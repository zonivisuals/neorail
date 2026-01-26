"use client"
import { useEffect, useState } from 'react';

const SCALE = 250; 
const OFFSET = 300; // Center it (300px, 300px)

export default function NetworkMap() {
  const [tracks, setTracks] = useState<any>(null);
  const [trains, setTrains] = useState<any[]>([]);

  // 1. Load Static Tracks ONCE
  useEffect(() => {
    fetch('http://localhost:8000/network-data')
      .then(res => res.json())
      .then(data => setTracks(data));
  }, []);

  // 2. Poll Train Positions Every Second
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('http://localhost:8000/live-positions')
        .then(res => res.json())
        .then(data => setTrains(data));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Helper to convert Abstract (-1 to 1) Coords to Screen Pixels
  const toScreen = (pt: {x: number, y: number}) => ({
    x: pt.x * SCALE + OFFSET,
    y: pt.y * SCALE + OFFSET
  });

  if (!tracks) return <div className="text-white">Initializing GIS System...</div>;

  return (
    <div className="flex flex-col items-center bg-slate-900 min-h-screen text-slate-200 p-8">
      <h1 className="text-3xl font-bold mb-2">🚄 Rail Network Control</h1>
      <p className="text-slate-400 mb-8">Live Telemetry Feed • Sector 7</p>

      {/* THE MAP CONTAINER */}
      <div className="relative border-4 border-slate-700 rounded-xl bg-slate-950 shadow-2xl" style={{ width: '600px', height: '600px' }}>
        <svg width="600" height="600" className="absolute top-0 left-0">
          
          {/* --- LAYER 1: TRACKS --- */}
          {Object.keys(tracks).map((trackKey) => {
            const points = tracks[trackKey];
            // Convert points to SVG Path string "M x y L x y..."
            const pathData = points.map((p: any, i: number) => {
              const s = toScreen(p);
              return `${i === 0 ? 'M' : 'L'} ${s.x} ${s.y}`;
            }).join(" ");

            return (
              <g key={trackKey}>
                {/* Track Glow */}
                <path d={pathData} stroke={trackKey === "main_loop" ? "#1e293b" : "#0f172a"} strokeWidth="12" fill="none" />
                {/* Track Rail */}
                <path d={pathData} stroke="#475569" strokeWidth="4" fill="none" strokeDasharray="5,5" />
              </g>
            );
          })}

          {/* --- LAYER 2: TRAINS --- */}
          {trains.map((t) => {
            const s = toScreen({x: t.x, y: t.y});
            return (
              <g key={t.id} style={{ transition: 'all 1s linear' }}>
                {/* Pulsing Effect for Stuck Trains */}
                {t.status.includes('STUCK') && (
                  <circle cx={s.x} cy={s.y} r="20" fill="red" opacity="0.3">
                    <animate attributeName="r" from="20" to="40" dur="1s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.3" to="0" dur="1s" repeatCount="indefinite" />
                  </circle>
                )}
                
                {/* The Train Dot */}
                <circle cx={s.x} cy={s.y} r="8" fill={t.color} stroke="white" strokeWidth="2" />
                
                {/* Train Label */}
                <text x={s.x} y={s.y - 15} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
                  {t.id}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend Overlay */}
        <div className="absolute bottom-4 left-4 bg-slate-900/80 p-3 rounded border border-slate-700 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-blue-500 rounded-full"></div> <span className="text-xs">Express (Main Loop)</span></div>
          <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-red-500 rounded-full"></div> <span className="text-xs">Intercity (Cross)</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full"></div> <span className="text-xs">Freight (Scenic)</span></div>
        </div>
      </div>

      {/* CONTROL PANEL */}
      <div className="mt-8 grid grid-cols-1 gap-4 w-[600px]">
        {trains.map(t => (
          <div key={t.id} className="flex items-center justify-between bg-slate-800 p-4 rounded border border-slate-700">
            <div>
              <span className="font-bold text-lg block">{t.id}</span>
              <span className={`text-sm ${t.status.includes('STUCK') ? 'text-red-400 font-bold' : 'text-green-400'}`}>
                {t.status}
              </span>
            </div>
            
            {t.id === 'Train-404' && !t.status.includes('STUCK') && (
              <button 
                onClick={() => fetch(`http://localhost:8000/trigger-incident/${t.id}`, { method: 'POST' })}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold shadow-lg shadow-red-900/20 transition"
              >
                ⚠️ SIMULATE CRASH
              </button>
            )}

            {t.status.includes('STUCK') && (
              <div className="flex gap-2">
                 <button 
                   onClick={() => fetch(`http://localhost:8000/resolve-incident/${t.id}`, { method: 'POST' })}
                   className="border border-slate-500 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded"
                 >
                   Reset
                 </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}