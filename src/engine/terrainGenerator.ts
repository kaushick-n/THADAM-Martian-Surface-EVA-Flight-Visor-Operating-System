import { SiteConfig, TerrainCell } from '../types/eva';
import { UHFRaycaster } from './uhfRaycaster';

export class TerrainGenerator {
  public static readonly GRID_SIZE = 48;
  public static readonly CELL_RESOLUTION_METERS = 12.5; // 48 * 12.5m = 600m field of operation

  /**
   * Generates a fully populated 48x48 geophysical grid tailored to the selected Martian site.
   */
  public static generateGrid(site: SiteConfig): TerrainCell[][] {
    const size = this.GRID_SIZE;
    const res = this.CELL_RESOLUTION_METERS;

    // 1. Synthesize elevation matrix based on site geomorphology
    const rawElevations: number[][] = [];
    for (let y = 0; y < size; y++) {
      rawElevations[y] = [];
      for (let x = 0; x < size; x++) {
        rawElevations[y][x] = this.synthesizeElevation(site.id, x, y, size);
      }
    }

    // Ensure the Habitat location matches the site configuration
    rawElevations[site.habPosition.y][site.habPosition.x] = site.habPosition.elevation;

    // 2. Initialize UHF Raycaster for line-of-sight analysis
    const raycaster = new UHFRaycaster(size, size, res);

    const grid: TerrainCell[][] = [];

    for (let y = 0; y < size; y++) {
      grid[y] = [];
      for (let x = 0; x < size; x++) {
        const elevation = rawElevations[y][x];

        // Central difference slope calculation
        const xPrev = x > 0 ? rawElevations[y][x - 1] : elevation;
        const xNext = x < size - 1 ? rawElevations[y][x + 1] : elevation;
        const yPrev = y > 0 ? rawElevations[y - 1][x] : elevation;
        const yNext = y < size - 1 ? rawElevations[y + 1][x] : elevation;

        const dzdx = (xNext - xPrev) / (2 * res);
        const dzdy = (yNext - yPrev) / (2 * res);
        const gradientMagnitude = Math.sqrt(dzdx * dzdx + dzdy * dzdy);
        const slopeDeg = Math.min(85.0, Math.atan(gradientMagnitude) * (180.0 / Math.PI));

        // THEMIS Thermal Inertia (TIU) modeling:
        // Ridge tops & steep scarps blow free of dust = high TIU bedrock
        // Flat depressions collect fine eolian dust drifts = low TIU
        const isRidge = slopeDeg > 14 && elevation > 25;
        const isDepression = elevation < 14;
        let thermalInertia = 340 + Math.sin(x * 0.3) * 60 + Math.cos(y * 0.3) * 50;
        if (isRidge) thermalInertia += 160;
        if (isDepression) thermalInertia -= 140;
        thermalInertia = Math.max(140, Math.min(620, Math.round(thermalInertia)));

        // CRISM Hydration index (clay/sulfate spectral absorption ratio):
        // Concentrated in mineral veins, delta mudstones, and sulfate deposits
        let hydration = 0.18 + 0.12 * Math.sin(x * 0.18 + y * 0.22);
        if (site.id === 'jezero-delta') {
          // Jezero delta front clay unit
          if (x >= 20 && x <= 32 && y >= 18 && y <= 30) {
            hydration += 0.55;
          }
        } else if (site.id === 'mount-sharp-boxwork') {
          // Sulfate vein networks
          const boxworkPattern = Math.abs(Math.sin(x * 0.8) * Math.cos(y * 0.8));
          if (boxworkPattern > 0.45 && elevation > 22) {
            hydration += 0.48;
          }
        } else if (site.id === 'olympus-lava-tube') {
          // Volcanic ash & subsurface condensation in cavern
          if (x >= 15 && x <= 25 && y >= 25 && y <= 42) {
            hydration += 0.62;
          }
        }
        hydration = Math.max(0.04, Math.min(0.96, parseFloat(hydration.toFixed(3))));

        // Surface Radiation Dose Rate (uSv/h):
        // Thinner atmosphere on high peaks increases RAD; caves/depressions offer shielding
        let radDoseRate = site.weather.radiationFluxMicroSvPerHour + (elevation / 50.0) * 4.5;
        if (site.id === 'olympus-lava-tube' && y > 28 && elevation < 15) {
          // Inside lava tube cave: massive basalt shielding reduces radiation drastically
          radDoseRate = Math.max(1.2, 8.0 - (y - 28) * 0.6);
        }
        radDoseRate = parseFloat(radDoseRate.toFixed(2));

        // UHF Line of Sight from Hab Mast
        const rayResult = raycaster.castRay(
          rawElevations,
          site.habPosition.x,
          site.habPosition.y,
          x,
          y
        );

        // Approximate Martian Lat/Lon coordinates for cell
        const latOffset = ((y - size / 2) * res) / 59274.0; // Mars meters per degree lat ~ 59.27 km
        const lonOffset = ((x - size / 2) * res) / (59274.0 * Math.cos((site.centerLat * Math.PI) / 180.0));
        const cellLat = parseFloat((site.centerLat + latOffset).toFixed(5));
        const cellLon = parseFloat((site.centerLon + lonOffset).toFixed(5));

        grid[y][x] = {
          x,
          y,
          elevation: parseFloat(elevation.toFixed(2)),
          slope: parseFloat(slopeDeg.toFixed(2)),
          thermalInertia,
          hydrationIndex: hydration,
          radDoseRate,
          uhfLoS: rayResult.hasLoS,
          uhfSignalStrength: rayResult.signalStrength,
          cost: 1.0, // Initialized; dynamically updated by astarSolver
          lat: cellLat,
          lon: cellLon,
        };
      }
    }

    return grid;
  }

