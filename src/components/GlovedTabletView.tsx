import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { RouteMetrics, RouteProfile, SiteConfig, TerrainCell, Waypoint } from '../types/eva';
import { getUSGSUnitForSite, USGSGeologicUnit } from '../data/usgsGeologyUnits';
import { AlertTriangle, Compass, Heart, Layers, MapPin, Radio, Shield, Sparkles, Zap } from 'lucide-react';

interface GlovedTabletViewProps {
  site: SiteConfig;
  grid: TerrainCell[][];
  routeMetrics: RouteMetrics;
  activeProfile: RouteProfile;
  onProfileChange: (p: RouteProfile) => void;
  onWaypointSelect?: (wp: Waypoint) => void;
}

export type BasemapType = 'VIKING_COLOR' | 'MOLA_ELEVATION' | 'THEMIS_IR';
export type TacticalOverlayType = 'COST' | 'USGS_GEOLOGY' | 'UHF' | 'SLOPE';

export const GlovedTabletView: React.FC<GlovedTabletViewProps> = ({
  site,
  grid,
  routeMetrics,
  activeProfile,
  onProfileChange,
  onWaypointSelect,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayLayersRef = useRef<L.LayerGroup | null>(null);

  const [basemap, setBasemap] = useState<BasemapType>('VIKING_COLOR');
  const [activeOverlay, setActiveOverlay] = useState<TacticalOverlayType>('USGS_GEOLOGY');
  const [selectedWaypoint, setSelectedWaypoint] = useState<Waypoint | null>(site.waypoints[1] || null);
  const [inspectedUnit, setInspectedUnit] = useState<USGSGeologicUnit | null>(null);
  const [abortArmed, setAbortArmed] = useState(false);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [site.centerLat, site.centerLon],
      zoom: 14,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false,
    });

    leafletMapRef.current = map;

    const overlayGroup = L.layerGroup().addTo(map);
    overlayLayersRef.current = overlayGroup;

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, [site.centerLat, site.centerLon]);

  // Switch NASA Mars Trek Basemap layer
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
    }

    let layerId = 'Mars_Viking_MDIM21_ClrMosaic_global_232m';
    if (basemap === 'MOLA_ELEVATION') {
      layerId = 'Mars_MGS_MOLA_ClrShade_merge_global_463m';
    } else if (basemap === 'THEMIS_IR') {
      layerId = 'Mars_MO_THEMIS-IR-Day_mosaic_global_100m_v2';
    }

    const tileUrl = `https://trek.nasa.gov/tiles/Mars/EQ/${layerId}/1.0.0//default/default028mm/{z}/{y}/{x}.jpg`;

    const newLayer = L.tileLayer(tileUrl, {
      maxZoom: 18,
      errorTileUrl: 'data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="%232d120a"/><path d="M0 0 L256 256 M256 0 L0 256" stroke="%233f1b0e" stroke-width="2"/><text x="128" y="130" fill="%2385321d" font-family="monospace" font-size="12" text-anchor="middle">MARS ORBITAL BASE</text></svg>',
    });

    newLayer.addTo(map);
    baseTileLayerRef.current = newLayer;
  }, [basemap]);

  // Redraw tactical grid cells, A* polyline, and Waypoint pins on the Leaflet map
  useEffect(() => {
    const map = leafletMapRef.current;
    const overlay = overlayLayersRef.current;
    if (!map || !overlay || !grid || grid.length === 0) return;

    overlay.clearLayers();

    const size = grid.length;
    const stepDeg = 0.00021; // ~12.5m grid spacing

    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 2) {
        const cell = grid[y][x];
        let fillColor = '#00f0ff';
        let fillOpacity = 0.25;

        if (activeOverlay === 'USGS_GEOLOGY') {
          const unit = getUSGSUnitForSite(site.id, cell.elevation, cell.slope);
          fillColor = unit.colorHex;
          fillOpacity = 0.38;
        } else if (activeOverlay === 'COST') {
          if (cell.cost > 3.0) {
            fillColor = '#ff3344';
            fillOpacity = 0.45;
          } else if (cell.cost > 1.8) {
            fillColor = '#ffb000';
            fillOpacity = 0.35;
          } else {
            fillColor = '#00ff88';
            fillOpacity = 0.2;
          }
        } else if (activeOverlay === 'UHF') {
          if (!cell.uhfLoS) {
            fillColor = '#d946ef';
            fillOpacity = 0.5;
          } else {
            fillColor = '#00f0ff';
            fillOpacity = 0.15;
          }
        } else if (activeOverlay === 'SLOPE') {
          if (cell.slope > 20) {
            fillColor = '#ff3344';
            fillOpacity = 0.55;
          } else if (cell.slope > 12) {
            fillColor = '#ffb000';
            fillOpacity = 0.35;
          } else {
            fillColor = '#00ff88';
            fillOpacity = 0.15;
          }
        }

        const bounds: L.LatLngBoundsExpression = [
          [cell.lat - stepDeg, cell.lon - stepDeg],
          [cell.lat + stepDeg, cell.lon + stepDeg],
        ];

        const rect = L.rectangle(bounds, {
          color: 'transparent',
          fillColor,
          fillOpacity,
          weight: 0,
        });

        rect.on('click', () => {
          const unit = getUSGSUnitForSite(site.id, cell.elevation, cell.slope);
          setInspectedUnit(unit);
        });

        rect.addTo(overlay);
      }
    }

    // Draw A* Traversal Route Polyline
    if (routeMetrics.path && routeMetrics.path.length > 0) {
      const latlngs: L.LatLngExpression[] = routeMetrics.path.map(c => [c.lat, c.lon]);
      const routeColor =
        activeProfile === 'EMERGENCY_HAB_ABORT' ? '#ff3344' :
        activeProfile === 'MAX_SCIENCE' ? '#00ff88' : '#00f0ff';

      L.polyline(latlngs, {
        color: routeColor,
        weight: 5,
        opacity: 0.95,
        dashArray: activeProfile === 'EMERGENCY_HAB_ABORT' ? '8, 8' : undefined,
      }).addTo(overlay);
    }

    // Draw Apollo/Artemis Walkback Limit Circle
    const habWp = site.waypoints.find(w => w.type === 'HAB') || site.waypoints[0];
    if (habWp) {
      L.circle([habWp.lat, habWp.lon], {
        radius: routeMetrics.walkbackLimitRadiusMeters,
        color: routeMetrics.walkbackSafe ? '#ffb000' : '#ff3344',
        weight: 2,
        fillColor: '#ffb000',
        fillOpacity: 0.05,
        dashArray: '6, 6',
      }).addTo(overlay);
    }

    // Draw Waypoint Markers
    site.waypoints.forEach(wp => {
      const isHab = wp.type === 'HAB';
      const markerColor =
        isHab ? '#ffffff' :
        wp.type === 'SAMPLE' ? '#00ff88' :
        wp.type === 'SCIENCE' ? '#ffb000' :
        wp.type === 'HAZARD' ? '#ff3344' : '#00f0ff';

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div style="
            width: ${isHab ? '28px' : '22px'};
            height: ${isHab ? '28px' : '22px'};
            background: ${markerColor};
            border: 2px solid #000;
            border-radius: ${isHab ? '4px' : '50%'};
            box-shadow: 0 0 10px ${markerColor};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 900;
            color: #000;
          ">
            ${isHab ? 'HAB' : wp.id.split('-')[1] || 'WP'}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([wp.lat, wp.lon], { icon: customIcon });
      marker.on('click', () => {
        setSelectedWaypoint(wp);
        if (onWaypointSelect) onWaypointSelect(wp);
      });
      marker.addTo(overlay);
    });
  }, [grid, routeMetrics, activeOverlay, activeProfile, site, basemap]);

  const handleZoomIn = () => leafletMapRef.current?.zoomIn();
  const handleZoomOut = () => leafletMapRef.current?.zoomOut();
  const handleCenterHab = () => {
    const hab = site.waypoints.find(w => w.type === 'HAB') || site.waypoints[0];
    if (hab && leafletMapRef.current) {
      leafletMapRef.current.setView([hab.lat, hab.lon], 15);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row w-full h-full min-h-[580px] bg-slate-950 border border-hud-border rounded-lg overflow-hidden font-mono text-slate-100">
      {/* Left/Main Tactical Map Viewport */}
      <div className="relative flex-1 h-[380px] lg:h-auto border-b lg:border-b-0 lg:border-r border-hud-border">
        {/* Leaflet DOM container */}
        <div ref={mapContainerRef} className="w-full h-full bg-[#1e0a05]" />

        {/* Top Floating Map Banner with Basemap Switcher */}
        <div className="absolute top-3 left-3 z-[1000] p-2 bg-hud-panel border border-hud-border rounded text-xs backdrop-blur flex flex-wrap items-center gap-2">
          <div className="text-hud-cyan font-bold tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4" />
            NASA MARS TREK
          </div>

          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800 text-[10px]">
            <button
              onClick={() => setBasemap('VIKING_COLOR')}
              className={`px-2 py-0.5 rounded font-bold transition ${
                basemap === 'VIKING_COLOR' ? 'bg-hud-cyan text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              VIKING (232m)
            </button>
            <button
              onClick={() => setBasemap('MOLA_ELEVATION')}
              className={`px-2 py-0.5 rounded font-bold transition ${
                basemap === 'MOLA_ELEVATION' ? 'bg-hud-cyan text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              MOLA ALTIMETRY
            </button>
            <button
              onClick={() => setBasemap('THEMIS_IR')}
              className={`px-2 py-0.5 rounded font-bold transition ${
                basemap === 'THEMIS_IR' ? 'bg-hud-cyan text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              THEMIS IR DAY
            </button>
          </div>

          <div className="text-hud-amber font-bold">{site.centerLat.toFixed(2)}°N, {site.centerLon.toFixed(2)}°E</div>
        </div>

        {/* Oversized Glove Controls: Zoom & Recenter */}
        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="w-14 h-14 bg-slate-900/90 active:bg-hud-cyan hover:bg-slate-800 border-2 border-hud-border rounded-lg flex items-center justify-center text-2xl font-bold text-hud-cyan active:text-slate-950 shadow-2xl transition"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="w-14 h-14 bg-slate-900/90 active:bg-hud-cyan hover:bg-slate-800 border-2 border-hud-border rounded-lg flex items-center justify-center text-2xl font-bold text-hud-cyan active:text-slate-950 shadow-2xl transition"
            title="Zoom Out"
          >
            -
          </button>
          <button
            onClick={handleCenterHab}
            className="w-14 h-14 bg-slate-900/90 active:bg-hud-amber hover:bg-slate-800 border-2 border-hud-border rounded-lg flex items-center justify-center text-hud-amber active:text-slate-950 shadow-2xl transition"
            title="Recenter Hab"
          >
            <Compass className="w-6 h-6" />
          </button>
        </div>

        {/* Bottom Tactical Layer Selector for EVA Glove */}
        <div className="absolute bottom-3 left-3 z-[1000] flex flex-wrap gap-2">
          <button
            onClick={() => setActiveOverlay('USGS_GEOLOGY')}
            className={`min-h-[50px] px-3.5 py-2 border-2 rounded-lg font-bold text-xs flex items-center gap-2 transition ${
              activeOverlay === 'USGS_GEOLOGY'
                ? 'bg-hud-emerald text-slate-950 border-hud-emerald shadow-hud-emerald'
                : 'bg-slate-900/90 text-slate-300 border-slate-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            USGS SIM 3292
          </button>

          <button
            onClick={() => setActiveOverlay('COST')}
            className={`min-h-[50px] px-3.5 py-2 border-2 rounded-lg font-bold text-xs flex items-center gap-2 transition ${
              activeOverlay === 'COST'
                ? 'bg-hud-cyan text-slate-950 border-hud-cyan shadow-hud-cyan'
                : 'bg-slate-900/90 text-slate-300 border-slate-700'
            }`}
          >
            <Shield className="w-4 h-4" />
            COSTMAP
          </button>

          <button
            onClick={() => setActiveOverlay('UHF')}
            className={`min-h-[50px] px-3.5 py-2 border-2 rounded-lg font-bold text-xs flex items-center gap-2 transition ${
              activeOverlay === 'UHF'
                ? 'bg-hud-purple text-slate-950 border-hud-purple'
                : 'bg-slate-900/90 text-slate-300 border-slate-700'
            }`}
          >
            <Radio className="w-4 h-4" />
            UHF SHADOW
          </button>

          <button
            onClick={() => setActiveOverlay('SLOPE')}
            className={`min-h-[50px] px-3.5 py-2 border-2 rounded-lg font-bold text-xs flex items-center gap-2 transition ${
              activeOverlay === 'SLOPE'
                ? 'bg-hud-amber text-slate-950 border-hud-amber shadow-hud-amber'
                : 'bg-slate-900/90 text-slate-300 border-slate-700'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            SLOPE HAZARD
          </button>
        </div>
      </div>

      {/* Right Tactical Mission & Glove Operation Panel (340px) */}
      <div className="w-full lg:w-84 p-4 flex flex-col justify-between bg-hud-dark overflow-y-auto">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-hud-border pb-2">
            <div>
              <div className="text-xs text-slate-400">SECONDARY TERMINAL</div>
              <div className="text-sm font-bold text-hud-cyan">GLOVED WRIST / CHEST</div>
            </div>
            <div className="px-2 py-1 bg-emerald-950/60 border border-emerald-500/50 rounded text-xs text-emerald-400 font-bold">
              GLOVE MODE: ON
            </div>
          </div>

          {/* Route Profile Buttons - Oversized 54px touch targets */}
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1.5 font-bold">
              Traverse Profile Select
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => onProfileChange('LOW_O2_SAFE')}
                className={`min-h-[54px] px-4 py-2 rounded-lg border-2 text-left font-bold transition flex items-center justify-between ${
                  activeProfile === 'LOW_O2_SAFE'
                    ? 'border-hud-cyan bg-cyan-950/50 text-hud-cyan shadow-hud-cyan'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="text-xs">LOW O2 SAFE</div>
                  <div className="text-[11px] font-normal text-slate-400">Min slope, comms linked</div>
                </div>
                <Zap className="w-5 h-5 text-hud-cyan" />
              </button>

              <button
                onClick={() => onProfileChange('MAX_SCIENCE')}
                className={`min-h-[54px] px-4 py-2 rounded-lg border-2 text-left font-bold transition flex items-center justify-between ${
                  activeProfile === 'MAX_SCIENCE'
                    ? 'border-hud-emerald bg-emerald-950/50 text-hud-emerald shadow-hud-emerald'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="text-xs">MAX SCIENCE</div>
                  <div className="text-[11px] font-normal text-slate-400">High hydration & samples</div>
                </div>
                <Heart className="w-5 h-5 text-hud-emerald" />
              </button>
            </div>
          </div>

          {/* USGS SIM 3292 Inspected Unit Card */}
          {inspectedUnit && (
            <div className="p-3 bg-hud-panel border border-hud-emerald rounded-lg shadow-hud-emerald">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-hud-emerald font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  USGS UNIT [{inspectedUnit.symbol}]
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-hud-amber font-bold">
                  {inspectedUnit.epoch}
                </span>
              </div>
              <div className="text-xs font-bold text-white mb-1">{inspectedUnit.name}</div>
              <div className="text-[11px] text-slate-300 leading-relaxed mb-2">
                {inspectedUnit.description}
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400 border-t border-slate-800 pt-1.5">
                <div>Boot Traction: <strong className="text-hud-cyan">{(inspectedUnit.tractionFrictionCoeff * 100).toFixed(0)}%</strong></div>
                <div>GCR Shielding: <strong className="text-hud-amber">{inspectedUnit.gcrShieldingScore}/100</strong></div>
              </div>
            </div>
          )}

          {/* Selected Waypoint Briefing */}
          {selectedWaypoint && (
            <div className="p-3 bg-hud-panel border border-hud-border rounded-lg">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-hud-amber font-bold flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {selectedWaypoint.id}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                  {selectedWaypoint.type}
                </span>
              </div>
              <div className="text-sm font-bold text-white mb-1">{selectedWaypoint.name}</div>
              <div className="text-xs text-slate-300 leading-relaxed mb-2">
                {selectedWaypoint.description}
              </div>
              {selectedWaypoint.sampleType && (
                <div className="text-[11px] text-hud-emerald font-semibold">
                  Sample Target: {selectedWaypoint.sampleType}
                </div>
              )}
            </div>
          )}

          {/* Mission Telemetry Summary */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-slate-900 border border-slate-800 rounded">
              <div className="text-slate-400">Total Distance</div>
              <div className="text-sm font-bold text-white">{routeMetrics.totalDistanceMeters} m</div>
            </div>
            <div className="p-2 bg-slate-900 border border-slate-800 rounded">
              <div className="text-slate-400">Est. Traverse Time</div>
              <div className="text-sm font-bold text-white">{routeMetrics.estimatedTimeMinutes} min</div>
            </div>
            <div className="p-2 bg-slate-900 border border-slate-800 rounded">
              <div className="text-slate-400">Total O2 Burn</div>
              <div className="text-sm font-bold text-hud-amber">{routeMetrics.totalO2ConsumedLiters} L</div>
            </div>
            <div className="p-2 bg-slate-900 border border-slate-800 rounded">
              <div className="text-slate-400">20% Walkback Radius</div>
              <div className={`text-sm font-bold ${routeMetrics.walkbackSafe ? 'text-hud-cyan' : 'text-hud-red'}`}>
                {routeMetrics.walkbackLimitRadiusMeters} m
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Hab Abort with 2-Step Safety Interlock */}
        <div className="mt-4 pt-3 border-t border-slate-800">
          {!abortArmed ? (
            <button
              onClick={() => setAbortArmed(true)}
              className="w-full min-h-[58px] bg-red-950/70 hover:bg-red-900 border-2 border-red-600 rounded-lg text-white font-bold text-sm tracking-wider flex items-center justify-center gap-2 shadow-hud-red transition"
            >
              <AlertTriangle className="w-5 h-5 text-hud-red" />
              ARM EMERGENCY ABORT
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => {
                  onProfileChange('EMERGENCY_HAB_ABORT');
                  setAbortArmed(false);
                }}
                className="w-full min-h-[58px] bg-hud-red active:bg-red-700 text-slate-950 font-black text-sm tracking-wider rounded-lg flex items-center justify-center gap-2 animate-pulse shadow-hud-red"
              >
                CONFIRM ABORT TO HAB NOW
              </button>
              <button
                onClick={() => setAbortArmed(false)}
                className="w-full py-2 text-xs text-slate-400 hover:text-white underline text-center"
              >
                Cancel / Disarm
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
