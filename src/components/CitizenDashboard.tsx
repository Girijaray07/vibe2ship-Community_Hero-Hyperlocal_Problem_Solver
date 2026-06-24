"use client";

import { useEffect, useState } from "react";
import { db, auth } from "../lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Award, CheckCircle2, AlertTriangle, Clock, RefreshCw, Key } from "lucide-react";

interface UserProfile {
  uid: string;
  displayName: string;
  reputation_points: number;
  badges: string[];
  role: string;
}

interface Issue {
  id: string;
  category: string;
  severity: number;
  status: string;
  votes: number;
  description?: string;
  ai_description?: string;
  image_url?: string;
}

export default function CitizenDashboard() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myIssues, setMyIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Listen to Auth & Fetch Profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        // Fetch profile
        const userRef = query(collection(db, "users"), where("uid", "==", user.uid));
        const unsubProfile = onSnapshot(userRef, (snapshot) => {
          if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            setProfile({
              uid: snapshot.docs[0].id,
              displayName: data.displayName || "Anonymous Hero",
              reputation_points: data.reputation_points || 0,
              badges: data.badges || [],
              role: data.role || "citizen"
            });
          }
        });

        // Fetch user's own reports
        const qIssues = query(collection(db, "issues"), where("reporter_id", "==", user.uid));
        const unsubIssues = onSnapshot(qIssues, (snapshot) => {
          const list: Issue[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              category: data.category || "unknown",
              severity: data.severity || 1,
              status: data.status || "reported",
              votes: data.votes || 0,
              description: data.description || "",
              ai_description: data.ai_description || "",
              image_url: data.image_url || ""
            });
          });
          setMyIssues(list);
          setIsLoading(false);
        });

        return () => {
          unsubProfile();
          unsubIssues();
        };
      } else {
        setProfile(null);
        setMyIssues([]);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
        Loading your dashboard...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center glass-panel rounded-2xl border border-slate-800 flex flex-col items-center gap-4">
        <Key className="w-10 h-10 text-indigo-400 mb-2" />
        <h3 className="text-xl font-bold text-white">Dashboard Restricted</h3>
        <p className="text-xs text-slate-400">
          You must log in to view your points balance, track submitted issues, and review earned badges.
        </p>
      </div>
    );
  }

  const points = profile?.reputation_points || 0;
  const level = Math.floor(points / 50) + 1;
  const nextLevelThreshold = level * 50;
  const prevLevelThreshold = (level - 1) * 50;
  const progressPercent = Math.min(100, ((points - prevLevelThreshold) / 50) * 100);

  // Available badges metadata
  const badgesMetadata = [
    { name: "Eco Starter", desc: "Awarded upon joining the platform.", icon: "🌱", unlocked: points >= 0 },
    { name: "First Reporter", desc: "Submitted your first community issue report.", icon: "📸", unlocked: myIssues.length >= 1 },
    { name: "Pothole Patrol", desc: "Reported 3 or more pothole reports.", icon: "🛣️", unlocked: myIssues.filter(x => x.category === "pothole").length >= 3 },
    { name: "Light Saver", desc: "Helped fix streetlights by reporting broken bulbs.", icon: "💡", unlocked: myIssues.filter(x => x.category === "broken streetlight").length >= 2 },
    { name: "Community Hero", desc: "Achieved a reputation score above 100 points.", icon: "👑", unlocked: points >= 100 }
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 pb-12 grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Left Column: Reputation Meter & Badges */}
      <div className="md:col-span-1 flex flex-col gap-6">
        {/* Profile Card */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4 bg-gradient-to-tr from-indigo-900/5 to-indigo-950/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/25 flex items-center justify-center text-indigo-400 font-extrabold text-lg">
              {profile?.displayName ? profile.displayName.charAt(0).toUpperCase() : "U"}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{profile?.displayName}</h3>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Citizen Level {level}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-400">Level Progress</span>
              <span className="text-indigo-400">{points} / {nextLevelThreshold} pts</span>
            </div>
            <div className="w-full h-2.5 bg-slate-950/60 rounded-full overflow-hidden border border-slate-800">
              <div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="text-[10px] text-slate-500 italic mt-0.5">Earn {nextLevelThreshold - points} more points to reach Level {level + 1}!</span>
          </div>
        </div>

        {/* Badges Inventory */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            My Reward Badges
          </h3>
          <p className="text-xs text-slate-400">Earn badges through civic actions to showcase on the leaderboard.</p>

          <div className="flex flex-col gap-3 mt-2">
            {badgesMetadata.map((badge, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                  badge.unlocked
                    ? "bg-slate-900/40 border-indigo-500/20 text-slate-100"
                    : "bg-slate-950/20 border-slate-800/40 text-slate-500 opacity-60"
                }`}
              >
                <span className={`text-xl p-2 rounded-lg ${badge.unlocked ? "bg-indigo-600/10 badge-glow" : "bg-slate-900"}`}>
                  {badge.icon}
                </span>
                <div>
                  <h4 className="text-xs font-bold">{badge.name}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">{badge.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Columns: My Filed Reports */}
      <div className="md:col-span-2 flex flex-col gap-6">
        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4 min-h-[400px]">
          <h3 className="text-base font-bold text-white">My Submitted Reports ({myIssues.length})</h3>
          <p className="text-xs text-slate-400">Track the resolution lifecycle of issues you reported.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            {myIssues.length > 0 ? (
              myIssues.map((issue) => (
                <div key={issue.id} className="glass-card p-4 rounded-xl flex flex-col gap-3">
                  {/* Photo preview (custom canvas or fallback placeholder image url) */}
                  <div className="w-full h-28 rounded-lg overflow-hidden relative bg-slate-950 border border-slate-800 flex items-center justify-center">
                    {issue.image_url ? (
                      <img src={issue.image_url} alt={issue.category} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-slate-500">No Image Uploaded</span>
                    )}
                    <span className="absolute top-2 right-2 text-[9px] font-black px-1.5 py-0.5 rounded bg-red-500 text-white">
                      Sev: {issue.severity}/10
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-black capitalize text-slate-200">{issue.category.replace("_", " ")}</h4>
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                      {issue.ai_description || issue.description || "No description."}
                    </p>
                  </div>

                  <div className="flex justify-between items-center mt-1 border-t border-slate-800/60 pt-2 text-[10px]">
                    <span className="text-slate-500 font-semibold flex items-center gap-1">
                      👍 {issue.votes} Votes
                    </span>
                    <span className={`px-2 py-0.5 rounded uppercase font-bold tracking-wider ${
                      issue.status === "resolved" ? "bg-emerald-500/10 text-emerald-400" :
                      issue.status === "in-progress" ? "bg-amber-500/10 text-amber-400" :
                      issue.status === "duplicate" ? "bg-slate-500/10 text-slate-400" : "bg-indigo-500/10 text-indigo-400"
                    }`}>
                      {issue.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 text-center py-20 text-xs text-slate-500 italic flex flex-col items-center gap-2">
                <Clock className="w-8 h-8 text-slate-600 animate-pulse" />
                You haven't reported any infrastructure issues yet. Click "Report Issue" to start!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
