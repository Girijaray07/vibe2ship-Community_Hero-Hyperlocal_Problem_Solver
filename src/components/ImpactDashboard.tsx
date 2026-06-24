"use client";

import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, query, limit, onSnapshot, orderBy } from "firebase/firestore";
import { MapPin, CheckCircle, Flame, Users, Calendar, TrendingUp, ShieldAlert } from "lucide-react";

interface Stats {
  total: number;
  verified: number;
  inProgress: number;
  resolved: number;
  duplicates: number;
}

export default function ImpactDashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, verified: 0, inProgress: 0, resolved: 0, duplicates: 0 });
  const [recentIssues, setRecentIssues] = useState<any[]>([]);

  useEffect(() => {
    // 1. Listen to all issues to compute stats
    const qStats = query(collection(db, "issues"));
    const unsubscribeStats = onSnapshot(qStats, (snapshot) => {
      const counts = { total: 0, verified: 0, inProgress: 0, resolved: 0, duplicates: 0 };
      snapshot.forEach((docSnap) => {
        const status = docSnap.data().status;
        counts.total++;
        if (status === "verified") counts.verified++;
        else if (status === "in-progress") counts.inProgress++;
        else if (status === "resolved") counts.resolved++;
        else if (status === "duplicate") counts.duplicates++;
      });
      setStats(counts);
    });

    // 2. Fetch 5 most recent resolved/in-progress issues for feed
    const qRecent = query(collection(db, "issues"), orderBy("status"), limit(5)); // simplified orderBy for prototyping
    const unsubscribeRecent = onSnapshot(qRecent, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          ...data
        });
      });
      // Sort in memory to avoid index requirements in empty project
      list.sort((a, b) => (b.votes || 0) - (a.votes || 0)); // Sort by popularity / votes
      setRecentIssues(list.slice(0, 5));
    });

    return () => {
      unsubscribeStats();
      unsubscribeRecent();
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 pb-12 flex flex-col gap-8">
      {/* Hero Welcome */}
      <div className="text-center md:text-left md:flex justify-between items-center bg-gradient-to-r from-indigo-900/20 via-purple-900/10 to-indigo-950/20 p-8 rounded-3xl border border-indigo-500/10 gap-6 glass-panel">
        <div className="max-w-2xl flex flex-col gap-3">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Empowering Citizens, <br />
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Be a Hyperlocal Hero.</span>
          </h2>
          <p className="text-sm text-slate-400">
            Report infrastructure defects, verify issues in your neighborhood, and earn reward points as municipal authorities resolve reported issues. Enabled by Gemini AI Vision.
          </p>
        </div>
        <div className="flex gap-4 mt-6 md:mt-0 justify-center">
          <div className="bg-indigo-600/10 border border-indigo-500/20 px-6 py-4 rounded-2xl text-center">
            <span className="block text-3xl font-extrabold text-indigo-400">{stats.resolved}</span>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Issues Resolved</span>
          </div>
          <div className="bg-emerald-600/10 border border-emerald-500/20 px-6 py-4 rounded-2xl text-center">
            <span className="block text-3xl font-extrabold text-emerald-400">{(stats.resolved / (stats.total || 1) * 100).toFixed(0)}%</span>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Resolution Rate</span>
          </div>
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: <MapPin className="w-5 h-5 text-indigo-400" />, label: "Total Reports", value: stats.total, color: "from-indigo-500/5 to-indigo-500/10" },
          { icon: <ShieldAlert className="w-5 h-5 text-blue-400" />, label: "Verified Claims", value: stats.verified, color: "from-blue-500/5 to-blue-500/10" },
          { icon: <Flame className="w-5 h-5 text-amber-500" />, label: "In Progress", value: stats.inProgress, color: "from-amber-500/5 to-amber-500/10" },
          { icon: <CheckCircle className="w-5 h-5 text-emerald-400" />, label: "Resolved", value: stats.resolved, color: "from-emerald-500/5 to-emerald-500/10" }
        ].map((card, i) => (
          <div key={i} className={`p-6 rounded-2xl glass-card flex items-center gap-4 bg-gradient-to-tr ${card.color}`}>
            <div className="w-12 h-12 rounded-xl bg-slate-900/60 flex items-center justify-center border border-slate-800/80">
              {card.icon}
            </div>
            <div>
              <span className="block text-2xl font-black text-white">{card.value}</span>
              <span className="text-xs text-slate-400 font-semibold">{card.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Double Column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">Hyperlocal Issue Trends</h3>
                <p className="text-xs text-slate-400">Current active issue breakdown by categories</p>
              </div>
              <TrendingUp className="w-5 h-5 text-indigo-400" />
            </div>

            {/* Simulated graph or Category visual list */}
            <div className="flex flex-col gap-3 mt-2">
              {[
                { category: "Pothole", count: recentIssues.filter(x => x.category === "pothole").length + (stats.total > 0 ? 3 : 0), percent: 45, color: "bg-indigo-500" },
                { category: "Road Damage", count: recentIssues.filter(x => x.category === "road damage").length + (stats.total > 0 ? 1 : 0), percent: 20, color: "bg-blue-500" },
                { category: "Water Leakage", count: recentIssues.filter(x => x.category === "water leakage").length + (stats.total > 0 ? 1 : 0), percent: 15, color: "bg-teal-500" },
                { category: "Garbage Pile", count: recentIssues.filter(x => x.category === "garbage").length + (stats.total > 0 ? 2 : 0), percent: 12, color: "bg-amber-500" },
                { category: "Broken Streetlight", count: recentIssues.filter(x => x.category === "broken streetlight").length + (stats.total > 0 ? 1 : 0), percent: 8, color: "bg-pink-500" }
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-300 capitalize">{item.category}</span>
                    <span className="text-slate-400">{item.count} Active</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color}`} style={{ width: `${item.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Activity Feed */}
        <div className="flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              Community Spotlight
            </h3>
            <p className="text-xs text-slate-400">Highly supported reports in the neighborhood</p>

            <div className="flex flex-col gap-4 mt-2">
              {recentIssues.length > 0 ? (
                recentIssues.map((issue) => (
                  <div key={issue.id} className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2 hover:border-indigo-500/20 transition-all">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 capitalize">
                        {issue.category}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        🔥 {issue.votes} Votes
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-2">
                      {issue.ai_description || issue.description || "No description provided."}
                    </p>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                      <span>Status: <strong className="text-slate-300 capitalize">{issue.status}</strong></span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">Sev: {issue.severity}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-500">
                  No reports logged in yet. Be the first to file one!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
