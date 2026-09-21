import React, { useState } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  XCircle, 
  HelpCircle, 
  Sliders, 
  RotateCcw,
  CheckCircle2,
  Maximize2
} from 'lucide-react';
import { SonarTarget, SonarMissionTelemetry } from '../types/sonar';
import { calculate3DHeight } from '../utils/sonarAcousticMath';

interface PhysicsGeometryViewerProps {
  telemetry: SonarMissionTelemetry;
  targets: SonarTarget[];
  selectedTarget: SonarTarget | null;
  onSelectTarget: (target: SonarTarget) => void;
  minHeightThreshold: number;
}

export const PhysicsGeometryViewer: React.FC<PhysicsGeometryViewerProps> = ({
  telemetry,
  targets,
  selectedTarget,
  onSelectTarget,
  minHeightThreshold,
}) => {
  // Interactive simulation parameters
  const [altH, setAltH] = useState<number>(selectedTarget?.depthMeters ? telemetry.auvAltitudeH : 12.0);
  const [groundRg, setGroundRg] = useState<number>(selectedTarget ? selectedTarget.groundRangeRg : 18.5);
  const [shadowL, setShadowL] = useState<number>(selectedTarget ? selectedTarget.shadowLengthL : 6.8);

  // Sync with selected target
  const handleSelectTarget = (tgt: SonarTarget) => {
    onSelectTarget(tgt);
    setAltH(telemetry.auvAltitudeH);
    setGroundRg(tgt.groundRangeRg);
    setShadowL(tgt.shadowLengthL);
  };

  // Recompute true 3D height live
  const { heightH, sigmaH } = calculate3DHeight(altH, groundRg, shadowL);
  const isConfirmed = heightH >= minHeightThreshold;

  // Slant range Pythagorean distance: Rs = sqrt(Rg^2 + H^2)
  const slantRangeRs = Math.sqrt(groundRg * groundRg + altH * altH);

  // SVG Geometry normalization coordinates
  // Seafloor is at Y=280. AUV is at X=80, Y=280 - (altH * scale)
  const SVG_WIDTH = 740;
  const SVG_HEIGHT = 340;
  const SEABED_Y = 270;

  // Visual scaling factors
  const xScale = 18; // px per meter
  const yScale = 9;  // px per meter

  const auvX = 70;
  const auvY = Math.max(40, SEABED_Y - altH * yScale);

  // Object base location on seabed
  const objBaseX = Math.min(SVG_WIDTH - 200, auvX + groundRg * xScale);
  const objBaseY = SEABED_Y;
  const visualHeightPx = Math.min(120, Math.max(4, heightH * yScale * 3.5));
  const objTopY = objBaseY - visualHeightPx;

  // Trailing shadow along seabed
  const visualShadowWidthPx = Math.min(260, Math.max(6, shadowL * xScale));
  const shadowEndX = objBaseX + visualShadowWidthPx;

  return (
    <div id="physics-risk-engine-module" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
      {/* Header and Theory explanation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              FLOWCHART NODES 5 & 7
            </span>
            <span className="text-xs font-mono text-slate-400">
              PhysicsRiskEngine • Deterministic 3D Validation Gate
            </span>
          </div>
          <h2 className="text-lg font-bold text-white mt-1 flex items-center gap-2">
            3D Acoustic Shadow Relief & False-Positive Rejection Engine
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 max-w-3xl">
            Side-scan acoustic waves travel straight from the AUV. An elevated obstruction (such as a buoyant ghost net)
            casts an acoustic shadow on the seabed. Using triangular similar ratios, we resolve the true physical height <span className="font-mono text-amber-300">h</span>.
            If <span className="font-mono text-amber-300">h &lt; {minHeightThreshold}m</span>, the AI bounding box is strictly rejected as a flat geological feature (flat rock / ripple).
          </p>
        </div>

        {/* Target Preset Selector Buttons */}
        <div className="flex flex-wrap gap-2">
          {targets.map((tgt) => (
            <button
              key={tgt.id}
              onClick={() => handleSelectTarget(tgt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedTarget?.id === tgt.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-950/40'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
              }`}
            >
              {tgt.status === 'CONFIRMED_HAZARD' ? (
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              )}
              <span>{tgt.name.split(' ')[0]}</span>
              <span className="text-[10px] opacity-75">({tgt.status === 'CONFIRMED_HAZARD' ? 'Net' : 'Flat Rock'})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Grid: SVG Geometric Diagram + Live Formula Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: SVG Ray Tracing & Seafloor Geometry Diagram (7 cols) */}
        <div className="lg:col-span-8 bg-slate-950 rounded-xl border border-slate-800 p-3 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2 px-1">
            <span>ACOUSTIC RAY PROJECTION & SHADOW FORMATION</span>
            <span className="text-amber-400">Coordinate Frame: Sensor Nadir (Z=H) to Seabed (Z=0)</span>
          </div>

          <div className="w-full overflow-x-auto flex justify-center">
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="w-full max-w-[740px] h-auto select-none"
            >
              <defs>
                {/* Acoustic Sound Ray Gradient */}
                <linearGradient id="sonarRayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
                </linearGradient>

                {/* Shadow Area Hatch Pattern */}
                <pattern id="shadowHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#6366f1" strokeWidth="2" strokeOpacity="0.35" />
                </pattern>
              </defs>

              {/* Water Column Background */}
              <rect x="0" y="0" width={SVG_WIDTH} height={SEABED_Y} fill="#030812" />

              {/* Seafloor Bedrock/Sand (Bottom) */}
              <rect x="0" y={SEABED_Y} width={SVG_WIDTH} height={SVG_HEIGHT - SEABED_Y} fill="#1e180d" />
              <line x1="0" y1={SEABED_Y} x2={SVG_WIDTH} y2={SEABED_Y} stroke="#d97706" strokeWidth="2.5" />
              <text x="15" y={SEABED_Y + 25} fill="#b45309" fontSize="12" fontFamily="monospace" fontWeight="bold">
                SEABED DATUM (Z = 0)
              </text>

              {/* Acoustic Shadow Zone (Occluded acoustic cone) */}
              <polygon
                points={`${objTopY < SEABED_Y ? objBaseX : objBaseX},${SEABED_Y} ${objBaseX},${objTopY} ${shadowEndX},${SEABED_Y}`}
                fill="url(#shadowHatch)"
                stroke="#818cf8"
                strokeWidth="1"
                strokeDasharray="3 3"
              />

              {/* Sound Rays from AUV to Object Base and Object Top */}
              {/* Ray 1: Grazing Ray to Top of Target, continuing to Shadow End */}
              <line
                x1={auvX}
                y1={auvY}
                x2={shadowEndX}
                y2={SEABED_Y}
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray="4 2"
              />

              {/* Ray 2: Direct Ray to Base of Object */}
              <line
                x1={auvX}
                y1={auvY}
                x2={objBaseX}
                y2={SEABED_Y}
                stroke="#38bdf8"
                strokeWidth="1.5"
                opacity="0.85"
              />

              {/* Towfish / AUV Icon & Coordinates */}
              <g transform={`translate(${auvX - 20}, ${auvY - 14})`}>
                <rect x="0" y="0" width="40" height="18" rx="4" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
                <polygon points="40,9 48,4 48,14" fill="#0284c7" />
                <circle cx="12" cy="9" r="3" fill="#facc15" />
                <text x="-15" y="-8" fill="#38bdf8" fontSize="11" fontFamily="monospace" fontWeight="bold">
                  AUV Sonar Towfish
                </text>
              </g>

              {/* Altitude Dimension Line (H) */}
              <line x1="35" y1={auvY} x2="35" y2={SEABED_Y} stroke="#38bdf8" strokeWidth="1.5" />
              <line x1="30" y1={auvY} x2="40" y2={auvY} stroke="#38bdf8" strokeWidth="1.5" />
              <line x1="30" y1={SEABED_Y} x2="40" y2={SEABED_Y} stroke="#38bdf8" strokeWidth="1.5" />
              <text x="42" y={(auvY + SEABED_Y) / 2} fill="#38bdf8" fontSize="12" fontFamily="monospace" fontWeight="bold">
                H = {altH.toFixed(1)}m
              </text>

              {/* Target Anomaly Graphic */}
              {isConfirmed ? (
                // Elevated Ghost Net mesh structure
                <g>
                  <rect
                    x={objBaseX - 6}
                    y={objTopY}
                    width="12"
                    height={visualHeightPx}
                    fill="rgba(244, 63, 94, 0.4)"
                    stroke="#f43f5e"
                    strokeWidth="2"
                  />
                  {/* Mesh lines */}
                  <line x1={objBaseX - 6} y1={objTopY + visualHeightPx * 0.3} x2={objBaseX + 6} y2={objTopY + visualHeightPx * 0.7} stroke="#f43f5e" strokeWidth="1" />
                  <line x1={objBaseX - 6} y1={objTopY + visualHeightPx * 0.7} x2={objBaseX + 6} y2={objTopY + visualHeightPx * 0.3} stroke="#f43f5e" strokeWidth="1" />
                  {/* Floats / Weights */}
                  <circle cx={objBaseX} cy={objTopY} r="4" fill="#fbbf24" stroke="#f59e0b" />
                  <text x={objBaseX - 25} y={objTopY - 10} fill="#f43f5e" fontSize="11" fontFamily="monospace" fontWeight="bold">
                    Ghost Net (3D)
                  </text>
                </g>
              ) : (
                // Flat rock slab (almost no vertical relief)
                <g>
                  <polygon
                    points={`${objBaseX - 16},${SEABED_Y} ${objBaseX + 16},${SEABED_Y} ${objBaseX + 10},${SEABED_Y - 6} ${objBaseX - 10},${SEABED_Y - 6}`}
                    fill="#64748b"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                  />
                  <text x={objBaseX - 25} y={SEABED_Y - 14} fill="#94a3b8" fontSize="11" fontFamily="monospace" fontWeight="bold">
                    Flat Rock (2D)
                  </text>
                </g>
              )}

              {/* Physical Height Dimension (h) */}
              <line x1={objBaseX - 12} y1={objTopY} x2={objBaseX - 12} y2={SEABED_Y} stroke="#f43f5e" strokeWidth="1.5" />
              <line x1={objBaseX - 16} y1={objTopY} x2={objBaseX - 8} y2={objTopY} stroke="#f43f5e" strokeWidth="1.5" />
              <line x1={objBaseX - 16} y1={SEABED_Y} x2={objBaseX - 8} y2={SEABED_Y} stroke="#f43f5e" strokeWidth="1.5" />
              <text x={objBaseX - 58} y={(objTopY + SEABED_Y) / 2 + 4} fill="#f43f5e" fontSize="12" fontFamily="monospace" fontWeight="bold">
                h = {heightH.toFixed(2)}m
              </text>

              {/* Ground Range Dimension Line (Rg) along seabed */}
              <line x1={auvX} y1={SEABED_Y + 12} x2={objBaseX} y2={SEABED_Y + 12} stroke="#38bdf8" strokeWidth="1.5" />
              <line x1={auvX} y1={SEABED_Y + 8} x2={auvX} y2={SEABED_Y + 16} stroke="#38bdf8" strokeWidth="1.5" />
              <line x1={objBaseX} y1={SEABED_Y + 8} x2={objBaseX} y2={SEABED_Y + 16} stroke="#38bdf8" strokeWidth="1.5" />
              <text x={(auvX + objBaseX) / 2 - 25} y={SEABED_Y + 28} fill="#38bdf8" fontSize="11" fontFamily="monospace">
                R_g = {groundRg.toFixed(1)}m
              </text>

              {/* Shadow Length Dimension Line (L_shadow) */}
              <line x1={objBaseX} y1={SEABED_Y + 12} x2={shadowEndX} y2={SEABED_Y + 12} stroke="#818cf8" strokeWidth="1.5" />
              <line x1={shadowEndX} y1={SEABED_Y + 8} x2={shadowEndX} y2={SEABED_Y + 16} stroke="#818cf8" strokeWidth="1.5" />
              <text x={(objBaseX + shadowEndX) / 2 - 35} y={SEABED_Y + 28} fill="#818cf8" fontSize="11" fontFamily="monospace" fontWeight="bold">
                L_shd = {shadowL.toFixed(1)}m
              </text>

              {/* Slant Range Arrow text */}
              <text x={(auvX + shadowEndX) / 2 - 20} y={(auvY + SEABED_Y) / 2 - 14} fill="#f59e0b" fontSize="11" fontFamily="monospace">
                R_s = {slantRangeRs.toFixed(1)}m
              </text>
            </svg>
          </div>

          {/* Interactive Telemetry & Dimension Sliders */}
          <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-300 font-mono mb-1">
                <span>Sensor Altitude (H):</span>
                <span className="text-cyan-400 font-bold">{altH.toFixed(1)} m</span>
              </div>
              <input
                type="range"
                min="3.0"
                max="30.0"
                step="0.5"
                value={altH}
                onChange={(e) => setAltH(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 font-mono mb-1">
                <span>Ground Range (R_g):</span>
                <span className="text-sky-400 font-bold">{groundRg.toFixed(1)} m</span>
              </div>
              <input
                type="range"
                min="5.0"
                max="45.0"
                step="0.5"
                value={groundRg}
                onChange={(e) => setGroundRg(parseFloat(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 font-mono mb-1">
                <span>Acoustic Shadow (L):</span>
                <span className="text-indigo-400 font-bold">{shadowL.toFixed(1)} m</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="16.0"
                step="0.2"
                value={shadowL}
                onChange={(e) => setShadowL(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right: Validation Gate Math & Decision Card (4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-4">
          {/* Decision Status Banner */}
          <div
            className={`p-4 rounded-xl border flex flex-col gap-2 transition-all ${
              isConfirmed
                ? 'bg-rose-950/40 border-rose-600/80 shadow-md shadow-rose-950/50'
                : 'bg-slate-800/60 border-slate-700 shadow-md'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono tracking-wider uppercase text-slate-400">
                Validation Gate Status
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                  isConfirmed
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-slate-700 text-slate-300 border border-slate-600'
                }`}
              >
                {isConfirmed ? 'FLAGGED AS HAZARD' : 'REJECTED: NATURAL'}
              </span>
            </div>

            <div className="flex items-center gap-3 my-1">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isConfirmed ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-700/50 text-slate-400'
                }`}
              >
                {isConfirmed ? (
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                ) : (
                  <XCircle className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {isConfirmed ? 'Confirmed 3D Hazard' : 'Flat Geological Outcrop'}
                </h3>
                <p className="text-xs text-slate-400">
                  {isConfirmed ? 'Ghost net / Entangled marine debris' : 'Flat rock / Sand ripple rejected'}
                </p>
              </div>
            </div>

            <div className="text-xs border-t border-slate-700/60 pt-2 font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Calculated 3D Height (h):</span>
                <span className={`font-bold ${isConfirmed ? 'text-rose-400' : 'text-slate-300'}`}>
                  {heightH.toFixed(2)} m (±{sigmaH.toFixed(2)}m)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Threshold Floor (h_min):</span>
                <span className="text-slate-300">{minHeightThreshold.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Seabed Relief Status:</span>
                <span className={isConfirmed ? 'text-rose-300' : 'text-slate-400'}>
                  {isConfirmed ? 'Stands Tall Off Seabed' : 'Near Zero Elevation'}
                </span>
              </div>
            </div>
          </div>

          {/* Mathematical Proof Box */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono">
            <h4 className="text-amber-400 font-semibold mb-2 flex items-center gap-1.5">
              <span>Deterministic Acoustic Formula</span>
            </h4>
            <div className="bg-slate-900/90 p-2.5 rounded border border-slate-800 text-center my-2">
              <div className="text-sm font-bold text-amber-300 tracking-wide">
                h = (H · L_shadow) / (R_g + L_shadow)
              </div>
            </div>

            <div className="space-y-1.5 text-slate-300 text-[11px] pt-1">
              <div className="flex justify-between">
                <span>H (Sensor Altitude)</span>
                <span className="text-cyan-400 font-semibold">{altH.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between">
                <span>L_shadow (Acoustic Shadow)</span>
                <span className="text-indigo-400 font-semibold">{shadowL.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between">
                <span>R_g (Ground Range)</span>
                <span className="text-sky-400 font-semibold">{groundRg.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1 font-bold">
                <span className="text-slate-200">Result: Physical Relief h</span>
                <span className={isConfirmed ? 'text-rose-400' : 'text-slate-400'}>
                  {heightH.toFixed(3)} m
                </span>
              </div>
            </div>

            <div className="mt-3 p-2 rounded bg-slate-900 text-[10px] text-slate-400 leading-relaxed border border-slate-800/80">
              <span className="text-cyan-400 font-semibold">Why this eliminates false positives:</span> Standard CNNs
              frequently mistake high-reflectivity flat rocks or sand ripples for debris. By solving for true vertical
              relief <span className="text-slate-200">h</span>, flat rocks (shadow ≈ 0m) produce <span className="text-slate-200">h ≈ 0.05m</span> and are immediately dropped without human intervention.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
