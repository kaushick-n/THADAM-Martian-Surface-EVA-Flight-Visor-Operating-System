/**
 * UHF Line-of-Sight (LoS) Raycasting Engine
 * Simulates radio frequency coverage on the Martian surface using 3D Bresenham raycasting
 * from the Habitat 2.8-meter comms mast to an astronaut's 1.8-meter helmet transceiver.
 */

export interface RaycastResult {
  hasLoS: boolean;
  signalStrength: number; // 0.0 to 1.0
  obstructionElevation?: number;
  obstructionDistance?: number;
}

export class UHFRaycaster {
  private gridWidth: number;
  private gridHeight: number;
  private cellResolutionMeters: number;

  constructor(gridWidth = 48, gridHeight = 48, cellResolutionMeters = 12.5) {
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.cellResolutionMeters = cellResolutionMeters;
  }

  /**
   * Cast a 3D ray from Habitat mast to target coordinate across the elevation grid.
   * @param elevationGrid 2D array [y][x] of terrain elevations in meters
   * @param habX Habitat grid X
   * @param habY Habitat grid Y
   * @param targetX Astronaut grid X
   * @param targetY Astronaut grid Y
   * @param mastHeightMeters Habitat mast height (default 2.8m)
   * @param astronautAntennaHeight Astronaut receiver height (default 1.8m)
   */
  public castRay(
    elevationGrid: number[][],
    habX: number,
    habY: number,
    targetX: number,
    targetY: number,
    mastHeightMeters = 2.8,
    astronautAntennaHeight = 1.8
  ): RaycastResult {
    // Bounds check
    if (
      habX < 0 || habX >= this.gridWidth || habY < 0 || habY >= this.gridHeight ||
      targetX < 0 || targetX >= this.gridWidth || targetY < 0 || targetY >= this.gridHeight
    ) {
      return { hasLoS: false, signalStrength: 0.0 };
    }

    // If target is directly at the hab
    if (habX === targetX && habY === targetY) {
      return { hasLoS: true, signalStrength: 1.0 };
    }

    const habElev = elevationGrid[habY][habX];
    const targetElev = elevationGrid[targetY][targetX];

    const sourceZ = habElev + mastHeightMeters;
    const destZ = targetElev + astronautAntennaHeight;

    // Generate intermediate cells using Bresenham 2D line algorithm
    const points = this.getBresenhamPoints(habX, habY, targetX, targetY);
    const totalSteps = points.length - 1;

    let hasLoS = true;
    let maxObstructionOverhang = 0;
    let obstructionDist = 0;

    for (let i = 1; i < totalSteps; i++) {
      const pt = points[i];
      const terrainZ = elevationGrid[pt.y][pt.x];

      // Interpolate theoretical ray beam elevation at step i
      const t = i / totalSteps;
      const rayZ = sourceZ + t * (destZ - sourceZ);

      // Account for 0.5m Fresnel clearance margin
      const clearance = 0.5;
      if (terrainZ > rayZ - clearance) {
        hasLoS = false;
        const overhang = terrainZ - rayZ;
        if (overhang > maxObstructionOverhang) {
          maxObstructionOverhang = overhang;
          obstructionDist = i * this.cellResolutionMeters;
        }
      }
    }

    // Distance calculation
    const dxMeters = (targetX - habX) * this.cellResolutionMeters;
    const dyMeters = (targetY - habY) * this.cellResolutionMeters;
    const distanceMeters = Math.sqrt(dxMeters * dxMeters + dyMeters * dyMeters);

    // Free-space path loss model + obstacle diffraction penalty
    let signalStrength = 0;
    if (hasLoS) {
      // Nominal free-space attenuation over Mars surface distances (< 1000m)
      const rangeRatio = distanceMeters / 1000.0;
      signalStrength = Math.max(0.2, 1.0 - 0.7 * (rangeRatio * rangeRatio));
    } else {
      // Diffraction / multipath penetration behind ridges (exponential drop with overhang)
      const attenuation = Math.exp(-0.35 * Math.max(1, maxObstructionOverhang));
      signalStrength = Math.max(0.02, 0.28 * attenuation);
    }

    return {
      hasLoS,
      signalStrength: parseFloat(signalStrength.toFixed(3)),
      obstructionElevation: hasLoS ? undefined : maxObstructionOverhang,
      obstructionDistance: hasLoS ? undefined : obstructionDist,
    };
  }

  /**
   * Generates continuous grid coordinates from (x0, y0) to (x1, y1) via Bresenham's algorithm.
   */
  private getBresenhamPoints(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let currX = x0;
    let currY = y0;

    while (true) {
      points.push({ x: currX, y: currY });
      if (currX === x1 && currY === y1) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        currX += sx;
      }
      if (e2 < dx) {
        err += dx;
        currY += sy;
      }
    }

    return points;
  }
}
