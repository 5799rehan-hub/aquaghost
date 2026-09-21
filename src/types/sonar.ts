export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AnomalyStatus = 'CONFIRMED_HAZARD' | 'REJECTED_FALSE_POSITIVE';

export interface SonarTarget {
  id: string;
  name: string;
  type: 'ghost_net' | 'derelict_trap' | 'flat_rock' | 'sand_ripple' | 'sunken_cylinder';
  highlightBBox: BBox;
  shadowBBox: BBox | null;
  fusedBBox?: BBox; // Unified multi-scale boundary box combining highlight echo & shadow relief
  groundRangeRg: number; // in meters
  shadowLengthL: number; // in meters
  objectLength: number; // in meters
  objectWidth: number; // in meters
  calculatedHeight: number; // in meters: h = (H * L) / (Rg + L)
  heightUncertainty: number; // sigma_h
  aiConfidence: number; // 0.0 - 1.0 from GhostNetV2
  // Multi-Scale Feature Fusion Tri-Heads
  objectDetectorScore: number; // Head A: highlight echo detection confidence (0.0 - 1.0)
  shadowAnalysisScore: number; // Head B: acoustic shadow presence & boundary confidence (0.0 - 1.0)
  anomalyDetectorScore: number; // Head C: non-seafloor textural anomaly density score (0.0 - 1.0)
  triFeatureAgreement: number; // % cross-head feature consistency (0 - 100%)
  fusedConfidenceScore: number; // Final fused confidence score after multi-scale comparison (0 - 100%)
  fusedRiskScore: number; // 0 - 100%
  status: AnomalyStatus;
  rejectionReason?: string;
  latitude: number;
  longitude: number;
  depthMeters: number;
  pingIndex: number;
  timestamp: string;
}

export interface SonarMissionTelemetry {
  missionId: string;
  locationName: string;
  auvAltitudeH: number; // meters (H)
  maxSlantRange: number; // meters (R_s,max)
  operatingFrequencyKhz: number; // e.g. 450 kHz
  soundSpeed: number; // m/s (1500)
  waterDepth: number; // meters
  headingDeg: number;
  speedKnots: number;
  batteryPercent: number;
  jetsonGpuLoad: number; // %
  jetsonTempC: number;
  jetsonPowerWatts: number;
  fps: number;
}

export interface PreprocessingParams {
  tvgSpreadingFactor: number; // e.g. 35 dB
  absorptionAlpha: number; // dB/km (e.g. 95)
  speckleKernelSize: number; // 3, 5, 7
  speckleStrength: number; // 0.1 - 1.0
  unwarpPythagorean: boolean;
  minHeightThreshold: number; // e.g. 0.20 meters
}

export type ViewFilterMode = 'raw' | 'tvg' | 'speckle_filtered' | 'ground_unwarped';

export type WorkspaceMode = 'live' | 'upload';

export interface SonarBenchmarkPreset {
  id: string;
  name: string;
  location: string;
  description: string;
  altitudeH: number;
  maxSlantRange: number;
  operatingFrequencyKhz: number;
  sampleTargets: SonarTarget[];
}
