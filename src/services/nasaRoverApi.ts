import { GroundTruthPhoto } from '../types/eva';

export interface GeologicalTarget {
  id: string;
  name: string;
  screenX: number; // Percentage [0..100]
  screenY: number; // Percentage [0..100]
  distanceMeters: number;
  bearingDeg: number;
  mineralType: string;
  description: string;
  crismHydrationPct: number;
  hazardRisk: 'LOW' | 'MODERATE' | 'HIGH';
}

export class NasaRoverService {
  private static readonly CURIOSITY_ENDPOINT = 'https://rovers.nebulum.one/api/v1/rovers/curiosity/photos';

  /**
   * Fetches authentic eye-level Mastcam/Navcam imagery from the Mars Rover API.
   * If network fails, CORS blocks, or rate-limited, safely returns empty array to trigger canvas fallback.
   */
  public static async fetchRoverPhotos(sol = 1000, camera = 'MAST'): Promise<GroundTruthPhoto[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second timeout

      const url = `${this.CURIOSITY_ENDPOINT}?sol=${sol}&camera=${camera}&page=1`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Rover API error: ${response.status}`);
      }

      const data = await response.json();
      const photos = data.photos || [];

      if (!Array.isArray(photos) || photos.length === 0) {
        return [];
      }

      return photos.slice(0, 5).map((p: any, idx: number) => ({
        id: `ROV-${p.id || idx}`,
        camera: p.camera?.full_name || camera,
        earthDate: p.earth_date || '2024-05-12',
        sol: p.sol || sol,
        imgSrc: p.img_src,
        caption: `Curiosity Mastcam sol ${p.sol} geological record`,
        featureCallout: `Outcrop Stratum ${idx + 1}`,
        distanceMeters: 14.5 + idx * 8.2,
        bearingDeg: (45 + idx * 30) % 360,
        mineralTarget: idx % 2 === 0 ? 'Sulfate-Cemented Sandstone' : 'Basaltic Regolith Breccia',
      }));
    } catch {
      // Graceful fallback to procedural canvas
      return [];
    }
  }

  /**
   * Generates authentic geological AR target callouts for the viewport.
   */
  public static getSiteGeologicalTargets(siteId: string): GeologicalTarget[] {
    if (siteId === 'mount-sharp-boxwork') {
      return [
        {
          id: 'TGT-G1',
          name: 'Boxwork Vein Spine A-4',
          screenX: 32,
          screenY: 58,
          distanceMeters: 18.2,
          bearingDeg: 124,
          mineralType: 'Crystalline Gypsum / Magnesium Sulfate',
          description: 'Erosion-resistant blade projecting 1.8m above deflated regolith.',
          crismHydrationPct: 78,
          hazardRisk: 'LOW',
        },
        {
          id: 'TGT-G2',
          name: 'Pahrump Mudstone Shelf',
          screenX: 68,
          screenY: 72,
          distanceMeters: 8.6,
          bearingDeg: 168,
          mineralType: 'Iron-Rich Smectite Mudstone',
          description: 'Fine laminated lacustrine bedding with preserved sub-millimeter laminae.',
          crismHydrationPct: 84,
          hazardRisk: 'LOW',
        },
        {
          id: 'TGT-G3',
          name: 'Scree Gully Talus Drop',
          screenX: 84,
          screenY: 48,
          distanceMeters: 42.0,
          bearingDeg: 215,
          mineralType: 'Unsorted Basalt Talus',
          description: 'Steep scree-slope funnel with high slip risk.',
          crismHydrationPct: 22,
          hazardRisk: 'HIGH',
        },
      ];
    }

    if (siteId === 'jezero-delta') {
      return [
        {
          id: 'TGT-J1',
          name: 'Delta Scarp Bottomset Lobe',
          screenX: 25,
          screenY: 62,
          distanceMeters: 24.5,
          bearingDeg: 84,
          mineralType: 'Aqueous Smectite Clay Matrix',
          description: 'Key organic preservation target formed in quiet bottomset paleolake waters.',
          crismHydrationPct: 92,
          hazardRisk: 'LOW',
        },
        {
          id: 'TGT-J2',
          name: 'Kodiak Butte Cliff Wall',
          screenX: 72,
          screenY: 38,
          distanceMeters: 145.0,
          bearingDeg: 112,
          mineralType: 'Topset-Foreset Delta Sandstone',
          description: 'Truncated river delta architecture demonstrating ancient lake water level.',
          crismHydrationPct: 45,
          hazardRisk: 'MODERATE',
        },
      ];
    }

    // Olympus Lava Tube
    return [
      {
        id: 'TGT-O1',
        name: 'Skylight Basalt Overhang',
        screenX: 48,
        screenY: 66,
        distanceMeters: 12.0,
        bearingDeg: 340,
        mineralType: 'Tholeiitic Columnar Basalt',
        description: 'Fractured cantilever rim spanning 35m across the cavern abyss.',
        crismHydrationPct: 15,
        hazardRisk: 'HIGH',
      },
      {
        id: 'TGT-O2',
        name: 'Cavern Shadow Threshold',
        screenX: 52,
        screenY: 82,
        distanceMeters: 28.0,
        bearingDeg: 355,
        mineralType: 'Subsurface Condensate Frost & Ice',
        description: 'Complete cosmic ray protection zone (<2 uSv/h). Extreme cold -95°C.',
        crismHydrationPct: 88,
        hazardRisk: 'MODERATE',
      },
    ];
  }

  /**
   * Renders high-fidelity Martian horizon on HTML5 Canvas using physical atmospheric dust scattering.
   */
  public static renderProceduralMarsHorizon(
    canvas: HTMLCanvasElement,
    siteId: string,
    opticalDepthTau = 0.65
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Martian Atmospheric Sky Gradient
    // Mars sky color: butterscotch / dusty ochre near horizon, deep salmon/rusty brown at zenith
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.58);
    const tauFactor = Math.min(1.5, Math.max(0.4, opticalDepthTau));
    
    skyGrad.addColorStop(0, `rgb(${Math.round(85 * tauFactor)}, ${Math.round(48 * tauFactor)}, ${Math.round(34 * tauFactor)})`);
    skyGrad.addColorStop(0.4, `rgb(${Math.round(155 * tauFactor)}, ${Math.round(92 * tauFactor)}, ${Math.round(62 * tauFactor)})`);
    skyGrad.addColorStop(1.0, `rgb(${Math.round(205 * tauFactor)}, ${Math.round(130 * tauFactor)}, ${Math.round(88 * tauFactor)})`);

    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height * 0.58);

    // Pale bluish sun glow around solar disk (Martian inverse scattering phenomenon)
    const sunX = width * 0.42;
    const sunY = height * 0.22;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 90);
    sunGlow.addColorStop(0, 'rgba(215, 235, 255, 0.85)');
    sunGlow.addColorStop(0.15, 'rgba(170, 205, 240, 0.4)');
    sunGlow.addColorStop(0.6, 'rgba(180, 130, 95, 0.15)');
    sunGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, width, height * 0.58);

    // 2. Far Distant Crater Rim Mountain Ridge (modulated by site morphology)
    const ridgeHueOffset = siteId === 'olympus-lava-tube' ? -15 : siteId === 'jezero-delta' ? 10 : 0;
    ctx.fillStyle = `rgb(${Math.max(40, Math.round((128 + ridgeHueOffset) * tauFactor))}, 74, 55)`;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.52);
    for (let x = 0; x <= width; x += 15) {
      const ridgeY = height * 0.50 + Math.sin(x * 0.008) * 18 + Math.cos(x * 0.02) * 8;
      ctx.lineTo(x, ridgeY);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // 3. Mid-Ground Dunes & Scarp Terraces
    ctx.fillStyle = `rgb(${Math.round(168 * tauFactor)}, 78, 48)`;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.56);
    for (let x = 0; x <= width; x += 20) {
      const midY = height * 0.54 + Math.sin(x * 0.015) * 14 + Math.sin(x * 0.04) * 6;
      ctx.lineTo(x, midY);
    }
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // 4. Foreground Martian Regolith Floor (Basalt Sand + Eolian Ripples)
    const groundGrad = ctx.createLinearGradient(0, height * 0.56, 0, height);
    groundGrad.addColorStop(0, '#9e3f22');
    groundGrad.addColorStop(0.4, '#7a2f17');
    groundGrad.addColorStop(1, '#48190c');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, height * 0.56, width, height * 0.44);

    // Draw Eolian Sand Ripples
    ctx.strokeStyle = 'rgba(60, 20, 10, 0.35)';
    ctx.lineWidth = 1.8;
    for (let y = height * 0.60; y < height; y += 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= width; x += 25) {
        ctx.lineTo(x, y + Math.sin(x * 0.06 + y * 0.2) * 3);
      }
      ctx.stroke();
    }

    // 5. Basalt Rocks & Geological Outcrops
    this.drawMartianRock(ctx, width * 0.28, height * 0.72, 38, 22, '#502014', '#281009');
    this.drawMartianRock(ctx, width * 0.65, height * 0.78, 62, 34, '#582417', '#30120a');
    this.drawMartianRock(ctx, width * 0.82, height * 0.68, 24, 15, '#4a1e12', '#220b06');
    this.drawMartianRock(ctx, width * 0.14, height * 0.84, 46, 26, '#5a2618', '#2d1109');
  }

  private static drawMartianRock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    fillLight: string,
    fillDark: string
  ): void {
    ctx.save();
    // Rock shadow on sand
    ctx.fillStyle = 'rgba(25, 8, 4, 0.6)';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.1, y + h * 0.45, w * 0.65, h * 0.3, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Rock body
    ctx.fillStyle = fillDark;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y);
    ctx.lineTo(x - w * 0.3, y - h * 0.5);
    ctx.lineTo(x + w * 0.2, y - h * 0.6);
    ctx.lineTo(x + w * 0.5, y - h * 0.1);
    ctx.lineTo(x + w * 0.4, y + h * 0.4);
    ctx.lineTo(x - w * 0.4, y + h * 0.3);
    ctx.closePath();
    ctx.fill();

    // Sunlight facet
    ctx.fillStyle = fillLight;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y);
    ctx.lineTo(x - w * 0.3, y - h * 0.5);
    ctx.lineTo(x + w * 0.2, y - h * 0.6);
    ctx.lineTo(x, y - h * 0.1);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
