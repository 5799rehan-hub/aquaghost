"""
=============================================================================
AQUAGHOST-SONAR: Edge AI & Acoustic Physics Pipeline for Marine Debris Detection
Module 2: The 3D Shadow Risk Engine (Node 5 & 7)
Target Platform: NVIDIA Jetson Orin / Xavier / Nano (Edge Autonomous Sonar)
Author: AQUAGHOST-SONAR Core Engineering Team (Smart India Hackathon)
=============================================================================
"""

import numpy as np
from typing import Dict, Any, List, Optional, Tuple, Union
from dataclasses import dataclass, asdict


@dataclass
class BoundingBox:
    """Represents a 2D bounding box [x_min, y_min, x_max, y_max]."""
    x_min: float
    y_min: float
    x_max: float
    y_max: float

    @property
    def width(self) -> float:
        return max(0.0, self.x_max - self.x_min)

    @property
    def height(self) -> float:
        return max(0.0, self.y_max - self.y_min)

    @property
    def center_x(self) -> float:
        return (self.x_min + self.x_max) / 2.0

    @property
    def center_y(self) -> float:
        return (self.y_min + self.y_max) / 2.0


@dataclass
class PhysicsAssessment:
    """Structured assessment output from the 3D Shadow Risk Engine."""
    target_id: str
    status: str                       # 'CONFIRMED_HAZARD' or 'REJECTED_FALSE_POSITIVE'
    classification: str               # 'Ghost Net / Suspended Debris' or 'Flat Rock / Sand Ripple'
    calculated_height_m: float        # True physical elevation above seabed (h)
    shadow_length_m: float            # Physical acoustic shadow extent (L_shadow)
    ground_range_m: float             # Distance from sensor nadir track to object (R_g)
    sensor_altitude_m: float          # Telemetry altitude H
    height_uncertainty_m: float       # Propagated 1-sigma uncertainty +/- error
    ai_raw_confidence: float          # Neural network backbone detector confidence [0, 1]
    fused_risk_score: float           # Physics-gated marine threat score [0.0 - 100.0%]
    rejection_reason: Optional[str]
    dimensions_m: Dict[str, float]


