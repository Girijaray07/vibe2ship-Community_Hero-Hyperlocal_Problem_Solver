# CivicSense AI - Hyperlocal Community Hero Platform

**Mission:** To empower local communities with an AI-driven, transparent, and gamified infrastructure reporting platform that bridges the gap between citizens and municipal authorities using the Google Cloud and Gemini ecosystem.

---

## 🌟 Key Features

1. **Automated Issue Categorization via Gemini 1.5 Flash Vision**
   * Upload an image of an infrastructure failure (pothole, garbage, water leakage, broken streetlight, or road damage).
   * Gemini automatically assesses the issue type, evaluates the severity on a 1-10 scale, and generates a structured summary.
2. **Clustered Geolocation Mapping & Duplicate Detection**
   * High-fidelity, dark-themed interactive map powered by Leaflet and OpenStreetMap.
   * Auto-detects duplicate reports of the same category within ~100 meters. If a duplicate is found, it links the issues and increments votes on the parent issue instead of bloating the feed.
3. **Sleek Citizen Gamification Engine**
   * Track reputation points and level progression.
   * Unlock rewards and digital badges (e.g. *🌱 Eco Starter*, *📸 First Reporter*, *🛣️ Pothole Patrol*, *👑 Community Hero*).
4. **Gemini 1.5 Pro Predictive Hotspot Analytics**
   * Aggregates historical telemetry.
   * Forecasts the top 3 high-likelihood infrastructure decay areas for the next 30 days.
   * Compiles prioritized, actionable recommendations for municipal dispatch.
5. **Municipal Dispatch Console**
   * Unified interface for authority officials to change statuses (Reported -> Verified -> In Progress -> Resolved).
   * Visual indicator cards showing real-time statistics.

---

## 🏗️ System Architecture

```mermaid
graph TD
    Citizen["Citizen User"] -->|1. Uploads Photo & Drops Pin| Frontend["Next.js App (Tailwind CSS)"]
    Frontend -->|2. Image Upload| Storage["Firebase Storage"]
    Frontend -->|3. Save Issue Document (Status: reported)| Firestore["Cloud Firestore"]
    
    Firestore -->|4. onDocumentCreated Trigger| CloudFunc["Firebase Cloud Functions (Node.js)"]
    CloudFunc -->|5. Read Image Buffer| Storage
    CloudFunc -->|6. Call Gemini 1.5 Flash (Vision)| GeminiAPI["Google AI Studio (Gemini 1.5 Flash)"]
    
    GeminiAPI -->|7. Return JSON Schema| CloudFunc
    CloudFunc -->|8. Duplicates Lookup (~100m)| Firestore
    CloudFunc -->|9. Update Issue Details & Award Rep Points| Firestore
    
    Authority["Municipal Authority"] -->|10. View Dispatch Console| Frontend
    Frontend -->|11. Call getPredictiveAnalytics| CloudFunc
    CloudFunc -->|12. Fetch Historical Telemetry| Firestore
    CloudFunc -->|13. Call Gemini 1.5 Pro (Reasoning)| GeminiAPI
    GeminiAPI -->|14. Return Forecast & Recommendations| CloudFunc
    CloudFunc -->|15. Display Premium Forecast Report| Frontend
```

---

## ✍️ Gemini Prompt Gallery

### 1. Gemini 1.5 Flash - Issue Analysis (Vision)
**Prompt Structure:**
```text
Analyze this infrastructure image. Identify if it contains: pothole, garbage, water leakage, broken streetlight, or road damage.
Provide a severity score from 1-10 (where 10 is extremely hazardous) and a brief description.
You MUST output your response in JSON format matching this schema exactly:
{
  "category": "pothole" | "garbage" | "water leakage" | "broken streetlight" | "road damage" | "unknown",
  "severity": number,
  "description": string
}
```

### 2. Gemini 1.5 Pro - Predictive Analytics (Reasoning)
**Prompt Structure:**
```text
Given the following historical infrastructure issue data:
[JSON_ARRAY_OF_ISSUES]

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
}
```

---

## 🔒 Firebase Security Rules

### Firestore Rules (`firestore.rules`)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /issues/{issueId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null;
    }
    match /votes/{voteId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### Storage Rules (`storage.rules`)
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

## ⚙️ Local Development & Validation Guide

### Prerequisites
* **Node.js**: v20 or v22
* **Firebase CLI**: Installed globally or via `npx` (which our scripts do automatically)
* **Gemini API Key**: Set up an API key at [Google AI Studio](https://aistudio.google.com/)

### Step 1: Clone & Install Dependencies
1. Navigate to the project root directory.
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Install backend Cloud Functions dependencies:
   ```bash
   cd functions && npm install && cd ..
   ```

### Step 2: Configure Environment Keys
Create a `.env` file in the `functions/` folder or set the environment variable in your shell:
```bash
export GEMINI_API_KEY="your-google-ai-studio-api-key"
```

### Step 3: Run the Firebase Emulator Suite
Start the local emulators to test Auth, Firestore, Storage, and Cloud Functions locally:
```bash
npx -y firebase-tools@latest emulators:start
```
*The Firebase Emulator UI will be accessible at [http://127.0.0.1:4000](http://127.0.0.1:4000).*

### Step 4: Run the Next.js Frontend
Open a new terminal session and run the Next.js development server:
```bash
npm run dev
```
*Access the client web dashboard at [http://localhost:3000](http://localhost:3000).*

### Step 5: Validate the Core Flows
1. **Registration & Auth**: Open the page and click "Get Started". Select **Citizen Reporter** and sign up to verify user creation in the Emulator's Firestore database.
2. **Issue Filing Flow**: Click "Report Issue". Choose a simulated photo preset (Pothole, Garbage, or Water Leak), click a location coordinates spot on the map, write a description, and submit.
3. **AI Vision Verification**: Watch the live verification progress. Within seconds, the Cloud Function will download the file, send it to Gemini 1.5 Flash, perform duplicate check, update the database document, and show you the parsed categories and severity score!
4. **Predictive Analytics**: Register a second account as **Municipal Authority** or log out and log back in as one. Switch to the **Municipal Dashboard**, navigate to the **Predictive Analytics** tab, click "Compile Analytics Report", and watch Gemini 1.5 Pro analyze your neighborhood's data in real time!
