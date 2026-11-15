# Technical Master Specification & AI Context Reference
**Project THADAM (Team KALAM)** | Document for AI Reference & Developer Context

---

## 1. Project Overview & Separation of Concerns

THADAM is an Extravehicular Activity (EVA) Flight Traverse & Visor Operating System for the NASA Space Apps Challenge ("Interplanetary Survival Guide: Martian Map").
- **Framework**: Vite 6 + React 18 + TypeScript 5.6
- **Styling**: Tailwind CSS 3.4 + Aerospace HUD glassmorphism + CRT scanlines
- **3D Graphics**: Three.js WebGL with dynamic heightfield plane geometry & vertex shaders
- **2D Mapping**: Leaflet with live JPL Mars Trek WMTS tile layers + USGS Astrogeology WMS
- **Pathfinding**: 8-directional profile-weighted A* algorithm (`LOW_O2_SAFE`, `MAX_SCIENCE`, `EMERGENCY_HAB_ABORT`)
- **Physics**: Santee/Minetti 0.38g biomechanical workload, metabolic $O_2$ consumption, and Apollo/Artemis 20% walkback limit

---

## 2. Ingested NASA & USGS Planetary Datasets

### A. USGS SIM 3292 Geologic Map of Mars (Tanaka et al., 2014)
- **Classification Schema**: 44 chronostratigraphic units categorized by epoch:
  - **Amazonian**: Youngest volcanic flood basalts, eolian mantles (`AHv`, `Av`, `lAea`, `mAl`).
  - **Hesperian**: Intermediate transitional lava plains and canyon channel deposits (`Hpe`, `Hch`, `Hchp`, `Hh`).
  - **Noachian**: Ancient cratered highlands and clay-bearing bedrock (`mNh`, `lNl`, `eNh`, `HNch`).
- **Data Integration**:
  - Encoded in `src/data/usgsGeologyUnits.ts`.
  - Maps lithology, rock compressive strength ($\text{MPa}$), suited boot friction coefficient ($\mu_s$), and galactic cosmic ray (GCR) shielding score.
  - Live WMS service: `https://astrowebmaps.wr.usgs.gov/webmap/ows/wms?`

### B. NASA PDS Imaging Atlas & Mars Trek
- **Live Tile Endpoint**:
  `https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0//default/default028mm/{z}/{y}/{x}.jpg`
- **DEM Resolution**: $48 \times 48$ elevation grid covering $600\text{m} \times 600\text{m}$ at $12.5\text{m/cell}$.
- **Comms Raycaster**: 3D Bresenham raycasting from 2.8m Hab mast to 1.8m astronaut helmet antenna.

### C. NASA Mars 2020 & Curiosity Raw Image APIs & MMGIS Feeds
- **Perseverance Live Waypoints GeoJSON**:
  `https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json`
- **Perseverance Live Traverse GeoJSON**:
  `https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json`
- **Curiosity Live Waypoints GeoJSON**:
  `https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json`
- **Curiosity Live Traverse GeoJSON**:
  `https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json`
- **Raw Image REST API**:
  `https://api.nasa.gov/mars-photos/api/v1/rovers/{curiosity|perseverance}/photos`

### D. NASA Science Curiosity Path Up Mount Sharp (10 Stages)
1. `WP-G0 (Bradbury Landing)`: Sol 0, $-4.59^\circ\text{S}, 137.44^\circ\text{E}$, Elev: $-4501\text{m}$ (Landing datum)
2. `WP-G1 (Yellowknife Bay)`: Sol 125, $-4.58^\circ\text{S}, 137.45^\circ\text{E}$, Elev: $-4520\text{m}$ (Mudstone lakebed)
3. `WP-G2 (Pahrump Hills)`: Sol 750, $-4.61^\circ\text{S}, 137.41^\circ\text{E}$, Elev: $-4460\text{m}$ (Basal Murray formation)
4. `WP-G3 (Murray Buttes)`: Sol 1400, $-4.62^\circ\text{S}, 137.39^\circ\text{E}$, Elev: $-4420\text{m}$ (Eolian sandstone mesas)
5. `WP-G4 (Vera Rubin Ridge)`: Sol 1800, $-4.63^\circ\text{S}, 137.38^\circ\text{E}$, Elev: $-4210\text{m}$ (Hematite ridge)
6. `WP-G5 (Glen Torridon Clay Unit)`: Sol 2300, $-4.64^\circ\text{S}, 137.37^\circ\text{E}$, Elev: $-4260\text{m}$ (Smectite clay trough)
7. `WP-G6 (Greenheugh Pediment)`: Sol 2700, $-4.65^\circ\text{S}, 137.36^\circ\text{E}$, Elev: $-4180\text{m}$ (Unconformity cap)
8. `WP-G7 (Sulfate-Bearing Unit)`: Sol 3200, $-4.66^\circ\text{S}, 137.35^\circ\text{E}$, Elev: $-4050\text{m}$ (Hydrated sulfate salts)
9. `WP-G8 (Gediz Vallis Channel)`: Sol 3600, $-4.67^\circ\text{S}, 137.34^\circ\text{E}$, Elev: $-3980\text{m}$ (Debris flow boulders)
10. `WP-G9 (Boxwork Fracture Web)`: Sol 4000+, $-4.68^\circ\text{S}, 137.33^\circ\text{E}$, Elev: $-3850\text{m}$ (Groundwater mineral lattice)

---

## 3. Mathematical & Biomechanical Formulations

- **Martian Gravity**: $g_{mars} = 3.721\,\text{m/s}^2$
- **Suited Mass**: $m_{astronaut} (80\,\text{kg}) + m_{xEMU} (140\,\text{kg}) = 220\,\text{kg}$ ($W_{mars} \approx 818.62\,\text{N}$)
- **Metabolic Power**:
  $$P(\theta) = P_{base} + W_{mars} \cdot v \cdot (\sin\theta + 1.8 \sin^2\theta) \times \mu_{dust}$$
- **Oxygen Consumption**:
  $$\dot{V}_{O2}\,(\text{L/min}) = \frac{P(\text{Watts}) \times 60}{20,900}$$
- **Apollo/Artemis Walkback Limit**:
  Primary tank $1200\,\text{L}$, Emergency reserve floor $240\,\text{L}$ ($20\%$), Usable budget $960\,\text{L}$.
  $$R_{walkback} = \left(\frac{O_{2,\text{remaining usable}}}{P_{sprint} / 20,900}\right) \times v_{sprint} \times 0.85$$

---

## 4. Multi-Commit Deployment Plan

1. **Commit 1**: `feat(data): add USGS SIM 3292 geology units and 10-stage Mount Sharp traverse`
2. **Commit 2**: `feat(api): integrate dual-rover live streaming and NASA MMGIS GeoJSON feeds`
3. **Commit 3**: `feat(ui): add USGS GIS tile layers to Gloved Tablet and AR locks to Surface POV`
4. **Commit 4**: `feat(3d): implement USGS Stratigraphy heatmap in Habitat 3D and update Visor HUD`
5. **Commit 5**: `feat(tools): add token-free PDS DEM extractor script and update flight manual`
