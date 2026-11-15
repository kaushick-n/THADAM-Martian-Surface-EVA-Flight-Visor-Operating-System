# THADAM | Martian Surface EVA Flight Traverse & Visor Operating System
**Team KALAM** | NASA International Space Apps Challenge: *"Interplanetary Survival Guide: Martian Map"*

[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?logo=three.js&logoColor=white)](https://threejs.org/)
[![Leaflet](https://img.shields.io/badge/Leaflet-WMTS-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

### Master Project Documentation
- 📘 **[User Action Guide](USER_ACTION_GUIDE.md)**: Simple, plain-English step-by-step guide explaining how each feature works, how to use the app, and how the AR/VR HUD operates.
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

## 2. System Architecture

THADAM is built on **Vite + React + TypeScript** with strict modular separation of concerns:

```text
thadam/
├── index.html                         # Entry HTML with military HUD typography & Leaflet assets
├── package.json                       # Core dependencies (Three.js, Leaflet, Lucide, Tailwind)
├── tsconfig.json                      # Strict TypeScript compiler options
├── vite.config.ts                     # Vite bundler configuration
├── README.md                          # Architecture, NASA data sources, math formulas & SI disclosure
└── src/
    ├── main.tsx                       # React DOM root mounting
    ├── App.tsx                        # Flight Director bar, MET clock, Display Mode router & simulation controls
    ├── types/
    │   └── eva.ts                     # Strongly typed interfaces for TerrainCell, SiteConfig, Waypoint, RouteMetrics
    ├── data/
    │   └── sites.ts                   # Real Martian landing coordinates & waypoints (Mount Sharp, Jezero, Olympus)
    ├── engine/
    │   ├── terrainGenerator.ts        # Synthesizes 48x48 DEM grids with HiRISE elevation, slope (°), THEMIS TIU, CRISM, RAD, UHF LoS
    │   ├── astarSolver.ts             # 8-directional profile-weighted A* solver (LOW_O2_SAFE, MAX_SCIENCE, EMERGENCY_HAB_ABORT)
    │   ├── uhfRaycaster.ts            # Bresenham 3D elevation Line-of-Sight raycasting from Habitat 2.8m comms mast
    │   └── biomechanics.ts            # xEMU suit workload (Watts), metabolic O2 burn, cumulative mSv, & Apollo/Artemis 20% limit
    ├── services/
    │   └── nasaRoverApi.ts            # Curiosity/Perseverance Mastcam API + procedural Canvas Mars horizon & AR target lock
    └── components/
        ├── HabitatViewport3D.tsx      # Three.js WebGL 3D terrain mesh, orbital heatmaps, glowing path, walkback ring, agents
        ├── GlovedTabletView.tsx       # Wrist/chest terminal: Leaflet + JPL Mars Trek WMTS tiles & tactical costmap overlay
        ├── HelmetVisorHUD.tsx         # Peripheral AR visor HUD with 3D first-person camera, compass tape, xEMU gauges, hotkeys
        ├── ElevationProfileChart.tsx  # Real-time Canvas 2D cross-section plotting elevation (cyan) vs. cumulative O2 (orange)
        └── SurfacePovCard.tsx         # Eye-level ground-truth rover POV viewport with interactive geological callouts
```

---

## 3. Mathematical & Geophysical Formulations

### A. 3D Bresenham UHF Line-of-Sight (LoS) Raycasting
The Habitat is equipped with a 2.8-meter UHF communications mast positioned at $(x_h, y_h)$ with absolute height $z_{mast} = z(x_h, y_h) + 2.8\,\text{m}$. An astronaut at target cell $(x_t, y_t)$ carries a helmet transceiver at height $z_{rx} = z(x_t, y_t) + 1.8\,\text{m}$.

The raycaster traces the 2D grid line using Bresenham's line algorithm. At fractional step $t = \frac{i}{N}$:
$$z_{ray}(t) = z_{mast} + t \cdot (z_{rx} - z_{mast})$$

If the intermediate terrain elevation $z(x_i, y_i) > z_{ray}(t) - 0.5\,\text{m}$ (including a 0.5m Fresnel clearance margin), the signal path is obstructed. When obstructed, diffractive signal strength drops exponentially with ridge overhang:
$$\text{Signal Strength} = 0.28 \cdot \exp(-0.35 \cdot \Delta z_{overhang})$$

### B. Martian Suited Biomechanics & Metabolic Workload
In Martian gravity ($g = 3.721\,\text{m/s}^2$, $0.38g$), the combined mass of the astronaut ($80\,\text{kg}$) and the pressurized xEMU suit ($140\,\text{kg}$) is $220\,\text{kg}$, yielding a Martian weight of:
$$W_{mars} = 220\,\text{kg} \times 3.721\,\text{m/s}^2 \approx 818.62\,\text{N}$$

The metabolic power expenditure model adapts Santee et al. and Minetti walking mechanics for pressurized EVA suits:
- **Resting Basal Rate**: $P_{rest} = 190\,\text{W}$ (astronaut basal + suit life support avionics).
- **Level Locomotion Work**: $P_{level} = (W_{mars} \cdot v \cdot 0.24) \times 1.28 \approx 250\,\text{W}$ at standard traverse velocity $v = 0.8\,\text{m/s}$.
- **Slope Incline Penalty ($\theta > 0$)**:
  $$P_{incline} = W_{mars} \cdot v \cdot \left(\sin\theta + 1.8 \sin^2\theta\right)$$
- **Slope Decline Braking ($\theta < 0$)**: Downhill walking decreases metabolic burn down to $\theta \approx -10^\circ$, after which knee joint stabilization resistance elevates power.
- **Surface Drag Factor**: Low thermal inertia dust ($TIU < 220\,\text{J m}^{-2}\text{K}^{-1}\text{s}^{-1/2}$) incurs up to a **+35%** mechanical drag penalty.

### C. Metabolic Oxygen Consumption
Human respiratory oxidation yields approximately $20,900\,\text{Joules}$ per Liter of $O_2$ consumed ($4.8\,\text{kcal/L}$):
$$\dot{V}_{O2}\,(\text{L/min}) = \frac{P\,(\text{Watts}) \times 60}{20,900}$$
At nominal $350\,\text{W}$ traverse workload, oxygen burn is $\approx 1.00\,\text{L/min}$.

### D. Apollo / Artemis 20% Non-Negotiable Walkback Limit
- Standard primary $O_2$ suit tank: $1,200\,\text{L}$ (8-hour rating).
- Emergency Reserve Floor: $20\% \times 1,200\,\text{L} = 240\,\text{L}$.
- Usable mission budget: $960\,\text{L}$.
- At all times, the system computes the dynamic **Walkback Limit Radius** $R_{walkback}$: the maximum safe radial distance from Habitat where an emergency sprint return at $1.2\,\text{m/s}$ ($420\,\text{W}$) can be completed before touching the 240 L reserve floor. This boundary is rendered as a glowing dashed circle in both 3D and 2D maps.

---

## 4. NASA Data Sources & Acknowledgments

| Dataset / Instrument | Source Agency / Mission | Application in THADAM |
| :--- | :--- | :--- |
| **HiRISE (High Resolution Imaging Science Experiment)** | NASA / JPL / University of Arizona (MRO) | Digital Elevation Models (DEM) and geomorphology modeling (boxwork ridge lattices, delta scarps, volcanic pits). |
| **CRISM (Compact Reconnaissance Imaging Spectrometer)** | NASA / JPL / JHUAPL (MRO) | Surface hydration spectral indices, detecting clay smectites and hydrated sulfates. |
| **THEMIS (Thermal Emission Imaging System)** | NASA / JPL / Arizona State University (2001 Mars Odyssey) | Thermal inertia values (150–600 TIU) distinguishing fine eolian dust traps from dense bedrock. |
| **MSL RAD (Radiation Assessment Detector)** | NASA / SwRI (Curiosity Rover) | Surface cosmic ray and solar energetic particle dosimetry ($18–45\,\mu\text{Sv/h}$). |
| **Mars Trek Global Tile Service** | NASA / JPL Solar System Treks | Live Viking MDIM21 232m/pixel global color mosaic WMTS tile streaming. |
| **Curiosity & Perseverance Mastcam APIs** | NASA / JPL-Caltech / Nebulum API | Eye-level ground-truth surface imagery and geological targets. |

---

## 5. SI Units Disclosure

In strict adherence to international aerospace engineering and NASA mission standards:
- **Distance / Elevation**: Meters ($\text{m}$)
- **Mass**: Kilograms ($\text{kg}$)
- **Velocity**: Meters per second ($\text{m/s}$)
- **Atmospheric Pressure**: Pascals ($\text{Pa}$)
- **Mechanical & Metabolic Power**: Watts ($\text{W}$)
- **Energy**: Joules ($\text{J}$)
- **Oxygen Volume**: Liters ($\text{L}$) at Standard Temperature and Pressure
- **Radiation Dose**: MicroSieverts ($\mu\text{Sv}$) and milliSieverts ($\text{mSv}$)
- **Thermal Inertia**: $\text{J}\cdot\text{m}^{-2}\cdot\text{K}^{-1}\cdot\text{s}^{-1/2}$ (TIU)

---

## 6. Operational Form Factors & Controls

### Form Factors
1. **3D Habitat Flight Director Viewport (`HabitatViewport3D`)**:
   - Three.js WebGL canvas with dynamic height displacement from 48x48 DEM grid.
   - Dynamic vertex-colored orbital heatmaps: Topographic elevation, THEMIS thermal inertia, CRISM hydration, UHF line-of-sight, and Tactical costmap.
   - Glowing 3D path ribbon and Apollo/Artemis Walkback Limit ring.
   - Real-time animated agents: EV-1 (gold), EV-2 (cyan), ROVER-01 (emerald).
   - Raycasting cursor terrain inspector.
2. **Gloved Wrist/Chest Tablet View (`GlovedTabletView`)**:
   - Secondary astronaut terminal optimized for bulky EVA gloves.
   - 56px–64px oversized tactile touch targets.
   - Leaflet 2D mapping with live JPL Mars Trek WMTS tiles and high-contrast tactical costmap overlay.
   - Two-step safety interlock on Emergency Hab Abort.
3. **Helmet AR Visor HUD (`HelmetVisorHUD`)**:
   - First-person 3D terrain perspective with peripheral AR visor instrumentation.
   - 360° dynamic compass heading tape with target azimuth chevrons.
   - xEMU life support gauges (primary O2, suit pressure, heart rate, core temperature).
   - RAD dosimeter bar with color-coded safety tiers.
   - Picture-in-Picture (PiP) rover forward-view camera.
4. **Real-Time Cross-Section Chart (`ElevationProfileChart`)**:
   - Real-time Canvas 2D plot comparing terrain elevation profile (cyan) against cumulative O2 consumption (orange) and 20% reserve floor (red).
5. **Ground-Truth Rover POV (`SurfacePovCard`)**:
   - Eye-level Curiosity/Perseverance imagery with interactive AR diamond reticle target locks and mineralogy inspector.

### Keyboard Hotkeys
- **`[1]`**: Drop Core Pin (places sample marker at current astronaut position)
- **`[2]`**: Cycle Next Waypoint POV (switches target acquisition)
- **`[3]`**: Emergency Abort to Hab (initiates rapid direct reverse traverse)
- **`[SPACE]`**: Play / Pause Traverse Simulation

---

## 7. Quickstart & Installation

```bash
# Clone the repository
git clone https://github.com/kaushick-n/THADAM-Martian-Surface-EVA-Flight-Visor-Operating-System.git
cd THADAM-Martian-Surface-EVA-Flight-Visor-Operating-System

# Install dependencies
npm install

# Launch development server
npm run dev

# Build production bundle
npm run build
```

---

**Developed with pride by Team KALAM for the NASA Space Apps Challenge 2026.**
