import React, { useState, useEffect } from 'react';
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight, 
  Activity, 
  ShieldAlert,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { SonarTarget, SonarMissionTelemetry } from '../types/sonar';

interface TemporalTrackerViewerProps {
  telemetry: SonarMissionTelemetry;
  targets: SonarTarget[];
}

export const TemporalTrackerViewer: React.FC<TemporalTrackerViewerProps> = ({
  telemetry,
  targets,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simulatedPing, setSimulatedPing] = useState<number>(1144);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSimulatedPing((prev) => (prev >= 1150 ? 1138 : prev + 1));
    }, 1200);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Simulated sequential pings data
  const pingHistory = [
    {
      ping: 1140,
      timestamp: '10:14:02.10',
      trackedHazards: 1,
      transientSpikes: 2,
      note: 'Initial shadow illumination detected at Rg = 18.2m',
    },
    {
      ping: 1141,
      timestamp: '10:14:02.85',
      trackedHazards: 1,
      transientSpikes: 0,
      note: 'Track TRK-0001 hit streak = 2 (Transient spike dissolved)',
    },
    {
      ping: 1142,
      timestamp: '10:14:03.60',
      trackedHazards: 1,
      transientSpikes: 1,
      note: 'Track TRK-0001 hit streak = 3 (Persistence validated)',
    },
    {
      ping: 1143,
      timestamp: '10:14:04.35',
      trackedHazards: 2,
      transientSpikes: 0,
      note: 'Peak specular backscatter return; shadow length L = 7.8m',
    },
    {
      ping: 1144,
      timestamp: '10:14:05.10',
      trackedHazards: 2,
      transientSpikes: 0,
      note: 'Spatial correlation confirms static marine obstacle',
    },
  ];

  return (
    <div id="temporal-tracker-module" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              FLOWCHART NODE 6
            </span>
            <span className="text-xs font-mono text-slate-400">
              Temporal Ping Tracking & Acoustic Persistence Verification
            </span>
          </div>
          <h2 className="text-lg font-bold text-white mt-1">
            Multi-Ping Association & Transient Noise Elimination
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 max-w-3xl">
            Real marine debris persists across 5 to 30 sequential acoustic pings as the vehicle advances. Transient false alarms (fish schools, bubble wakes, acoustic multipath) are eliminated because they vanish after 1–2 pings.
          </p>
        </div>

        {/* Live Simulation Controls */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Current Ping: <strong className="text-cyan-400">#{simulatedPing}</strong></span>
          </div>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 cursor-pointer"
            title={isPlaying ? 'Pause simulation' : 'Play simulation'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setSimulatedPing(1138)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 cursor-pointer"
            title="Reset ping sequence"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Comparison Grid: Real Debris vs Transient Noise */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400 mb-2">
            <CheckCircle2 className="w-4 h-4" />
            GENUINE MARINE HAZARD (Ghost Net / Gear)
          </div>
          <div className="space-y-2 text-xs font-mono text-slate-300">
            <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
              <span>Ping Streak:</span>
              <span className="text-emerald-300 font-bold">12 consecutive hits (&gt; 4 threshold)</span>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
              <span>Spatial Consistency:</span>
              <span className="text-emerald-300">Δx &lt; 0.4m (Stationary Seafloor Object)</span>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
              <span>Acoustic Shadow Correlation:</span>
              <span className="text-emerald-300">Shadow contracts predictably as AUV passes</span>
            </div>
            <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 font-bold text-center">
              STATUS: CONFIRMED PERSISTENT TARGET
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-rose-500/30">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-rose-400 mb-2">
            <XCircle className="w-4 h-4" />
            TRANSIENT NOISE SPIKE (Fish / Wake / Multipath)
          </div>
          <div className="space-y-2 text-xs font-mono text-slate-300">
            <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
              <span>Ping Streak:</span>
              <span className="text-rose-400 font-bold">1 isolated hit (miss streak = 3)</span>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
              <span>Spatial Consistency:</span>
              <span className="text-rose-400">Vanishes on subsequent ping N+1</span>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
              <span>Acoustic Shadow Correlation:</span>
              <span className="text-rose-400">Zero physical geometric correlation</span>
            </div>
            <div className="p-2 rounded bg-rose-950/40 border border-rose-800/40 text-rose-300 font-bold text-center">
              STATUS: REJECTED AS TRANSIENT WATER COLUMN ARTIFACT
            </div>
          </div>
        </div>
      </div>

      {/* Ping Water History Log */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
        <h3 className="text-xs font-mono font-bold text-slate-200 mb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400" />
          Sequential Ping Tracking Audit Trail
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase border-b border-slate-800">
              <tr>
                <th className="p-2">Ping #</th>
                <th className="p-2">UTC Timestamp</th>
                <th className="p-2">Active Track ID</th>
                <th className="p-2">Hit Streak</th>
                <th className="p-2">Persistence Status</th>
                <th className="p-2">Tracking Observation Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {pingHistory.map((h, i) => (
                <tr key={h.ping} className={h.ping === simulatedPing ? 'bg-cyan-950/30' : ''}>
                  <td className="p-2 font-bold text-cyan-400">#{h.ping}</td>
                  <td className="p-2 text-slate-400">{h.timestamp}</td>
                  <td className="p-2 font-bold text-purple-300">TRK-0001</td>
                  <td className="p-2 font-bold text-emerald-400">{i + 1} hits</td>
                  <td className="p-2">
                    {i + 1 >= 3 ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        PERSISTENT
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                        PROVISIONAL
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-slate-300 text-[11px]">{h.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
