"use client";

import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { Trophy, Award, Star, Medal, Users } from "lucide-react";

interface UserProfile {
  uid: string;
  displayName: string;
  reputation_points: number;
  badges: string[];
  role: string;
}

export default function Leaderboard() {
  const [leaders, setLeaders] = useState<UserProfile[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "users"),
      orderBy("reputation_points", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        usersList.push({
          uid: docSnap.id,
          displayName: data.displayName || "Anonymous Hero",
          reputation_points: data.reputation_points || 0,
          badges: data.badges || [],
          role: data.role || "citizen"
        });
      });
      setLeaders(usersList);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 pb-12 flex flex-col gap-6">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-indigo-900/20 via-purple-900/10 to-indigo-950/20 p-8 rounded-3xl border border-indigo-500/10 text-center glass-panel flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500 badge-glow">
          <Trophy className="w-6 h-6" />
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          Community Hero Leaderboard
        </h2>
        <p className="text-sm text-slate-400 max-w-xl">
          Top-contributing citizens who report issues, vote responsibly, and verify infrastructure claims to build a safer, cleaner city.
        </p>
      </div>

      {/* Rankings List */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
        <div className="flex justify-between items-center px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <span>Rank & Citizen Name</span>
          <div className="flex gap-8">
            <span className="w-24 text-center">Badges Earned</span>
            <span className="w-24 text-right">Reputation</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {leaders.length > 0 ? (
            leaders.map((leader, index) => {
              const rank = index + 1;
              let rankStyle = "bg-slate-800 text-slate-400";
              let rankIcon = null;

              if (rank === 1) {
                rankStyle = "bg-yellow-500/20 border border-yellow-500/30 text-yellow-400";
                rankIcon = <Trophy className="w-4 h-4 text-yellow-500" />;
              } else if (rank === 2) {
                rankStyle = "bg-slate-300/20 border border-slate-300/30 text-slate-300";
                rankIcon = <Medal className="w-4 h-4 text-slate-300" />;
              } else if (rank === 3) {
                rankStyle = "bg-amber-700/20 border border-amber-700/30 text-amber-500";
                rankIcon = <Award className="w-4 h-4 text-amber-600" />;
              }

              return (
                <div
                  key={leader.uid}
                  className={`flex justify-between items-center p-4 rounded-xl transition-all ${
                    rank <= 3 ? "bg-indigo-950/10 border border-indigo-500/5" : "bg-slate-900/20 border border-slate-800/40 hover:bg-slate-900/40"
                  }`}
                >
                  {/* Left Side: Rank + Name */}
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold ${rankStyle}`}>
                      {rankIcon ? rankIcon : rank}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        {leader.displayName}
                        {leader.role === "authority" && (
                          <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                            Staff
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Contributor since June 2026</p>
                    </div>
                  </div>

                  {/* Right Side: Badges + Score */}
                  <div className="flex items-center gap-8">
                    {/* Badges Gallery */}
                    <div className="flex gap-1 justify-center w-24">
                      {leader.badges.length > 0 ? (
                        leader.badges.map((badge, idx) => (
                          <span
                            key={idx}
                            title={badge}
                            className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] border border-indigo-500/20"
                          >
                            🏆
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">None</span>
                      )}
                    </div>

                    {/* Reputation Points */}
                    <div className="w-24 text-right">
                      <span className="text-sm font-black text-indigo-400">{leader.reputation_points}</span>
                      <span className="text-[10px] text-slate-500 block font-medium">Points</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs flex flex-col items-center gap-2">
              <Users className="w-8 h-8 text-slate-600" />
              No active users found. Create an account to become a hero!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
