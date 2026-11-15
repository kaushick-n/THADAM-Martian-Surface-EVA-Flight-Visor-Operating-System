import React, { useEffect, useRef, useState } from 'react';
import { RouteMetrics, SiteConfig } from '../types/eva';
import { TerrainGenerator } from '../engine/terrainGenerator';
import { BiomechanicsEngine, USABLE_O2_BUDGET_LITERS } from '../engine/biomechanics';

interface ElevationProfileChartProps {
  site: SiteConfig;
  routeMetrics: RouteMetrics;
  currentStepIndex: number;
}

export const ElevationProfileChart: React.FC<ElevationProfileChartProps> = ({
  site,
  routeMetrics,
  currentStepIndex,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    distanceMeters: number;
    elevation: number;
    slope: number;
    o2BurnLiters: number;
    screenX: number;
  } | null>(null);

  const path = routeMetrics.path;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !path || path.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 30, right: 50, bottom: 35, left: 55 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    // Compute cumulative distance & O2 along the path
    const res = TerrainGenerator.CELL_RESOLUTION_METERS;
    const distData: number[] = [0];
    const elevData: number[] = [path[0].elevation];
    const o2Data: number[] = [0];

    let cumDist = 0;
    let cumO2 = 0;

    for (let i = 1; i < path.length; i++) {
      const p1 = path[i - 1];
      const p2 = path[i];
      const dx = (p2.x - p1.x) * res;
      const dy = (p2.y - p1.y) * res;
      const stepD = Math.sqrt(dx * dx + dy * dy);
      cumDist += stepD;
      distData.push(cumDist);
      elevData.push(p2.elevation);

      const dz = p2.elevation - p1.elevation;
      const stepBio = BiomechanicsEngine.evaluateStep(
        stepD,
        dz,
        p2.thermalInertia,
        p2.radDoseRate
      );
      cumO2 += stepBio.o2ConsumedThisStepLiters;
      o2Data.push(cumO2);
    }

    const totalDist = Math.max(1, distData[distData.length - 1]);

    // Elevation extents
    let minElev = Math.min(...elevData) - 5;
    let maxElev = Math.max(...elevData) + 8;
    if (maxElev - minElev < 10) maxElev = minElev + 10;

    // Max O2 extent
    const maxO2 = Math.max(USABLE_O2_BUDGET_LITERS * 1.1, Math.max(...o2Data) * 1.25);

    // Coordinate mapping functions
    const getX = (dist: number) => padding.left + (dist / totalDist) * chartW;
    const getYElev = (el: number) => padding.top + (1 - (el - minElev) / (maxElev - minElev)) * chartH;
    const getYO2 = (o2: number) => padding.top + (1 - o2 / maxO2) * chartH;

    // 1. Grid lines and background
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    const yGridSteps = 4;
    for (let i = 0; i <= yGridSteps; i++) {
      const y = padding.top + (i / yGridSteps) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Left Y-Axis labels (Elevation in meters)
      const elVal = maxElev - (i / yGridSteps) * (maxElev - minElev);
      ctx.fillStyle = '#00f0ff';
      ctx.font = '10px "Share Tech Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(elVal)}m`, padding.left - 8, y + 3);

      // Right Y-Axis labels (O2 in Liters)
      const o2Val = maxO2 - (i / yGridSteps) * maxO2;
      ctx.fillStyle = '#ffb000';
      ctx.textAlign = 'left';
      ctx.fillText(`${Math.round(o2Val)}L`, width - padding.right + 8, y + 3);
    }

    // X-Axis distance ticks
    const xGridSteps = 6;
    for (let i = 0; i <= xGridSteps; i++) {
      const x = padding.left + (i / xGridSteps) * chartW;
      const dVal = (i / xGridSteps) * totalDist;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(dVal)}m`, x, height - 10);
    }

    // 2. Red Dashed Line: Artemis/Apollo 20% Usable Limit Floor (960 L)
    const yLimit = getYO2(USABLE_O2_BUDGET_LITERS);
    if (yLimit >= padding.top && yLimit <= padding.top + chartH) {
      ctx.save();
      ctx.strokeStyle = '#ff3344';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padding.left, yLimit);
      ctx.lineTo(width - padding.right, yLimit);
      ctx.stroke();
      ctx.fillStyle = '#ff3344';
      ctx.font = '9px "Share Tech Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('20% O2 FLOOR (960L)', width - padding.right - 8, yLimit - 4);
      ctx.restore();
    }

    // 3. Shaded Elevation Terrain Area & Cyan Profile Curve
    const elevGrad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    elevGrad.addColorStop(0, 'rgba(0, 240, 255, 0.28)');
    elevGrad.addColorStop(1, 'rgba(0, 240, 255, 0.02)');

    ctx.beginPath();
    ctx.moveTo(getX(distData[0]), padding.top + chartH);
    for (let i = 0; i < distData.length; i++) {
      ctx.lineTo(getX(distData[i]), getYElev(elevData[i]));
    }
    ctx.lineTo(getX(distData[distData.length - 1]), padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = elevGrad;
    ctx.fill();

    // Elevation Stroke line (Cyan)
    ctx.beginPath();
    ctx.moveTo(getX(distData[0]), getYElev(elevData[0]));
    for (let i = 1; i < distData.length; i++) {
      ctx.lineTo(getX(distData[i]), getYElev(elevData[i]));
    }
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 4. Cumulative O2 Consumption Line (Orange)
    ctx.beginPath();
    ctx.moveTo(getX(distData[0]), getYO2(o2Data[0]));
    for (let i = 1; i < distData.length; i++) {
      ctx.lineTo(getX(distData[i]), getYO2(o2Data[i]));
    }
    ctx.strokeStyle = '#ffb000';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // 5. Waypoint Flag Pins along the Profile
    routeMetrics.waypointArrivals.forEach(arr => {
      const wp = site.waypoints.find(w => w.id === arr.waypointId);
      const wx = getX(arr.distanceSoFarMeters);
      const stepIdx = Math.min(path.length - 1, arr.stepIndex);
      const wy = getYElev(path[stepIdx].elevation);

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx, wy - 16);
      ctx.stroke();

      ctx.fillStyle = wp?.type === 'SAMPLE' ? '#00ff88' : wp?.type === 'HAZARD' ? '#ff3344' : '#ffb000';
      ctx.beginPath();
      ctx.arc(wx, wy - 18, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '9px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(wp?.id.split('-')[1] || 'WP', wx, wy - 23);
    });

    // 6. Current Astronaut Step Marker along Profile
    const activeStep = Math.min(path.length - 1, currentStepIndex);
    const activeDist = distData[activeStep] || 0;
    const ax = getX(activeDist);
    const ay = getYElev(elevData[activeStep] || minElev);

    ctx.save();
    ctx.fillStyle = '#ffb000';
    ctx.shadowColor = '#ffb000';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(ax, ay, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, [path, routeMetrics, site, currentStepIndex]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !path || path.length < 2) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padding = { top: 30, right: 50, bottom: 35, left: 55 };
    const chartW = canvas.width - padding.left - padding.right;

    if (x >= padding.left && x <= canvas.width - padding.right) {
      const ratio = (x - padding.left) / chartW;
      const index = Math.round(ratio * (path.length - 1));
      const cell = path[index];
      if (cell) {
        setHoveredPoint({
          distanceMeters: Math.round(ratio * routeMetrics.totalDistanceMeters),
          elevation: cell.elevation,
          slope: cell.slope,
          o2BurnLiters: parseFloat((ratio * routeMetrics.totalO2ConsumedLiters).toFixed(2)),
          screenX: x,
        });
      }
    } else {
      setHoveredPoint(null);
    }
  };

  return (
    <div className="relative w-full bg-slate-950 p-3 rounded-lg border border-hud-border font-mono">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-white tracking-wider">
            REAL-TIME TRAVERSE PROFILE CROSS-SECTION
          </span>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1 text-hud-cyan font-bold">
              <span className="w-2.5 h-0.5 bg-hud-cyan"></span> Elevation (m)
            </span>
            <span className="flex items-center gap-1 text-hud-amber font-bold">
              <span className="w-2.5 h-0.5 bg-hud-amber"></span> Cumulative O2 (L)
            </span>
          </div>
        </div>
        <div className="text-[11px] text-slate-400">
          Max Slope: <span className="text-hud-amber font-bold">{routeMetrics.maxSlopeDeg}°</span> |
          Gain: <span className="text-hud-cyan font-bold">+{routeMetrics.elevationGainMeters}m</span>
        </div>
      </div>

      <div className="relative w-full h-36">
        <canvas
          ref={canvasRef}
          width={800}
          height={144}
          className="w-full h-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
        />

        {hoveredPoint && (
          <div
            className="absolute top-2 p-1.5 bg-hud-panel border border-hud-border rounded text-[10px] text-white pointer-events-none shadow-xl backdrop-blur z-20"
            style={{ left: `${Math.max(10, Math.min(650, hoveredPoint.screenX - 70))}px` }}
          >
            <div>Distance: <span className="text-hud-cyan font-bold">{hoveredPoint.distanceMeters}m</span></div>
            <div>Elevation: <span className="text-hud-cyan font-bold">{hoveredPoint.elevation.toFixed(1)}m</span></div>
            <div>Slope: <span className="text-hud-amber font-bold">{hoveredPoint.slope.toFixed(1)}°</span></div>
            <div>O2 Burn: <span className="text-hud-amber font-bold">{hoveredPoint.o2BurnLiters}L</span></div>
          </div>
        )}
      </div>
    </div>
  );
};
