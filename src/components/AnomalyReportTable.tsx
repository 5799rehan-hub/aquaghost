import React, { useState } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  FileCode, 
  FileJson,
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  ExternalLink,
  Search,
  Copy,
  Check,
  Eye,
  X
} from 'lucide-react';
import { SonarTarget, SonarMissionTelemetry } from '../types/sonar';

interface AnomalyReportTableProps {
  telemetry: SonarMissionTelemetry;
  targets: SonarTarget[];
  selectedTarget: SonarTarget | null;
  onSelectTarget: (target: SonarTarget) => void;
}

export const AnomalyReportTable: React.FC<AnomalyReportTableProps> = ({
  telemetry,
  targets,
  selectedTarget,
  onSelectTarget,
}) => {
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [copiedCoordId, setCopiedCoordId] = useState<string | null>(null);

  const filteredTargets = targets.filter((tgt) => {
    if (filter === 'confirmed' && tgt.status !== 'CONFIRMED_HAZARD') return false;
    if (filter === 'rejected' && tgt.status !== 'REJECTED_FALSE_POSITIVE') return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        tgt.id.toLowerCase().includes(q) ||
        tgt.name.toLowerCase().includes(q) ||
        tgt.type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Generate standardized JSON representation of mission and detections
  const getDetectionJsonData = () => {
    return {
      mission_metadata: {
        system: "AQUAGHOST",
        mission_id: telemetry.missionId,
        location: telemetry.locationName,
        auv_altitude_meters: telemetry.auvAltitudeH,
        max_slant_range_meters: telemetry.maxSlantRange,
        operating_frequency_khz: telemetry.operatingFrequencyKhz,
        exported_at: new Date().toISOString(),
        total_targets: targets.length,
        confirmed_hazards: targets.filter(t => t.status === 'CONFIRMED_HAZARD').length,
      },
      detections: targets.map((t) => ({
        target_id: t.id,
        classification: t.name,
        type: t.type,
        status: t.status,
        is_hazard: t.status === 'CONFIRMED_HAZARD',
        latitude: t.latitude,
        longitude: t.longitude,
        depth_meters: t.depthMeters,
        calculated_3d_height_meters: t.calculatedHeight,
        height_uncertainty_meters: t.heightUncertainty,
        ground_range_rg_meters: t.groundRangeRg,
        shadow_length_l_meters: t.shadowLengthL,
        object_dimensions_meters: {
          length: t.objectLength,
          width: t.objectWidth,
          height: t.calculatedHeight,
        },
        ai_confidence_pct: +(t.aiConfidence * 100).toFixed(1),
        fused_risk_score_pct: t.fusedRiskScore,
        ping_index: t.pingIndex,
        timestamp_utc: t.timestamp,
        rejection_reason: t.rejectionReason || null,
      })),
    };
  };

  // Export structured JSON
  const handleExportJSON = () => {
    const data = getDetectionJsonData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AQUAGHOST_Detections_${telemetry.missionId}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export structured CSV
  const handleExportCSV = () => {
    const headers = [
      'Target_ID',
      'Classification',
      'Physics_Gate_Status',
      'Latitude',
      'Longitude',
      'Calculated_3D_Height_m',
      'Height_Uncertainty_m',
      'Ground_Range_Rg_m',
      'Shadow_Length_L_m',
      'Object_Length_m',
      'Object_Width_m',
      'AI_Confidence_Pct',
      'Fused_Marine_Risk_Pct',
      'Water_Depth_m',
      'Sensor_Altitude_H_m',
      'Ping_Index',
      'Timestamp_UTC',
      'Rejection_Reason',
    ];

    const rows = targets.map((t) => [
      t.id,
      `"${t.name}"`,
      t.status,
      t.latitude.toFixed(6),
      t.longitude.toFixed(6),
      t.calculatedHeight.toFixed(3),
      t.heightUncertainty.toFixed(3),
      t.groundRangeRg.toFixed(2),
      t.shadowLengthL.toFixed(2),
      t.objectLength.toFixed(2),
      t.objectWidth.toFixed(2),
      (t.aiConfidence * 100).toFixed(1),
      t.fusedRiskScore,
      t.depthMeters,
      telemetry.auvAltitudeH,
      t.pingIndex,
      t.timestamp,
      `"${t.rejectionReason || 'None - Confirmed Hazard'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AQUAGHOST_Anomaly_Report_${telemetry.missionId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export structured GeoJSON
  const handleExportGeoJSON = () => {
    const geojson = {
      type: 'FeatureCollection',
      mission_metadata: {
        system: "AQUAGHOST",
        mission_id: telemetry.missionId,
        location: telemetry.locationName,
        auv_altitude_h_m: telemetry.auvAltitudeH,
        max_slant_range_m: telemetry.maxSlantRange,
        frequency_khz: telemetry.operatingFrequencyKhz,
        exported_at: new Date().toISOString(),
      },
      features: targets.map((t) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [t.longitude, t.latitude, -t.depthMeters],
        },
        properties: {
          target_id: t.id,
          name: t.name,
          status: t.status,
          is_hazard: t.status === 'CONFIRMED_HAZARD',
          latitude: t.latitude,
          longitude: t.longitude,
          calculated_3d_height_m: t.calculatedHeight,
          height_uncertainty_m: t.heightUncertainty,
          ground_range_rg_m: t.groundRangeRg,
          shadow_length_m: t.shadowLengthL,
          dimensions: {
            length_m: t.objectLength,
            width_m: t.objectWidth,
            height_m: t.calculatedHeight,
          },
          ai_confidence: t.aiConfidence,
          fused_risk_score: t.fusedRiskScore,
          ping_index: t.pingIndex,
          timestamp: t.timestamp,
          rejection_reason: t.rejectionReason || null,
        },
      })),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(geojson, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `AQUAGHOST_GeoTags_${telemetry.missionId}.geojson`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyCoord = (tgt: SonarTarget) => {
    navigator.clipboard.writeText(`${tgt.latitude.toFixed(6)}, ${tgt.longitude.toFixed(6)}`);
    setCopiedCoordId(tgt.id);
    setTimeout(() => setCopiedCoordId(null), 2000);
  };

  const handleCopyJsonToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(getDetectionJsonData(), null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div id="anomaly-reporting-module" className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
      {/* Title & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
              FLOWCHART NODE 8
            </span>
            <span className="text-xs font-mono text-slate-400">
              Anomalous Reporting & Geotagging Engine
            </span>
          </div>
          <h2 className="text-lg font-bold text-white mt-1">
            Structured Sonar Anomaly Audit & Marine Threat Log
          </h2>
        </div>

        {/* Export Buttons: JSON, CSV, GeoJSON, View JSON */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="export-json-btn"
            onClick={handleExportJSON}
            title="Download full detection data as JSON format with Latitude and Longitude"
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 shadow-sm shadow-amber-950"
          >
            <FileJson className="w-3.5 h-3.5" />
            Download JSON
          </button>

          <button
            id="export-csv-btn"
            onClick={handleExportCSV}
            title="Download detection audit log as CSV format with Latitude and Longitude"
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-emerald-700 hover:bg-emerald-600 text-white flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 shadow-sm shadow-emerald-950"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Download CSV
          </button>

          <button
            id="export-geojson-btn"
            onClick={handleExportGeoJSON}
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-cyan-700 hover:bg-cyan-600 text-white flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 shadow-sm shadow-cyan-950"
          >
            <FileCode className="w-3.5 h-3.5" />
            Download GeoJSON
          </button>

          <button
            id="view-json-modal-btn"
            onClick={() => setShowJsonModal(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            View JSON Output
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-slate-800 text-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Anomaly Detections ({targets.length})
          </button>
          <button
            onClick={() => setFilter('confirmed')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              filter === 'confirmed'
                ? 'bg-rose-950/80 text-rose-300 font-semibold border border-rose-800/80'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Confirmed Hazards Only ({targets.filter((t) => t.status === 'CONFIRMED_HAZARD').length})
          </button>
          <button
            onClick={() => setFilter('rejected')}
            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
              filter === 'rejected'
                ? 'bg-slate-800 text-slate-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Physics Gate Rejected ({targets.filter((t) => t.status === 'REJECTED_FALSE_POSITIVE').length})
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search anomaly by ID or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-64"
          />
        </div>
      </div>

      {/* Structured Table with Explicit Latitude & Longitude Columns */}
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Target ID</th>
              <th className="py-2.5 px-3">Classification</th>
              <th className="py-2.5 px-3">Gate Status</th>
              <th className="py-2.5 px-3 text-cyan-300">LATITUDE</th>
              <th className="py-2.5 px-3 text-cyan-300">LONGITUDE</th>
              <th className="py-2.5 px-3">3D Height (h)</th>
              <th className="py-2.5 px-3">Shadow (L)</th>
              <th className="py-2.5 px-3">Ground Range</th>
              <th className="py-2.5 px-3">AI / Risk</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {filteredTargets.map((tgt) => {
              const isConfirmed = tgt.status === 'CONFIRMED_HAZARD';
              const isSelected = selectedTarget?.id === tgt.id;

              return (
                <tr
                  key={tgt.id}
                  onClick={() => onSelectTarget(tgt)}
                  className={`hover:bg-slate-900/70 transition-colors cursor-pointer ${
                    isSelected ? 'bg-amber-950/20 border-l-2 border-amber-400' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                    {tgt.id}
                  </td>
                  <td className="py-2.5 px-3 max-w-xs truncate">
                    {tgt.name}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {isConfirmed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        HAZARD
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                        <XCircle className="w-2.5 h-2.5" />
                        REJECTED
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap font-bold text-cyan-300">
                    {tgt.latitude.toFixed(6)}° N
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap font-bold text-cyan-300">
                    {tgt.longitude.toFixed(6)}° E
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap font-bold">
                    <span className={isConfirmed ? 'text-rose-400' : 'text-slate-400'}>
                      {tgt.calculatedHeight.toFixed(2)}m
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal"> (±{tgt.heightUncertainty.toFixed(2)}m)</span>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-indigo-300">
                    {tgt.shadowLengthL.toFixed(1)}m
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-sky-300">
                    {tgt.groundRangeRg.toFixed(1)}m
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">{(tgt.aiConfidence * 100).toFixed(0)}%</span>
                      <span className="text-slate-600">/</span>
                      <span className={`font-bold ${isConfirmed ? 'text-rose-400' : 'text-slate-500'}`}>
                        {tgt.fusedRiskScore}%
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyCoord(tgt);
                      }}
                      title="Copy Lat/Lon"
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-cyan-300 border border-slate-700 inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCoordId === tgt.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span className="text-[10px]">{copiedCoordId === tgt.id ? 'Copied' : 'Copy GPS'}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* JSON Viewer Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileJson className="w-5 h-5 text-amber-400" />
                <h3 className="font-mono font-bold text-white text-sm">
                  AQUAGHOST Detection Dataset Output (JSON Format)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyJsonToClipboard}
                  className="px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedJson ? 'Copied to Clipboard' : 'Copy JSON'}</span>
                </button>
                <button
                  onClick={handleExportJSON}
                  className="px-2.5 py-1 rounded text-xs bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .json</span>
                </button>
                <button
                  onClick={() => setShowJsonModal(false)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-auto flex-1 font-mono text-xs bg-slate-950 text-slate-300 selection:bg-cyan-500 selection:text-slate-950">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(getDetectionJsonData(), null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