class PhysicsRiskEngine:
    """
    Deterministic 3D Acoustic Shadow Risk Engine and False-Positive Validation Gate.
    
    Acoustic Physics Principle:
      In side-scan sonar, an elevated 3D object on the seafloor blocks the expanding
      acoustic wave packet, creating a distinctive trailing acoustic shadow behind
      the specular acoustic highlight.
      
      From the geometry of similar right triangles:
          h / H = L_shadow / (R_g + L_shadow)
          
      Rearranging gives the exact physical height:
          h = (H * L_shadow) / (R_g + L_shadow)
          
      Where:
          H        = Sensor altitude above seafloor in meters (from DVL or altimeter)
          L_shadow = Physical length of the acoustic shadow cast on the seabed
          R_g      = Physical ground range from nadir ground track to object base
          h        = Physical vertical relief of object off the seafloor
          
    Validation Gate Decision Logic:
      - If h < min_height_threshold_m (default 0.20m):
        The detected anomaly is physically flat with negligible seabed relief.
        REJECT as "Flat Rock / Sand Ripple / Seabed Texture".
      - If h >= min_height_threshold_m:
        The anomaly stands proud of the seafloor (monofilament net, derelict cage,
        entangled trawler gear).
        CONFIRM as "Confirmed Hazard" and compute composite marine risk score.
    """

    def __init__(
        self,
        min_height_threshold_m: float = 0.20,
        critical_height_m: float = 1.20,
        sensor_altitude_sigma_m: float = 0.05,
        shadow_boundary_sigma_px: float = 2.0,
    ):
        """
        Initialize the Physics Risk Engine.

        Args:
            min_height_threshold_m: Minimum physical 3D elevation (h) required to qualify
                                    as an elevated hazard (default 0.20m = 20cm).
            critical_height_m: Height threshold at which a ghost net is deemed critical hazard.
            sensor_altitude_sigma_m: 1-sigma measurement error of AUV altimeter/DVL.
            shadow_boundary_sigma_px: Expected edge uncertainty in shadow segmentation.
        """
        self.min_height_threshold_m = float(min_height_threshold_m)
        self.critical_height_m = float(critical_height_m)
        self.sensor_altitude_sigma_m = float(sensor_altitude_sigma_m)
        self.shadow_boundary_sigma_px = float(shadow_boundary_sigma_px)

    def calculate_3d_height(
        self,
        altitude_h: float,
        ground_range_rg: float,
        shadow_length_l: float,
    ) -> Tuple[float, float]:
        """
        Compute true 3D physical height (h) and propagated physical error (sigma_h).
        
        Formula:
            h = (H * L_shadow) / (R_g + L_shadow)
            
        Error propagation via partial derivatives:
            sigma_h = sqrt( (dh/dH * sigma_H)^2 + (dh/dL * sigma_L)^2 )
            where:
                dh/dH = L / (R_g + L)
                dh/dL = (H * R_g) / ((R_g + L)^2)

        Args:
            altitude_h: Sensor altitude in meters (H > 0).
            ground_range_rg: Ground range from nadir in meters (R_g >= 0).
            shadow_length_l: Physical length of trailing acoustic shadow (L >= 0).

        Returns:
            Tuple of (height_h_m, uncertainty_sigma_h_m).
        """
        H = max(float(altitude_h), 0.05)
        Rg = max(float(ground_range_rg), 0.1)
        L = max(float(shadow_length_l), 0.0)

        denominator = Rg + L
        if denominator <= 1e-5:
            return 0.0, 0.0

        # Exact physical elevation
        h = (H * L) / denominator

        # Partial derivatives for uncertainty propagation
        dh_dH = L / denominator
        dh_dL = (H * Rg) / (denominator ** 2)

        # Assuming shadow boundary length uncertainty ~ 0.08m
        sigma_L = 0.08
        var_h = (dh_dH * self.sensor_altitude_sigma_m) ** 2 + (dh_dL * sigma_L) ** 2
        sigma_h = float(np.sqrt(var_h))

        return float(h), sigma_h

    def evaluate_detection(
        self,
        object_bbox: Union[BoundingBox, Tuple[float, float, float, float]],
        shadow_bbox: Optional[Union[BoundingBox, Tuple[float, float, float, float]]],
        sensor_altitude_h: float,
        meters_per_pixel: float,
        nadir_x_coord_px: float,
        ai_detector_confidence: float = 0.85,
        target_id: str = "TGT-001",
        swath_side: str = "starboard",
    ) -> PhysicsAssessment:
        """
        Evaluate a candidate object detection against its associated acoustic shadow.
        Acts as the primary hard validation gate in the AQUAGHOST-SONAR pipeline.

        Args:
            object_bbox: Bounding box of acoustic highlight (x1, y1, x2, y2).
            shadow_bbox: Bounding box of trailing acoustic shadow (or None if no shadow).
            sensor_altitude_h: Telemetry AUV altitude in meters (H).
            meters_per_pixel: Physical ground resolution of preprocessed image (m/px).
            nadir_x_coord_px: Horizontal coordinate corresponding to the nadir ground track.
            ai_detector_confidence: Raw confidence from GhostNetV2 detector [0.0, 1.0].
            target_id: Unique string identifier for target.
            swath_side: 'starboard' (shadows cast rightward) or 'port' (shadows cast leftward).

        Returns:
            PhysicsAssessment with status, true physical height, and risk score.
        """
        # Normalize bboxes
        if isinstance(object_bbox, tuple):
            obj_box = BoundingBox(*object_bbox)
        else:
            obj_box = object_bbox

        # Physical dimensions of the highlight object itself
        obj_width_m = obj_box.width * meters_per_pixel
        obj_length_m = obj_box.height * meters_per_pixel

        # Compute ground range (R_g) from nadir track to center of object
        distance_px_from_nadir = abs(obj_box.center_x - nadir_x_coord_px)
        r_g_m = max(distance_px_from_nadir * meters_per_pixel, 0.5)

        # Case 1: No acoustic shadow detected at all
        if shadow_bbox is None:
            return PhysicsAssessment(
                target_id=target_id,
                status="REJECTED_FALSE_POSITIVE",
                classification="Flat Rock / Sand Ripple",
                calculated_height_m=0.0,
                shadow_length_m=0.0,
                ground_range_m=round(r_g_m, 2),
                sensor_altitude_m=round(sensor_altitude_h, 2),
                height_uncertainty_m=0.02,
                ai_raw_confidence=round(ai_detector_confidence, 3),
                fused_risk_score=0.0,
                rejection_reason="Zero acoustic shadow detected; anomaly has no seabed elevation.",
                dimensions_m={"length_m": round(obj_length_m, 2), "width_m": round(obj_width_m, 2), "height_m": 0.0},
            )

        if isinstance(shadow_bbox, tuple):
            shd_box = BoundingBox(*shadow_bbox)
        else:
            shd_box = shadow_bbox

        # Shadow length along the acoustic propagation radial axis (across-track horizontal dimension)
        shadow_length_px = shd_box.width
        shadow_length_m = max(shadow_length_px * meters_per_pixel, 0.0)

        # Calculate 3D physical height using the exact sonar shadow formula
        h_calculated, sigma_h = self.calculate_3d_height(
            altitude_h=sensor_altitude_h,
            ground_range_rg=r_g_m,
            shadow_length_l=shadow_length_m,
        )

        # HARD VALIDATION GATE: Decision Logic
        if h_calculated < self.min_height_threshold_m:
            # Physical height near 0m -> reject as flat geological seabed feature
            status = "REJECTED_FALSE_POSITIVE"
            classification = "Flat Rock / Sand Ripple"
            rejection_reason = (
                f"Calculated 3D height ({h_calculated:.2f}m) is below minimum "
                f"hazard threshold ({self.min_height_threshold_m:.2f}m). "
                f"Classified as flat geological feature (rock outcrop or bedform)."
            )
            fused_risk_score = max(0.0, round(float(ai_detector_confidence * 8.0), 1))  # Scaled down to insignificance
        else:
            # Physical height >= threshold -> Confirmed elevated man-made hazard
            status = "CONFIRMED_HAZARD"
            classification = "Ghost Net / Suspended Debris"
            rejection_reason = None

            # Calculate composite fused marine risk score (0 - 100%)
            # High vertical relief + large physical footprint + high AI confidence = severe hazard
            height_factor = min(h_calculated / self.critical_height_m, 1.5)
            area_m2 = max(obj_width_m * obj_length_m, 0.2)
            area_factor = min(area_m2 / 10.0, 1.2)

            fused_risk = (
                0.40 * (ai_detector_confidence * 100.0)
                + 0.40 * (height_factor * 80.0)
                + 0.20 * (area_factor * 80.0)
            )
            fused_risk_score = round(float(np.clip(fused_risk, 10.0, 99.8)), 1)

        return PhysicsAssessment(
            target_id=target_id,
            status=status,
            classification=classification,
            calculated_height_m=round(h_calculated, 3),
            shadow_length_m=round(shadow_length_m, 2),
            ground_range_m=round(r_g_m, 2),
            sensor_altitude_m=round(sensor_altitude_h, 2),
            height_uncertainty_m=round(sigma_h, 3),
            ai_raw_confidence=round(ai_detector_confidence, 3),
            fused_risk_score=fused_risk_score,
            rejection_reason=rejection_reason,
            dimensions_m={
                "length_m": round(obj_length_m, 2),
                "width_m": round(obj_width_m, 2),
                "height_m": round(h_calculated, 2),
            },
        )

    def filter_detections_batch(
        self,
        candidate_detections: List[Dict[str, Any]],
        sensor_altitude_h: float,
        meters_per_pixel: float,
        nadir_x_coord_px: float,
    ) -> Tuple[List[PhysicsAssessment], List[PhysicsAssessment]]:
        """
        Filter a batch of candidate detections from the neural network heads.

        Returns:
            Tuple of (confirmed_hazards_list, rejected_false_positives_list)
        """
        confirmed: List[PhysicsAssessment] = []
        rejected: List[PhysicsAssessment] = []

        for idx, det in enumerate(candidate_detections):
            target_id = det.get("id", f"TGT-{idx+1:03d}")
            obj_box = det["object_bbox"]
            shd_box = det.get("shadow_bbox", None)
            conf = det.get("confidence", 0.85)

            assessment = self.evaluate_detection(
                object_bbox=obj_box,
                shadow_bbox=shd_box,
                sensor_altitude_h=sensor_altitude_h,
                meters_per_pixel=meters_per_pixel,
                nadir_x_coord_px=nadir_x_coord_px,
                ai_detector_confidence=conf,
                target_id=target_id,
            )

            if assessment.status == "CONFIRMED_HAZARD":
                confirmed.append(assessment)
            else:
                rejected.append(assessment)

        return confirmed, rejected
