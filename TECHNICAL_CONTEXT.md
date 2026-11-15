# Technical Master Specification & AI Context Reference
**Project THADAM (Team KALAM)** | Document for AI Reference & Developer Context

---

## 1. Project Overview & Architectural Boundaries

THADAM is an operational Martian Extravehicular Activity (EVA) Flight Traverse & Visor Operating System for the NASA Space Apps Challenge ("Interplanetary Survival Guide: Martian Map").
- **Framework**: Vite 6 + React 18 + TypeScript 5.6
- **3D Graphics Engine**: Three.js WebGL with dynamic 48x48 DEM displacement and vertex-color shaders
- **2D Planetary GIS**: Leaflet 1.9 streaming live OGC WMTS/WMS tile pyramids
- **Autonomous Pathfinding**: 8-directional profile-weighted A* algorithm (`LOW_O2_SAFE`, `MAX_SCIENCE`, `EMERGENCY_HAB_ABORT`)
- **Biomechanical Life Support**: Santee/Minetti 0.38g metabolic model, metabolic $O_2$ consumption, and Apollo/Artemis 20% walkback limit ($240\text{L}$ reserve floor)
- **Zero-Token Telemetry Pipeline**: All external NASA/USGS rasters and GeoJSON feeds are streamed directly into client viewports without passing heavy binary payloads through the LLM context.

---

## 2. Definitive NASA & USGS Planetary Product Identifiers

To prevent navigating through thousands of ambiguous search results (e.g. the 2,038 results in Mars Trek), THADAM targets the following exact, verified product IDs:

### A. NASA Mars Trek & PDS Imaging Node (`trek.nasa.gov/mars`)

| Target Site | Exact Mars Trek Layer ID | NASA PDS Product Code | Spatial Resolution | Data Type |
| :--- | :--- | :--- | :--- | :--- |
| **Gale Crater (Mount Sharp)** | `Gale_CTX_BlockAdj_dd` | `DTEEC_023957_1755_024023_1755_A01` | 5.0 m/px (CTX) / 1.0 m/px (HiRISE) | Controlled Ortho-Mosaic & DTM Elevation |
| **Jezero Crater (Delta Front)**| `Jezero_CTX_mosaic` | `DTEEC_037128_1985_037207_1985_A01` | 5.0 m/px (CTX) / 1.0 m/px (HiRISE) | Controlled Ortho-Mosaic & DTM Elevation |
| **Global Elevation** | `Mars_MGS_MOLA_ClrShade_merge_global_463m` | MOLA MEGDR | 463 m/px (128 pixels/degree) | Shaded Relief Altimetry |
| **Global Thermal Inertia** | `Mars_MO_THEMIS-IR-Day_mosaic_global_100m_v2` | THEMIS IR Day | 100 m/px | Thermal Inertia & Rock Fraction |
| **Global Basemap** | `Mars_Viking_MDIM21_ClrMosaic_global_232m` | USGS Astrogeology MDIM 2.1 | 232 m/px | Color Surface Imagery |

#### Live WMTS Tile URL Structure:
```text
https://trek.nasa.gov/tiles/Mars/EQ/{LayerID}/1.0.0/default/default028mm/{z}/{y}/{x}.jpg (or .png)
```

---

### B. USGS SIM 3292 Geologic Map of Mars (Tanaka et al., 2014)
- **Portal ID**: `fc004c3d21b64c398ed5458580ab7c58` (USGS Astrogeology WebAppViewer)
- **Live WMS Service Endpoint**:
  `https://astrowebmaps.wr.usgs.gov/webmap/ows/wms?`
  - WMS Layer Name: `SIM3292_Geology`
  - WMS Contacts Layer: `SIM3292_Contacts`
  - WMS Linear Structures: `SIM3292_LinearFeatures`
- **Key Stratigraphic Units in Traverse Areas**:
  - `lAb` (Late Amazonian Basalt / Mount Sharp Boxwork capping unit): High compressive strength (180 MPa), excellent boot traction ($\mu_s = 0.82$), baseline GCR shielding.
  - `Hpe` (Hesperian Ridged Plains / Gale floor): Basaltic plains, semi-consolidated duricrust, moderate traction ($\mu_s = 0.65$).
  - `mNh` (Middle Noachian Highlands / Jezero Delta basement): Smectite clay-rich mudstones, high aqueous alteration, low compressive strength (35 MPa), soft eolian slip hazard ($\mu_s = 0.45$).
  - `HNch` (Hesperian-Noachian Channel Material / Neretva Vallis & Gediz Vallis): Fluvial debris-flow conglomerate, mixed boulder field requiring suited dismount.

---

