# sitedotmoss (`site(.)moss`)
navigation: sitedotmoss.vercel.app

`site(.)moss` is a personal portfolio, dynamic interactive dashboard, and AI experimental laboratory developed by Tinnaphop Sonsang. It brings together AI research projects, interactive web applications, financial modeling tools, and a technical dev journal.

---

## Key Features & Modules

### 1. Interactive Dashboard (`/`)
- Metro Tile / Bento Grid styled landing page.
- Features real-time widgets including a live clock, calendar, featured quotes, fast links, and an About Me modal.

### 2. Next WBC — Avian Cell Detection (`/nextwbc`)
- AI-powered diagnostic tool for Avian White Blood Cell detection.
- Connects to a custom YOLO12 deep learning model deployed on Hugging Face Spaces via real-time Server-Sent Events (SSE) streaming.
- Enhanced with a custom 3D Frutiger Aero physics bubble engine.

### 3. Sonic Atlas — Spotify Audio Analysis (`/spotify-analysis`)
- Music structure and audio feature visualization platform (Madonna Sonic Atlas).
- Computes track similarity matrices using flat `Float32Array` cosine similarity and visualizes data using 3D scatter plots and parametric ellipsoid surfaces powered by Plotly.js.

### 4. Paint App (`/paint`)
- Web-based image editing software featuring a Photoshop-inspired Glassmorphism UI.
- Supports canvas drawing tools, multi-layer management, custom brushes, and geometric shapes.

### 5. Glassmorphism CV / Resume (`/cv`)
- Professional curriculum vitae detailing work history, education, research achievements, and core technical skills.

### 6. FIRE Plan (`/fire-plan`)
- Financial Independence, Retire Early strategy modeler and milestone tracker.

### 7. sitedotmoss Journal (`/blog`)
- Personal blog and tech journal for developer logs, visual feeds, and AI research notes.

---

## Tech Stack

- Framework: Astro 6 (`@astrojs/vercel` static/server hybrid)
- Frontend: TypeScript, Vanilla CSS3 (Design Tokens), React 19, Lucide Icons
- Visualization & Math: Plotly.js (3D Scatter & Mesh Surfaces), HTML5 Canvas Physics Engines, Jacobi Eigendecomposition & Cosine Similarity Matrix
- Machine Learning Integration: Hugging Face Space SSE Streaming API (`badgaitintin/hawkwbc` YOLO12 Model)
- Database & ORM: Drizzle ORM, LibSQL Client
- Testing: Vitest (85+ Automated Unit Tests)

---

## Getting Started

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Run unit tests
npx vitest

# Build for production
npm run build
