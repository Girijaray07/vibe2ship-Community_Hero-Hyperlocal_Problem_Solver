const { onRequest, onCall } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();
const db = admin.firestore();

// Retrieve Gemini API Key from environment or Firebase config
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Helper to convert image buffer to generative part
function bufferToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType
    },
  };
}

// 1. Cloud Function to analyze uploaded issues using Gemini 1.5 Flash
exports.analyzeIssue = onDocumentCreated("issues/{issueId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return null;
  const issueData = snapshot.data();
  const issueId = event.params.issueId;

  // Process only if status is initially "reported"
  if (issueData.status !== "reported") return null;

  try {
    const storagePath = issueData.storage_path;
    if (!storagePath) {
      console.error("No storage path provided for issue", issueId);
      return null;
    }

    // Download image from Firebase Storage (dynamically parse bucket to avoid emulator config mismatches)
    let bucketName = "civicsense-ai-91b4.appspot.com"; // default fallback
    if (issueData.image_url) {
      const match = issueData.image_url.match(/\/b\/([^/]+)/);
      if (match && match[1]) {
        bucketName = match[1];
      }
    }

    const bucket = admin.storage().bucket(bucketName);
    const file = bucket.file(storagePath);
    const [fileBuffer] = await file.download();

    const mimeType = file.metadata.contentType || "image/jpeg";
    const imagePart = bufferToGenerativePart(fileBuffer, mimeType);

    // Call Gemini 1.5 Flash with prompt
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Analyze this infrastructure image. Identify if it contains: pothole, garbage, water leakage, broken streetlight, or road damage.
Provide a severity score from 1-10 (where 10 is extremely hazardous) and a brief description.
You MUST output your response in JSON format matching this schema exactly:
{
  "category": "pothole" | "garbage" | "water leakage" | "broken streetlight" | "road damage" | "unknown",
  "severity": number,
  "description": string
}`;

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    
    // Clean markdown wraps
    const cleanJSONText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    const analysis = JSON.parse(cleanJSONText);

    console.log("AI analysis results for issue", issueId, ":", analysis);

    // Geolocation clustering for duplicate detection (~100m)
    const currentLoc = issueData.location;
    let isDuplicate = false;
    let parentIssueId = null;

    if (currentLoc && analysis.category !== "unknown") {
      const latMin = currentLoc.latitude - 0.001;
      const latMax = currentLoc.latitude + 0.001;
      const lngMin = currentLoc.longitude - 0.001;
      const lngMax = currentLoc.longitude + 0.001;

      // Fetch existing unresolved issues of the same category
      const duplicateQuery = await db.collection("issues")
        .where("category", "==", analysis.category)
        .where("status", "in", ["reported", "verified", "in-progress"])
        .get();

      for (const doc of duplicateQuery.docs) {
        if (doc.id === issueId) continue;
        const data = doc.data();
        if (data.location &&
            data.location.latitude >= latMin && data.location.latitude <= latMax &&
            data.location.longitude >= lngMin && data.location.longitude <= lngMax) {
          isDuplicate = true;
          parentIssueId = doc.id;
          break;
        }
      }
    }

    const updatedStatus = isDuplicate ? "duplicate" : (analysis.category === "unknown" ? "reported" : "verified");

    // Update in transaction to ensure consistency
    await db.runTransaction(async (transaction) => {
      // Update issue document
      transaction.update(db.collection("issues").doc(issueId), {
        category: analysis.category,
        severity: analysis.severity || 1,
        ai_description: analysis.description || "No description provided.",
        status: updatedStatus,
        parent_issue_id: parentIssueId,
        ai_analysis: {
          analyzed_at: FieldValue.serverTimestamp(),
          category: analysis.category,
          severity: analysis.severity
        }
      });

      // If duplicate, increase validation/vote count on the parent issue
      if (isDuplicate && parentIssueId) {
        transaction.update(db.collection("issues").doc(parentIssueId), {
          votes: FieldValue.increment(1)
        });
      }

      // Add reputation points to the citizen if report is verified
      const reporterId = issueData.reporter_id;
      if (reporterId && updatedStatus === "verified") {
        const userRef = db.collection("users").doc(reporterId);
        transaction.set(userRef, {
          reputation_points: FieldValue.increment(10)
        }, { merge: true });
      }
    });

    console.log(`Finished processing issue ${issueId}. Status: ${updatedStatus}`);
  } catch (error) {
    console.error("Error running AI analysis for issue", issueId, error);
    await db.collection("issues").doc(issueId).update({
      status: "reported",
      error_message: error.message
    });
  }
});

// 2. Cloud Function to handle voting updates and reputation calculation
exports.onVoteCreated = onDocumentCreated("votes/{voteId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return null;
  const voteData = snapshot.data();
  const { issue_id, vote_type, user_id } = voteData;

  try {
    const increment = vote_type === "up" ? 1 : -1;
    const issueRef = db.collection("issues").doc(issue_id);

    await db.runTransaction(async (transaction) => {
      const issueDoc = await transaction.get(issueRef);
      if (!issueDoc.exists) return;
      const issue = issueDoc.data();

      // Update votes on issue
      transaction.update(issueRef, {
        votes: FieldValue.increment(increment)
      });

      // Update reputation points for the original reporter (+2 for upvote, -2 for downvote)
      const reporterId = issue.reporter_id;
      if (reporterId) {
        const userRef = db.collection("users").doc(reporterId);
        const points = vote_type === "up" ? 2 : -2;
        transaction.set(userRef, {
          reputation_points: FieldValue.increment(points)
        }, { merge: true });
      }
    });
  } catch (error) {
    console.error("Error updating vote for voteId", event.params.voteId, error);
  }
});

// 3. Cloud Function to execute predictive analytics using Gemini 1.5 Pro
exports.getPredictiveAnalytics = onCall(async (request) => {
  // Ensure authentication
  if (!request.auth) {
    throw new Error("unauthenticated");
  }

  try {
    const issuesSnapshot = await db.collection("issues").limit(100).get();
    const issues = [];
    issuesSnapshot.forEach((doc) => {
      const data = doc.data();
      issues.push({
        id: doc.id,
        category: data.category,
        severity: data.severity,
        status: data.status,
        votes: data.votes || 0,
        lat: data.location ? data.location.latitude : null,
        lng: data.location ? data.location.longitude : null,
        created_at: data.created_at ? data.created_at.toDate().toISOString() : null
      });
    });

    const issuesDataStr = JSON.stringify(issues);

    const prompt = `Given the following historical infrastructure issue data:
${issuesDataStr}

Predict the top 3 areas (defined by coordinate boundaries or clusters) likely to experience infrastructure failure in the next 30 days. Provide detailed reasoning for each prediction.
Also, aggregate the current data and give a summary of the most common issue categories, their average severities, and the estimated impact score of resolving these issues.
Format your response as a valid JSON object matching this schema exactly:
{
  "summary": {
    "total_issues": number,
    "top_category": string,
    "average_severity": number
  },
  "predictions": [
    {
      "area_name": string,
      "coordinates": { "lat": number, "lng": number },
      "likelihood": "high" | "medium" | "low",
      "reasoning": string,
      "category_predicted": string
    }
  ],
  "recommendations": [
    {
      "title": string,
      "description": string,
      "priority": "high" | "medium" | "low"
    }
  ]
}`;

    // Gracefully handle model access restrictions by adding a fallback path to Gemini 1.5 Flash
    let model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    let result;
    try {
      result = await model.generateContent(prompt);
    } catch (apiError) {
      console.warn("Gemini 1.5 Pro failed, falling back to 1.5 Flash:", apiError);
      model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      result = await model.generateContent(prompt);
    }

    const responseText = result.response.text();
    const cleanJSONText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return JSON.parse(cleanJSONText);
  } catch (error) {
    console.error("Error executing predictive analytics", error);
    throw new Error("Internal analytics error: " + error.message);
  }
});
