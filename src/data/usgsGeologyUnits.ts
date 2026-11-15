/**
 * USGS SIM 3292 Chronostratigraphic Geologic Units of Mars
 * Reference: Tanaka, K.L., Skinner, J.A., Dohm, J.M., et al. (2014)
 * Geologic Map of Mars, U.S. Geological Survey Scientific Investigations Map 3292.
 */

export interface USGSGeologicUnit {
  symbol: string;               // Formal USGS unit map code (e.g. "AHv", "Hpe", "mNh")
  name: string;                 // Full stratigraphic unit name
  epoch: 'Noachian' | 'Hesperian' | 'Amazonian';
  lithology: string;            // Rock type and sedimentary/igneous classification
  bulkDensityKgM3: number;      // Density for rock mechanics calculations
  compressiveStrengthMpa: number; // Uniaxial compressive strength
  tractionFrictionCoeff: number;// Suited EVA boot friction coefficient [0.0..1.0]
  gcrShieldingScore: number;    // Galactic Cosmic Ray attenuation rating [0..100]
  colorHex: string;             // Official USGS SIM 3292 cartographic tint
  description: string;
}

export const USGS_GEOLOGIC_UNITS: Record<string, USGSGeologicUnit> = {
  // Amazonian Units
  'lAb': {
    symbol: 'lAb',
    name: 'Late Amazonian Basalt / Boxwork Capping Unit',
    epoch: 'Amazonian',
    lithology: 'Dense vesicular tholeiitic basalt & erosion-resistant mineral fracture veins',
    bulkDensityKgM3: 2950,
    compressiveStrengthMpa: 195,
    tractionFrictionCoeff: 0.85,
    gcrShieldingScore: 68,
    colorHex: '#3b82f6',
    description: 'Hardened basaltic flow sheets with resistant gypsum and magnesium sulfate fracture fillings. Superior boot traction, minimal slip hazard.',
  },
  'AHv': {
    symbol: 'AHv',
    name: 'Amazonian and Hesperian Volcanic Unit',
    epoch: 'Amazonian',
    lithology: 'Undifferentiated basaltic lava plains, pahoehoe lobes & pyroclastic ash mantles',
    bulkDensityKgM3: 2750,
    compressiveStrengthMpa: 140,
    tractionFrictionCoeff: 0.72,
    gcrShieldingScore: 55,
    colorHex: '#60a5fa',
    description: 'Extensive lava flows surrounding the Tharsis rise and volcanic plains with occasional brittle collapse pits.',
  },

  // Hesperian Units
  'Hpe': {
    symbol: 'Hpe',
    name: 'Hesperian Ridged Plains Material',
    epoch: 'Hesperian',
    lithology: 'Wrinkle-ridged flood basalt, semi-consolidated duricrust & eolian drift sand',
    bulkDensityKgM3: 2600,
    compressiveStrengthMpa: 95,
    tractionFrictionCoeff: 0.65,
    gcrShieldingScore: 48,
    colorHex: '#fbbf24',
    description: 'Curiosity traverse floor. Rolling plain with moderate dust cover; wrinkle ridges present localized steep inclines.',
  },
  'Hch': {
    symbol: 'Hch',
    name: 'Hesperian Channel Floor Material',
    epoch: 'Hesperian',
    lithology: 'Fluvial conglomerate, coarse gravel bars & scoured bedrock',
    bulkDensityKgM3: 2500,
    compressiveStrengthMpa: 80,
    tractionFrictionCoeff: 0.58,
    gcrShieldingScore: 44,
    colorHex: '#f59e0b',
    description: 'High-energy outflow channel deposits. Unsorted rounded cobbles and loose sand bars increase ankle stabilization workload.',
  },
  'Hsu': {
    symbol: 'Hsu',
    name: 'Hesperian Sulfate-Bearing Unit (Mount Sharp)',
    epoch: 'Hesperian',
    lithology: 'Polyhydrated & monohydrated magnesium sulfate bedrock, cross-bedded sandstones',
    bulkDensityKgM3: 2400,
    compressiveStrengthMpa: 65,
    tractionFrictionCoeff: 0.74,
    gcrShieldingScore: 62,
    colorHex: '#ec4899',
    description: 'Evaporitic saline lakebed strata marking Mars transition to hyper-arid climate. High CRISM hydration absorption.',
  },

  // Noachian Units
  'mNh': {
    symbol: 'mNh',
    name: 'Middle Noachian Highland & Lacustrine Mudstone',
    epoch: 'Noachian',
    lithology: 'Iron-magnesium smectite clays, laminated lacustrine mudstone & phyllosilicates',
    bulkDensityKgM3: 2300,
    compressiveStrengthMpa: 42,
    tractionFrictionCoeff: 0.48,
    gcrShieldingScore: 75,
    colorHex: '#10b981',
    description: 'Ancient aqueous clay deposits in Jezero and Yellowknife Bay. Excellent biosignature entrapment, but powdery scree creates foot slippage.',
  },
  'HNch': {
    symbol: 'HNch',
    name: 'Hesperian-Noachian Channel & Delta Front Conglomerate',
    epoch: 'Noachian',
    lithology: 'Coarse deltaic foreset sandstone, clay lenses & meter-scale basaltic boulders',
    bulkDensityKgM3: 2550,
    compressiveStrengthMpa: 78,
    tractionFrictionCoeff: 0.52,
    gcrShieldingScore: 50,
    colorHex: '#14b8a6',
    description: 'Jezero Delta Front scarp. Steep 15-25° scarp incline with boulder scree funnels requiring active traversal avoidance.',
  },
  'lNl': {
    symbol: 'lNl',
    name: 'Late Noachian Lowland Unit',
    epoch: 'Noachian',
    lithology: 'Brecciated basement bedrock, impact melt sheets & fractured anorthositic crust',
    bulkDensityKgM3: 2850,
    compressiveStrengthMpa: 160,
    tractionFrictionCoeff: 0.80,
    gcrShieldingScore: 70,
    colorHex: '#059669',
    description: 'Ancient pre-impact crater basement. High mechanical integrity and solid boot anchor points.',
  },
};

/**
 * Returns the dominant USGS Geologic Unit for a given Martian location and elevation.
 */
export function getUSGSUnitForSite(siteId: string, elevation: number, slope: number): USGSGeologicUnit {
  if (siteId === 'mount-sharp-boxwork') {
    if (elevation > 40 && slope > 15) return USGS_GEOLOGIC_UNITS['lAb'];
    if (elevation > 28) return USGS_GEOLOGIC_UNITS['Hsu'];
    if (elevation < 16) return USGS_GEOLOGIC_UNITS['mNh'];
    return USGS_GEOLOGIC_UNITS['Hpe'];
  }

  if (siteId === 'jezero-delta') {
    if (slope > 18 || (elevation > 25 && elevation < 45)) return USGS_GEOLOGIC_UNITS['HNch'];
    if (elevation <= 20) return USGS_GEOLOGIC_UNITS['mNh'];
    return USGS_GEOLOGIC_UNITS['Hch'];
  }

  // Olympus Mons Lava Tube
  if (elevation < 15) return USGS_GEOLOGIC_UNITS['lAb'];
  return USGS_GEOLOGIC_UNITS['AHv'];
}
