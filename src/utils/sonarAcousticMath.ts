import { SonarTarget, PreprocessingParams, AnomalyStatus } from '../types/sonar';

/**
 * Deterministic Acoustic Physics calculations for Side-Scan Sonar.
 */

export function calculate3DHeight(
  altitudeH: number,
  groundRangeRg: number,
  shadowLengthL: number
): { heightH: number; sigmaH: number } {
  const H = Math.max(altitudeH, 0.1);
  const Rg = Math.max(groundRangeRg, 0.1);
  const L = Math.max(shadowLengthL, 0.0);

  const denom = Rg + L;
  if (denom <= 0.001) return { heightH: 0, sigmaH: 0 };

  // h = (H * L_shadow) / (R_g + L_shadow)
  const h = (H * L) / denom;

  // Propagated uncertainty assuming sigma_H = 0.05m and sigma_L = 0.08m
  const sigmaH_inst = 0.05;
  const sigmaL = 0.08;
  const dh_dH = L / denom;
  const dh_dL = (H * Rg) / (denom * denom);
  const variance = Math.pow(dh_dH * sigmaH_inst, 2) + Math.pow(dh_dL * sigmaL, 2);
  const sigmaH = Math.sqrt(variance);

  return {
    heightH: Number(h.toFixed(3)),
    sigmaH: Number(sigmaH.toFixed(3)),
  };
}

