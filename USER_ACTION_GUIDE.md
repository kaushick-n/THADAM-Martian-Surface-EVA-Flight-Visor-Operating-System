# User Action Guide: Plain & Simple Steps for Project THADAM
**Team KALAM** | Document for the User (Simple & Easy to Read)

---

## Welcome! Here Is Everything in Simple Terms

This guide answers your questions directly without technical jargon:
1. **"What should I do step-by-step to get the accurate map and data from NASA without wasting tokens?"**
2. **"How does the AR/VR part work since NASA doesn't give us a ready-made AR interface?"**
3. **"How does our multi-commit workflow work on GitHub?"**

---

## 1. What YOU Need to Do (Step-by-Step)

### Right Now:
- **Action**: You do **not** need to copy, paste, or download any large files into the chat!
- **Why**: We connected directly to NASA's public web links so the data streams straight into your browser when the app is running.
- **Token Cost**: **0 tokens wasted**.

---

### When Using the App in Your Browser (`http://localhost:3000/` or `http://localhost:3001/`):
Here is how you use each feature with a single click:

| What You Want to Do | How You Do It in THADAM | What Happens Behind the Scenes |
| :--- | :--- | :--- |
| **See Curiosity's 10-Stage Path up Mount Sharp** | Click **"Mount Sharp"** at the top bar. | The app loads the authentic NASA Science route from Bradbury Landing all the way to the Boxwork fracture ridges. |
| **See Perseverance's River Delta Path** | Click **"Jezero Delta"** at the top bar. | The app loads Perseverance's real landing site and delta scarp waypoints. |
| **Inspect USGS Geology Rocks** | On the Gloved Tablet or 3D view, click **"USGS Geology"**. | Live colored geological map units from USGS appear, showing rock hardness, age, and slip risk. |
| **See Live Rover Photos with AR Target Locks** | Look at the bottom right **"Ground Truth POV"** card. | The app calls NASA's live camera feed. Diamond target locks appear over rocks, showing distance and mineral composition. |
| **Switch Cameras** | Click buttons: **MASTCAM**, **NAVCAM**, or **HAZCAM**. | The app instantly queries that specific camera from NASA. |

---

### (Optional) If You Ever Download a Custom 3D Map from NASA Mars Trek:
You don't need this right now, but if you ever want a custom terrain slice:
1. Go to [https://trek.nasa.gov/mars/](https://trek.nasa.gov/mars/).
2. Type **"Gale Crater"** in the search bar.
3. Click the **Tools** icon on the right $\rightarrow$ click **Export**.
4. Draw a box over any area $\rightarrow$ download the **GeoTIFF** file.
5. In your computer's terminal, run:
   ```powershell
   python scripts/pds_dem_extractor.py your_downloaded_file.tif
   ```
   *This automatically turns the giant file into a tiny 15 KB file for your project with ZERO tokens spent!*

---

## 2. How the AR / VR Part Works (Explained Simply)

### Why doesn't NASA have an AR interface?
NASA rovers are robotic explorers on Mars. They take normal 2D digital photographs and send them back to Earth. NASA doesn't provide an "AR headset app".

### How does THADAM create the AR/VR experience?
We do exactly what NASA's Jet Propulsion Laboratory (JPL) does for their own scientists:
1. **The AR Visor (Augmented Reality)**:
   - We take the 2D photo sent by the rover.
   - We paint a futuristic heads-up display (HUD) directly on top of the photo:
     - A digital compass tape along the top that rotates with the rover's camera.
     - Glowing diamond reticles that lock onto rocks in the photo, showing their name, distance (e.g. `[18m]`), and mineral type (e.g. `Gypsum Sulfate Vein`).
     - Astronaut oxygen levels, suit pressure, and slope danger alarms.
2. **The 3D VR Mode (Virtual Reality)**:
   - In the 3D Habitat view, we map the terrain into a 3D surface using elevation data.
   - You can rotate and zoom around in 3D as if you are flying over the rover or standing on Mars.

---

## 3. Our Multi-Commit Roadmap for GitHub

Every time we push code, we will make a clean, separate git commit so you can backtrack at any time:

- **Commit 1**: Add USGS Geological Units and the 10-stage NASA Science Mount Sharp route.
- **Commit 2**: Add live dual-rover camera streaming (Curiosity + Perseverance).
- **Commit 3**: Add USGS geological map layers to the 2D tablet and AR reticles to the rover camera.
- **Commit 4**: Add 3D USGS Stratigraphy heatmap to the 3D terrain viewer.
- **Commit 5**: Add the Python GeoTIFF extractor script and update the manual.

---

## What to Do Next
Whenever you want to start the multi-commit implementation, simply say **"Implement Commit 1"** or **"Start implementation"**!
