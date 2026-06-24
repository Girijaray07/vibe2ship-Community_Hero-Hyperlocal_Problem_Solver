"use client";

import { useEffect, useRef, useState } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, query, doc, setDoc, addDoc, updateDoc } from "firebase/firestore";
import L from "leaflet";

interface Issue {
  id: string;
  category: string;
  severity: number;
  status: string;
  votes: number;
  description?: string;
  ai_description?: string;
  location: {
    latitude: number;
    longitude: number;
  };
  reporter_id: string;
}

interface MapComponentProps {
  user: any;
  isReporting: boolean;
  onLocationSelected?: (lat: number, lng: number) => void;
  selectedLocation: { lat: number; lng: number } | null;
}

export default function MapComponent({
  user,
  isReporting,
  onLocationSelected,
  selectedLocation
}: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.CircleMarker }>({});
  const tempMarkerRef = useRef<L.Marker | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);

  // 1. Fetch issues in real-time
  useEffect(() => {
    const q = query(collection(db, "issues"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const issuesList: Issue[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.location && data.location.latitude && data.location.longitude) {
          issuesList.push({
            id: docSnap.id,
            category: data.category || "unknown",
            severity: data.severity || 1,
            status: data.status || "reported",
            votes: data.votes || 0,
            description: data.description || "",
            ai_description: data.ai_description || "",
            location: {
              latitude: data.location.latitude,
              longitude: data.location.longitude
            },
            reporter_id: data.reporter_id || ""
          });
        }
      });
      setIssues(issuesList);
    });

    return () => unsubscribe();
  }, []);

  // 2. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Center map around a default location (e.g. Bangalore center: 12.9716, 77.5946)
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false
    }).setView([12.9716, 77.5946], 13);

    // Dark-themed Map tiles (matches dark mode theme)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 20
    }).addTo(map);

    mapRef.current = map;

    // Call invalidateSize after a short timeout to make sure container size is fully calculated
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 250);

    // Handle clicks to drop reporting pin
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (!isReporting || !onLocationSelected) return;
      const { lat, lng } = e.latlng;
      onLocationSelected(lat, lng);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isReporting, onLocationSelected]);

  // 3. Update Map view if isReporting changes or location selection changes
  useEffect(() => {
    if (!mapRef.current) return;

    // If a location is selected programmatically (from parent), put a temp marker there
    if (selectedLocation) {
      if (tempMarkerRef.current) {
        tempMarkerRef.current.setLatLng([selectedLocation.lat, selectedLocation.lng]);
      } else {
        const pinIcon = L.divIcon({
          className: "custom-div-icon",
          html: `<div class="w-8 h-8 rounded-full bg-indigo-500 border-2 border-white flex items-center justify-center shadow-lg animate-bounce">
                  <div class="w-3 h-3 bg-white rounded-full"></div>
                 </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32]
        });
        tempMarkerRef.current = L.marker([selectedLocation.lat, selectedLocation.lng], { icon: pinIcon }).addTo(mapRef.current);
      }
      mapRef.current.panTo([selectedLocation.lat, selectedLocation.lng]);
    } else {
      if (tempMarkerRef.current) {
        tempMarkerRef.current.remove();
        tempMarkerRef.current = null;
      }
    }
  }, [selectedLocation]);

  // 4. Render/Sync issue markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers that no longer exist
    Object.keys(markersRef.current).forEach((id) => {
      if (!issues.find((issue) => issue.id === id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Add or update markers
    issues.forEach((issue) => {
      const position: [number, number] = [issue.location.latitude, issue.location.longitude];
      
      // Determine colors based on status
      let color = "#6366f1"; // default: indigo
      if (issue.status === "verified") color = "#3b82f6"; // blue
      if (issue.status === "in-progress") color = "#f59e0b"; // yellow
      if (issue.status === "resolved") color = "#10b981"; // green
      if (issue.status === "duplicate") color = "#64748b"; // slate/grey

      const severityRadius = 6 + (issue.severity * 1.5); // higher severity -> larger circle

      // If marker exists, update it, otherwise create
      let marker = markersRef.current[issue.id];
      if (marker) {
        marker.setLatLng(position);
        marker.setStyle({ color, fillColor: color, radius: severityRadius });
      } else {
        marker = L.circleMarker(position, {
          radius: severityRadius,
          fillColor: color,
          color: "#ffffff",
          weight: 1.5,
          opacity: 0.9,
          fillOpacity: 0.6
        }).addTo(map);

        markersRef.current[issue.id] = marker;
      }

      // Bind interactive popup content
      const popupContent = document.createElement("div");
      popupContent.className = "p-2 min-w-[200px] text-slate-100 flex flex-col gap-1";
      popupContent.innerHTML = `
        <div class="flex justify-between items-start">
          <span class="text-xs uppercase font-semibold px-2 py-0.5 rounded ${
            issue.status === "resolved" ? "bg-emerald-500/20 text-emerald-400" :
            issue.status === "in-progress" ? "bg-amber-500/20 text-amber-400" :
            issue.status === "duplicate" ? "bg-slate-500/20 text-slate-400" : "bg-indigo-500/20 text-indigo-400"
          }">${issue.status}</span>
          <span class="text-xs font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400">Sev: ${issue.severity}/10</span>
        </div>
        <h4 class="text-sm font-bold capitalize mt-1 text-white">${issue.category.replace("_", " ")}</h4>
        <p class="text-xs text-slate-300 line-clamp-3">${issue.ai_description || issue.description || "No description."}</p>
        <div class="flex items-center gap-1 mt-2 text-xs text-slate-400">
          <span>Votes: <strong>${issue.votes}</strong></span>
        </div>
        <div class="flex gap-2 mt-3 w-full border-t border-slate-700/50 pt-2" id="popup-actions-${issue.id}">
          <button class="flex-1 py-1 px-2 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-center cursor-pointer transition-colors" id="btn-upvote-${issue.id}">Upvote</button>
          ${
            user && user.role === "authority" ? `
              <select class="flex-1 py-1 px-1 rounded bg-slate-800 border border-slate-700 text-xs font-medium text-white" id="select-status-${issue.id}">
                <option value="reported" ${issue.status === "reported" ? "selected" : ""}>Reported</option>
                <option value="verified" ${issue.status === "verified" ? "selected" : ""}>Verified</option>
                <option value="in-progress" ${issue.status === "in-progress" ? "selected" : ""}>In Progress</option>
                <option value="resolved" ${issue.status === "resolved" ? "selected" : ""}>Resolved</option>
              </select>
            ` : ""
          }
        </div>
      `;

      marker.bindPopup(popupContent);

      // Attach click events on popup open
      marker.on("popupopen", () => {
        // Upvote click handler
        const upvoteBtn = document.getElementById(`btn-upvote-${issue.id}`);
        if (upvoteBtn) {
          upvoteBtn.addEventListener("click", async () => {
            if (!user) {
              alert("Please log in to vote!");
              return;
            }
            try {
              // Write a vote document
              const voteId = `${issue.id}_${user.uid}`;
              await setDoc(doc(db, "votes", voteId), {
                issue_id: issue.id,
                user_id: user.uid,
                vote_type: "up",
                timestamp: new Date()
              });
              alert("Upvoted successfully!");
              marker.closePopup();
            } catch (err: any) {
              console.error(err);
              alert("Already voted or error voting!");
            }
          });
        }

        // Status select handler (for Authority role)
        const statusSelect = document.getElementById(`select-status-${issue.id}`) as HTMLSelectElement;
        if (statusSelect) {
          statusSelect.addEventListener("change", async (e: any) => {
            const newStatus = e.target.value;
            try {
              await updateDoc(doc(db, "issues", issue.id), {
                status: newStatus
              });
              alert(`Status updated to ${newStatus}`);
              marker.closePopup();
            } catch (err: any) {
              console.error(err);
              alert("Failed to update status.");
            }
          });
        }
      });
    });
  }, [issues, user]);

  return (
    <div className="w-full h-full relative min-h-[400px]">
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full border border-slate-700/40 rounded-xl overflow-hidden glass-panel" />
      {isReporting && !selectedLocation && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-slate-900/90 backdrop-blur border border-indigo-500/50 text-indigo-300 px-4 py-2 rounded-lg text-xs font-semibold shadow-lg text-center flex items-center gap-2 pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
          Click on the map to pin the issue location
        </div>
      )}
    </div>
  );
}
