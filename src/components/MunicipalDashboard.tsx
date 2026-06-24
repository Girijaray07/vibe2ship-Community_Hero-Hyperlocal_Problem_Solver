"use client";

import { useEffect, useState } from "react";
import { db, functions } from "../lib/firebase";
import { collection, query, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Shield, Sparkles, AlertTriangle, CheckCircle, RefreshCw, Layers, TrendingUp, Compass } from "lucide-react";

interface Issue {
  id: string;
  category: string;
  severity: number;
  status: string;
  votes: number;
  description?: string;
  ai_description?: string;
  reporter_id: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export default function MunicipalDashboard() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("issues"); // "issues" | "analytics"

  // Analytics states
  const [analyticsResult, setAnalyticsResult] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 1. Listen to all issues
  useEffect(() => {
    const q = query(collection(db, "issues"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
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
          reporter_id: data.reporter_id || "",
          location: data.location ? {
            latitude: data.location.latitude,
            longitude: data.location.longitude
          } : undefined
        });
      });
      setIssues(list);
    });

    return () => unsubscribe();
  }, []);

  // Update issue status
  const handleUpdateStatus = async (issueId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "issues", issueId), {
        status: newStatus
      });
      alert(`Issue updated to ${newStatus}`);
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    }
  };

  // Trigger Gemini Pro analytics
  const runPredictiveAnalytics = async () => {
    setIsAnalyzing(true);
    setAnalyticsResult(null);
    try {
      const getAnalyticsFunc = httpsCallable(functions, "getPredictiveAnalytics");
      const res: any = await getAnalyticsFunc();
      setAnalyticsResult(res.data);
    } catch (err: any) {
      console.error(err);
      alert("Analytics compilation failed: " + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filteredIssues = selectedStatusFilter === "all"
    ? issues
    : issues.filter((issue) => issue.status === selectedStatusFilter);

  return (
    <div className="max-w-7xl mx-auto px-6 pb-12 flex flex-col gap-6">
      {/* Header Profile */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-800/80">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            Municipal Management Portal
          </h2>
          <p className="text-xs text-slate-400">Review community reports, dispatch repair crews, and analyze decay trends.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("issues")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "issues"
                ? "bg-blue-600 text-white shadow shadow-blue-500/20"
                : "bg-slate-950/40 border border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            Report Log
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "analytics"
                ? "bg-indigo-600 text-white shadow shadow-indigo-500/20"
                : "bg-slate-950/40 border border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Predictive Analytics
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "issues" ? (
        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-base font-bold text-white">Active Local Issue Log</h3>
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="text-slate-500">Filter:</span>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="py-1.5 px-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-300"
              >
                <option value="all">All Issues</option>
                <option value="reported">Reported</option>
                <option value="verified">Verified</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="duplicate">Duplicate</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto w-full border border-slate-800 rounded-xl mt-2">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/50 border-b border-slate-800 font-bold text-slate-400">
                  <th className="p-4">Category</th>
                  <th className="p-4">AI Details / Description</th>
                  <th className="p-4 text-center">Severity</th>
                  <th className="p-4 text-center">Votes</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredIssues.length > 0 ? (
                  filteredIssues.map((issue) => (
                    <tr key={issue.id} className="hover:bg-slate-900/10">
                      <td className="p-4 font-bold capitalize text-indigo-400">
                        {issue.category.replace("_", " ")}
                      </td>
                      <td className="p-4 max-w-sm">
                        <p className="text-slate-200 truncate">{issue.ai_description || issue.description}</p>
                        {issue.location && (
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            📍 {issue.location.latitude.toFixed(4)}, {issue.location.longitude.toFixed(4)}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded font-black ${
                          issue.severity >= 8 ? "bg-red-500/10 text-red-400" :
                          issue.severity >= 5 ? "bg-amber-500/10 text-amber-400" : "bg-indigo-500/10 text-indigo-400"
                        }`}>
                          {issue.severity}/10
                        </span>
                      </td>
                      <td className="p-4 text-center font-semibold text-slate-400">
                        {issue.votes}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded uppercase font-extrabold text-[9px] tracking-wider ${
                          issue.status === "resolved" ? "bg-emerald-500/10 text-emerald-400" :
                          issue.status === "in-progress" ? "bg-amber-500/10 text-amber-400" :
                          issue.status === "duplicate" ? "bg-slate-500/10 text-slate-400" : "bg-indigo-500/10 text-indigo-400"
                        }`}>
                          {issue.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <select
                          value={issue.status}
                          onChange={(e) => handleUpdateStatus(issue.id, e.target.value)}
                          className="py-1.5 px-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-medium"
                        >
                          <option value="reported">Reported</option>
                          <option value="verified">Verified</option>
                          <option value="in-progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="duplicate">Duplicate</option>
                        </select>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500 italic">
                      No issues match the selected filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* AI trigger block */}
          <div className="glass-panel p-8 rounded-2xl border border-indigo-500/10 text-center flex flex-col items-center gap-4 bg-gradient-to-tr from-indigo-900/10 via-slate-950/20 to-indigo-950/15">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-indigo-400 badge-glow">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex justify-center items-center gap-1.5">
                <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
                Gemini Pro Predictive Hotspot Analytics
              </h3>
              <p className="text-xs text-slate-400 max-w-lg mt-2 mx-auto">
                Utilize historical reports, upvote distributions, and category patterns to forecast next-likely failure hotspots in the next 30 days.
              </p>
            </div>

            {isAnalyzing ? (
              <div className="flex flex-col items-center gap-3 p-4 bg-slate-950/40 border border-slate-800 rounded-xl max-w-sm w-full mt-2">
                <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
                <span className="text-xs font-bold text-indigo-300 animate-pulse">Querying Gemini Pro reasoning model...</span>
              </div>
            ) : (
              <button
                onClick={runPredictiveAnalytics}
                className="px-6 py-3 rounded-xl glow-btn font-bold text-xs uppercase tracking-wider text-white mt-2 cursor-pointer"
              >
                Compile Analytics Report
              </button>
            )}
          </div>

          {/* AI Report display */}
          {analyticsResult && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              {/* Summary and Recommendations */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                {/* Aggregate Summary */}
                <div className="glass-panel p-6 rounded-2xl flex flex-col gap-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-400" />
                    Model Findings Summary
                  </h4>
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Analyzed Points</span>
                      <span className="text-2xl font-black text-white">{analyticsResult.summary?.total_issues || 0}</span>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Dominant Issue</span>
                      <span className="text-sm font-bold text-indigo-400 truncate block mt-1 capitalize">
                        {analyticsResult.summary?.top_category || "N/A"}
                      </span>
                    </div>
                    <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Mean Severity</span>
                      <span className="text-2xl font-black text-red-400">
                        {analyticsResult.summary?.average_severity ? analyticsResult.summary.average_severity.toFixed(1) : "0"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    AI Resolution Recommendations
                  </h4>
                  <div className="flex flex-col gap-3.5">
                    {analyticsResult.recommendations?.map((rec: any, idx: number) => (
                      <div key={idx} className="p-4 rounded-xl bg-slate-950/30 border border-slate-850 flex items-start justify-between gap-4">
                        <div>
                          <h5 className="text-xs font-bold text-white">{rec.title}</h5>
                          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{rec.description}</p>
                        </div>
                        <span className={`text-[9px] uppercase font-extrabold px-2 py-0.5 rounded ${
                          rec.priority === "high" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                          rec.priority === "medium" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-slate-800 text-slate-400"
                        }`}>
                          {rec.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Hotspot predictions */}
              <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  30-Day Hotspot Forecasts
                </h4>
                <div className="flex flex-col gap-4">
                  {analyticsResult.predictions?.map((pred: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 flex flex-col gap-2 relative overflow-hidden">
                      {/* Glow indicator side bar */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                        pred.likelihood === "high" ? "bg-red-500" :
                        pred.likelihood === "medium" ? "bg-amber-500" : "bg-blue-500"
                      }`} />

                      <div className="flex justify-between items-center pl-1">
                        <h5 className="text-xs font-bold text-slate-100">{pred.area_name}</h5>
                        <span className={`text-[9px] font-black uppercase ${
                          pred.likelihood === "high" ? "text-red-400" :
                          pred.likelihood === "medium" ? "text-amber-400" : "text-blue-400"
                        }`}>
                          {pred.likelihood} Risk
                        </span>
                      </div>
                      
                      <p className="text-[10px] text-slate-400 leading-normal pl-1">
                        {pred.reasoning}
                      </p>

                      <div className="flex justify-between items-center pl-1 border-t border-slate-850 pt-2 text-[9px] text-slate-500">
                        <span className="capitalize">Target: <strong className="text-slate-300 font-semibold">{pred.category_predicted}</strong></span>
                        {pred.coordinates && (
                          <span>📍 {pred.coordinates.lat?.toFixed(4)}, {pred.coordinates.lng?.toFixed(4)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
