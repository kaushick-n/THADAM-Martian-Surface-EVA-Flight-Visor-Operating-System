/**
 * Martian EVA Biomechanics & Life Support Engine
 * Incorporates Santee et al. and Minetti metabolic walking models adapted for Mars 0.38g gravity,
 * xEMU suit mass, terrain friction penalties, O2 burn rates, and Apollo/Artemis 20% Walkback Limit.
 */

export const MARS_GRAVITY = 3.721; // m/s^2 (0.38 Earth g)
export const ASTRONAUT_MASS_KG = 80.0;
export const XEMU_SUIT_MASS_KG = 140.0;
export const TOTAL_EVA_MASS_KG = ASTRONAUT_MASS_KG + XEMU_SUIT_MASS_KG; // 220 kg
export const WEIGHT_ON_MARS_NEWTONS = TOTAL_EVA_MASS_KG * MARS_GRAVITY; // 818.62 N

export const PRIMARY_O2_CAPACITY_LITERS = 1200.0; // Standard 8-hr EVA tank
export const EMERGENCY_O2_RESERVE_FRACTION = 0.20; // Apollo/Artemis non-negotiable 20% floor
export const EMERGENCY_O2_RESERVE_LITERS = PRIMARY_O2_CAPACITY_LITERS * EMERGENCY_O2_RESERVE_FRACTION; // 240 L
export const USABLE_O2_BUDGET_LITERS = PRIMARY_O2_CAPACITY_LITERS - EMERGENCY_O2_RESERVE_LITERS; // 960 L

export const NOMINAL_WALK_SPEED_MPS = 0.8; // Standard suited EVA velocity on Mars
export const SPRINT_ABORT_SPEED_MPS = 1.2; // Maximum emergency return velocity

// Joules per Liter of O2 metabolized by human respiratory system
export const JOULES_PER_LITER_O2 = 20900.0; 

export interface StepBiomechanics {
  workloadWatts: number;
  o2BurnRateLitersPerMin: number;
  o2ConsumedThisStepLiters: number;
  timeSeconds: number;
  radDoseMicroSv: number;
}

export class BiomechanicsEngine {
  /**
   * Calculates metabolic power consumption in Watts for suited locomotion across a terrain segment.
   * @param slopeDegrees Slope angle in degrees (-45° to +45°)
   * @param thermalInertia THEMIS thermal inertia (low TIU = loose dust drag)
   * @param speedMps Traverse speed in m/s (default 0.8 m/s)
   */
  public static calculateWorkloadWatts(
    slopeDegrees: number,
    thermalInertia: number,
    speedMps = NOMINAL_WALK_SPEED_MPS
  ): number {
    // Baseline metabolic resting rate of suited astronaut + life support thermal control
    const pBaseRest = 190.0; // Watts

    // Level locomotion cost on Mars in pressurized xEMU suit
    // Minetti walking equation scaled for 0.38g and suit joint resistance (factor 1.28)
    const levelWalkingWork = (WEIGHT_ON_MARS_NEWTONS * speedMps * 0.24) * 1.28; // ~250W

    const slopeRad = (slopeDegrees * Math.PI) / 180.0;
    const sinSlope = Math.sin(slopeRad);

    let slopeWork = 0;
    if (slopeDegrees >= 0) {
      // Incline: gravitational potential work + muscle inefficiency
      slopeWork = WEIGHT_ON_MARS_NEWTONS * speedMps * (sinSlope + 1.8 * sinSlope * sinSlope);
    } else {
      // Decline: negative gravitational work with braking stabilization
      // Energy drops until ~ -10 degrees, then rises due to knee joint braking resistance
      if (slopeDegrees > -12) {
        slopeWork = WEIGHT_ON_MARS_NEWTONS * speedMps * (0.6 * sinSlope);
      } else {
        slopeWork = WEIGHT_ON_MARS_NEWTONS * speedMps * (0.3 * Math.abs(sinSlope));
      }
    }

    // Terrain friction multiplier: loose Martian dust (TIU < 220) slips under boot lugs
    let surfaceDragMultiplier = 1.0;
    if (thermalInertia < 220) {
      // Up to 35% extra metabolic burn churning through soft eolian drifts
      surfaceDragMultiplier = 1.0 + 0.35 * (1.0 - Math.max(0, thermalInertia - 120) / 100);
    } else if (thermalInertia > 500) {
      // Firm exposed bedrock: optimal traction
      surfaceDragMultiplier = 0.96;
    }

    const netWorkload = (pBaseRest + levelWalkingWork + slopeWork) * surfaceDragMultiplier;

    // Constrain within realistic human physiological envelope [180W .. 750W]
    return Math.max(180.0, Math.min(750.0, netWorkload));
  }