export function fuseMultiScaleTriFeatures(
  target: SonarTarget,
  altitudeH: number,
  minHeightThreshold: number = 0.20
): {
  fusedConfidenceScore: number;
  triFeatureAgreement: number;
  fusedBBox: { x: number; y: number; width: number; height: number };
  status: AnomalyStatus;
  calculatedHeight: number;
  heightUncertainty: number;
  fusedRiskScore: number;
  rejectionReason?: string;
} {
  const sObj = target.objectDetectorScore ?? target.aiConfidence;
  const sShd = target.shadowAnalysisScore ?? (target.shadowLengthL > 0.5 ? 0.90 : 0.10);
  const sAnom = target.anomalyDetectorScore ?? (target.status === 'CONFIRMED_HAZARD' ? 0.90 : 0.15);

  // Compute 3D physical elevation
  const shadowL = target.shadowLengthL;
  const groundRg = target.groundRangeRg;
  const { heightH, sigmaH } = calculate3DHeight(altitudeH, groundRg, shadowL);

  // Compute Unified Fused Boundary Box (encompassing both echo highlight and shadow relief)
  let fusedBBox = { ...target.highlightBBox };
  if (target.shadowBBox && target.shadowLengthL > 0.1) {
    const minX = Math.min(target.highlightBBox.x, target.shadowBBox.x);
    const minY = Math.min(target.highlightBBox.y, target.shadowBBox.y);
    const maxX = Math.max(
      target.highlightBBox.x + target.highlightBBox.width,
      target.shadowBBox.x + target.shadowBBox.width
    );
    const maxY = Math.max(
      target.highlightBBox.y + target.highlightBBox.height,
      target.shadowBBox.y + target.shadowBBox.height
    );
    fusedBBox = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  // Cross-Feature Comparison & Tri-Feature Agreement calculation
  // Measures consensus between highlight, shadow, and anomaly detectors
  const scoreSpread = Math.max(sObj, sShd, sAnom) - Math.min(sObj, sShd, sAnom);
  const rawAgreement = Math.max(0, (1 - scoreSpread) * 100);

  // Weighted base score: 40% Object, 35% Shadow, 25% Anomaly
  const weightedBase = (0.40 * sObj + 0.35 * sShd + 0.25 * sAnom) * 100;

  // If shadow is missing or relief < threshold, penalize confidence heavily (flat bedrock rejection)
  let finalConfidence = weightedBase;
  let status: AnomalyStatus = 'CONFIRMED_HAZARD';
  let rejectionReason: string | undefined = undefined;

  if (!target.shadowBBox || shadowL <= 0.05 || heightH < minHeightThreshold) {
    status = 'REJECTED_FALSE_POSITIVE';
    // Agreement drops due to severe mismatch between high highlight and absent shadow
    const agreement = Math.min(rawAgreement, 22.0);
    // Confidence penalized to reflect 2D false positive rejection
    finalConfidence = Math.min(weightedBase * 0.18, 15.0);
    rejectionReason = !target.shadowBBox || shadowL <= 0.05
      ? 'Zero acoustic shadow detected. Tri-feature fusion comparison rejected candidate: bedform texture without 3D acoustic relief.'
      : `Calculated 3D height (${heightH.toFixed(2)}m) < ${minHeightThreshold.toFixed(2)}m threshold. Multi-scale feature comparison revealed bright highlight (${Math.round(sObj * 100)}%) without acoustic shadow (${Math.round(sShd * 100)}%) or anomaly texture (${Math.round(sAnom * 100)}%). Classified as flat bedrock.`;

    return {
      fusedConfidenceScore: Number(finalConfidence.toFixed(1)),
      triFeatureAgreement: Number(agreement.toFixed(1)),
      fusedBBox,
      status,
      calculatedHeight: heightH,
      heightUncertainty: sigmaH,
      fusedRiskScore: Math.round(finalConfidence * 0.8),
      rejectionReason,
    };
  }

  // Confirmed 3D Hazard
  const agreement = Math.max(rawAgreement, 82.0);
  finalConfidence = Math.min(Math.max(weightedBase * (agreement / 100), 75.0), 98.5);

  const heightFactor = Math.min(heightH / 1.2, 1.5);
  const areaM2 = Math.max(target.objectLength * target.objectWidth, 0.5);
  const areaFactor = Math.min(areaM2 / 8.0, 1.2);
  const rawRisk = 0.45 * finalConfidence + 0.35 * (heightFactor * 75) + 0.20 * (areaFactor * 80);
  const fusedRiskScore = Math.min(Math.max(Math.round(rawRisk), 20), 99);

  return {
    fusedConfidenceScore: Number(finalConfidence.toFixed(1)),
    triFeatureAgreement: Number(agreement.toFixed(1)),
    fusedBBox,
    status,
    calculatedHeight: heightH,
    heightUncertainty: sigmaH,
    fusedRiskScore,
  };
}

export function evaluatePhysicsRiskGate(
  target: Omit<SonarTarget, 'status' | 'calculatedHeight' | 'heightUncertainty' | 'fusedRiskScore' | 'rejectionReason'>,
  altitudeH: number,
  minHeightThreshold: number = 0.20
): {
  status: AnomalyStatus;
  calculatedHeight: number;
  heightUncertainty: number;
  fusedRiskScore: number;
  fusedConfidenceScore?: number;
  triFeatureAgreement?: number;
  fusedBBox?: { x: number; y: number; width: number; height: number };
  rejectionReason?: string;
} {
  const fusionResult = fuseMultiScaleTriFeatures(target as SonarTarget, altitudeH, minHeightThreshold);
  return {
    status: fusionResult.status,
    calculatedHeight: fusionResult.calculatedHeight,
    heightUncertainty: fusionResult.heightUncertainty,
    fusedRiskScore: fusionResult.fusedRiskScore,
    fusedConfidenceScore: fusionResult.fusedConfidenceScore,
    triFeatureAgreement: fusionResult.triFeatureAgreement,
    fusedBBox: fusionResult.fusedBBox,
    rejectionReason: fusionResult.rejectionReason,
  };
}

/**
 * Apply Time-Varying Gain, speckle filtering, and Pythagorean unwarping
 * to an ImageData canvas buffer for real-time visual inspection.
 */
export function processCanvasSonarFrame(
  sourceCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mode: 'raw' | 'tvg' | 'speckle_filtered' | 'ground_unwarped',
  params: PreprocessingParams,
  altitudeH: number,
  maxSlantRange: number
): ImageData {
  const srcData = sourceCtx.getImageData(0, 0, width, height);
  const data = srcData.data;
  const output = new ImageData(width, height);
  const outData = output.data;

  const midX = width / 2;
  const H = Math.max(altitudeH, 0.5);
  const RsMax = Math.max(maxSlantRange, H + 2.0);
  const RgMax = Math.sqrt(Math.max(RsMax * RsMax - H * H, 1.0));

  // Precompute TVG gain lookup curve
  const tvgCurve = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const distFromMid = Math.abs(x - midX);
    const normalizedRange = distFromMid / midX;
    const rSlant = Math.max(normalizedRange * RsMax, 1.0);
    // dB = spreading * log10(Rs / 1) + 2 * alpha * (Rs - 1) * 1e-3
    const geomLoss = params.tvgSpreadingFactor * Math.log10(rSlant);
    const absLoss = 2.0 * params.absorptionAlpha * (rSlant - 1.0) * 0.001;
    const totalDb = geomLoss + absLoss;
    // convert to linear factor capped for display
    tvgCurve[x] = Math.min(Math.pow(10, totalDb / 38.0), 3.2);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sampleX = x;

      // Slant-to-Ground Pythagorean Unwarping
      if (mode === 'ground_unwarped') {
        const isPort = x < midX;
        const normGround = isPort ? (midX - x) / midX : (x - midX) / midX;
        const rGround = normGround * RgMax;
        // R_s = sqrt(R_g^2 + H^2)
        const rSlantNeeded = Math.sqrt(rGround * rGround + H * H);
        const normSlant = Math.min(rSlantNeeded / RsMax, 1.0);
        sampleX = isPort ? Math.round(midX - normSlant * midX) : Math.round(midX + normSlant * midX);
        sampleX = Math.max(0, Math.min(width - 1, sampleX));
      }

      const srcIdx = (y * width + sampleX) * 4;
      const outIdx = (y * width + x) * 4;

      let r = data[srcIdx];
      let g = data[srcIdx + 1];
      let b = data[srcIdx + 2];

      // Greyscale acoustic intensity
      let intensity = 0.299 * r + 0.587 * g + 0.114 * b;

      // Apply TVG
      if (mode === 'tvg' || mode === 'speckle_filtered' || mode === 'ground_unwarped') {
        const gain = tvgCurve[sampleX];
        intensity = Math.min(255, intensity * gain);
      }

      // Apply Speckle Noise Filter (Homomorphic Log Bilateral approximation)
      if (mode === 'speckle_filtered' || mode === 'ground_unwarped') {
        // Sample 3x3 local mean in log domain
        let logSum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = Math.max(0, Math.min(height - 1, y + dy));
            const nx = Math.max(0, Math.min(width - 1, sampleX + dx));
            const nIdx = (ny * width + nx) * 4;
            const nVal = 0.299 * data[nIdx] + 0.587 * data[nIdx + 1] + 0.114 * data[nIdx + 2];
            logSum += Math.log(nVal + 1);
            count++;
          }
        }
        const filteredVal = Math.exp(logSum / count) - 1;
        // Blend filtered with TVG intensity according to filter strength
        intensity = intensity * (1 - params.speckleStrength * 0.7) + filteredVal * (params.speckleStrength * 0.7);
        intensity = Math.min(255, Math.max(0, intensity));
      }

      // Sonar Copper / Amber palette mapping
      // Classic acoustic high-contrast colormap (Deep Navy -> Amber -> Bright Gold / Specular White)
      const norm = intensity / 255.0;
      let outR = Math.min(255, Math.round(norm * 290));
      let outG = Math.min(255, Math.round(Math.pow(norm, 1.25) * 220));
      let outB = Math.min(255, Math.round(Math.pow(norm, 2.2) * 110));

      outData[outIdx] = outR;
      outData[outIdx + 1] = outG;
      outData[outIdx + 2] = outB;
      outData[outIdx + 3] = 255;
    }
  }

  return output;
}
