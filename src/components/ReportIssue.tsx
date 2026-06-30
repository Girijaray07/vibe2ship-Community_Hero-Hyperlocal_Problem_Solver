"use client";

import { useState, useEffect } from "react";
import { db, storage, auth } from "../lib/firebase";
import { collection, doc, setDoc, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { GeoPoint, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Camera, MapPin, Sparkles, Check, AlertCircle, RefreshCw, Eye } from "lucide-react";
import dynamic from "next/dynamic";

// Dynamically import MapComponent to avoid SSR errors
const MapComponent = dynamic(() => import("./MapComponent"), { ssr: false });

interface StarProps {
  index: number;
}
function FloatingStar({ index }: StarProps) {
  const angle = (index * 360) / 16 + Math.random() * 15;
  const distance = 80 + Math.random() * 120;
  const x = Math.cos((angle * Math.PI) / 180) * distance;
  const y = Math.sin((angle * Math.PI) / 180) * distance;
  const scale = 0.5 + Math.random() * 0.8;
  const rotate = 45 + Math.random() * 180;
  const delay = Math.random() * 0.3;

  return (
    <svg
      className="absolute w-5 h-5 text-yellow-450 fill-current pointer-events-none"
      style={{
        left: "50%",
        top: "50%",
        "--tw-x": `${x}px`,
        "--tw-y": `${y}px`,
        "--tw-scale": scale,
        "--tw-rotate": `${rotate}deg`,
        animation: `floatStar 2s cubic-bezier(0.25, 1, 0.5, 1) ${delay}s forwards`,
      } as React.CSSProperties}
      viewBox="0 0 24 24"
    >
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );
}

export default function ReportIssue() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [step, setStep] = useState(1);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiReportId, setAiReportId] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [showPointsAnimation, setShowPointsAnimation] = useState(false);
  const [submittingStatus, setSubmittingStatus] = useState("Uploading payload...");

  const playChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);
        
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.25, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };

      const now = ctx.currentTime;
      playTone(261.63, now, 1.2);       // C4
      playTone(329.63, now + 0.08, 1.2); // E4
      playTone(392.00, now + 0.16, 1.2); // G4
      playTone(493.88, now + 0.24, 1.5); // B4
      playTone(587.33, now + 0.32, 1.8); // D5
    } catch (err) {
      console.error("Audio Context failed to start:", err);
    }
  };

  useEffect(() => {
    if (showPointsAnimation) {
      const timer = setTimeout(() => {
        setShowPointsAnimation(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [showPointsAnimation]);

  useEffect(() => {
    if (isSubmitting) {
      const messages = [
        "Uploading report payload...",
        "Calling Gemini Vision AI models...",
        "Identifying defect category...",
        "Evaluating severity parameters...",
        "Comparing duplicates in 100m radius...",
        "Finalizing transaction details..."
      ];
      let idx = 0;
      setSubmittingStatus(messages[0]);
      const interval = setInterval(() => {
        idx = (idx + 1) % messages.length;
        setSubmittingStatus(messages[idx]);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isSubmitting]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Real-time listener for the created issue to get AI responses
  useEffect(() => {
    if (!aiReportId) return;

    const unsub = onSnapshot(doc(db, "issues", aiReportId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // If the status is no longer "reported", it means the backend function finished processing it
        if (data.status !== "reported" && data.ai_analysis) {
          setAiResult(data);
          setIsSubmitting(false);
          setStep(4); // Move to AI review success step

          // Trigger points animation and chime!
          if (data.status === "verified") {
            setShowPointsAnimation(true);
            playChime();
          }
        } else if (data.status === "reported" && data.error_message) {
          alert("AI Analysis failed: " + data.error_message);
          setIsSubmitting(false);
        }
      }
    });

    return () => unsub();
  }, [aiReportId]);

  // Generate simulated image using canvas for easy testing
  const handleSimulatePhoto = (type: "pothole" | "garbage" | "leakage") => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background (Asphalt road)
    ctx.fillStyle = "#334155";
    ctx.fillRect(0, 0, 400, 300);

    if (type === "pothole") {
      // Draw road lane lines
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 4;
      ctx.setLineDash([15, 15]);
      ctx.beginPath();
      ctx.moveTo(200, 0);
      ctx.lineTo(200, 300);
      ctx.stroke();

      // Pothole hole
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(200, 150, 45, 0, Math.PI * 2);
      ctx.fill();

      // Cracks
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(155, 150);
      ctx.lineTo(120, 140);
      ctx.moveTo(245, 150);
      ctx.lineTo(280, 170);
      ctx.moveTo(200, 105);
      ctx.lineTo(190, 70);
      ctx.stroke();

      // Write simulated text
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px sans-serif";
      ctx.fillText("[Simulated Road Pothole Model]", 10, 20);
    } else if (type === "garbage") {
      // Draw floor sidewalk
      ctx.fillStyle = "#475569";
      ctx.fillRect(0, 200, 400, 100);

      // Draw bags of trash
      ctx.fillStyle = "#1e293b"; // Black trash bag 1
      ctx.beginPath();
      ctx.arc(160, 200, 30, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#0f172a"; // Black trash bag 2
      ctx.beginPath();
      ctx.arc(210, 210, 25, 0, Math.PI * 2);
      ctx.fill();

      // Scattered waste elements
      ctx.fillStyle = "#ef4444"; // red can
      ctx.fillRect(250, 230, 10, 20);

      ctx.fillStyle = "#f59e0b"; // yellow cup
      ctx.beginPath();
      ctx.arc(110, 220, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "12px sans-serif";
      ctx.fillText("[Simulated Garbage Pile Model]", 10, 20);
    } else {
      // Water leakage
      ctx.fillStyle = "#0284c7"; // puddle
      ctx.beginPath();
      ctx.ellipse(200, 150, 80, 40, 0, 0, Math.PI * 2);
      ctx.fill();

      // pipe
      ctx.fillStyle = "#64748b";
      ctx.fillRect(190, 0, 20, 120);

      ctx.fillStyle = "#ffffff";
      ctx.font = "12px sans-serif";
      ctx.fillText("[Simulated Water Main Pipe Leak]", 10, 20);
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `simulated_${type}.jpg`, { type: "image/jpeg" });
        setImageFile(file);
        setImagePreview(canvas.toDataURL("image/jpeg"));
        setDescription(`Simulated ${type} reported in the neighborhood for platform verification.`);
        setStep(2); // advance to Map location selection
      }
    }, "image/jpeg");
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setStep(2); // Go to map location
    }
  };

  const handleLocationSelected = (selectedLat: number, selectedLng: number) => {
    setLat(selectedLat);
    setLng(selectedLng);
  };

  const handleSubmitReport = async () => {
    if (!currentUser) {
      alert("Please login first to submit a report.");
      return;
    }
    if (!imageFile || lat === null || lng === null) {
      alert("Please upload a photo and drop a location pin.");
      return;
    }

    setIsSubmitting(true);
    try {
      const issueId = "issue_" + Math.random().toString(36).substring(2, 15);
      const storagePath = `issues/${issueId}_${imageFile.name}`;
      const imageRef = ref(storage, storagePath);

      // 1. Upload file to Firebase Storage
      await uploadBytes(imageRef, imageFile);
      const downloadURL = await getDownloadURL(imageRef);

      // 2. Write document to Firestore with status 'reported'
      const newIssueDoc = {
        id: issueId,
        reporter_id: currentUser.uid,
        description: description,
        image_url: downloadURL,
        storage_path: storagePath,
        location: new GeoPoint(lat, lng),
        status: "reported",
        votes: 0,
        created_at: serverTimestamp()
      };

      await setDoc(doc(db, "issues", issueId), newIssueDoc);
      setAiReportId(issueId); // triggers Firestore listener to track status
    } catch (err: any) {
      console.error(err);
      alert("Submission failed: " + err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 pb-12 flex flex-col gap-6">
      {/* Step Indicators */}
      <div className="flex items-center justify-between bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
        {[
          { number: 1, label: "Upload Image" },
          { number: 2, label: "Pin Geolocation" },
          { number: 3, label: "Review & Submit" },
          { number: 4, label: "AI Verification" }
        ].map((s) => (
          <div key={s.number} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= s.number ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-500 border border-slate-700/50"
            }`}>
              {step > s.number ? <Check className="w-4.5 h-4.5" /> : s.number}
            </div>
            <span className={`text-xs font-bold hidden sm:inline ${step >= s.number ? "text-slate-200" : "text-slate-500"}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Wizard Sheets */}
      <div className="glass-panel p-6 rounded-2xl min-h-[400px] flex flex-col justify-between">
        
        {/* STEP 1: Upload Photo */}
        {step === 1 && (
          <div className="flex flex-col items-center justify-center py-8 gap-6">
            <div className="text-center max-w-sm flex flex-col gap-2">
              <h3 className="text-lg font-bold text-white">Capture or Upload Photo</h3>
              <p className="text-xs text-slate-400">
                Provide a clear photo of the local issue (pothole, trash dump, leaking pipe, etc.).
              </p>
            </div>

            {/* Custom File Upload Box */}
            <label className="w-full max-w-md h-48 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl flex flex-col items-center justify-center cursor-pointer bg-slate-950/20 hover:bg-slate-900/10 transition-all gap-3">
              <Camera className="w-10 h-10 text-indigo-400" />
              <span className="text-xs font-semibold text-slate-300">Select Image File</span>
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>

            {/* Preset simulator buttons */}
            <div className="flex flex-col items-center gap-3 w-full max-w-md border-t border-slate-850 pt-4">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Or Use Simulated Photo (Fast Test)</span>
              <div className="grid grid-cols-3 gap-2 w-full">
                <button
                  onClick={() => handleSimulatePhoto("pothole")}
                  className="py-2.5 px-2 rounded-xl bg-slate-900 hover:bg-indigo-650/10 border border-slate-800 text-[10px] font-bold text-slate-300 transition-all cursor-pointer"
                >
                  🛣️ Pothole
                </button>
                <button
                  onClick={() => handleSimulatePhoto("garbage")}
                  className="py-2.5 px-2 rounded-xl bg-slate-900 hover:bg-indigo-650/10 border border-slate-800 text-[10px] font-bold text-slate-300 transition-all cursor-pointer"
                >
                  🗑️ Garbage Pile
                </button>
                <button
                  onClick={() => handleSimulatePhoto("leakage")}
                  className="py-2.5 px-2 rounded-xl bg-slate-900 hover:bg-indigo-650/10 border border-slate-800 text-[10px] font-bold text-slate-300 transition-all cursor-pointer"
                >
                  💦 Water Leak
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Geolocation Drop Pin */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-400" />
                Specify Location of Issue
              </h3>
              <p className="text-xs text-slate-400">Click on the interactive map to pin the coordinates of the issue.</p>
            </div>

            <div className="w-full h-80 rounded-xl overflow-hidden border border-slate-800">
              <MapComponent
                user={currentUser}
                isReporting={true}
                onLocationSelected={handleLocationSelected}
                selectedLocation={lat !== null && lng !== null ? { lat, lng } : null}
              />
            </div>

            <div className="flex justify-between items-center mt-4">
              <button
                onClick={() => setStep(1)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 text-xs font-bold text-slate-300 cursor-pointer"
              >
                Back
              </button>
              <button
                disabled={lat === null || lng === null}
                onClick={() => setStep(3)}
                className="px-5 py-2.5 rounded-xl glow-btn text-white text-xs font-bold disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Review & Submit */}
        {step === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
            {/* Left Col: Photo + Location stats */}
            <div className="flex flex-col gap-4">
              <h3 className="text-base font-bold text-white">Review Report Parameters</h3>
              
              {imagePreview && (
                <div className="w-full h-44 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 relative">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-850 flex flex-col gap-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Latitude:</span>
                  <span className="font-semibold text-slate-200">{lat?.toFixed(5)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Longitude:</span>
                  <span className="font-semibold text-slate-200">{lng?.toFixed(5)}</span>
                </div>
              </div>
            </div>

            {/* Right Col: Description Form */}
            <div className="flex flex-col justify-between gap-4">
              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold text-slate-400 uppercase">Write Reporter Description</label>
                <textarea
                  placeholder="Describe the issue in your own words..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-32 p-4 rounded-xl glass-input text-xs resize-none"
                />
              </div>

              {isSubmitting ? (
                <div className="flex flex-col items-center justify-center p-6 bg-indigo-950/20 border border-indigo-500/20 rounded-xl gap-3 w-full">
                  <RefreshCw className="w-7 h-7 text-indigo-400 animate-spin" />
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 animate-pulse">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    Gemini AI Vision verifying photo...
                  </span>
                  <span className="text-[10px] text-indigo-400/80 font-mono text-center animate-pulse">{submittingStatus}</span>
                </div>
              ) : (
                <div className="flex gap-3 justify-end mt-4">
                  <button
                    onClick={() => setStep(2)}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmitReport}
                    className="px-5 py-2.5 rounded-xl glow-btn text-white text-xs font-bold cursor-pointer"
                  >
                    Submit & Verify
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: AI Review Success */}
        {step === 4 && aiResult && (
          <div className="flex flex-col items-center py-6 gap-6 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Check className="w-6 h-6" />
            </div>

            <div className="text-center flex flex-col gap-2">
              <h3 className="text-lg font-bold text-white">AI Analysis Complete!</h3>
              <p className="text-xs text-slate-400">Gemini 1.5 Flash has successfully classified your upload.</p>
            </div>

            <div className="w-full p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col gap-3.5 text-xs text-slate-300">
              <div className="flex justify-between items-center">
                <span>Classified Category:</span>
                <span className="font-extrabold capitalize text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                  {aiResult.category}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Assessed Severity Score:</span>
                <span className="font-extrabold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                  {aiResult.severity}/10
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Duplicate Status Check:</span>
                <span className={`font-extrabold uppercase px-2 py-0.5 rounded ${
                  aiResult.status === "duplicate" ? "bg-slate-500/20 text-slate-400" : "bg-emerald-500/10 text-emerald-400"
                }`}>
                  {aiResult.status === "duplicate" ? "Duplicate Detected (Linked)" : "Verified Unique"}
                </span>
              </div>
              <div className="border-t border-slate-800/60 pt-3">
                <span className="block text-slate-400 font-semibold mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Gemini Generated AI Description:
                </span>
                <p className="text-[11px] leading-relaxed text-slate-300 italic">
                  "{aiResult.ai_description}"
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setStep(1);
                  setImageFile(null);
                  setImagePreview(null);
                  setDescription("");
                  setLat(null);
                  setLng(null);
                  setAiReportId(null);
                  setAiResult(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 text-xs font-bold text-slate-300 cursor-pointer"
              >
                File Another Report
              </button>
            </div>
          </div>
        )}
      {showPointsAnimation && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center pointer-events-none bg-slate-950/25 backdrop-blur-[2px]">
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes slideUpCenter {
              0% {
                transform: translateY(100vh) scale(0.7);
                opacity: 0;
              }
              60% {
                transform: translateY(-10px) scale(1.05);
                opacity: 1;
              }
              100% {
                transform: translateY(0) scale(1);
                opacity: 1;
              }
            }
            @keyframes floatStar {
              0% {
                transform: translate(0, 0) scale(0) rotate(0deg);
                opacity: 0;
              }
              20% {
                opacity: 1;
              }
              100% {
                transform: translate(var(--tw-x), var(--tw-y)) scale(var(--tw-scale)) rotate(var(--tw-rotate));
                opacity: 0;
              }
            }
            @keyframes pulseGold {
              0%, 100% {
                text-shadow: 0 0 15px rgba(250, 204, 21, 0.6), 0 0 30px rgba(250, 204, 21, 0.3);
                transform: scale(1);
              }
              50% {
                text-shadow: 0 0 30px rgba(250, 204, 21, 1), 0 0 50px rgba(250, 204, 21, 0.6), 0 0 70px rgba(250, 204, 21, 0.4);
                transform: scale(1.03);
              }
            }
            .animate-slide-up-center {
              animation: slideUpCenter 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            }
            .animate-pulse-gold {
              animation: pulseGold 2s infinite ease-in-out;
            }
          `}} />

          <div 
            className="pointer-events-auto bg-slate-900/95 border border-yellow-500/40 rounded-3xl p-8 shadow-[0_0_60px_rgba(250,204,21,0.3)] flex flex-col items-center gap-4 text-center max-w-sm w-full mx-4 animate-slide-up-center relative overflow-visible"
            style={{
              backdropFilter: "blur(16px)",
            }}
          >
            <div className="w-20 h-20 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400 relative">
              <Sparkles className="w-10 h-10 animate-spin" style={{ animationDuration: '6s' }} />
              {Array.from({ length: 16 }).map((_, i) => (
                <FloatingStar key={i} index={i} />
              ))}
            </div>

            <div className="flex flex-col gap-1 z-10">
              <span className="text-[10px] uppercase tracking-widest text-yellow-500 font-extrabold">Citizen Hero Bonus</span>
              <h2 className="text-4xl font-black text-yellow-400 animate-pulse-gold select-none">
                +10 PTS
              </h2>
              <p className="text-xs text-slate-300 font-semibold mt-2">
                Report Verified & Active!
              </p>
              <p className="text-[10px] text-slate-400 max-w-xs mt-1">
                Thank you for making your neighborhood a better place. Your civic reward has been credited.
              </p>
            </div>

            <button
              onClick={() => setShowPointsAnimation(false)}
              className="mt-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-yellow-500/20 cursor-pointer pointer-events-auto"
            >
              Awesome!
            </button>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
