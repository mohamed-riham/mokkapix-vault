# 🚀 MokkaPix Vault - Production Deployment Manual

This manual outlines the process to upload, maintain, and publish **MokkaPix Vault** to your private or public GitHub repository, configure automated integration pipelines, and deploy running instances to production hosts.

---

## 📦 Step 1: Initializing your GitHub Repository

To push this codebase from your local terminal to a new GitHub repository, run these initial commands inside the project's root folder:

```bash
# Initialize a local Git repository
git init

# Stage and index all active codebase files
git add .

# Create the initial launch checkpoint
git commit -m "feat: initial release of MokkaPix Vault platform with Cache Storage, SEO, and custom branding"

# Create and switch to the primary main branch
git branch -M main

# Pair with your newly created GitHub repository
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPOSITORY_NAME>.git

# Push the code safely to your secure repository
git push -u origin main
```

---

## 🛠️ Step 2: Automated Integration with GitHub Actions

MokkaPix Vault includes an automated validation system preconfigured inside `.github/workflows/ci-cd.yml`. Whenever you pull, merge, or push changes to the `main` branch, GitHub Actions will automatically:

1. Setup Node.js v20.
2. Build an efficient dependency tree via `npm ci`.
3. Validate typography, TypeScript parameters, and import safety using `npm run lint`.
4. Bundle production codes with standard Vite assets and bundled backend parameters using `npm run build`.

This guarantees your applet is in a perfect compilation state before deployments trigger.

---

## 🌐 Step 3: Deployment Options

Because MokkaPix Vault utilizes a highly efficient Node.js + Express backend to deliver server-side API routes and power dynamic search engines, it must be hosted on a cloud environment that supports container runtime states or Node services (e.g. Google Cloud Run, Render, Fly.io, or AWS ECS).

### Option A: Google Cloud Run (Recommended Container Registry)
Google Cloud Run provides immediate scalability, auto-scaling to zero, and cold start optimizations.

1. Create a service account key inside your **Google Cloud Console** under **IAM & Admin -> Service Accounts**.
2. Save the key JSON contents to your GitHub Repository Secrets as `GCP_SA_KEY`.
3. Add your exact GCP project identifier to your GitHub Secrets as `GCP_PROJECT_ID`.
4. Un-comment the `deploy-cloud-run` section in `.github/workflows/ci-cd.yml` to enable instant automated continuous deployments on every branch push!

### Option B: Node.js App Hosting (e.g., Render, Railway, fly.io)
If you prefer straight Node.js execution without container wrappers:
1. Connect your Github Repository directly under your host's Dashboard panel.
2. Define the target **Build Command**: `npm run build`
3. Define the target **Start Command**: `npm run start`
4. Declare standard environment variables inside the dashboard environment properties list.

---

## 🔑 Step 4: Environment Variables Setup

Ensure you declare these environment configs inside your cloud host's admin console to secure access and maximize SEO performance:

| Parameter Key | Purpose | Suggested Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Running state identification. | `production` |
| `ADMIN_USERNAME` | Administrator credentials login username. | (Choose a secure unique key) |
| `ADMIN_PASSWORD` | Administrator credentials login password. | (Choose a secure unique key) |
| `SESSION_SECRET` | Authentication cookie signing algorithm seed. | (Generate a random sequence) |
| `GEMINI_API_KEY` | Server-side secure token for AI prompt translation/enrichment. | (Your personal Gemini token) |

---

## ⚡ Step 5: SEO and High-Performance Features Verified

When deployed, MokkaPix Vault automatically utilizes modern design configurations that secure top index scores on search metrics:
* **Custom SEO Document Handlers**: Dynamically alters browser tabs and titles when viewers explore custom pages (`/prompt/[slug]`).
* **Micro-Optimized Cache Storage API**: Client-side favorites locker records and API responses are synced and saved locally within the device's Cache Storage sandboxes for instantaneous loading times.
* **Modern Lazy Preloading**: Prompts and high-resolution artworks preload smoothly in low-priority cycles during browsing sessions to ensure smooth transitions.
