import React, { useEffect, useMemo, useState } from 'react';
import {
  AgentTelemetry,
  DisplayMode,
  RouteMetrics,
  RouteProfile,
  Waypoint,
} from './types/eva';
import { MARTIAN_SITES } from './data/sites';
import { TerrainGenerator } from './engine/terrainGenerator';
import { AStarSolver } from './engine/astarSolver';
import { HabitatViewport3D } from './components/HabitatViewport3D';
import { GlovedTabletView } from './components/GlovedTabletView';
import { HelmetVisorHUD } from './components/HelmetVisorHUD';
import { ElevationProfileChart } from './components/ElevationProfileChart';
import { SurfacePovCard } from './components/SurfacePovCard';
import {
  Activity,
  AlertTriangle,
  Clock,
  Compass,
  Cpu,
  Eye,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Smartphone,
  Split,
  Thermometer,
  Wind,
  Zap,
} from 'lucide-react';

export const App: React.FC = () => {
  // Selected Site & Profile
  const [selectedSiteId, setSelectedSiteId] = useState<string>('mount-sharp-boxwork');
  const [activeProfile, setActiveProfile] = useState<RouteProfile>('LOW_O2_SAFE');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('HABITAT_3D');

  // Simulation Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [activeAgentId, setActiveAgentId] = useState<'EV-1' | 'EV-2' | 'ROVER-01'>('EV-1');

  // Mission Elapsed Time (MET) counter
  const [metSeconds, setMetSeconds] = useState<number>(15482); // Initial MET ~ 04:18:02

  // Active Site configuration
  const currentSite = useMemo(() => {
    return MARTIAN_SITES.find(s => s.id === selectedSiteId) || MARTIAN_SITES[0];
  }, [selectedSiteId]);

  // Generate 48x48 Geophysical Grid for active site
  const terrainGrid = useMemo(() => {
    return TerrainGenerator.generateGrid(currentSite);
  }, [currentSite]);

  // Dynamic custom pinned waypoints (added by astronaut [1] hotkey)
  const [customWaypoints, setCustomWaypoints] = useState<Waypoint[]>([]);

  // Combined waypoints list
  const activeWaypoints = useMemo(() => {
    return [...currentSite.waypoints, ...customWaypoints];
  }, [currentSite, customWaypoints]);

  // Compute A* Traverse & Biomechanical Life Support Metrics
  const routeMetrics: RouteMetrics = useMemo(() => {
    return AStarSolver.solveMissionRoute(terrainGrid, currentSite, activeWaypoints, activeProfile);
  }, [terrainGrid, currentSite, activeWaypoints, activeProfile]);

  // Agent Telemetry state for EV-1, EV-2, ROVER-01
  const agents: AgentTelemetry[] = useMemo(() => {
    const path = routeMetrics.path;
    const pathLen = Math.max(1, path.length);
    const progressRatio = currentStepIndex / pathLen;

    const currentCell = path[Math.min(pathLen - 1, currentStepIndex)] || terrainGrid[0][0];

    // EV-1 (Lead Geologist)
    const ev1O2Burn = routeMetrics.totalO2ConsumedLiters * progressRatio;
    const ev1RemainingLiters = Math.max(0, 1200 - ev1O2Burn);
    const ev1RemainingPct = (ev1RemainingLiters / 1200) * 100;
    const ev1Watts = routeMetrics.avgWorkloadWatts + Math.round(currentCell.slope * 3.5);

    // EV-2 (Mission Specialist)
    const ev2Step = Math.max(0, currentStepIndex - 2);
    const ev2Cell = path[Math.min(pathLen - 1, ev2Step)] || currentCell;
    const ev2O2Burn = routeMetrics.totalO2ConsumedLiters * (ev2Step / pathLen);

    // ROVER-01 (Pressurized Support Vehicle)
    const roverStep = Math.max(0, currentStepIndex - 5);
    const roverCell = path[Math.min(pathLen - 1, roverStep)] || currentCell;

    return [
      {
        id: 'EV-1',
        callsign: 'KALAM-1 (EV-1)',
        role: 'Lead Surface Geologist',
        x: currentCell.x,
        y: currentCell.y,
        elevation: currentCell.elevation,
        heartRateBpm: 92 + Math.min(65, Math.round(currentCell.slope * 2.2)),
        suitPressureKPa: 29.6,
        o2RemainingPct: parseFloat(ev1RemainingPct.toFixed(1)),
        o2RemainingLiters: parseFloat(ev1RemainingLiters.toFixed(1)),
        batteryRemainingPct: Math.max(15, Math.round(98 - progressRatio * 28)),
        coreTempCelsius: 37.1,
        workloadWatts: ev1Watts,
        radCumulativeMicroSv: routeMetrics.totalRadDoseMicroSv * progressRatio,
        status: activeProfile === 'EMERGENCY_HAB_ABORT' ? 'ABORTING' : ev1RemainingPct < 25 ? 'WARNING' : 'NOMINAL',
      },
      {
        id: 'EV-2',
        callsign: 'KALAM-2 (EV-2)',
        role: 'Mission Specialist / Comms',
        x: ev2Cell.x,
        y: ev2Cell.y,
        elevation: ev2Cell.elevation,
        heartRateBpm: 86 + Math.round(ev2Cell.slope * 1.8),
        suitPressureKPa: 29.7,
        o2RemainingPct: parseFloat((((1200 - ev2O2Burn) / 1200) * 100).toFixed(1)),
        o2RemainingLiters: parseFloat((1200 - ev2O2Burn).toFixed(1)),
        batteryRemainingPct: Math.max(20, Math.round(99 - progressRatio * 25)),
        coreTempCelsius: 37.0,
        workloadWatts: Math.round(ev1Watts * 0.92),
        radCumulativeMicroSv: routeMetrics.totalRadDoseMicroSv * progressRatio * 0.95,
        status: 'NOMINAL',
      },
      {
        id: 'ROVER-01',
        callsign: 'ROVER-01 (CHHAYA)',
        role: 'Autonomous Pressurized Support Rover',
        x: roverCell.x,
        y: roverCell.y,
        elevation: roverCell.elevation,
        heartRateBpm: 0,
        suitPressureKPa: 70.3,
        o2RemainingPct: 100,
        o2RemainingLiters: 4800,
        batteryRemainingPct: Math.max(45, Math.round(94 - progressRatio * 15)),
        coreTempCelsius: 21.5,
        workloadWatts: 1850,
        radCumulativeMicroSv: 0,
        status: 'NOMINAL',
      },
    ];
  }, [currentStepIndex, routeMetrics, terrainGrid, activeProfile]);

  // Active agent telemetry object
  const activeAgent = useMemo(() => {
    return agents.find(a => a.id === activeAgentId) || agents[0];
  }, [agents, activeAgentId]);

  // Mission Elapsed Time timer
  useEffect(() => {
    const timer = setInterval(() => {
      setMetSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format MET seconds into HH:MM:SS
  const formatMet = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Traverse Simulation Animation loop
  useEffect(() => {
    if (!isPlaying) return;
    const intervalTime = Math.max(100, 800 / playbackSpeed);
    const interval = setInterval(() => {
      setCurrentStepIndex(prev => {
        if (prev >= routeMetrics.path.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalTime);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, routeMetrics.path.length]);

  // Spacebar hotkey to toggle simulation play/pause
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Handler for Astronaut [1] Hotkey: Drop Core Pin
  const handleDropPin = (coords: { x: number; y: number; elevation: number }) => {
    const newPin: Waypoint = {
      id: `PIN-${customWaypoints.length + 1}`,
      name: `Core Specimen Pin #${customWaypoints.length + 1}`,
      x: coords.x,
      y: coords.y,
      elevation: coords.elevation,
      lat: currentSite.centerLat + ((coords.y - 24) * 12.5) / 59274,
      lon: currentSite.centerLon + ((coords.x - 24) * 12.5) / 59274,
      type: 'SAMPLE',
      scienceValue: 85,
      sampleType: 'In-situ Regolith Core',
      description: 'Astronaut surface sample flagged for robotic return.',
    };
    setCustomWaypoints(prev => [...prev, newPin]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-mono selection:bg-hud-cyan selection:text-slate-950">
      {/* =========================================================================
          TOP FLIGHT DIRECTOR BAR (AEROSPACE MISSION CONTROL COMMAND CONSOLE)
      ========================================================================= */}
      <header className="border-b border-hud-border bg-hud-dark/95 backdrop-blur px-4 py-2.5 sticky top-0 z-50">
        <div className="flex flex-col xl:flex-row items-center justify-between gap-3">
          {/* Left: Branding & Team KALAM Header */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-gradient-to-br from-mars-500 to-hud-cyan p-0.5 flex items-center justify-center shadow-hud-cyan">
                <div className="w-full h-full bg-slate-950 rounded flex items-center justify-center">
                  <Compass className="w-5 h-5 text-hud-cyan" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-black text-lg tracking-wider text-white">
                    THADAM
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-mars-500/30 text-mars-200 border border-mars-400/40 font-bold">
                    TEAM KALAM
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/60 text-hud-cyan border border-hud-cyan/40">
                    NASA SPACE APPS
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  MARTIAN SURFACE EVA FLIGHT TRAVERSE & VISOR OPERATING SYSTEM
                </div>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-800 hidden md:block" />

            {/* Live MET Clock */}
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded text-xs">
              <Clock className="w-4 h-4 text-hud-amber" />
              <span className="text-slate-400 font-bold">SOL {currentSite.weather.sol}</span>
              <span className="text-slate-600">|</span>
              <span className="text-hud-amber font-black tracking-widest">
                MET {formatMet(metSeconds)}
              </span>
            </div>
          </div>

          {/* Center: Site Selector & Route Profile Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Site Picker */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded border border-slate-800">
              {MARTIAN_SITES.map(site => (
                <button
                  key={site.id}
                  onClick={() => {
                    setSelectedSiteId(site.id);
                    setCurrentStepIndex(0);
                    setCustomWaypoints([]);
                  }}
                  className={`px-2.5 py-1 text-xs rounded transition font-bold ${
                    selectedSiteId === site.id
                      ? 'bg-hud-cyan text-slate-950 shadow-hud-cyan'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {site.name.split(' ')[0]}
                </button>
              ))}
            </div>

            {/* Route Profile Mode */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded border border-slate-800">
              <button
                onClick={() => setActiveProfile('LOW_O2_SAFE')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition font-bold ${
                  activeProfile === 'LOW_O2_SAFE'
                    ? 'bg-hud-cyan text-slate-950 shadow-hud-cyan'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                LOW O2 SAFE
              </button>

              <button
                onClick={() => setActiveProfile('MAX_SCIENCE')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition font-bold ${
                  activeProfile === 'MAX_SCIENCE'
                    ? 'bg-hud-emerald text-slate-950 shadow-hud-emerald'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                MAX SCIENCE
              </button>

              <button
                onClick={() => setActiveProfile('EMERGENCY_HAB_ABORT')}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition font-bold ${
                  activeProfile === 'EMERGENCY_HAB_ABORT'
                    ? 'bg-hud-red text-slate-950 shadow-hud-red animate-pulse'
                    : 'text-red-400 hover:text-white'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                HAB ABORT
              </button>
            </div>
          </div>

          {/* Right: Operational Display Mode Router Tabs */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded border border-hud-border">
            <button
              onClick={() => setDisplayMode('HABITAT_3D')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded transition ${
                displayMode === 'HABITAT_3D'
                  ? 'bg-hud-cyan text-slate-950 shadow-hud-cyan'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              3D HABITAT
            </button>

            <button
              onClick={() => setDisplayMode('GLOVED_TABLET')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded transition ${
                displayMode === 'GLOVED_TABLET'
                  ? 'bg-hud-amber text-slate-950 shadow-hud-amber'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              GLOVED TABLET
            </button>

            <button
              onClick={() => setDisplayMode('HELMET_HUD')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded transition ${
                displayMode === 'HELMET_HUD'
                  ? 'bg-hud-emerald text-slate-950 shadow-hud-emerald'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              HELMET AR VISOR
            </button>

            <button
              onClick={() => setDisplayMode('SPLIT_OPS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded transition ${
                displayMode === 'SPLIT_OPS'
                  ? 'bg-hud-purple text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Split className="w-3.5 h-3.5" />
              SPLIT DUAL-VIEW
            </button>
          </div>
        </div>

        {/* Sub-bar: Environmental Telemetry Cluster & Active Agent Switcher */}
        <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1 text-slate-300">
              <Thermometer className="w-3.5 h-3.5 text-hud-cyan" />
              Temp: <strong className="text-white">{currentSite.weather.ambientTempCelsius}°C</strong>
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <Activity className="w-3.5 h-3.5 text-hud-amber" />
              Pressure: <strong className="text-white">{currentSite.weather.atmosphericPressurePa} Pa (0.006 atm)</strong>
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <Wind className="w-3.5 h-3.5 text-slate-400" />
              Wind: <strong className="text-white">{currentSite.weather.windSpeedMps} m/s @ {currentSite.weather.windDirectionDeg}°</strong>
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <Shield className="w-3.5 h-3.5 text-hud-emerald" />
              Optical Tau: <strong className="text-white">{currentSite.weather.dustOpticalDepthTau}</strong>
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <AlertTriangle className="w-3.5 h-3.5 text-hud-red" />
              RAD Flux: <strong className="text-hud-amber">{currentSite.weather.radiationFluxMicroSvPerHour} μSv/h</strong>
            </span>
          </div>

          {/* Active Agent Selector */}
          <div className="flex items-center gap-2 mt-1 sm:mt-0">
            <span className="text-[11px] text-slate-500 uppercase font-bold">Monitor:</span>
            {agents.map(ag => (
              <button
                key={ag.id}
                onClick={() => setActiveAgentId(ag.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold border transition ${
                  activeAgentId === ag.id
                    ? ag.id === 'EV-1'
                      ? 'border-hud-amber bg-amber-950/60 text-hud-amber'
                      : ag.id === 'EV-2'
                      ? 'border-hud-cyan bg-cyan-950/60 text-hud-cyan'
                      : 'border-hud-emerald bg-emerald-950/60 text-hud-emerald'
                    : 'border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300'
                }`}
              >
                {ag.id}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* =========================================================================
          TRAVERSE SIMULATION CONTROLLER (PLAY/PAUSE, SPEED, SCRUB BAR)
      ========================================================================= */}
      <div className="bg-hud-dark border-b border-hud-border px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Playback Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold transition ${
              isPlaying
                ? 'bg-hud-amber text-slate-950 shadow-hud-amber'
                : 'bg-hud-cyan text-slate-950 shadow-hud-cyan'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? 'PAUSE [SPC]' : 'PLAY [SPC]'}
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentStepIndex(0);
            }}
            className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-slate-300 hover:text-white"
            title="Reset to Habitat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Speed Selectors */}
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
            {[1, 2, 5].map(spd => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                  playbackSpeed === spd
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Traverse Step Scrubber */}
        <div className="flex-1 max-w-xl flex items-center gap-3">
          <span className="text-[11px] text-slate-400 whitespace-nowrap">
            Traverse Scrub: {currentStepIndex} / {Math.max(1, routeMetrics.path.length - 1)}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(1, routeMetrics.path.length - 1)}
            value={currentStepIndex}
            onChange={e => setCurrentStepIndex(parseInt(e.target.value, 10))}
            className="w-full accent-hud-cyan cursor-pointer"
          />
        </div>

        {/* Biomechanical Telemetry Highlights */}
        <div className="flex items-center gap-3 text-[11px]">
          <div>
            Dist: <strong className="text-white">{routeMetrics.totalDistanceMeters}m</strong>
          </div>
          <div>
            Time: <strong className="text-white">{routeMetrics.estimatedTimeMinutes} min</strong>
          </div>
          <div>
            O2 Burn: <strong className="text-hud-amber">{routeMetrics.totalO2ConsumedLiters}L</strong>
          </div>
          <div>
            20% Walkback: 
            <strong className={`ml-1 ${routeMetrics.walkbackSafe ? 'text-hud-cyan' : 'text-hud-red'}`}>
              {routeMetrics.walkbackLimitRadiusMeters}m ({routeMetrics.walkbackSafe ? 'NOMINAL' : 'BREACH'})
            </strong>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MAIN OPERATIONAL VIEWPORT ROUTER
      ========================================================================= */}
      <main className="flex-1 p-3 flex flex-col gap-3">
        {displayMode === 'HABITAT_3D' && (
          <div className="flex-1 min-h-[560px]">
            <HabitatViewport3D
              site={currentSite}
              grid={terrainGrid}
              routeMetrics={routeMetrics}
              activeProfile={activeProfile}
              agents={agents}
              currentStepIndex={currentStepIndex}
            />
          </div>
        )}

        {displayMode === 'GLOVED_TABLET' && (
          <div className="flex-1 min-h-[560px]">
            <GlovedTabletView
              site={currentSite}
              grid={terrainGrid}
              routeMetrics={routeMetrics}
              activeProfile={activeProfile}
              onProfileChange={setActiveProfile}
            />
          </div>
        )}

        {displayMode === 'HELMET_HUD' && (
          <div className="flex-1 min-h-[560px]">
            <HelmetVisorHUD
              site={currentSite}
              grid={terrainGrid}
              routeMetrics={routeMetrics}
              activeProfile={activeProfile}
              agent={activeAgent}
              currentStepIndex={currentStepIndex}
              onDropPin={handleDropPin}
              onNextWaypoint={() => {}}
              onEmergencyAbort={() => setActiveProfile('EMERGENCY_HAB_ABORT')}
            />
          </div>
        )}

        {displayMode === 'SPLIT_OPS' && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-[560px]">
            <div className="h-[480px] lg:h-full">
              <HabitatViewport3D
                site={currentSite}
                grid={terrainGrid}
                routeMetrics={routeMetrics}
                activeProfile={activeProfile}
                agents={agents}
                currentStepIndex={currentStepIndex}
              />
            </div>
            <div className="h-[480px] lg:h-full">
              <HelmetVisorHUD
                site={currentSite}
                grid={terrainGrid}
                routeMetrics={routeMetrics}
                activeProfile={activeProfile}
                agent={activeAgent}
                currentStepIndex={currentStepIndex}
                onDropPin={handleDropPin}
                onNextWaypoint={() => {}}
                onEmergencyAbort={() => setActiveProfile('EMERGENCY_HAB_ABORT')}
              />
            </div>
          </div>
        )}

        {/* =========================================================================
            BOTTOM DASHBOARD: REAL-TIME ELEVATION PROFILE CHART & ROVER POV
        ========================================================================= */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          {/* Real-time 2D Cross-section Elevation vs O2 Chart (2 cols on large screen) */}
          <div className="xl:col-span-2">
            <ElevationProfileChart
              site={currentSite}
              routeMetrics={routeMetrics}
              currentStepIndex={currentStepIndex}
            />
          </div>

          {/* Eye-level Rover Ground Truth POV & AR Reticle Locks (1 col) */}
          <div className="xl:col-span-1">
            <SurfacePovCard site={currentSite} />
          </div>
        </div>
      </main>

      {/* =========================================================================
          FOOTER STATUS BAR (HOTKEYS & SI DISCLOSURE)
      ========================================================================= */}
      <footer className="bg-hud-dark border-t border-hud-border px-4 py-2 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <span className="text-hud-cyan font-bold">HOTKEYS:</span>
          <span><strong className="text-white">[1]</strong> Drop Core Pin</span>
          <span><strong className="text-white">[2]</strong> Next Waypoint POV</span>
          <span><strong className="text-white">[3]</strong> Emergency Hab Abort</span>
          <span><strong className="text-white">[SPACE]</strong> Play/Pause Traverse</span>
        </div>

        <div className="flex items-center gap-4">
          <span>SI UNITS: Meters (m) | Pascals (Pa) | Watts (W) | Liters O2 (L) | μSv</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 font-bold">TEAM KALAM | NASA SPACE APPS 2026</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
