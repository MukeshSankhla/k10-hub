# K10 Hub

A professional learning and project platform for the [UNIHIKER K10](https://www.dfrobot.com/product-2671.html) — an ESP32-S3 based hardware board with display, camera, microphone, speaker and onboard AI.

**K10 Hub helps you go from LED Blink to face detection and AI vision, with projects, tutorials, and browser-based firmware flashing.**

---

## Project Structure

```
k10-hub/
├── backend/                    # Express + TypeScript API server
│   ├── src/
│   │   ├── config/             # Environment and database configuration
│   │   │   ├── env.ts          # Zod-validated environment variables
│   │   │   └── database.ts     # libSQL/Drizzle connection
│   │   ├── db/
│   │   │   ├── schema.ts       # Full Drizzle ORM schema (all tables)
│   │   │   ├── init.ts         # Table creation (CREATE IF NOT EXISTS)
│   │   │   └── seed.ts         # Seed data (categories, tags, projects)
│   │   ├── models/
│   │   │   └── index.ts        # TypeScript interfaces & types
│   │   ├── services/
│   │   │   ├── ProjectService.ts
│   │   │   └── CategoryService.ts
│   │   ├── api/routes/
│   │   │   ├── health.ts       # GET /api/health
│   │   │   ├── projects.ts     # GET /api/projects, /api/projects/:slug
│   │   │   └── categories.ts   # GET /api/categories, /api/categories/:slug
│   │   ├── middleware/
│   │   │   ├── cors.ts
│   │   │   └── errorHandler.ts
│   │   ├── app.ts              # Express app factory
│   │   └── server.ts           # Entry point
│   ├── data/                   # SQLite database (auto-created)
│   ├── .env                    # Environment variables (not committed)
│   ├── .env.example            # Template — copy to .env
│   └── package.json
│
├── frontend/                   # Vite + React + TypeScript
│   ├── public/
│   │   ├── images/             # K10 images (Hero.png, IOs.png, Example.png)
│   │   ├── models/             # GLB 3D model (k10.glb — see 3D Model section)
│   │   └── favicon.svg
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/         # Header, Footer
│   │   │   └── home/           # Hero, K10Model, CapabilityStrip,
│   │   │                       # LearningProgression, FeaturedProjects,
│   │   │                       # FlashTeaser, CommunitySection
│   │   ├── pages/
│   │   │   └── HomePage.tsx
│   │   ├── services/
│   │   │   └── api.ts          # Typed API client
│   │   ├── App.tsx             # Router
│   │   ├── index.css           # Complete design system
│   │   └── main.tsx
│   ├── vite.config.ts          # Vite config (proxy → backend)
│   └── package.json
│
├── scripts/
│   └── convert-step.mjs        # STEP → GLB conversion script
│
├── K10.step                    # Original CAD file (never modified)
├── images/                     # Source images
├── package.json                # Root workspace
└── README.md
```

---

## Hardware Specifications (UNIHIKER K10)

For the exhaustive engineering reference, register maps, and peripheral bus routing, refer to [HARDWARE_SPECS.md](HARDWARE_SPECS.md).

### 20-Module Architectural Summary

| # | Subsystem | Module / IC | Specifications & Signal Routing |
|---|---|---|---|
| 1 | **Main Processing MCU** | **ESP32-S3-WROOM-1 N16R8** | Xtensa LX7 Dual-Core 32-bit @ 240 MHz, 512KB SRAM, 16MB Flash, 8MB PSRAM, 3.3V |
| 2 | **Wireless Module** | Integrated Wi-Fi / BLE | 2.4 GHz 802.11 b/g/n (Station + SoftAP), Bluetooth 5 / Mesh (2 Mbps PHY) |
| 3 | **2.8" LCD Display** | **ILI9341** TFT LCD | 240 × 320 Color LCD, high-speed SPI, MMBT3904T backlight control via I/O expander |
| 4 | **Camera Module** | **GC2145** 2MP Sensor | 2 Megapixels, ~80° FOV, 8-bit DVP parallel camera interface directly to ESP32-S3 |
| 5 | **Temp & Humidity Sensor** | **AHT20** | I²C address `0x38`, P19/SCL, P20/SDA, -40 to +85°C (±0.3°C), 0–100% RH (±2% RH) |
| 6 | **Ambient Light Sensor** | **LTR-303ALS** | I²C address `0x29`, 0–64,000 Lux wide dynamic range |
| 7 | **3-Axis Accelerometer** | **SC7A20H** | I²C address `0x19`, ±2g / ±4g / ±8g / ±16g motion, orientation & tap sensing |
| 8 | **I/O Expander** | **XL9535QF24** 16-bit | I²C address `0x20`, controls backlight, camera RST, Button A/B, user LEDs |
| 9 | **Microphone Module** | **2 × MEMS Microphones** | **ES7243E** 24-bit audio ADC, digital I²S audio input to ESP32-S3 |
| 10 | **Audio Amplifier & Speaker** | **NS4168** + 2W Speaker | Class-D audio amplifier driving 2W speaker via digital I²S |
| 11 | **RGB LED Module** | **3 × WS2812** Smart RGB | Daisy-chained single-wire addressable RGB LEDs (24-bit true color) |
| 12 | **User Buttons** | Button A, B, Reset, Boot | Button A (P5/KeyA), Button B (P11/KeyB), Reset (CHIP_PU), Boot (GPIO0) |
| 13 | **TF / MicroSD Card** | Push-Push MicroSD Slot | High-speed SPI interface (up to 32GB FAT32) |
| 14 | **Font Chip** | **GT30L24A3W** | Serial font ROM for Chinese, ASCII, and multilingual UI typography |
| 15 | **USB Interface** | Reversible USB-C | 5V DC power, native ESP32-S3 USB data (USB_P/USB_N) with TVS ESD clamp |
| 16 | **Battery Power** | 2-pin PH2.0 Socket | 3.0–6.5V input range, 3.7V LiPo or 3× AA/AAA battery pack |
| 17 | **Power Regulation** | BL8555 & AP7343Q | Dedicated 2.8V and 1.8V rails for camera analog and sensor digital domains |
| 18 | **GPIO Expansion** | IO1 (P0), IO2 (P1), I²C | 3-pin and 4-pin Gravity connectors for plug-and-play sensors and actuators |
| 19 | **Edge Connector** | Micro:bit-Compatible | P0–P16, P19 (SCL), P20 (SDA), 3V3, GND (15 digital I/O lines) |
| 20 | **Communication Buses** | I²C, SPI, I²S, DVP, USB | High-speed multi-bus architecture |

---

## Installation & Quick Start

### Prerequisites
- Node.js v18+
- npm v9+

### 1. Install All Dependencies (Single Command)

From the project root folder:
```bash
npm run install:all
```
*(Or `npm install`)*

### 2. Configure Environment

```bash
# Backend environment configuration
cp backend/.env.example backend/.env

# Frontend environment configuration
cp frontend/.env.example frontend/.env
```

### 3. Seed the Database

```bash
npm run db:seed
```

The database file (`backend/data/k10hub.db`) is created automatically on first run.

### 4. Run Both Backend & Frontend (Single Terminal!)

From the main root directory, run a single command:

```bash
npm run dev
```

This concurrently boots:
- **Backend API**: `http://localhost:3001` (Health: `http://localhost:3001/api/health`)
- **Frontend App**: `http://localhost:5173` (with Vite HMR and `/api` proxy)

#### Available Root Commands:
- `npm run dev` — Start both Backend and Frontend concurrently in one terminal
- `npm run build` — Compile and bundle both Backend and Frontend for production
- `npm run start` — Run production server (serves API and built frontend)
- `npm run dev:backend` — Run only the backend API server
- `npm run dev:frontend` — Run only the frontend Vite development server
- `npm run db:seed` — Populate the SQLite database with initial hardware projects and categories

---

## Backend Architecture

### Technology Stack
| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express 4 |
| Database | SQLite via libSQL (Drizzle ORM) |
| Validation | Zod |
| Security | Helmet, CORS |
| Logging | Morgan |

### Design Principles
- **Factory pattern** — `createApp()` separates Express configuration from server startup (testable)
- **Service layer** — Business logic is isolated in `ProjectService` and `CategoryService`
- **Environment-driven** — All config values come from environment variables, validated at startup
- **Future-ready auth** — Middleware slots for JWT authentication are already present but inactive

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Server health and version |
| `GET` | `/api/projects` | Paginated project list (filterable) |
| `GET` | `/api/projects/featured` | Featured projects for homepage |
| `GET` | `/api/projects/:slug` | Single project with full relations |
| `GET` | `/api/categories` | All categories |
| `GET` | `/api/categories/:slug` | Single category |

#### Query Parameters (GET /api/projects)
- `page` — Page number (default: 1)
- `pageSize` — Items per page (default: 12, max: 50)
- `category` — Filter by category slug
- `difficulty` — `beginner` | `intermediate` | `advanced`
- `featured` — `true` | `false`
- `community` — `true` | `false`
- `search` — Text search in title and description

### Database Schema

The database is designed to support the full K10 Hub vision without requiring a major rewrite:

| Table | Purpose |
|---|---|
| `authors` | Project creators — future user accounts |
| `categories` | Project categories (fundamentals, sensors, ai, community) |
| `tags` | Tag taxonomy |
| `projects` | Core project entity (full schema with firmware, code, stats) |
| `project_hardware` | Hardware requirements per project |
| `libraries` | Library/dependency registry |
| `project_libraries` | Project ↔ Library join |
| `project_tags` | Project ↔ Tag join |
| `tutorials` | Step-by-step tutorial steps |
| `firmware_versions` | Firmware releases for browser flashing |

---

## Frontend Architecture

### Technology Stack
| Layer | Technology |
|---|---|
| Build | Vite 5 |
| Framework | React 18 + TypeScript |
| Routing | React Router v6 |
| 3D | Three.js + @react-three/fiber + @react-three/drei |
| Icons | Lucide React |
| Styling | Vanilla CSS (custom properties design system) |

### Design System
The design system lives entirely in `src/index.css` using CSS custom properties:
- **Background**: `#F8F6F1` (warm paper-like off-white with CSS noise texture)
- **Typography**: IBM Plex Sans + IBM Plex Mono
- **Accent**: `#1D4ED8` (technical blue — used sparingly)
- **Borders**: Sharp (`4px` max radius) — not rounded
- **Spacing**: 8px grid system

### API Proxy
The Vite dev server proxies `/api/*` requests to the backend (`http://localhost:3001`), so the frontend uses relative `/api` paths.

---

## 3D Model (K10.step → k10.glb)

The `K10.step` file (52MB) is the official B-Rep CAD model of the UNIHIKER K10.

It has been converted into an optimized, high-fidelity binary GLTF (`frontend/public/models/k10.glb`, 6.32MB) preserving all 66 CAD components (screen, ESP32-S3 module, buttons, shells, edge connectors) with original PBR materials.

### Conversion

To regenerate the GLB model at any time:

```bash
# Uses native OpenCASCADE multi-threaded meshing (takes ~15s)
python scripts/convert_step.py
```

The script outputs `frontend/public/models/k10.glb`.

### Resilient Fallback

The frontend `K10Model` component automatically falls back to `Hero.png` if:
- `k10.glb` is not present
- WebGL is not supported by the browser
- Any WebGL/Three.js context error occurs

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3001` | API server port |
| `HOST` | `localhost` | API server host |
| `DATABASE_URL` | `./data/k10hub.db` | SQLite database path |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Allowed frontend origins |

---

## Future Phases

The following features are **not** built yet but the architecture supports them:

- **User authentication** — JWT slots are in the middleware, `AuthUser` types in models
- **Admin dashboard** — CRUD routes can be added to existing service layer
- **Browser flashing** — Web Serial API integration (firmware_versions table is ready)
- **Community projects** — `is_community` field on projects, authors table ready
- **Firmware management** — `firmware_versions` table with SHA256, target chip, offset
- **Full tutorial system** — `tutorials` table linked to projects
- **Search** — search param is wired through project service
- **Tags and filtering** — tag schema fully implemented

---

## Images Used

| File | Usage |
|---|---|
| `Hero.png` | Hero section 3D model fallback (official product render — front + back) |
| `IOs.png` | Community section hardware reference diagram (labeled components) |
| `Example.png` | Face Detection project card cover image |

---

Built by [Mukesh Sankhla](https://github.com/mukeshsankhla)
