import { RouteMetrics, RouteProfile, SiteConfig, TerrainCell, Waypoint } from '../types/eva';
import {
  BiomechanicsEngine,
  NOMINAL_WALK_SPEED_MPS,
  SPRINT_ABORT_SPEED_MPS,
  USABLE_O2_BUDGET_LITERS,
} from './biomechanics';
import { TerrainGenerator } from './terrainGenerator';

interface PriorityNode {
  x: number;
  y: number;
  f: number;
  g: number;
  h: number;
  parent?: PriorityNode;
}

export class AStarSolver {
  private static readonly NEIGHBORS = [
    { dx: 0, dy: -1, distMult: 1.0 },
    { dx: 0, dy: 1, distMult: 1.0 },
    { dx: -1, dy: 0, distMult: 1.0 },
    { dx: 1, dy: 0, distMult: 1.0 },
    { dx: -1, dy: -1, distMult: Math.SQRT2 },
    { dx: 1, dy: -1, distMult: Math.SQRT2 },
    { dx: -1, dy: 1, distMult: Math.SQRT2 },
    { dx: 1, dy: 1, distMult: Math.SQRT2 },
  ];

  /**
   * Updates normalized traversal cost [0..1] for all cells in the grid based on the active profile.
   */
  public static updateGridCosts(grid: TerrainCell[][], profile: RouteProfile): void {
    const size = grid.length;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cell = grid[y][x];
        grid[y][x].cost = this.calculateCellBaseCost(cell, profile);
      }
    }
  }

  /**
   * Calculates individual cell step traversal resistance based on operational profile.
   */
  public static calculateCellBaseCost(cell: TerrainCell, profile: RouteProfile): number {
    const slope = cell.slope;

    if (profile === 'LOW_O2_SAFE') {
      if (slope > 24.0) return 999.0; // Impassable cliff
      let cost = 1.0 + (slope / 10.0) ** 2.2;
      // Soft dust penalty
      if (cell.thermalInertia < 220) {
        cost += 1.8 * (1.0 - cell.thermalInertia / 250);
      }
      // Comms loss penalty
      if (!cell.uhfLoS) {
        cost += 1.2;
      }
      return cost;
    }

    if (profile === 'MAX_SCIENCE') {
      if (slope > 22.0) return 999.0;
      let cost = 1.0 + (slope / 12.0) ** 1.8;
      // High hydration provides substantial traversal reward (cost reduction)
      cost -= cell.hydrationIndex * 0.75;
      if (cell.thermalInertia > 450) {
        cost -= 0.2; // Bedrock is desirable for geological core sampling
      }
      return Math.max(0.15, cost);
    }

    // EMERGENCY_HAB_ABORT: strict bee-line speed
    if (slope > 28.0) return 999.0;
    return 1.0 + (slope / 16.0) ** 1.5;
  }

  /**
   * Plans complete mission traverse connecting Hab through waypoints and back to Hab.
   */
  public static solveMissionRoute(
    grid: TerrainCell[][],
    _site: SiteConfig,
    waypoints: Waypoint[],
    profile: RouteProfile
  ): RouteMetrics {
    this.updateGridCosts(grid, profile);

    // If emergency abort, route directly from current outer waypoint back to Hab
    let targetWaypoints = waypoints;
    if (profile === 'EMERGENCY_HAB_ABORT') {
      const farPoint = waypoints.find(w => w.type !== 'HAB') || waypoints[waypoints.length - 1];
      const habPoint = waypoints.find(w => w.type === 'HAB') || waypoints[0];
      targetWaypoints = [farPoint, habPoint];
    }

    const fullPath: TerrainCell[] = [];
    const waypointArrivals: RouteMetrics['waypointArrivals'] = [];

    let totalDistanceMeters = 0;
    let totalTimeSeconds = 0;
    let totalO2Liters = 0;
    let totalRadMicroSv = 0;
    let totalWorkloadJoules = 0;
    let peakWatts = 0;
    let maxSlope = 0;
    let elevGain = 0;
    let elevLoss = 0;

    const res = TerrainGenerator.CELL_RESOLUTION_METERS;
    const speed = profile === 'EMERGENCY_HAB_ABORT' ? SPRINT_ABORT_SPEED_MPS : NOMINAL_WALK_SPEED_MPS;

    for (let i = 0; i < targetWaypoints.length - 1; i++) {
      const startWp = targetWaypoints[i];
      const goalWp = targetWaypoints[i + 1];

      const segment = this.findPathAStar(grid, startWp.x, startWp.y, goalWp.x, goalWp.y, profile);

      // Skip start point on subsequent segments to avoid duplication
      const startIndex = i === 0 ? 0 : 1;
      for (let s = startIndex; s < segment.length; s++) {
        const cell = segment[s];
        fullPath.push(cell);

        if (fullPath.length > 1) {
          const prevCell = fullPath[fullPath.length - 2];
          const dx = (cell.x - prevCell.x) * res;
          const dy = (cell.y - prevCell.y) * res;
          const stepDist = Math.sqrt(dx * dx + dy * dy);
          const dz = cell.elevation - prevCell.elevation;

          if (dz > 0) elevGain += dz;
          else elevLoss += Math.abs(dz);

          if (cell.slope > maxSlope) maxSlope = cell.slope;

          const stepBio = BiomechanicsEngine.evaluateStep(
            stepDist,
            dz,
            cell.thermalInertia,
            cell.radDoseRate,
            speed
          );

          totalDistanceMeters += stepDist;
          totalTimeSeconds += stepBio.timeSeconds;
          totalO2Liters += stepBio.o2ConsumedThisStepLiters;
          totalRadMicroSv += stepBio.radDoseMicroSv;
          totalWorkloadJoules += stepBio.workloadWatts * stepBio.timeSeconds;

          if (stepBio.workloadWatts > peakWatts) {
            peakWatts = stepBio.workloadWatts;
          }
        }
      }

      waypointArrivals.push({
        waypointId: goalWp.id,
        stepIndex: fullPath.length - 1,
        distanceSoFarMeters: Math.round(totalDistanceMeters),
        o2BurnSoFarLiters: parseFloat(totalO2Liters.toFixed(2)),
        elapsedMinutes: Math.round(totalTimeSeconds / 60.0),
      });
    }

    const avgWatts = totalTimeSeconds > 0 ? totalWorkloadJoules / totalTimeSeconds : 240;
    const remainingUsableO2 = USABLE_O2_BUDGET_LITERS - totalO2Liters;
    const walkbackRadius = BiomechanicsEngine.calculateWalkbackLimitRadius(remainingUsableO2);
    const walkbackSafe = totalO2Liters <= USABLE_O2_BUDGET_LITERS;

    return {
      totalDistanceMeters: Math.round(totalDistanceMeters),
      estimatedTimeMinutes: Math.round(totalTimeSeconds / 60.0),
      totalO2ConsumedLiters: parseFloat(totalO2Liters.toFixed(2)),
      totalRadDoseMicroSv: parseFloat(totalRadMicroSv.toFixed(2)),
      avgWorkloadWatts: Math.round(avgWatts),
      peakWorkloadWatts: Math.round(peakWatts),
      maxSlopeDeg: parseFloat(maxSlope.toFixed(1)),
      elevationGainMeters: Math.round(elevGain),
      elevationLossMeters: Math.round(elevLoss),
      walkbackLimitRadiusMeters: Math.round(walkbackRadius),
      walkbackSafe,
      path: fullPath,
      waypointArrivals,
    };
  }

  /**
   * Core 8-directional weighted A* algorithm between two grid nodes.
   */
  private static findPathAStar(
    grid: TerrainCell[][],
    startX: number,
    startY: number,
    goalX: number,
    goalY: number,
    profile: RouteProfile
  ): TerrainCell[] {
    const size = grid.length;
    const openSet: PriorityNode[] = [];
    const closedSet = new Set<string>();
    const nodeMap = new Map<string, PriorityNode>();

    const startH = this.heuristic(startX, startY, goalX, goalY);
    const startNode: PriorityNode = {
      x: startX,
      y: startY,
      f: startH,
      g: 0,
      h: startH,
    };

    openSet.push(startNode);
    nodeMap.set(`${startX},${startY}`, startNode);

    while (openSet.length > 0) {
      // Find lowest f node
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;
      const key = `${current.x},${current.y}`;

      if (current.x === goalX && current.y === goalY) {
        // Reconstruct path
        const path: TerrainCell[] = [];
        let curr: PriorityNode | undefined = current;
        while (curr) {
          path.unshift(grid[curr.y][curr.x]);
          curr = curr.parent;
        }
        return path;
      }

      closedSet.add(key);

      for (const n of this.NEIGHBORS) {
        const nx = current.x + n.dx;
        const ny = current.y + n.dy;

        if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
        const nKey = `${nx},${ny}`;
        if (closedSet.has(nKey)) continue;

        const neighborCell = grid[ny][nx];
        const currentCell = grid[current.y][current.x];

        // Absolute impassable slope check
        const maxPermissibleSlope = profile === 'EMERGENCY_HAB_ABORT' ? 28.0 : 23.0;
        if (neighborCell.slope > maxPermissibleSlope) continue;

        // Step elevation difference
        const dz = neighborCell.elevation - currentCell.elevation;
        let stepCost = n.distMult * neighborCell.cost;
        if (dz > 0) {
          stepCost += (dz / 4.0) * (profile === 'LOW_O2_SAFE' ? 2.0 : 1.2);
        }

        const tentativeG = current.g + stepCost;
        let neighborNode = nodeMap.get(nKey);

        if (!neighborNode) {
          const h = this.heuristic(nx, ny, goalX, goalY);
          neighborNode = {
            x: nx,
            y: ny,
            f: tentativeG + h,
            g: tentativeG,
            h,
            parent: current,
          };
          nodeMap.set(nKey, neighborNode);
          openSet.push(neighborNode);
        } else if (tentativeG < neighborNode.g) {
          neighborNode.g = tentativeG;
          neighborNode.f = tentativeG + neighborNode.h;
          neighborNode.parent = current;
        }
      }
    }

    // Fallback: If blocked, return direct Bresenham interpolation line
    return [grid[startY][startX], grid[goalY][goalX]];
  }

  /**
   * Octile heuristic distance.
   */
  private static heuristic(x1: number, y1: number, x2: number, y2: number): number {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  }
}
