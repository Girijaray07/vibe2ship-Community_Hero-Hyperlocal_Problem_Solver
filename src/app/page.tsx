"use client";

import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import Navbar from "../components/Navbar";
import ImpactDashboard from "../components/ImpactDashboard";
import Leaderboard from "../components/Leaderboard";
import CitizenDashboard from "../components/CitizenDashboard";
import ReportIssue from "../components/ReportIssue";
import MunicipalDashboard from "../components/MunicipalDashboard";
import UserProfile from "../components/UserProfile";
import dynamic from "next/dynamic";
import { RefreshCw, Activity, Compass, AlertCircle } from "lucide-react";

// Dynamically import map with SSR disabled to avoid Node execution crashes
const MapComponent = dynamic(() => import("../components/MapComponent"), { ssr: false });

export default function Home() {
  const [activeTab, setActiveTab] = useState("impact");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Listen to Auth State
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);

      // Clean up previous profile listener if any
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (user) {
        // Listen to profile
        const userRef = doc(db, "users", user.uid);
        unsubProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setProfile(data);
            
            // Switch tabs if the user is an authority and on a citizen-only page
            if (data.role === "authority" && (activeTab === "report" || activeTab === "citizen")) {
              setActiveTab("municipal");
            }
          }
          setIsLoading(false);
        }, (error) => {
          console.error("Profile load error:", error);
          setIsLoading(false);
        });
      } else {
        setProfile(null);
        if (activeTab === "report" || activeTab === "citizen" || activeTab === "municipal") {
          setActiveTab("impact");
        }
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubProfile) {
        unsubProfile();
      }
    };
  }, [activeTab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#090d16] text-[#f8fafc]">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
        <span className="text-xs font-bold text-slate-400 tracking-wider">Syncing CivicSense AI...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#090d16] text-[#f8fafc]">
      {/* Navigation bar */}
      <Navbar onTabChange={handleTabChange} activeTab={activeTab} />

      {/* Main Tabs Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-0">
        {activeTab === "impact" && <ImpactDashboard />}
        {activeTab === "leaderboard" && <Leaderboard />}
        
        {/* Citizen Screens */}
        {activeTab === "report" && <ReportIssue />}
        {activeTab === "citizen" && <CitizenDashboard />}

        {/* Municipal Authority Screens */}
        {activeTab === "municipal" && <MunicipalDashboard />}

        {/* User Profile Screen */}
        {activeTab === "profile" && <UserProfile />}

        {/* Interactive map view (Full page width map dashboard) */}
        {activeTab === "map" && (
          <div className="px-6 pb-12 flex flex-col gap-4">
            <div className="flex justify-between items-center bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-indigo-400" />
                  Hyperlocal Infrastructure Grid
                </h3>
                <p className="text-[10px] text-slate-400">
                  Real-time issue telemetry and duplicate clustering. Click markers to upvote or check details.
                </p>
              </div>
              <div className="flex gap-4 items-center text-[10px] font-bold text-slate-400 bg-slate-950/60 py-1.5 px-3 rounded-lg border border-slate-850">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Reported
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Verified
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> In Progress
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Resolved
                </span>
              </div>
            </div>
            <div className="w-full h-[550px] rounded-xl overflow-hidden border border-slate-850">
              <MapComponent
                user={profile}
                isReporting={false}
                selectedLocation={null}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-slate-850/80 text-center text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-12 bg-slate-950/20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center px-6 gap-4">
          <span>© 2026 CivicSense AI. All Rights Reserved.</span>
          <span className="flex items-center gap-1.5 text-slate-400">
            Powered by Google Cloud, Firebase, and Gemini AI Studio
          </span>
        </div>
      </footer>
    </div>
  );
}
