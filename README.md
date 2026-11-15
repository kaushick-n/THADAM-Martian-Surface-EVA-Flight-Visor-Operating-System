# THADAM | Martian Surface EVA Flight Traverse & Visor Operating System
**Team KALAM** | NASA International Space Apps Challenge: *"Interplanetary Survival Guide: Martian Map"*

[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?logo=three.js&logoColor=white)](https://threejs.org/)
[![Leaflet](https://img.shields.io/badge/Leaflet-WMTS-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

### Master Project Documentation
- 📘 **[User Action Guide](USER_ACTION_GUIDE.md)**: Simple, plain-English step-by-step guide explaining how each feature works, how to use the app, and how the AR/VR HUD operates over rover photos.
- 🔬 **[Technical Context & AI Specification](TECHNICAL_CONTEXT.md)**: Comprehensive architectural reference with TypeScript schemas, USGS data tables, NASA endpoints, and biomechanical equations.

---

## 1. Executive Summary

Extravehicular Activity (EVA) on the surface of Mars presents an unforgiving physiological and environmental hazard profile:
- Atmospheric pressure averaging just **610 Pa** (~0.006 atm, near the Armstrong limit).
- Ambient daytime temperatures from **-88°C to -55°C**.
- Unfiltered surface cosmic ray and solar energetic particle flux (**18–45 μSv/h**).
- Rugged terrain with loose basaltic dust drifts that increase suited locomotion drag by up to **35%**.
- UHF line-of-sight signal loss behind crater rims and ridge walls, isolating crews from the surface habitat comms mast.

**THADAM** (by **Team KALAM**) is an operational Martian EVA Flight Traverse & Visor Operating System engineered for mission flight controllers, habitat science directors, and suited astronauts. It fuses orbital remote-sensing datasets, 3D raycasting, biomechanical walking models, and multi-form-factor visual user interfaces to ensure zero-loss crew survival and optimal geological return.

---

## 2. Ingested NASA & USGS Planetary Datasets

To cut through ambiguous repository searches (such as the 2,038 search results in NASA Mars Trek), THADAM directly integrates the official, verified product identifiers:

### A. NASA Mars Trek & PDS Imaging Node (`trek.nasa.gov/mars`)
- **Gale Crater (Mount Sharp)**: `Gale_CTX_BlockAdj_dd` (5 m/px controlled mosaic) & HiRISE DTM `ESP_023957_1755` (1 m/px elevation).
- **Jezero Crater (Delta Front)**: `Jezero_CTX_mosaic` (5 m/px controlled mosaic) & HiRISE DTM `ESP_037128_1985`.
- **Global Altimetry**: `Mars_MGS_MOLA_ClrShade_merge_global_463m` (MOLA Shaded Relief).
- **Global Thermal Inertia**: `Mars_MO_THEMIS-IR-Day_mosaic_global_100m_v2` (THEMIS Day IR).
- **Global Basemap**: `Mars_Viking_MDIM21_ClrMosaic_global_232m` (232 m/px).

### B. USGS SIM 3292 Geologic Map of Mars (Tanaka et al., 2014)
- **Portal ID**: `fc004c3d21b64c398ed5458580ab7c58` (USGS Astrogeology WebAppViewer).
- **Live WMS Service**: `https://astrowebmaps.wr.usgs.gov/webmap/ows/wms?SERVICE=WMS&REQUEST=GetMap&LAYERS=SIM3292_Geology`.
- **Stratigraphic Matrix (`src/data/usgsGeologyUnits.ts`)**: Encodes physical rock mechanics (bulk density, compressive strength in MPa, suited boot friction coefficient $\mu_s$, and GCR radiation shielding score) across 8 dominant units (`lAb`, `AHv`, `Hpe`, `Hch`, `Hsu`, `mNh`, `HNch`, `lNl`).

### C. Live NASA MMGIS Telemetry & Dual-Rover API
- **Perseverance (M20) Live Waypoints GeoJSON**: `https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json`
- **Perseverance (M20) Live Traverse GeoJSON**: `https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json`
- **Curiosity (MSL) Live Waypoints GeoJSON**: `https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json`
- **Curiosity (MSL) Live Traverse GeoJSON**: `https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json`
- **Camera Instrument Selectors**: Support for `MASTCAM` / `Mastcam-Z`, `NAVCAM`, `HAZCAM` (Front/Rear avoidance), and `SUPERCAM_RMI` (Remote Micro-Imager).

### D. NASA Science Curiosity Path Up Mount Sharp (10 Authentic Stages)
Traverses chronologically from the landing datum to the groundwater boxwork network:
1. **Bradbury Landing** (Sol 0, $-4.59^\circ\text{S}, 137.44^\circ\text{E}$, Elev: $-4501\text{m}$)
2. **Yellowknife Bay** (Sol 125, $-4.58^\circ\text{S}, 137.45^\circ\text{E}$, Elev: $-4520\text{m}$)
3. **Pahrump Hills** (Sol 750, $-4.61^\circ\text{S}, 137.41^\circ\text{E}$, Elev: $-4460\text{m}$)
4. **Murray Buttes** (Sol 1400, $-4.62^\circ\text{S}, 137.39^\circ\text{E}$, Elev: $-4420\text{m}$)
5. **Vera Rubin Ridge** (Sol 1800, $-4.63^\circ\text{S}, 137.38^\circ\text{E}$, Elev: $-4210\text{m}$)
6. **Glen Torridon Clay Unit** (Sol 2300, $-4.64^\circ\text{S}, 137.37^\circ\text{E}$, Elev: $-4260\text{m}$)
7. **Greenheugh Pediment** (Sol 2700, $-4.65^\circ\text{S}, 137.36^\circ\text{E}$, Elev: $-4180\text{m}$)
8. **Sulfate-Bearing Unit** (Sol 3200, $-4.66^\circ\text{S}, 137.35^\circ\text{E}$, Elev: $-4050\text{m}$)
9. **Gediz Vallis Channel** (Sol 3600, $-4.67^\circ\text{S}, 137.34^\circ\text{E}$, Elev: $-3980\text{m}$)
10. **Boxwork Fracture Web** (Sol 4000+, $-4.68^\circ\text{S}, 137.33^\circ\text{E}$, Elev: $-3850\text{m}$)

---

## 3. Mathematical & Geophysical Formulations

### A. Pinhole Camera Matrix AR Reticle Projection
To superimpose AR target locks over raw 2D rover photos without a dedicated NASA AR interface:
$$\begin{pmatrix} u \\ v \\ 1 \end{pmatrix} = \frac{1}{Z_c} \mathbf{K} \cdot \left( \mathbf{R} \cdot \begin{pmatrix} X_{mars} - X_{rover} \\ Y_{mars} - Y_{rover} \\ Z_{mars} - Z_{rover} \end{pmatrix} \right)$$
Where $\mathbf{K}$ is the intrinsic camera matrix calibrated for Mastcam-Z focal length ($f_x = f_y \approx 1600\,\text{px}$) and principal center $(600, 300)$, and $\mathbf{R}$ is the 3D rotation matrix constructed from camera mast azimuth and elevation tilt.

### B. 3D Bresenham UHF Line-of-Sight Raycasting
Traces line-of-sight from the Habitat 2.8m comms mast ($z_{mast} = z(x_h, y_h) + 2.8\,\text{m}$) to an astronaut helmet receiver ($z_{rx} = z(x_t, y_t) + 1.8\,\text{m}$). Intermediate terrain blocks trigger diffraction attenuation:
$$\text{Signal Strength} = 0.28 \cdot \exp(-0.35 \cdot \Delta z_{overhang})$$

### C. Martian Suited Biomechanics & Apollo/Artemis Walkback Limit
- Astronaut ($80\,\text{kg}$) + xEMU suit ($140\,\text{kg}$) = $220\,\text{kg}$ ($818.62\,\text{N}$ at $0.38g$).
- Metabolic workload equation:
  $$P(\theta) = P_{base} + W_{mars} \cdot v \cdot (\sin\theta + 1.8 \sin^2\theta) \times \mu_{dust}$$
- Oxygen burn rate: $1\,\text{L } O_2 \approx 20,900\,\text{J}$ ($4.8\,\text{kcal}$).
- Dynamic Walkback Limit Radius: Enforces the non-negotiable **Apollo/Artemis 20% $O_2$ Reserve Floor** ($240\,\text{L}$), rendering a safe boundary circle beyond which an emergency sprint back to Habitat would breach reserve.

---

## 4. Operational Form Factors

1. **3D Habitat Flight Director Viewport (`HabitatViewport3D`)**: Three.js WebGL canvas with vertex-colored orbital heatmaps (Elevation, THEMIS Thermal Inertia, CRISM Hydration, UHF Comms, Tactical Cost, and **USGS SIM 3292 Stratigraphy**).
2. **Gloved Wrist/Chest Tablet View (`GlovedTabletView`)**: Tactical Leaflet mapping terminal with 54px touch targets, switchable NASA Mars Trek basemaps (Viking, MOLA, THEMIS), and USGS geology overlay.
3. **Helmet AR Visor HUD (`HelmetVisorHUD`)**: Peripheral AR heads-up display with 360° compass heading tape, waypoint azimuth chevrons, xEMU life support gauges, slope alarms, and hotkeys (`[1]` Drop Core Pin, `[2]` Next Waypoint POV, `[3]` Abort to Hab).
4. **Real-Time Cross-Section Chart (`ElevationProfileChart`)**: Real-time 2D Canvas cross-section plotting elevation (cyan) vs. cumulative $O_2$ consumption (orange) vs. 20% reserve ceiling (red).
5. **Ground-Truth Rover POV (`SurfacePovCard`)**: Dual-rover live imagery with camera selector (`MAST`, `NAV`, `HAZ`, `SUPER`) and AR diamond target locks displaying mineralogy and USGS unit classifications.

---

## 5. Token-Free Local DEM Extraction Tool

If you ever download a custom high-resolution HiRISE GeoTIFF DEM from NASA Mars Trek or PDS:
```powershell
python scripts/pds_dem_extractor.py path_to_input.tif [src/data/custom_dem.json]
```
This downsamples any raw multi-gigabyte raster locally into the compact 15 KB $48\times 48$ elevation matrix required by THADAM with **zero LLM tokens**.

---

## 6. Quickstart & Installation

```bash
# Clone the repository
git clone https://github.com/kaushick-n/THADAM-Martian-Surface-EVA-Flight-Visor-Operating-System.git
cd THADAM-Martian-Surface-EVA-Flight-Visor-Operating-System

# Install dependencies
npm install

# Launch development server
npm run dev

# Run production build & strict TypeScript verification
npm run build
```

---

**Developed with pride by Team KALAM for the NASA Space Apps Challenge 2026.**
