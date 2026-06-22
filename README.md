# 🌌 MokkaPix Vault

**MokkaPix Vault** is a premium, secure, production-ready full-stack AI Image Prompt Gallery and Marketplace-style platform. It allows users to browse exquisite, high-fidelity AI-generated artworks, inspect exact prompting parameters, toggle favorite presets with local persistence, dynamically apply visual watermark protections, and share links featuring optimized meta-tag previews on WhatsApp and Instagram. It also includes an authenticated dashboard enabling watermarking control overlays and full CRUD catalog management.

---

## 🎨 Professional Key Features

### 1. Curated AI Prompt Gallery
- **Modern Dark UI**: Features glassmorphism panels, responsive hover-active cards, custom-tailored Outfits type styles, and glowing visual accenting.
- **Deep Search & Filters**: Search fields match terms across prompt codes, categories, tags, and titles in real-time. Dropdowns filter by categories (Fantasy, Product, Sci-Fi) and models (Flux Pro, Midjourney, DALL-E) with sorting options (Newest vs Trending).
- **Favorites Lockers**: Enables users to save liked prompts with immediate local client synchronization, persisting choices across restarts using `localStorage`.

### 2. Virally Optimized Sharing Engine
- **Open Graph Meta Injection**: Dynamic backend parsers identify incoming browser scrapers (such as WhatsApp, Instagram, and Twitter crawlers) on `/prompt/:slug` requests, reading physical index templates and auto-injecting accurate contextual tags `<meta property="og:title" ...>` so previews look gorgeous on mobile networks.
- **Instagram Share Companion**: A guide assisting creators with sharing pipelines by downloading watermark-protected JPG illustrations automatically while copying exact rendering prompts to clipboards for effortless description pasting on Instagram.
- **Platform Syndication**: Interactive floating buttons for WhatsApp, X, Facebook, Telegram, Email, and dynamic system share sheets.

### 3. Automated Image Protection & Canvas Watermarking
- **Anti-Theft Overlay Barrier**: Disables conventional right-click saves, highlighting, and mobile focus rings.
- **Dynamic HTML5 Canvas Ribbon**: Rather than loading memory-intensive backend processors, downloading triggers a custom canvas thread, applying opacity borders, text-shadow overlays, and copyright captions directly into pixel buffers client-side-safely.
- **Watermark Settings Dashboard**: Direct toggles inside administrative dashboards to enable or disable watermarks dynamically.

### 4. Authenticated Admin CRUD Console
- **Session Security**: Locks operations behind secure `HttpOnly`, `SameSite=Strict` cookies. Authentication tokens are cryptographically signed with HMAC-SHA256 signatures, preventing session hijacking.
- **Brute-Force Rate Limiting**: Simple, persistent trackers lock out administrative IP addresses for 15 minutes after 5 consecutive failed authorization requests.
- **Secure File upload Base64 Validator**: Admin-panel uploads convert art files to Base64 buffers. This validates file integrity, limits sizing bounds strictly up to 5MB, and verifies headers ensuring only valid JPG, PNG, and WEBP formats are served.
- **Sanitized Parameters**: Cleans inputs against timing attacks, XSS injections, and tags injection through escaping utilities.

---

## 📂 Project Architecture

```typescript
├── /db_data/              # Local persistent Database directory
│   └── db.json            # Dynamic JSON Schema database (Seeded on init)
├── /public/               # Static Web Assets
│   ├── /images/           # Sample mock images
│   └── /uploads/          # Admin-uploaded custom assets
├── /src/                  # Frontend Directory
│   ├── /components/       # Modular React Components
│   │   ├── AdminPanel.tsx # Admin auth and CRUD dashboard managers
│   │   ├── PromptCard.tsx # Gallery preview cards
│   │   ├── PromptDetail.tsx # Deep inspection pages
│   │   ├── WatermarkedImage.tsx # Image layers for protection
│   │   └── SocialShare.tsx # Syndication links and canvas renderer
│   ├── types.ts           # Unified TypeScript definitions
│   ├── index.css          # Core CSS, custom fonts and transitions
│   └── App.tsx            # Main layout controller and URL router
├── server.ts              # Full-stack Node Express Server & SEO compiler
├── package.json           # Dependencies and compilation definitions
└── .env.example           # Secure blueprint for configuration setups
```

---

## 🛠️ Installation & Setup (Local execution)

Ensure you have [Node.js](https://nodejs.org/) (v18+) and npm installed on your terminal.

### Step 1: Clone the Repository
```bash
git clone https://github.com/mohamed-riham/mokkapix-vault.git
cd promptvault
```

### Step 2: Install dependencies
```bash
npm install
```

### Step 3: Establish environment variables
Duplicate the example file to make your real `.env` configuration file:
```bash
cp .env.example .env
```
Fill in your administrative keys securely inside `.env` so they are never exposed in standard code commits:
```env
# Credentials for Vault Master Login
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="vault_admin_secure_password_2026"

# Session cryptographic signature secrets
SESSION_SECRET="your_custom_long_hex_signature_key_here"

# Domain URL of your deployment (used for Open Graph shares)
APP_URL="http://localhost:3000"
```

### Step 4: Run the Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:3000` to interact with MokkaPix Vault in live-reload mode.

---

## 🚀 Deployment Guide

### Preparing the Production Build
Generate a bundled, compiled production distribution by running:
```bash
npm run build
```
This performs a two-step task:
1. Vite compiles client files into a static `/dist` directory.
2. `esbuild` compiles development `/server.ts` into a unified production CJS server `/dist/server.cjs`, bundling models and fully resolving TypeScript absolute namespaces safely.

To run the production deployment, execute:
```bash
npm run start
```

### Deploying to Platforms (Vercel, Render, Heroku)

#### Render / Fly.io / Custom Node Hosts:
- **Build Command**: `npm run build`
- **Start Command**: `npm run start`
- **Environment Variables**: Define `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`, and `APP_URL` inside your platform's Environment Settings dashboard.

#### Vercel & Serverless Architectures:
Because serverless filesystems are ephemeral (read-only restarts), configure MokkaPix Vault's database schema inside standard external adapters if persistent long-term uploads are required. Our modular database class inside `/src/server/db.ts` integrates with any persistence layer.