### C. NASA MMGIS Live Rover GeoJSON Telemetry
NASA JPL hosts live Multi-Mission Geographic Information System (MMGIS) GeoJSON feeds powering the official NASA rover location portals:
- **Perseverance (Mars 2020) Live Waypoints**:
  `https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json`
- **Perseverance (Mars 2020) Live Traverse Line**:
  `https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json`
- **Curiosity (MSL) Live Waypoints**:
  `https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json`
- **Curiosity (MSL) Live Traverse Line**:
  `https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json`

#### MMGIS Waypoint GeoJSON Schema:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [137.4412, -4.5895, -4501.2] },
      "properties": {
        "sol": 0,
        "site": 1,
        "drive": 0,
        "dist_m": 0.0,
        "elev": -4501.2,
        "target_name": "Bradbury Landing",
        "instrument": "MASTCAM"
      }
    }
  ]
}
```

---

### D. NASA Science Curiosity Path Up Mount Sharp (10 Authentic Stages)

```text
[Sol 0]      Bradbury Landing (-4.59°S, 137.44°E, -4501m) -> Landing site datum
[Sol 125]    Yellowknife Bay (-4.58°S, 137.45°E, -4520m) -> Mudstone lakebed (first habitable zone)
[Sol 750]    Pahrump Hills (-4.61°S, 137.41°E, -4460m) -> Basal Murray Formation mudstones
[Sol 1400]   Murray Buttes (-4.62°S, 137.39°E, -4420m) -> Ancient eolian cross-bedded sandstone
[Sol 1800]   Vera Rubin Ridge (-4.63°S, 137.38°E, -4210m) -> Resistant iron-oxide hematite bedrock
[Sol 2300]   Glen Torridon (-4.64°S, 137.37°E, -4260m) -> Smectite clay-rich mudstone trough
[Sol 2700]   Greenheugh Pediment (-4.65°S, 137.36°E, -4180m) -> Capping sandstone unconformity
[Sol 3200]   Sulfate-Bearing Unit (-4.66°S, 137.35°E, -4050m) -> Polyhydrated magnesium sulfate salts
[Sol 3600]   Gediz Vallis Channel (-4.67°S, 137.34°E, -3980m) -> Wet catastrophic debris flow boulders
[Sol 4000+]  Boxwork Fracture Web (-4.68°S, 137.33°E, -3850m) -> Hydraulic mineralized fracture blades
```

---

## 3. Mathematical Formulation: AR Target Reticle Projection

To project AR diamond reticles onto 2D rover photos without a dedicated NASA AR interface, THADAM uses the standard **Pinhole Camera Intrinsic/Extrinsic Matrix Transformation**:

$$\begin{pmatrix} u \\ v \\ 1 \end{pmatrix} = \frac{1}{Z_c} \mathbf{K} \cdot \left( \mathbf{R} \cdot \begin{pmatrix} X_{mars} - X_{rover} \\ Y_{mars} - Y_{rover} \\ Z_{mars} - Z_{rover} \end{pmatrix} \right)$$

Where:
- $\mathbf{K}$ is the Mastcam-Z camera intrinsic matrix:
  $$\mathbf{K} = \begin{pmatrix} f_x & 0 & c_x \\ 0 & f_y & c_y \\ 0 & 0 & 1 \end{pmatrix}$$
  (Focal length $f \approx 1600\,\text{pixels}$, principal optical center $(c_x, c_y) = (600, 300)$ for a $1200\times 600$ viewport).
- $\mathbf{R}$ is the 3D rotation matrix constructed from the rover Mast azimuth $\alpha$, elevation tilt $\beta$, and chassis roll $\gamma$:
  $$\mathbf{R} = \mathbf{R}_z(\alpha) \cdot \mathbf{R}_x(\beta) \cdot \mathbf{R}_y(\gamma)$$
- $(u, v)$ are the exact pixel screen coordinates where the AR target diamond, distance label, and ChemCam/SuperCam mineralogy tag are rendered in `SurfacePovCard.tsx` and `HelmetVisorHUD.tsx`.

---

## 4. Multi-Commit Execution Roadmap

- **Commit 1**: `feat(data): add USGS SIM 3292 geology units and 10-stage Mount Sharp traverse`
- **Commit 2**: `feat(api): integrate dual-rover live streaming and NASA MMGIS GeoJSON feeds`
- **Commit 3**: `feat(ui): add USGS GIS tile layers to Gloved Tablet and AR locks to Surface POV`
- **Commit 4**: `feat(3d): implement USGS Stratigraphy heatmap in Habitat 3D and update Visor HUD`
- **Commit 5**: `feat(tools): add token-free PDS DEM extractor script and update flight manual`
