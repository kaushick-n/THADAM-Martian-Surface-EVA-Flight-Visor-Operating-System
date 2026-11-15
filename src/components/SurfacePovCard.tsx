import React, { useEffect, useRef, useState } from 'react';
import { GroundTruthPhoto, SiteConfig } from '../types/eva';
import { GeologicalTarget, NasaRoverService } from '../services/nasaRoverApi';
import { Camera, Crosshair, RefreshCw, Sparkles } from 'lucide-react';

interface SurfacePovCardProps {
  site: SiteConfig;
}

export const SurfacePovCard: React.FC<SurfacePovCardProps> = ({ site }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photos, setPhotos] = useState<GroundTruthPhoto[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [useProceduralFallback, setUseProceduralFallback] = useState(true);
  const [selectedTarget, setSelectedTarget] = useState<GeologicalTarget | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const targets = NasaRoverService.getSiteGeologicalTargets(site.id);

  // Attempt to fetch photos from NASA Rover API on site switch
  useEffect(() => {
    let isMounted = true;
    const fetchPhotos = async () => {
      setIsLoading(true);
      const res = await NasaRoverService.fetchRoverPhotos(site.weather.sol, 'MAST');
      if (isMounted) {
        if (res.length > 0) {
          setPhotos(res);
          setUseProceduralFallback(false);
        } else {
          setUseProceduralFallback(true);
        }
        setIsLoading(false);
      }
    };

    fetchPhotos();
    return () => {
      isMounted = false;
    };
  }, [site.id, site.weather.sol]);

  // Render procedural Mars horizon on canvas when fallback is active
  useEffect(() => {
    if (!useProceduralFallback || !canvasRef.current) return;
    NasaRoverService.renderProceduralMarsHorizon(
      canvasRef.current,
      site.id,
      site.weather.dustOpticalDepthTau
    );
  }, [useProceduralFallback, site.id, site.weather.dustOpticalDepthTau]);

  const activePhoto = photos[activePhotoIndex];

  return (
    <div className="relative w-full h-full min-h-[320px] bg-slate-950 rounded-lg border border-hud-border font-mono overflow-hidden flex flex-col">
      {/* Top Telemetry Header */}
      <div className="p-2.5 bg-hud-dark border-b border-hud-border flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-hud-cyan" />
          <span className="text-xs font-bold text-white tracking-wider">
            GROUND TRUTH POV | {site.region.toUpperCase()}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-hud-amber font-bold">
            SOL {site.weather.sol}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {photos.length > 1 && !useProceduralFallback && (
            <div className="flex items-center gap-1">
              {photos.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePhotoIndex(idx)}
                  className={`w-4 h-4 rounded text-[9px] font-bold ${
                    activePhotoIndex === idx
                      ? 'bg-hud-cyan text-slate-950 font-black'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setUseProceduralFallback(!useProceduralFallback)}
            className={`px-2 py-1 text-[11px] rounded border transition flex items-center gap-1 ${
              useProceduralFallback
                ? 'border-hud-cyan text-hud-cyan bg-cyan-950/40'
                : 'border-slate-700 text-slate-300 bg-slate-900'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            {useProceduralFallback ? 'PHYSICAL SYNTHESIS' : 'NASA ROVER API'}
          </button>
        </div>
      </div>

      {/* Main Imagery Area */}
      <div className="relative flex-1 w-full overflow-hidden bg-black flex items-center justify-center">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 text-hud-cyan">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <span className="text-xs">UPLINKING ROVER MASTCAM TELEMETRY...</span>
          </div>
        ) : useProceduralFallback ? (
          <canvas
            ref={canvasRef}
            width={600}
            height={280}
            className="w-full h-full object-cover"
          />
        ) : activePhoto ? (
          <img
            src={activePhoto.imgSrc}
            alt={activePhoto.caption}
            className="w-full h-full object-cover"
            onError={() => setUseProceduralFallback(true)}
          />
        ) : (
          <canvas
            ref={canvasRef}
            width={600}
            height={280}
            className="w-full h-full object-cover"
          />
        )}

        {/* HUD Scanlines & Crosshair Layer */}
        <div className="absolute inset-0 hud-scanlines pointer-events-none" />

        {/* Interactive AR Target Locks Overlaid on Imagery */}
        {targets.map(tgt => {
          const isSelected = selectedTarget?.id === tgt.id;
          return (
            <div
              key={tgt.id}
              onClick={() => setSelectedTarget(isSelected ? null : tgt)}
              style={{ left: `${tgt.screenX}%`, top: `${tgt.screenY}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
            >
              {/* Reticle Diamond */}
              <div
                className={`w-6 h-6 border-2 rotate-45 transition-all duration-300 flex items-center justify-center ${
                  isSelected
                    ? 'border-hud-cyan bg-cyan-500/30 scale-125 shadow-hud-cyan'
                    : 'border-hud-amber/80 bg-black/40 group-hover:scale-110'
                }`}
              >
                <div className="w-1.5 h-1.5 bg-hud-cyan rounded-full -rotate-45" />
              </div>

              {/* Tag Label */}
              <div
                className={`absolute left-7 top-0 px-2 py-0.5 rounded text-[10px] whitespace-nowrap backdrop-blur border ${
                  isSelected
                    ? 'bg-slate-900 border-hud-cyan text-hud-cyan font-bold shadow-lg'
                    : 'bg-black/80 border-slate-700 text-slate-300 group-hover:border-hud-amber'
                }`}
              >
                {tgt.name} [{tgt.distanceMeters}m]
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Geological Target Inspector Details */}
      {selectedTarget ? (
        <div className="p-3 bg-hud-panel border-t border-hud-border text-xs z-10 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-hud-cyan font-bold flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5" />
              {selectedTarget.name} ({selectedTarget.mineralType})
            </span>
            <span className="text-hud-emerald font-bold">
              CRISM Hydration: {selectedTarget.crismHydrationPct}%
            </span>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed mb-1">
            {selectedTarget.description}
          </p>
          <div className="flex items-center gap-4 text-[10px] text-slate-400">
            <span>Range: {selectedTarget.distanceMeters}m</span>
            <span>Bearing: {selectedTarget.bearingDeg}°</span>
            <span>Hazard: <strong className={selectedTarget.hazardRisk === 'HIGH' ? 'text-hud-red' : 'text-hud-emerald'}>{selectedTarget.hazardRisk}</strong></span>
          </div>
        </div>
      ) : (
        <div className="p-2 bg-hud-dark border-t border-hud-border text-[11px] text-slate-400 flex items-center justify-between z-10">
          <span>Click on any AR diamond reticle above to lock geological target</span>
          <span className="text-hud-cyan">FOV: 68° MASTCAM EQ</span>
        </div>
      )}
    </div>
  );
};
