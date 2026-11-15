import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { AgentTelemetry, RouteMetrics, RouteProfile, SiteConfig, TerrainCell } from '../types/eva';
import { TerrainGenerator } from '../engine/terrainGenerator';
import { getUSGSUnitForSite } from '../data/usgsGeologyUnits';
import { Eye, Layers, Radio, ShieldAlert, Sparkles, Navigation } from 'lucide-react';

export type HeatmapMode = 'ELEVATION' | 'THERMAL_INERTIA' | 'HYDRATION' | 'UHF_LOS' | 'COSTMAP' | 'USGS_GEOLOGY';

interface HabitatViewport3DProps {
  site: SiteConfig;
  grid: TerrainCell[][];
  routeMetrics: RouteMetrics;
  activeProfile: RouteProfile;
  agents: AgentTelemetry[];
  currentStepIndex: number;
  onCellSelect?: (cell: TerrainCell) => void;
}

export const HabitatViewport3D: React.FC<HabitatViewport3DProps> = ({
  site,
  grid,
  routeMetrics,
  activeProfile,
  agents,
  currentStepIndex,
  onCellSelect,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('ELEVATION');
  const [inspectedCell, setInspectedCell] = useState<TerrainCell | null>(null);
  const [isRotating, setIsRotating] = useState(true);

  // References to keep Three.js scene objects alive and updated without re-mounting
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const terrainMeshRef = useRef<THREE.Mesh | null>(null);
  const pathLineRef = useRef<THREE.Line | null>(null);
  const walkbackRingRef = useRef<THREE.LineLoop | null>(null);
  const agentMarkersRef = useRef<Map<string, THREE.Group>>(new Map());

  // Mouse orbit controls tracking
  const mouseState = useRef({
    isMouseDown: false,
    prevX: 0,
    prevY: 0,
    rotX: 0.65,
    rotY: -0.75,
    zoom: 65,
    panX: 0,
    panY: 0,
  });

  const size = TerrainGenerator.GRID_SIZE;

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x070b10);
    scene.fog = new THREE.FogExp2(0x070b10, 0.008);

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    cameraRef.current = camera;
    updateCameraTransform();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Ambient & Directional Sun Lighting for Martian afternoon
    const ambientLight = new THREE.AmbientLight(0xd99568, 0.45);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffecd0, 1.3);
    sunLight.position.set(40, 80, 50);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // Subtle blue fill light from horizon dust scattering
    const skyFillLight = new THREE.DirectionalLight(0x4080aa, 0.4);
    skyFillLight.position.set(-50, 30, -50);
    scene.add(skyFillLight);

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (isRotating && !mouseState.current.isMouseDown) {
        mouseState.current.rotY += 0.0015;
        updateCameraTransform();
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
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
  }, []);

  function updateCameraTransform() {
    if (!cameraRef.current) return;
    const ms = mouseState.current;
    const dist = ms.zoom;
    const x = dist * Math.cos(ms.rotX) * Math.sin(ms.rotY) + ms.panX;
    const y = dist * Math.sin(ms.rotX);
    const z = dist * Math.cos(ms.rotX) * Math.cos(ms.rotY) + ms.panY;
    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(ms.panX, 8, ms.panY);
  }

  // Update Terrain Geometry & Vertex Colors when grid or heatmap changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !grid || grid.length === 0) return;

    if (terrainMeshRef.current) {
      scene.remove(terrainMeshRef.current);
      terrainMeshRef.current.geometry.dispose();
      (terrainMeshRef.current.material as THREE.Material).dispose();
      terrainMeshRef.current = null;
    }

    const segments = size - 1;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2); // Lay flat on XZ plane

    const positions = geometry.attributes.position;
    const colors: number[] = [];

    // Elevation extents for hypsometric tint
    let minZ = 999;
    let maxZ = -999;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const el = grid[y][x].elevation;
        if (el < minZ) minZ = el;
        if (el > maxZ) maxZ = el;
      }
    }
    const zRange = Math.max(1, maxZ - minZ);

    for (let i = 0; i < positions.count; i++) {
      const gx = i % size;
      const gy = Math.floor(i / size);
      const cell = grid[gy][gx];

      // Set elevation Y
      positions.setY(i, cell.elevation * 0.35); // Scale height for 3D aesthetics

      // Calculate vertex color based on active heatmap mode
      const rgb = computeCellRgb(cell, heatmapMode, minZ, zRange);
      colors.push(rgb.r, rgb.g, rgb.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.1,
      wireframe: false,
      flatShading: false,
    });

    const terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    terrainMesh.position.set(-size / 2, 0, -size / 2);
    scene.add(terrainMesh);
    terrainMeshRef.current = terrainMesh;

    // Add Habitat 3D Structure & Comms Mast at Hab position
    addHabitatStructure(scene, site, grid);
    addWaypointMarkers(scene, site);
  }, [grid, heatmapMode, site]);

  // Color generator for heatmap modes
  function computeCellRgb(cell: TerrainCell, mode: HeatmapMode, minZ: number, zRange: number): { r: number; g: number; b: number } {
    if (mode === 'ELEVATION') {
      const norm = (cell.elevation - minZ) / zRange;
      // Hypsometric tint: deep Martian rust -> ochre -> golden sand -> dusty white peaks
      if (norm < 0.25) return { r: 0.45 + norm * 0.5, g: 0.15, b: 0.08 };
      if (norm < 0.6) return { r: 0.75 + (norm - 0.25) * 0.4, g: 0.35 + (norm - 0.25) * 0.6, b: 0.18 };
      return { r: 0.95, g: 0.75 + (norm - 0.6) * 0.5, b: 0.55 + (norm - 0.6) * 0.9 };
    }

    if (mode === 'THERMAL_INERTIA') {
      // THEMIS: low TIU (soft dust) = dark maroon/brown, high TIU (bedrock) = glowing cyan
      const norm = Math.max(0, Math.min(1, (cell.thermalInertia - 150) / 450));
      return {
        r: (1 - norm) * 0.8 + norm * 0.05,
        g: (1 - norm) * 0.2 + norm * 0.95,
        b: (1 - norm) * 0.1 + norm * 1.0,
      };
    }

    if (mode === 'HYDRATION') {
      // CRISM: low = charcoal regolith, high = bright neon lime/emerald
      const h = cell.hydrationIndex;
      return {
        r: (1 - h) * 0.25 + h * 0.05,
        g: (1 - h) * 0.18 + h * 1.0,
        b: (1 - h) * 0.12 + h * 0.45,
      };
    }

    if (mode === 'UHF_LOS') {
      // UHF Comms: clear LoS = vibrant blue/cyan; shadow = warning purple/crimson
      if (cell.uhfLoS) {
        const sig = cell.uhfSignalStrength;
        return { r: 0.05, g: 0.6 + sig * 0.4, b: 0.9 + sig * 0.1 };
      }
      return { r: 0.75, g: 0.08, b: 0.25 }; // Radio shadow
    }

    if (mode === 'USGS_GEOLOGY') {
      const unit = getUSGSUnitForSite(site.id, cell.elevation, cell.slope);
      // Convert hex color (e.g. #3b82f6) to normalized RGB [0..1]
      const hex = unit.colorHex.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      return { r, g, b };
    }

    // COSTMAP: low cost = bright green, high hazard = deep red
    const costRatio = Math.min(1, (cell.cost - 0.2) / 4.0);
    return {
      r: costRatio > 0.5 ? 1.0 : costRatio * 2.0,
      g: costRatio < 0.5 ? 0.95 : (1.0 - costRatio) * 1.9,
      b: 0.1,
    };
  }

  // Habitat structure + 2.8m UHF Mast
  function addHabitatStructure(scene: THREE.Scene, curSite: SiteConfig, curGrid: TerrainCell[][]) {
    const existing = scene.getObjectByName('HABITAT_GROUP');
    if (existing) scene.remove(existing);

    const habGroup = new THREE.Group();
    habGroup.name = 'HABITAT_GROUP';

    const hx = curSite.habPosition.x - size / 2;
    const hz = curSite.habPosition.y - size / 2;
    const hy = (curGrid[curSite.habPosition.y]?.[curSite.habPosition.x]?.elevation || 0) * 0.35;

    // Hab module geodesic dome
    const domeGeo = new THREE.SphereGeometry(1.6, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      metalness: 0.7,
      roughness: 0.25,
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.set(hx, hy, hz);
    habGroup.add(dome);

    // 2.8m Comms Mast
    const mastGeo = new THREE.CylinderGeometry(0.08, 0.12, 2.8 * 0.35, 8);
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x007799 });
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.set(hx, hy + 1.6 + (2.8 * 0.35) / 2, hz);
    habGroup.add(mast);

    // Pulsing antenna beacon
    const beaconGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(hx, hy + 1.6 + 2.8 * 0.35, hz);
    habGroup.add(beacon);

    scene.add(habGroup);
  }

  // Waypoint markers in 3D
  function addWaypointMarkers(scene: THREE.Scene, curSite: SiteConfig) {
    const existing = scene.getObjectByName('WAYPOINTS_GROUP');
    if (existing) scene.remove(existing);

    const wpGroup = new THREE.Group();
    wpGroup.name = 'WAYPOINTS_GROUP';

    curSite.waypoints.forEach(wp => {
      if (wp.type === 'HAB') return;
      const wx = wp.x - size / 2;
      const wz = wp.y - size / 2;
      const wy = (grid[wp.y]?.[wp.x]?.elevation || wp.elevation) * 0.35;

      const pinGeo = new THREE.ConeGeometry(0.5, 1.4, 6);
      pinGeo.rotateX(Math.PI); // Point down at terrain
      const color =
        wp.type === 'SAMPLE' ? 0x00ff88 :
        wp.type === 'SCIENCE' ? 0xffb000 :
        wp.type === 'HAZARD' ? 0xff3344 : 0x00f0ff;

      const pinMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.4,
      });
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.set(wx, wy + 1.2, wz);
      wpGroup.add(pin);
    });

    scene.add(wpGroup);
  }

  // Update 3D A* Path Ribbon
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !routeMetrics.path || routeMetrics.path.length === 0) return;

    if (pathLineRef.current) {
      scene.remove(pathLineRef.current);
      pathLineRef.current.geometry.dispose();
      (pathLineRef.current.material as THREE.Material).dispose();
      pathLineRef.current = null;
    }

    const points: THREE.Vector3[] = [];
    routeMetrics.path.forEach(cell => {
      const px = cell.x - size / 2;
      const pz = cell.y - size / 2;
      const py = cell.elevation * 0.35 + 0.35; // Elevate slightly above terrain surface
      points.push(new THREE.Vector3(px, py, pz));
    });

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const pathColor =
      activeProfile === 'EMERGENCY_HAB_ABORT' ? 0xff3344 :
      activeProfile === 'MAX_SCIENCE' ? 0x00ff88 : 0x00f0ff;

    const material = new THREE.LineBasicMaterial({
      color: pathColor,
      linewidth: 3,
    });

    const pathLine = new THREE.Line(geometry, material);
    scene.add(pathLine);
    pathLineRef.current = pathLine;
  }, [routeMetrics.path, activeProfile]);

  // Update Apollo/Artemis Walkback Limit Ring
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (walkbackRingRef.current) {
      scene.remove(walkbackRingRef.current);
      walkbackRingRef.current.geometry.dispose();
      (walkbackRingRef.current.material as THREE.Material).dispose();
      walkbackRingRef.current = null;
    }

    const hx = site.habPosition.x - size / 2;
    const hz = site.habPosition.y - size / 2;
    const hy = (grid[site.habPosition.y]?.[site.habPosition.x]?.elevation || 0) * 0.35 + 0.5;

    // Convert walkback radius in meters to 3D grid cell units (1 unit = 12.5m)
    const radiusUnits = routeMetrics.walkbackLimitRadiusMeters / TerrainGenerator.CELL_RESOLUTION_METERS;

    const ringPoints: THREE.Vector3[] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const rx = hx + Math.cos(theta) * radiusUnits;
      const rz = hz + Math.sin(theta) * radiusUnits;

      // Sample terrain elevation at this ring position
      const gx = Math.max(0, Math.min(size - 1, Math.round(rx + size / 2)));
      const gy = Math.max(0, Math.min(size - 1, Math.round(rz + size / 2)));
      const ry = (grid[gy]?.[gx]?.elevation || hy) * 0.35 + 0.3;

      ringPoints.push(new THREE.Vector3(rx, ry, rz));
    }

    const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPoints);
    const ringMat = new THREE.LineBasicMaterial({
      color: routeMetrics.walkbackSafe ? 0xffb000 : 0xff2233,
      linewidth: 2,
    });

    const walkbackRing = new THREE.LineLoop(ringGeo, ringMat);
    scene.add(walkbackRing);
    walkbackRingRef.current = walkbackRing;
  }, [routeMetrics.walkbackLimitRadiusMeters, routeMetrics.walkbackSafe, site, grid]);

  // Update Animated Agents (EV-1, EV-2, ROVER-01) positions along path
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !routeMetrics.path || routeMetrics.path.length === 0) return;

    agents.forEach(agent => {
      let group = agentMarkersRef.current.get(agent.id);
      if (!group) {
        group = new THREE.Group();
        group.name = `AGENT_${agent.id}`;

        const beaconColor =
          agent.id === 'EV-1' ? 0xffb000 :
          agent.id === 'EV-2' ? 0x00f0ff : 0x00ff88;

        const bodyGeo = new THREE.SphereGeometry(agent.id === 'ROVER-01' ? 0.6 : 0.4, 8, 8);
        const bodyMat = new THREE.MeshBasicMaterial({ color: beaconColor });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);

        // Pulsing ring
        const ringGeo = new THREE.RingGeometry(0.5, 0.7, 12);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color: beaconColor, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        group.add(ring);

        scene.add(group);
        agentMarkersRef.current.set(agent.id, group);
      }

      // Position along path with slight offsets between agents
      let step = currentStepIndex;
      if (agent.id === 'EV-2') step = Math.max(0, currentStepIndex - 2);
      if (agent.id === 'ROVER-01') step = Math.max(0, currentStepIndex - 5);

      const targetCell = routeMetrics.path[Math.min(routeMetrics.path.length - 1, step)];
      if (targetCell) {
        const ax = targetCell.x - size / 2;
        const az = targetCell.y - size / 2;
        const ay = targetCell.elevation * 0.35 + 0.6;
        group.position.set(ax, ay, az);
      }
    });
  }, [agents, currentStepIndex, routeMetrics.path]);

  // Mouse Interaction: Orbit, Pan, Zoom, and Terrain Raycast Inspector
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseState.current.isMouseDown = true;
    mouseState.current.prevX = e.clientX;
    mouseState.current.prevY = e.clientY;
    setIsRotating(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mouseState.current.isMouseDown) {
      const dx = e.clientX - mouseState.current.prevX;
      const dy = e.clientY - mouseState.current.prevY;
      mouseState.current.prevX = e.clientX;
      mouseState.current.prevY = e.clientY;

      if (e.buttons === 1) {
        // Left click orbit
        mouseState.current.rotY -= dx * 0.008;
        mouseState.current.rotX = Math.max(0.15, Math.min(1.4, mouseState.current.rotX + dy * 0.008));
      } else if (e.buttons === 2) {
        // Right click pan
        mouseState.current.panX -= dx * 0.05;
        mouseState.current.panY -= dy * 0.05;
      }
      updateCameraTransform();
    } else {
      // Raycast inspector on hover
      inspectCellUnderCursor(e);
    }
  };

  const handleMouseUp = () => {
    mouseState.current.isMouseDown = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    mouseState.current.zoom = Math.max(15, Math.min(130, mouseState.current.zoom + e.deltaY * 0.05));
    updateCameraTransform();
  };

  const inspectCellUnderCursor = (e: React.MouseEvent) => {
    if (!mountRef.current || !cameraRef.current || !terrainMeshRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const intersects = raycaster.intersectObject(terrainMeshRef.current);

    if (intersects.length > 0) {
      const pt = intersects[0].point;
      const gx = Math.round(pt.x + size / 2);
      const gy = Math.round(pt.z + size / 2);
      if (gx >= 0 && gx < size && gy >= 0 && gy < size && grid[gy]?.[gx]) {
        const cell = grid[gy][gx];
        setInspectedCell(cell);
        if (onCellSelect && e.buttons === 1) {
          onCellSelect(cell);
        }
      }
    }
  };

  return (
    <div className="relative w-full h-full min-h-[550px] bg-hud-dark overflow-hidden rounded-lg border border-hud-border">
      {/* Three.js Canvas Container */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={e => e.preventDefault()}
      />

      {/* Top Left: Heatmap Mode Switcher Controls */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1.5 p-1.5 bg-hud-panel border border-hud-border rounded backdrop-blur">
        <button
          onClick={() => setHeatmapMode('ELEVATION')}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition ${
            heatmapMode === 'ELEVATION'
              ? 'bg-hud-cyan text-slate-900 shadow-hud-cyan'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          ELEVATION
        </button>

        <button
          onClick={() => setHeatmapMode('THERMAL_INERTIA')}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition ${
            heatmapMode === 'THERMAL_INERTIA'
              ? 'bg-hud-cyan text-slate-900 shadow-hud-cyan'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          THEMIS TIU
        </button>

        <button
          onClick={() => setHeatmapMode('HYDRATION')}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition ${
            heatmapMode === 'HYDRATION'
              ? 'bg-hud-emerald text-slate-900 shadow-hud-emerald'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          CRISM HYDRATION
        </button>

        <button
          onClick={() => setHeatmapMode('UHF_LOS')}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition ${
            heatmapMode === 'UHF_LOS'
              ? 'bg-hud-purple text-slate-900'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          UHF COMMS
        </button>

        <button
          onClick={() => setHeatmapMode('USGS_GEOLOGY')}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition ${
            heatmapMode === 'USGS_GEOLOGY'
              ? 'bg-hud-emerald text-slate-900 shadow-hud-emerald'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          USGS SIM 3292
        </button>

        <button
          onClick={() => setHeatmapMode('COSTMAP')}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded transition ${
            heatmapMode === 'COSTMAP'
              ? 'bg-hud-amber text-slate-900 shadow-hud-amber'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          TACTICAL COST
        </button>
      </div>

      {/* Top Right: Orbit Status & Compass Heading */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <button
          onClick={() => setIsRotating(!isRotating)}
          className={`px-2 py-1 text-xs font-mono rounded border ${
            isRotating
              ? 'border-hud-cyan text-hud-cyan bg-cyan-950/40'
              : 'border-slate-700 text-slate-400 bg-slate-900/60'
          }`}
        >
          {isRotating ? 'ORBIT: AUTO' : 'ORBIT: MANUAL'}
        </button>

        <div className="px-2.5 py-1 bg-hud-panel border border-hud-border rounded text-xs text-hud-cyan font-mono flex items-center gap-1">
          <Navigation className="w-3.5 h-3.5" />
          <span>GRID: 48x48 (600m)</span>
        </div>
      </div>

      {/* Bottom Left: Cursor Raycast Terrain Inspector Telemetry Tooltip */}
      {inspectedCell && (
        <div className="absolute bottom-3 left-3 z-10 p-3 bg-hud-panel border border-hud-border rounded-lg text-xs font-mono shadow-2xl backdrop-blur max-w-sm pointer-events-none">
          <div className="flex items-center justify-between border-b border-cyan-900/60 pb-1 mb-2 text-hud-cyan font-bold">
            <span>SECTOR CELL [{inspectedCell.x}, {inspectedCell.y}]</span>
            <span>{inspectedCell.lat.toFixed(4)}°N, {inspectedCell.lon.toFixed(4)}°E</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-300">
            <div>Elevation: <span className="text-white font-bold">{inspectedCell.elevation.toFixed(1)} m</span></div>
            <div>Slope: <span className={`font-bold ${inspectedCell.slope > 20 ? 'text-hud-red' : inspectedCell.slope > 12 ? 'text-hud-amber' : 'text-hud-emerald'}`}>{inspectedCell.slope.toFixed(1)}°</span></div>
            <div>THEMIS TIU: <span className="text-white">{inspectedCell.thermalInertia} TIU</span></div>
            <div>CRISM Hydr: <span className="text-hud-emerald font-bold">{(inspectedCell.hydrationIndex * 100).toFixed(0)}%</span></div>
            <div>RAD Dose: <span className="text-hud-amber">{inspectedCell.radDoseRate.toFixed(1)} μSv/h</span></div>
            <div>USGS Unit: <span className="text-hud-cyan font-bold">{getUSGSUnitForSite(site.id, inspectedCell.elevation, inspectedCell.slope).symbol}</span></div>
            <div>
              UHF Comms: 
              <span className={`ml-1 font-bold ${inspectedCell.uhfLoS ? 'text-hud-cyan' : 'text-hud-red'}`}>
                {inspectedCell.uhfLoS ? `LoS (${(inspectedCell.uhfSignalStrength * 100).toFixed(0)}%)` : 'SHADOW'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Right: Active Legend for Heatmap */}
      <div className="absolute bottom-3 right-3 z-10 p-2 bg-hud-panel border border-hud-border rounded text-xs font-mono text-slate-300 pointer-events-none flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-hud-cyan"></span>
          <span>A* Traverse</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border border-dashed border-hud-amber"></span>
          <span>20% Walkback Limit ({routeMetrics.walkbackLimitRadiusMeters}m)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-hud-amber"></span>
          <span>EV-1</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-hud-cyan"></span>
          <span>EV-2</span>
        </div>
      </div>
    </div>
  );
};
