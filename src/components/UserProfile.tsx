"use client";

import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { User, Mail, Shield, Award, Key, MapPin, Save, RefreshCw, Star } from "lucide-react";

export default function UserProfile() {
  const [user, setUser] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [defaultLat, setDefaultLat] = useState("");
  const [defaultLng, setDefaultLng] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        setUser(currentUser);
        setDisplayName(currentUser.displayName || "");
        
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfileData(data);
          if (data.defaultLocation) {
            setDefaultLat(data.defaultLocation.latitude?.toString() || "");
            setDefaultLng(data.defaultLocation.longitude?.toString() || "");
          }
        }
      }
    };

    fetchProfile();
  }, []);

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // 1. Update Firebase Auth displayName
      await updateProfile(user, { displayName });

      // 2. Prepare location geopoint if entered
      let locationObj = null;
      if (defaultLat !== "" && defaultLng !== "") {
        const latitude = parseFloat(defaultLat);
        const longitude = parseFloat(defaultLng);
        if (!isNaN(latitude) && !isNaN(longitude)) {
          locationObj = { latitude, longitude };
        }
      }

      // 3. Update Firestore profile document
      const userDocRef = doc(db, "users", user.uid);
      const updatePayload: any = { displayName };
      if (locationObj) {
        updatePayload.defaultLocation = locationObj;
      }
      
      await updateDoc(userDocRef, updatePayload);
      
      // Update local state
      setProfileData((prev: any) => ({
        ...prev,
        displayName,
        defaultLocation: locationObj || prev?.defaultLocation
      }));

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert("Failed to update profile: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center glass-panel rounded-2xl border border-slate-800 flex flex-col items-center gap-4">
        <Key className="w-10 h-10 text-indigo-400 mb-2" />
        <h3 className="text-xl font-bold text-white">Profile Restricted</h3>
        <p className="text-xs text-slate-400">
          You must log in to view and modify your account details.
        </p>
      </div>
    );
  }

  const level = Math.floor((profileData?.reputation_points || 0) / 50) + 1;

  return (
    <div className="max-w-3xl mx-auto px-6 pb-12 grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Profile Overview Sidebar */}
      <div className="md:col-span-1 flex flex-col gap-6">
        <div className="glass-panel p-6 rounded-2xl flex flex-col items-center text-center gap-4 bg-gradient-to-tr from-indigo-900/5 to-indigo-950/10">
          {/* Avatar circle */}
          <div className="w-20 h-20 rounded-2xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-3xl shadow-lg shadow-indigo-500/10">
            {displayName ? displayName.charAt(0).toUpperCase() : "U"}
          </div>

          <div>
            <h3 className="text-lg font-black text-white">{displayName || "Citizen Hero"}</h3>
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mt-0.5">
              Level {level} {profileData?.role === "authority" ? "Officer" : "Citizen"}
            </span>
          </div>

          <div className="w-full border-t border-slate-800/80 pt-4 flex flex-col gap-3 text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-indigo-400" /> Role</span>
              <span className="font-semibold text-slate-200 capitalize">{profileData?.role || "Citizen"}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span className="flex items-center gap-1.5"><Award className="w-4 h-4 text-yellow-500" /> Reputation</span>
              <span className="font-extrabold text-indigo-400">{profileData?.reputation_points || 0} Points</span>
            </div>
          </div>
        </div>

        {/* Badges Inventory Summary */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Award className="w-4.5 h-4.5 text-indigo-400" />
            Badges Gained
          </h4>
          <div className="flex flex-wrap gap-2">
            {profileData?.badges && profileData.badges.length > 0 ? (
              profileData.badges.map((badge: string, i: number) => (
                <span
                  key={i}
                  title={badge}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-indigo-500/20 text-[10px] font-bold text-indigo-300 flex items-center gap-1 badge-glow"
                >
                  🏆 {badge}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500 italic">No badges earned yet.</span>
            )}
          </div>
        </div>
      </div>

      {/* Profile Form Area */}
      <div className="md:col-span-2 flex flex-col gap-6">
        <form onSubmit={handleSaveChanges} className="glass-panel p-6 rounded-2xl flex flex-col justify-between min-h-[400px] gap-6">
          <div className="flex flex-col gap-5">
            <h3 className="text-base font-bold text-white border-b border-slate-800/80 pb-3">Edit Account Details</h3>

            {/* Display Name Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-500" />
                Full Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full pl-4 pr-4 py-2.5 rounded-xl glass-input text-xs"
                placeholder="Jane Doe"
              />
            </div>

            {/* Email Display (Read-Only) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-slate-500" />
                Account Email (Linked)
              </label>
              <input
                type="email"
                disabled
                value={user.email || ""}
                className="w-full pl-4 pr-4 py-2.5 rounded-xl glass-input text-xs opacity-50 cursor-not-allowed bg-slate-950/40"
              />
            </div>

            {/* Default Location settings */}
            <div className="flex flex-col gap-2 pt-2">
              <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-indigo-400 animate-pulse" />
                Default Geolocation Coordinates
              </label>
              <p className="text-[10px] text-slate-500 -mt-1 leading-normal">
                Set a neighborhood center. This automatically positions your map viewport when reporting.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-500">Latitude</span>
                  <input
                    type="number"
                    step="any"
                    value={defaultLat}
                    onChange={(e) => setDefaultLat(e.target.value)}
                    placeholder="12.9716"
                    className="w-full pl-4 pr-4 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-500">Longitude</span>
                  <input
                    type="number"
                    step="any"
                    value={defaultLng}
                    onChange={(e) => setDefaultLng(e.target.value)}
                    placeholder="77.5946"
                    className="w-full pl-4 pr-4 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 mt-2">
            {saveSuccess && (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
                <Save className="w-4 h-4" />
                Profile updated successfully!
              </span>
            )}
            <div className="flex-1"></div>
            {isSaving ? (
              <div className="flex items-center gap-2 bg-indigo-900/10 border border-indigo-500/20 py-2.5 px-5 rounded-xl text-xs font-bold text-indigo-300">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                Saving changes...
              </div>
            ) : (
              <button
                type="submit"
                className="px-6 py-3 rounded-xl glow-btn text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4.5 h-4.5" />
                Save Changes
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