  /**
   * Converts power (Watts) and duration (seconds) into Liters of Oxygen consumed.
   */
  public static wattsToO2Liters(workloadWatts: number, durationSeconds: number): number {
    const totalJoules = workloadWatts * durationSeconds;
    return totalJoules / JOULES_PER_LITER_O2;
  }

  /**
   * Evaluates the single step transition between two adjacent terrain cells.
   */
  public static evaluateStep(
    distanceMeters: number,
    elevationDeltaMeters: number,
    thermalInertia: number,
    radDoseRateMicroSvPerHour: number,
    speedMps = NOMINAL_WALK_SPEED_MPS
  ): StepBiomechanics {
    const slopeDegrees = Math.atan2(elevationDeltaMeters, distanceMeters) * (180.0 / Math.PI);
    const workloadWatts = this.calculateWorkloadWatts(slopeDegrees, thermalInertia, speedMps);

    const timeSeconds = distanceMeters / speedMps;
    const o2ConsumedThisStepLiters = this.wattsToO2Liters(workloadWatts, timeSeconds);
    const o2BurnRateLitersPerMin = (workloadWatts * 60.0) / JOULES_PER_LITER_O2;
    const radDoseMicroSv = radDoseRateMicroSvPerHour * (timeSeconds / 3600.0);

    return {
      workloadWatts: Math.round(workloadWatts),
      o2BurnRateLitersPerMin: parseFloat(o2BurnRateLitersPerMin.toFixed(3)),
      o2ConsumedThisStepLiters: parseFloat(o2ConsumedThisStepLiters.toFixed(4)),
      timeSeconds: parseFloat(timeSeconds.toFixed(1)),
      radDoseMicroSv: parseFloat(radDoseMicroSv.toFixed(4)),
    };
  }

  /**
   * Computes the dynamic Apollo/Artemis 20% Walkback Limit radius in meters from the Habitat.
   * This defines the safe envelope circle beyond which an emergency sprint back to Hab
   * would exhaust the 20% emergency reserve floor (240 Liters).
   * @param currentUsableO2Remaining Liters of O2 remaining above the 240L reserve
   */
  public static calculateWalkbackLimitRadius(currentUsableO2Remaining: number): number {
    // In an emergency sprint (1.2 m/s), workload averages ~420W
    const sprintWatts = 420.0;
    const sprintSpeed = SPRINT_ABORT_SPEED_MPS;

    // Liters of O2 consumed per second of sprinting
    const o2BurnPerSec = sprintWatts / JOULES_PER_LITER_O2; // ~0.0201 L/s

    // Total seconds of sprint allowable by the remaining usable O2 budget (capped at usable max)
    const availableSeconds = Math.max(0, currentUsableO2Remaining) / o2BurnPerSec;

    // Safe return radius in meters (with 15% safety detour buffer)
    const maxRadiusMeters = (availableSeconds * sprintSpeed) * 0.85;

    // Clamp to realistic traverse perimeter for a 600m local DEM area
    return Math.max(80.0, Math.min(550.0, maxRadiusMeters));
  }
}
