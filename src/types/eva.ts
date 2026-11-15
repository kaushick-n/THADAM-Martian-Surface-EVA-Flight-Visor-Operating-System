/**
 * THADAM - Martian Extravehicular Activity (EVA) Flight Traverse & Visor Operating System
 * Strongly-typed data models for geophysical, biomechanical, routing, and HUD telemetry.
 */

export interface TerrainCell {
  x: number;                    // Grid coordinate X [0..47]
  y: number;                    // Grid coordinate Y [0..47]
  elevation: number;            // Elevation in meters relative to datum
  slope: number;                // Terrain slope in degrees [0..90]
  thermalInertia: number;       // THEMIS thermal inertia in TIU (J m^-2 K^-1 s^-1/2) [150..600]
  hydrationIndex: number;       // CRISM hydration spectral ratio [0.0..1.0]
  radDoseRate: number;          // Surface radiation dose rate in microSieverts/hour [18.0..45.0]
  uhfLoS: boolean;              // UHF Line-of-Sight visibility from Habitat 2.8m mast
  uhfSignalStrength: number;    // Signal strength normalized [0.0..1.0]
  cost: number;                 // Normalized cost calculated for active profile
  lat: number;                  // Martian latitude in decimal degrees
  lon: number;                  // Martian longitude in decimal degrees
}

export type WaypointType = 'HAB' | 'SCIENCE' | 'SAMPLE' | 'HAZARD' | 'COMM_RELAY';

export interface Waypoint {
  id: string;
  name: string;
  x: number;
  y: number;
  elevation: number;
  lat: number;
  lon: number;
  type: WaypointType;
  scienceValue: number;         // Scientific priority score [0..100]
  sampleType?: string;          // E.g. "Sulfate Vein", "Hydrated Mudstone", "Vesicular Basalt"
  description: string;
  notes?: string;
}

export interface WeatherState {
  sol: number;
  solarZenithAngle: number;     // in degrees
  ambientTempCelsius: number;   // -110°C to +5°C
  atmosphericPressurePa: number;// e.g. 610 Pa (~0.006 atm)
  dustOpticalDepthTau: number;  // Optical depth tau [0.3 to 2.5]
  radiationFluxMicroSvPerHour: number; // Surface RAD rate
  windSpeedMps: number;         // e.g. 4.5 m/s
  windDirectionDeg: number;     // 0-360°
}

export interface SiteConfig {
  id: string;
  name: string;
  region: string;
  centerLat: number;
  centerLon: number;
  description: string;
  baseElevationOffset: number;  // in meters relative to Mars MOLA datum
  habPosition: { x: number; y: number; elevation: number };
  waypoints: Waypoint[];
  weather: WeatherState;
  geologicalContext: string;
  hiriseProductUrl?: string;
}

export type RouteProfile = 'LOW_O2_SAFE' | 'MAX_SCIENCE' | 'EMERGENCY_HAB_ABORT';

export type DisplayMode = 'HABITAT_3D' | 'GLOVED_TABLET' | 'HELMET_HUD' | 'SPLIT_OPS';

export interface RouteMetrics {
  totalDistanceMeters: number;
  estimatedTimeMinutes: number;
  totalO2ConsumedLiters: number;
  totalRadDoseMicroSv: number;
  avgWorkloadWatts: number;
  peakWorkloadWatts: number;
  maxSlopeDeg: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  walkbackLimitRadiusMeters: number;
  walkbackSafe: boolean;
  path: TerrainCell[];
  waypointArrivals: {
    waypointId: string;
    stepIndex: number;
    distanceSoFarMeters: number;
    o2BurnSoFarLiters: number;
    elapsedMinutes: number;
  }[];
}

export interface AgentTelemetry {
  id: 'EV-1' | 'EV-2' | 'ROVER-01';
  callsign: string;
  role: string;
  x: number;
  y: number;
  elevation: number;
  heartRateBpm: number;
  suitPressureKPa: number;       // Nominal 29.6 kPa (4.3 psi)
  o2RemainingPct: number;        // Primary tank percentage
  o2RemainingLiters: number;     // Liters of O2 remaining (tank capacity: 1200L)
  batteryRemainingPct: number;   // Suit battery percentage
  coreTempCelsius: number;       // Astronaut core body temp (~37.0°C)
  workloadWatts: number;         // Current metabolic output
  radCumulativeMicroSv: number;  // Accumulated radiation dose during this EVA
  status: 'NOMINAL' | 'WARNING' | 'CRITICAL' | 'ABORTING';
}

export interface GroundTruthPhoto {
  id: string;
  camera: string;
  earthDate: string;
  sol: number;
  imgSrc: string;
  caption: string;
  featureCallout: string;
  distanceMeters: number;
  bearingDeg: number;
  mineralTarget: string;
}

export interface SimulationState {
  isPlaying: boolean;
  playbackSpeed: number;         // 1x, 2x, 5x
  currentStepIndex: number;      // Position along route.path
  activeAgentId: 'EV-1' | 'EV-2' | 'ROVER-01';
}
