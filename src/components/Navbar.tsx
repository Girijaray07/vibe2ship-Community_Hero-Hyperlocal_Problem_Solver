"use client";

import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { Shield, Award, LogOut, Key, User, Zap, Activity } from "lucide-react";

interface NavbarProps {
  onTabChange: (tab: string) => void;
  activeTab: string;
}

export default function Navbar({ onTabChange, activeTab }: NavbarProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("citizen");
  const [displayName, setDisplayName] = useState("");

  // 1. Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        // Listen to User Profile Data in Firestore
        const userRef = doc(db, "users", user.uid);
        const unsubProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          } else {
            // Profile doesn't exist, create it (fallback)
            const initialProfile = {
              uid: user.uid,
              displayName: user.displayName || displayName || "Citizen Hero",
              reputation_points: 0,
              badges: [],
              role: role
            };
            setDoc(userRef, initialProfile);
            setUserData(initialProfile);
          }
        });
        return () => unsubProfile();
      } else {
        setUserData(null);
      }
    });

    return () => unsubscribe();
  }, [displayName, role]);

  // 2. Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setIsAuthModalOpen(false);
      resetForm();
    } catch (error: any) {
      alert("Login failed: " + error.message);
    }
  };

  // 3. Handle Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const userRef = doc(db, "users", userCred.user.uid);
      await setDoc(userRef, {
        uid: userCred.user.uid,
        displayName: displayName || "Citizen Hero",
        reputation_points: 10, // Starting bonus
        badges: ["Eco Starter"],
        role: role
      });
      setIsAuthModalOpen(false);
      resetForm();
    } catch (error: any) {
      alert("Registration failed: " + error.message);
    }
  };

  // 4. Handle Logout
  const handleLogout = async () => {
    await signOut(auth);
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setDisplayName("");
    setRole("citizen");
  };

  // Determine user level based on points
  const points = userData?.reputation_points || 0;
  const level = Math.floor(points / 50) + 1;
  const nextLevelPoints = level * 50;
  const progressPercent = Math.min(100, (points % 50) / 50 * 100);

  return (
    <nav className="sticky top-0 z-[2000] w-full px-6 py-4 glass-panel border-b border-slate-800/80 mb-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onTabChange("impact")}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
              CivicSense AI
            </h1>
            <p className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">Hyperlocal Hero Platform</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center flex-wrap gap-1 bg-slate-950/40 p-1.5 rounded-xl border border-slate-800/50">
          {[
            { id: "impact", label: "Impact" },
            { id: "map", label: "Interactive Map" },
            { id: "leaderboard", label: "Leaderboard" },
            ...(userData?.role === "citizen" || !userData ? [{ id: "report", label: "Report Issue" }, { id: "citizen", label: "Citizen Panel" }] : []),
            ...(userData?.role === "authority" ? [{ id: "municipal", label: "Municipal Dashboard" }] : []),
            ...(userData ? [{ id: "profile", label: "My Profile" }] : [])
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Auth / Profile Panel */}
        <div className="flex items-center gap-3">
          {userData ? (
            <div className="flex items-center gap-4 bg-slate-900/40 border border-slate-800/80 px-4 py-2 rounded-xl">
              {/* User Profile Summary */}
              <div className="text-right hidden sm:block">
                <div className="flex items-center gap-1.5 justify-end">
                  {userData.role === "authority" && <Shield className="w-3.5 h-3.5 text-blue-400" />}
                  <span className="text-sm font-bold text-slate-100">{userData.displayName}</span>
                </div>
                <div className="flex items-center gap-1.5 justify-end text-xs text-slate-400 mt-0.5">
                  <Award className="w-3.5 h-3.5 text-yellow-500" />
                  <span>Level {level} Citizen</span>
                  <span className="text-indigo-400 font-semibold">• {points} Pts</span>
                </div>
              </div>

              {/* Progress and badges */}
              <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden md:block">
                <div className="h-full bg-indigo-500" style={{ width: `${progressPercent}%` }} />
              </div>

              <div className="flex gap-1">
                {userData.badges?.slice(0, 2).map((badge: string, i: number) => (
                  <span
                    key={i}
                    title={badge}
                    className="w-7 h-7 rounded-full bg-slate-800/80 border border-indigo-500/25 flex items-center justify-center text-[10px] font-bold text-indigo-400 uppercase badge-glow shadow shadow-indigo-500/10 cursor-pointer"
                  >
                    🏆
                  </span>
                ))}
              </div>

              <button
                onClick={handleLogout}
                className="p-2 rounded-lg bg-slate-950/60 hover:bg-red-500/10 hover:text-red-400 border border-slate-800 text-slate-400 transition-all cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-5 py-2.5 rounded-xl glow-btn text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <Key className="w-4 h-4" />
              Get Started
            </button>
          )}
        </div>
      </div>

      {/* Authentication Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md glass-panel p-8 rounded-2xl border border-slate-800 flex flex-col gap-6 relative">
            <button
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 text-lg cursor-pointer"
            >
              ✕
            </button>

            <div className="text-center">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {isRegistering ? "Join CivicSense AI" : "Welcome Back"}
              </h2>
              <p className="text-xs text-slate-400 mt-2">
                {isRegistering
                  ? "Empower your neighborhood and earn community rewards."
                  : "Access your dashboard and report local infrastructure issues."}
              </p>
            </div>

            <form onSubmit={isRegistering ? handleRegister : handleLogin} className="flex flex-col gap-4">
              {isRegistering && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="Jane Doe"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="jane@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-sm"
                />
              </div>

              {isRegistering && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase">Platform Role</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setRole("citizen")}
                      className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        role === "citizen"
                          ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow"
                          : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      Citizen Reporter
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole("authority")}
                      className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        role === "authority"
                          ? "bg-blue-600/20 border-blue-500 text-blue-300 shadow"
                          : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      Municipal Authority
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl glow-btn font-bold text-xs uppercase tracking-wider text-white mt-2 cursor-pointer"
              >
                {isRegistering ? "Create Free Account" : "Sign In Account"}
              </button>
            </form>

            <div className="text-center text-xs text-slate-400">
              {isRegistering ? "Already have an account?" : "New to CivicSense AI?"}{" "}
              <button
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-indigo-400 font-bold hover:underline cursor-pointer"
              >
                {isRegistering ? "Login Here" : "Register Here"}
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
