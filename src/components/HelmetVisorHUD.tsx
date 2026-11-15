import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AgentTelemetry, RouteMetrics, RouteProfile, SiteConfig, TerrainCell } from '../types/eva';
import { TerrainGenerator } from '../engine/terrainGenerator';
import {
  AlertOctagon,
  BatteryCharging,
  Compass,
  Crosshair,
  Droplets,
  Heart,
  MapPin,
  Radio,
  Shield,
  Volume2,
  Wind,
} from 'lucide-react';

interface HelmetVisorHUDProps {
  site: SiteConfig;
  grid: TerrainCell[][];
  routeMetrics: RouteMetrics;
  activeProfile: RouteProfile;
  agent: AgentTelemetry;
  currentStepIndex: number;
  onDropPin: (coords: { x: number; y: number; elevation: number }) => void;
  onNextWaypoint: () => void;
  onEmergencyAbort: () => void;
}

export const HelmetVisorHUD: React.FC<HelmetVisorHUDProps> = ({
  site,
  grid,
  routeMetrics,
  activeProfile,
  agent,
  currentStepIndex,
  onDropPin,
  onNextWaypoint,
  onEmergencyAbort,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [activeWpIndex, setActiveWpIndex] = useState(1);
  const [hudMessage, setHudMessage] = useState<string>('VISOR OS V3.4 | ALL SENSORS NOMINAL');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // References for first-person Three.js camera
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const currentCell = routeMetrics.path[currentStepIndex] || grid[site.habPosition.y][site.habPosition.x];
  const targetWp = site.waypoints[activeWpIndex] || site.waypoints[0];

  // Calculate bearing from current position to active target waypoint
  const dxMeters = (targetWp.x - currentCell.x) * TerrainGenerator.CELL_RESOLUTION_METERS;
  const dyMeters = (targetWp.y - currentCell.y) * TerrainGenerator.CELL_RESOLUTION_METERS;
  const targetDistanceMeters = Math.round(Math.sqrt(dxMeters * dxMeters + dyMeters * dyMeters));
  let targetBearingDeg = Math.round((Math.atan2(dxMeters, -dyMeters) * 180.0) / Math.PI);
  if (targetBearingDeg < 0) targetBearingDeg += 360;

  // Simulate astronaut current facing heading (e.g. following the path direction)
  const currentHeadingDeg = (targetBearingDeg + 5) % 360;
  const relativeBearing = (targetBearingDeg - currentHeadingDeg + 360) % 360;
  const bearingOffsetPx = relativeBearing > 180 ? (relativeBearing - 360) * 2 : relativeBearing * 2;

  // Audio tone synthesizer using Web Audio API for tactical feedback
  const playHudTone = (freq = 880, type: OscillatorType = 'sine', duration = 0.12) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch {
      // AudioContext policy fallback
    }
  };

  // Keyboard Hotkeys: [1] Drop Core Pin, [2] Next Waypoint POV, [3] Abort to Hab
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1') {
        playHudTone(1200, 'triangle', 0.18);
        setHudMessage(`CORE PIN DROPPED AT [${currentCell.x}, ${currentCell.y}]`);
        onDropPin({ x: currentCell.x, y: currentCell.y, elevation: currentCell.elevation });
      } else if (e.key === '2') {
        playHudTone(950, 'sine', 0.12);
        setActiveWpIndex(prev => {
          const next = (prev + 1) % site.waypoints.length;
          setHudMessage(`TARGET ACQUIRED: ${site.waypoints[next]?.name || 'HAB'}`);
          return next;
        });
        onNextWaypoint();
      } else if (e.key === '3') {
        playHudTone(440, 'sawtooth', 0.35);
        setHudMessage('EMERGENCY ABORT INITIATED: HEADING TO HABITAT');
        onEmergencyAbort();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentCell, site.waypoints, onDropPin, onNextWaypoint, onEmergencyAbort, soundEnabled]);

  // First-Person 3D WebGL Camera Simulation
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xb5633a); // Martian sky ochre
    scene.fog = new THREE.FogExp2(0xb5633a, 0.015);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.5, 500);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Light
    const sun = new THREE.DirectionalLight(0xffedd0, 1.4);
    sun.position.set(50, 100, 30);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0x995030, 0.6));

    // First person terrain surface
    const size = TerrainGenerator.GRID_SIZE;
    const geom = new THREE.PlaneGeometry(size, size, size - 1, size - 1);
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const gx = i % size;
      const gy = Math.floor(i / size);
      pos.setY(i, (grid[gy]?.[gx]?.elevation || 0) * 0.35);
    }
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x933d20,
      roughness: 0.9,
      wireframe: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(-size / 2, 0, -size / 2);
    scene.add(mesh);

    // Place camera at current astronaut step
    const camX = currentCell.x - size / 2;
    const camZ = currentCell.y - size / 2;
    const camY = currentCell.elevation * 0.35 + 1.8 * 0.35; // 1.8m eye level
    camera.position.set(camX, camY, camZ);

    const lookTargetX = targetWp.x - size / 2;
    const lookTargetZ = targetWp.y - size / 2;
    camera.lookAt(lookTargetX, camY, lookTargetZ);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [grid, currentCell, targetWp]);

  const isSlopeHazard = currentCell.slope > 18.0;

  return (
    <div className="relative w-full h-full min-h-[580px] bg-slate-950 rounded-lg overflow-hidden border border-hud-border font-mono select-none">
      {/* 3D Background First-Person Terrain Viewport */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Visor Vignette and Curved Glass Distortion Layer */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_60%,rgba(0,10,20,0.6)_100%)] border-[12px] border-slate-950/70" />
      <div className="absolute inset-0 hud-scanlines" />

      {/* TOP COMPASS TAPE */}
      <div className="absolute top-2 inset-x-0 flex flex-col items-center pointer-events-none">
        <div className="px-3 py-1 bg-hud-panel border border-hud-border rounded-full text-xs text-hud-cyan font-bold tracking-widest flex items-center gap-2 shadow-hud-cyan">
          <Compass className="w-4 h-4 animate-spin-slow" />
          <span>HDG {currentHeadingDeg.toString().padStart(3, '0')}° M</span>
          <span className="text-slate-500">|</span>
          <span className="text-hud-amber">TGT {targetBearingDeg.toString().padStart(3, '0')}° ({targetDistanceMeters}m)</span>
          <span className="text-slate-500">|</span>
          <span className={activeProfile === 'EMERGENCY_HAB_ABORT' ? 'text-hud-red animate-pulse' : 'text-hud-emerald'}>
            {activeProfile}
          </span>
        </div>

        {/* Dynamic Horizontal Compass Bearing Tape */}
        <div className="relative w-80 h-7 overflow-hidden mt-1 border-t border-b border-hud-border bg-slate-950/80 backdrop-blur">
          <div
            className="absolute top-0 h-full flex items-center transition-all duration-300"
            style={{ transform: `translateX(${160 - (currentHeadingDeg % 360) * 4}px)` }}
          >
            {[...Array(72)].map((_, i) => {
              const deg = i * 10;
              const isCardinal = deg % 90 === 0;
              const cardinal = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : '';
              return (
                <div key={i} className="w-10 flex flex-col items-center justify-end text-[10px] text-slate-400">
                  <span>{isCardinal ? cardinal : deg}</span>
                  <div className={`w-0.5 ${isCardinal ? 'h-3 bg-hud-cyan' : 'h-1.5 bg-slate-600'}`} />
                </div>
              );
            })}
          </div>

          {/* Center Visor Reticle Line */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-hud-amber z-10" />

          {/* Floating Waypoint Azimuth Pointer Chevron */}
          <div
            className="absolute top-0 h-full flex items-center transition-all duration-200 z-10 text-hud-emerald font-black"
            style={{ left: `calc(50% + ${Math.max(-140, Math.min(140, bearingOffsetPx))}px)` }}
          >
            ▼
          </div>
        </div>
      </div>

      {/* VISOR CENTER CROSSHAIR RETICLE */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-28 h-28 border border-hud-cyan/30 rounded-full flex items-center justify-center">
          <div className="w-1.5 h-1.5 bg-hud-cyan rounded-full animate-ping" />
          <div className="absolute top-0 w-2 h-0.5 bg-hud-cyan" />
          <div className="absolute bottom-0 w-2 h-0.5 bg-hud-cyan" />
          <div className="absolute left-0 w-0.5 h-2 bg-hud-cyan" />
          <div className="absolute right-0 w-0.5 h-2 bg-hud-cyan" />

          {/* Target Callout in Reticle */}
          <div className="absolute -bottom-8 px-2 py-0.5 bg-hud-panel border border-hud-border rounded text-[11px] text-hud-cyan whitespace-nowrap">
            {targetWp.name} [{targetDistanceMeters}m]
          </div>
        </div>
      </div>

      {/* SLOPE HAZARD WARNING BANNER */}
      {isSlopeHazard && (
        <div className="absolute top-18 inset-x-0 flex justify-center pointer-events-none">
          <div className="px-4 py-1.5 bg-red-950/90 border-2 border-red-500 text-hud-red rounded font-bold text-xs flex items-center gap-2 animate-bounce shadow-hud-red">
            <AlertOctagon className="w-4 h-4" />
            TERRAIN WARNING: SLOPE {currentCell.slope.toFixed(1)}° EXCEEDS EVA ADVISORY (18°)
          </div>
        </div>
      )}

      {/* LEFT PERIPHERAL TELEMETRY: xEMU LIFE SUPPORT GAUGES */}
      <div className="absolute top-16 left-4 z-10 space-y-3 w-64 pointer-events-none">
        {/* Primary O2 Gauge */}
        <div className="p-2.5 bg-hud-panel border border-hud-border rounded-lg backdrop-blur">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1.5 text-hud-cyan font-bold">
              <Droplets className="w-4 h-4" />
              xEMU PRIMARY O2
            </span>
            <span className="text-white font-bold">{agent.o2RemainingPct.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                agent.o2RemainingPct > 40 ? 'bg-hud-cyan' : agent.o2RemainingPct > 20 ? 'bg-hud-amber' : 'bg-hud-red animate-pulse'
              }`}
              style={{ width: `${agent.o2RemainingPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>{agent.o2RemainingLiters.toFixed(0)} L Remaining</span>
            <span className="text-hud-amber">Floor 240 L (20%)</span>
          </div>
        </div>

        {/* Vital Signs (Heart Rate, Pressure, Core Temp) */}
        <div className="p-2.5 bg-hud-panel border border-hud-border rounded-lg backdrop-blur text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-slate-300">
              <Heart className="w-3.5 h-3.5 text-hud-red animate-pulse" />
              Heart Rate:
            </span>
            <span className="text-white font-bold">{agent.heartRateBpm} BPM</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-slate-300">
              <Shield className="w-3.5 h-3.5 text-hud-cyan" />
              Suit Pressure:
            </span>
            <span className="text-white font-bold">{agent.suitPressureKPa.toFixed(1)} kPa</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-slate-300">
              <BatteryCharging className="w-3.5 h-3.5 text-hud-emerald" />
              Suit Battery:
            </span>
            <span className="text-white font-bold">{agent.batteryRemainingPct}%</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-slate-300">
              <Wind className="w-3.5 h-3.5 text-hud-amber" />
              Metabolic Power:
            </span>
            <span className="text-hud-amber font-bold">{agent.workloadWatts} W</span>
          </div>
        </div>

        {/* Radiation Dosimeter Gauge */}
        <div className="p-2.5 bg-hud-panel border border-hud-border rounded-lg backdrop-blur text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-300">RAD DOSIMETER</span>
            <span className="text-hud-amber font-bold">{currentCell.radDoseRate.toFixed(1)} μSv/h</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-hud-emerald via-hud-amber to-hud-red transition-all duration-300"
              style={{ width: `${Math.min(100, (currentCell.radDoseRate / 45.0) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>Cumulative: {(agent.radCumulativeMicroSv / 1000).toFixed(3)} mSv</span>
            <span>Limit: 1.0 mSv</span>
          </div>
        </div>
      </div>

      {/* RIGHT PERIPHERAL: UHF COMMS & GEOLOGICAL TARGET DATA */}
      <div className="absolute top-16 right-4 z-10 space-y-3 w-64 pointer-events-none">
        {/* UHF Link Status */}
        <div className="p-2.5 bg-hud-panel border border-hud-border rounded-lg backdrop-blur text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5 text-hud-cyan font-bold">
              <Radio className="w-4 h-4" />
              HABITAT UHF LINK
            </span>
            <span className={`font-bold ${currentCell.uhfLoS ? 'text-hud-cyan' : 'text-hud-red'}`}>
              {currentCell.uhfLoS ? 'LINE-OF-SIGHT' : 'RADIO SHADOW'}
            </span>
          </div>
          <div className="text-[11px] text-slate-300">
            Mast Height: 2.8m | Signal: {(currentCell.uhfSignalStrength * 100).toFixed(0)}%
          </div>
        </div>

        {/* Current Ground Mineralogy */}
        <div className="p-2.5 bg-hud-panel border border-hud-border rounded-lg backdrop-blur text-xs space-y-1">
          <div className="text-hud-emerald font-bold flex items-center gap-1">
            <Crosshair className="w-3.5 h-3.5" />
            GROUND TRUTH TELEMETRY
          </div>
          <div className="text-slate-300">CRISM Hydration: <span className="text-white font-bold">{(currentCell.hydrationIndex * 100).toFixed(0)}%</span></div>
          <div className="text-slate-300">THEMIS Thermal: <span className="text-white font-bold">{currentCell.thermalInertia} TIU</span></div>
          <div className="text-slate-300">Slope: <span className="text-white font-bold">{currentCell.slope.toFixed(1)}°</span></div>
        </div>
      </div>

      {/* BOTTOM CENTER: HOTKEY HUD ACTION BAR */}
      <div className="absolute bottom-3 inset-x-0 flex flex-col items-center z-20">
        <div className="mb-1.5 px-3 py-1 bg-slate-900/90 border border-hud-border rounded text-[11px] text-hud-cyan font-mono backdrop-blur">
          {hudMessage}
        </div>

        <div className="flex items-center gap-2 p-1.5 bg-hud-panel border border-hud-border rounded-lg shadow-2xl backdrop-blur">
          <button
            onClick={() => {
              playHudTone(1200, 'triangle', 0.18);
              setHudMessage(`CORE PIN DROPPED AT [${currentCell.x}, ${currentCell.y}]`);
              onDropPin({ x: currentCell.x, y: currentCell.y, elevation: currentCell.elevation });
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 active:bg-hud-cyan active:text-slate-950 border border-hud-cyan/50 rounded text-xs font-bold text-hud-cyan transition"
          >
            <span className="w-4 h-4 rounded bg-hud-cyan/20 flex items-center justify-center text-[10px]">1</span>
            <MapPin className="w-3.5 h-3.5" />
            DROP CORE PIN
          </button>

          <button
            onClick={() => {
              playHudTone(950, 'sine', 0.12);
              setActiveWpIndex(prev => {
                const next = (prev + 1) % site.waypoints.length;
                setHudMessage(`TARGET ACQUIRED: ${site.waypoints[next]?.name || 'HAB'}`);
                return next;
              });
              onNextWaypoint();
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 active:bg-hud-emerald active:text-slate-950 border border-hud-emerald/50 rounded text-xs font-bold text-hud-emerald transition"
          >
            <span className="w-4 h-4 rounded bg-hud-emerald/20 flex items-center justify-center text-[10px]">2</span>
            <Crosshair className="w-3.5 h-3.5" />
            NEXT WAYPOINT POV
          </button>

          <button
            onClick={() => {
              playHudTone(440, 'sawtooth', 0.35);
              setHudMessage('EMERGENCY ABORT INITIATED: HEADING TO HABITAT');
              onEmergencyAbort();
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-950/80 hover:bg-red-900 active:bg-hud-red active:text-slate-950 border border-red-500 rounded text-xs font-bold text-hud-red transition"
          >
            <span className="w-4 h-4 rounded bg-red-500/20 flex items-center justify-center text-[10px]">3</span>
            <AlertOctagon className="w-3.5 h-3.5" />
            ABORT TO HAB
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded border transition ${
              soundEnabled
                ? 'border-hud-cyan text-hud-cyan bg-cyan-950/40'
                : 'border-slate-700 text-slate-500 bg-slate-900'
            }`}
            title="Toggle Visor Audio Synth"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