  /**
   * Procedural geomorphology height synthesis per Martian site.
   */
  private static synthesizeElevation(siteId: string, x: number, y: number, size: number): number {
    const nx = x / size;
    const ny = y / size;

    if (siteId === 'mount-sharp-boxwork') {
      // Gale Crater: base slope rising towards Mt. Sharp + intersecting polygonal boxwork ridges
      const baseSlope = (nx * 0.4 + ny * 0.6) * 35.0; // General incline towards summit
      const boxworkLattice = (
        Math.abs(Math.sin(x * 0.75)) * 8.0 +
        Math.abs(Math.cos(y * 0.75)) * 8.0
      );
      const gullyIncision = Math.sin((x - y) * 0.3) * 6.0;
      const microRoughness = Math.sin(x * 1.5 + y * 1.2) * 2.2;
      return Math.max(4.0, 10.0 + baseSlope + boxworkLattice - gullyIncision + microRoughness);
    } 
    
    if (siteId === 'jezero-delta') {
      // Jezero Crater: smooth lake floor transitioning into a steep 15-20m delta scarp and top channel
      const scarpLine = 0.55 + 0.08 * Math.sin(nx * 6.0); // Wavy delta front boundary
      const distFromScarp = (ny - scarpLine);
      let elevation = 12.0;

      if (distFromScarp < -0.05) {
        // Bottomset lake floor (smooth, low elevation)
        elevation = 10.0 + Math.sin(x * 0.4) * 2.0;
      } else if (distFromScarp <= 0.1) {
        // Delta Front Scarp (steep face)
        const t = (distFromScarp + 0.05) / 0.15;
        elevation = 12.0 + t * 26.0 + Math.sin(x * 0.9) * 3.5;
      } else {
        // Topset delta plain (elevated riverbed channels and boulder bars)
        elevation = 38.0 + (ny - 0.65) * 18.0 + Math.sin(x * 0.35 + y * 0.3) * 4.0;
      }

      // Add Kodiak Butte promontory at (x=35, y=20)
      const distKodiak = Math.sqrt((x - 35) ** 2 + (y - 20) ** 2);
      if (distKodiak < 6.0) {
        elevation += (6.0 - distKodiak) * 5.0; // 30m high mesa remnant
      }

      return Math.max(5.0, elevation);
    }

    if (siteId === 'olympus-lava-tube') {
      // Olympus Mons: Volcanic shield slope with a massive skylight pit collapse
      const shieldSlope = (size - y) * 0.7; // Upward volcanic flank slope
      let elevation = 15.0 + shieldSlope + Math.sin(x * 0.5) * 3.0;

      // Collapse Skylight Pit centered around (x=22, y=34) with radius ~ 9 cells
      const dxPit = (x - 22);
      const dyPit = (y - 34);
      const pitRadius = Math.sqrt(dxPit * dxPit + dyPit * dyPit);

      if (pitRadius < 8.5) {
        // Sudden drop into subterranean lava tube
        const depthFactor = Math.cos((pitRadius / 8.5) * (Math.PI / 2));
        elevation -= depthFactor * 32.0; // 32-meter collapse depth
      } else if (pitRadius < 10.5) {
        // Fragile fractured rim uplift
        elevation += (10.5 - pitRadius) * 4.0;
      }

      return Math.max(1.0, elevation);
    }

    // Default undulating terrain
    return 15.0 + Math.sin(nx * 4) * 10.0 + Math.cos(ny * 4) * 10.0;
  }
}
