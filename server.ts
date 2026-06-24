import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { db } from './src/server/db';
import { Prompt, WatermarkSettings } from './src/types';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// High-capacity JSON parsing for supporting robust Base64 image uploads (up to 10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Store directories
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// In-Memory Brute Force login tracker
interface LoginAttempt {
  attempts: number;
  lockoutUntil: number;
}
const loginIpTracker = new Map<string, LoginAttempt>();

// In-memory Session Secret - rotates if not defined in .env to prevent session hijacking
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'vault_admin_secure_password_2026';

// Helper: Securely sign session cookie
function signToken(username: string): string {
  const payload = JSON.stringify({ username, exp: Date.now() + 24 * 60 * 60 * 1000 }); // 24 hours
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64')}.${signature}`;
}

// Helper: Verify session cookie
function verifyToken(token: string): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  
  const [b64Payload, signature] = parts;
  const computedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(Buffer.from(b64Payload, 'base64').toString('utf-8')).digest('hex');
  
  // Timing attack resistant safe comparison
  if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(computedSignature, 'hex'))) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(b64Payload, 'base64').toString('utf-8'));
    if (payload.username === ADMIN_USER && payload.exp > Date.now()) {
      return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

// Cookie parser utility (zero NPM dependency, immune to library-level exploits)
function parseCookies(req: express.Request): Record<string, string> {
  const list: Record<string, string> = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      list[parts.shift()!.trim()] = decodeURI(parts.join('='));
    });
  }
  return list;
}

// Middleware: Admin Protection
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const cookies = parseCookies(req);
  const token = cookies.admin_session;
  if (!verifyToken(token)) {
    res.status(401).json({ success: false, error: "Unauthorized access: admin credentials required." });
    return;
  }
  next();
};

// Helper: XSS Cleanse / HTML Escaping Utility
function sanitizeString(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Helper: Cleanse array of strings
function sanitizeTags(tags: string[]): string[] {
  if (!tags || !Array.isArray(tags)) return [];
  return tags
    .map(tag => tag.trim().toLowerCase().replace(/[^a-zA-Z0-9-]/g, ''))
    .filter(tag => tag.length > 0);
}

// --- API ROUTES ---

// 1. Get List of Prompts with strong querying and filters (SQL parameter exposure injection prevention)
app.get('/api/prompts', (req, res) => {
  const { search, category, model, sort } = req.query;
  
  let prompts = [...db.getPrompts()];

  // Filter: Search
  if (search) {
    const term = String(search).toLowerCase().trim();
    prompts = prompts.filter(p => 
      p.title.toLowerCase().includes(term) || 
      p.prompt_text.toLowerCase().includes(term) ||
      p.tags.some(t => t.toLowerCase().includes(term))
    );
  }

  // Filter: Category
  if (category) {
    const cat = String(category).toLowerCase().trim();
    prompts = prompts.filter(p => p.category.toLowerCase() === cat);
  }

  // Filter: Model
  if (model) {
    const mdl = String(model).toLowerCase().trim();
    prompts = prompts.filter(p => p.ai_model.toLowerCase() === mdl);
  }

  // Sort
  if (sort === 'popular') {
    prompts.sort((a, b) => b.views - a.views);
  } else {
    // Default to 'newest'
    prompts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  res.json({ success: true, data: prompts });
});

// 2. Clear categories & models for dropdown lists
app.get('/api/filters', (req, res) => {
  const prompts = db.getPrompts();
  const categories = Array.from(new Set(prompts.map(p => p.category))).filter(Boolean);
  const models = Array.from(new Set(prompts.map(p => p.ai_model))).filter(Boolean);
  res.json({ success: true, data: { categories, models } });
});

// 3. Get Single Prompt & record view count
app.get('/api/prompts/:slugOrId', (req, res) => {
  const identifier = req.params.slugOrId;
  let prompt = db.findPromptBySlug(identifier);
  if (!prompt) {
    prompt = db.findPromptById(identifier);
  }

  if (!prompt) {
    res.status(404).json({ success: false, error: 'Prompt creation not found.' });
    return;
  }

  // Increment view counter dynamically without blocking response
  db.incrementView(prompt.id);
  
  // Return updated object with incremental view (avoid stale render feedback)
  const updatedPrompt = { ...prompt, views: prompt.views + 1 };
  res.json({ success: true, data: updatedPrompt });
});

// 4. Increment Copy Count
app.post('/api/prompts/:id/copy', (req, res) => {
  const { id } = req.params;
  const prompt = db.findPromptById(id);
  if (!prompt) {
    res.status(404).json({ success: false, error: 'Prompt not found.' });
    return;
  }
  db.incrementCopy(id);
  res.json({ success: true });
});

// 5. Admin Authentication (Brute Force Resistant, timing-safe validation)
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || 'unknown';

  // Brute force checks
  const attemptState = loginIpTracker.get(ip);
  if (attemptState && attemptState.lockoutUntil > Date.now()) {
    const secondsLeft = Math.ceil((attemptState.lockoutUntil - Date.now()) / 1000);
    res.status(429).json({ success: false, error: `Too many login failures. Brute-force block active. Retry in ${secondsLeft} seconds.` });
    return;
  }

  // Input sanitizer
  const cleanUser = String(username || '');
  const cleanPass = String(password || '');

  // Safe checks against timing attacks
  const userValid = crypto.timingSafeEqual(
    Buffer.alloc(32, cleanUser), 
    Buffer.alloc(32, ADMIN_USER)
  );
  const passValid = crypto.timingSafeEqual(
    Buffer.alloc(32, cleanPass), 
    Buffer.alloc(32, ADMIN_PASS)
  );

  if (userValid && passValid) {
    // Reset tracker on successful auth
    loginIpTracker.delete(ip);

    const token = signToken(ADMIN_USER);
    
    // Set HTTP-only, SameSite strict session identifier
    const isProd = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', `admin_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${24 * 60 * 60}; ${isProd ? "Secure;" : ""}`);
    
    res.json({ success: true, user: "admin" });
  } else {
    // Audit failed attempt
    const state = attemptState || { attempts: 0, lockoutUntil: 0 };
    state.attempts++;
    if (state.attempts >= 5) {
      state.lockoutUntil = Date.now() + 15 * 60 * 1000; // 15 Minute lockout block
      console.warn(`[BruteForce Blocked] IP ${ip} exceeded maximum incorrect attempts.`);
    }
    loginIpTracker.set(ip, state);

    res.status(401).json({ success: false, error: "Invalid admin username or secret password." });
  }
});

// 6. Admin Authentication Check
app.get('/api/admin/me', (req, res) => {
  const cookies = parseCookies(req);
  const token = cookies.admin_session;
  if (verifyToken(token)) {
    res.json({ success: true, user: "admin" });
  } else {
    res.json({ success: false });
  }
});

// 7. Admin Logout
app.post('/api/admin/logout', (req, res) => {
  // Clear administrative cookie instantly
  res.setHeader('Set-Cookie', 'admin_session=; Path=/; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  res.json({ success: true });
});

// 8. Admin Dashboard Stats
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const prompts = db.getPrompts();
  
  const totalPrompts = prompts.length;
  // Unique images
  const uniqueUrls = new Set(prompts.map(p => p.image_url));
  const totalImages = uniqueUrls.size;

  const totalViews = prompts.reduce((sum, p) => sum + p.views, 0);
  const totalCopyCount = prompts.reduce((sum, p) => sum + p.copy_count, 0);

  res.json({
    success: true,
    data: { totalImages, totalPrompts, totalViews, totalCopyCount }
  });
});

// Helper: Process and validate raw base64 upload
function handleBase64Image(base64Data: string): string {
  // Regex extracting type and buffer content matches data:image/png;base64,...
  const matches = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-+.]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid image format representation.");
  }

  const mimeType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');

  // Verify file size limits (5MB)
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error("File exceeds 5MB size limit.");
  }

  // Validate JPG PNG WEBP mime types only (Security Requirement)
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimeTypes.includes(mimeType)) {
    throw new Error("Unsupported image format. Allowed: JPG, PNG, WEBP.");
  }

  // Determine file suffix
  let suffix = 'jpg';
  if (mimeType === 'image/png') suffix = 'png';
  else if (mimeType === 'image/webp') suffix = 'webp';

  const fileName = `prompt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${suffix}`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  fs.writeFileSync(filePath, buffer);
  return `/uploads/${fileName}`;
}

// 9. Admin Add Prompt Card (CRUD - ADD)
app.post('/api/admin/prompts', requireAdmin, (req, res) => {
  try {
    const { title, prompt_text, ai_model, category, tags, featured, imageBase64, image_url } = req.body;

    if (!title || !prompt_text || !ai_model || !category) {
      res.status(400).json({ success: false, error: "Please fill in all mandatory fields." });
      return;
    }

    let resolvedImageUrl = image_url || '/images/cyberpunk_warrior.jpg';

    // Base64 Image upload processor
    if (imageBase64) {
      try {
        resolvedImageUrl = handleBase64Image(imageBase64);
      } catch (uploadError: any) {
        res.status(400).json({ success: false, error: uploadError.message });
        return;
      }
    }

    const cleanTags = sanitizeTags(tags);
    const newPrompt = db.createPrompt({
      title: sanitizeString(title),
      prompt_text: sanitizeString(prompt_text),
      ai_model: sanitizeString(ai_model),
      category: sanitizeString(category),
      tags: cleanTags,
      featured: !!featured,
      image_url: resolvedImageUrl
    });

    res.json({ success: true, data: newPrompt });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "An error occurred creating prompt." });
  }
});

// 10. Admin Modify Prompt Card (CRUD - EDIT & Image replacements)
app.put('/api/admin/prompts/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { title, prompt_text, ai_model, category, tags, featured, imageBase64, image_url } = req.body;

    const currentPrompt = db.findPromptById(id);
    if (!currentPrompt) {
      res.status(404).json({ success: false, error: "Prompt index not found." });
      return;
    }

    let resolvedImageUrl = image_url !== undefined ? image_url : currentPrompt.image_url;

    if (imageBase64) {
      try {
        resolvedImageUrl = handleBase64Image(imageBase64);
      } catch (uploadError: any) {
        res.status(400).json({ success: false, error: uploadError.message });
        return;
      }
    }

    const updateFields: any = {};
    if (title !== undefined) updateFields.title = sanitizeString(title);
    if (prompt_text !== undefined) updateFields.prompt_text = sanitizeString(prompt_text);
    if (ai_model !== undefined) updateFields.ai_model = sanitizeString(ai_model);
    if (category !== undefined) updateFields.category = sanitizeString(category);
    if (tags !== undefined) updateFields.tags = sanitizeTags(tags);
    if (featured !== undefined) updateFields.featured = !!featured;
    updateFields.image_url = resolvedImageUrl;

    const updated = db.updatePrompt(id, updateFields);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || "An error occurred updating the record." });
  }
});

// 11. Admin Delete (CRUD - DELETE)
app.delete('/api/admin/prompts/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const deleted = db.deletePrompt(id);
  if (!deleted) {
    res.status(404).json({ success: false, error: "Prompt entry not found." });
    return;
  }
  res.json({ success: true });
});

// 12. Watermark Control
app.get('/api/admin/watermark', (req, res) => {
  res.json({ success: true, data: db.getWatermark() });
});

app.post('/api/admin/watermark', requireAdmin, (req, res) => {
  const { enabled, text } = req.body;
  const updated = db.updateWatermark({
    enabled: !!enabled,
    text: text ? sanitizeString(String(text).substring(0, 30)) : "MokkaPix Vault"
  });
  res.json({ success: true, data: updated });
});


// --- DYNAMIC WATERMARK EXCLUSION ROOT OR RAW SERVING ROOT ---
// To statically serve physical uploads safely
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/images', express.static(path.join(process.cwd(), 'public', 'images')));

// --- SITEMAP PROTOCOL ---
app.get('/sitemap.xml', (req, res) => {
  const host = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const prompts = db.getPrompts();
  const currentDate = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  
  // Home page URL
  xml += `  <url>\n`;
  xml += `    <loc>${host}/</loc>\n`;
  xml += `    <lastmod>${currentDate}</lastmod>\n`;
  xml += `    <changefreq>daily</changefreq>\n`;
  xml += `    <priority>1.0</priority>\n`;
  xml += `  </url>\n`;

  // Admin login page URL
  xml += `  <url>\n`;
  xml += `    <loc>${host}/admin</loc>\n`;
  xml += `    <lastmod>${currentDate}</lastmod>\n`;
  xml += `    <changefreq>monthly</changefreq>\n`;
  xml += `    <priority>0.3</priority>\n`;
  xml += `  </url>\n`;

  // Dynamic Prompt pages URLs
  prompts.forEach((prompt) => {
    xml += `  <url>\n`;
    xml += `    <loc>${host}/prompt/${prompt.slug}</loc>\n`;
    xml += `    <lastmod>${currentDate}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += `  </url>\n`;
  });

  xml += `</urlset>`;

  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

// --- ROBOTS PROTOCOL ---
app.get('/robots.txt', (req, res) => {
  const host = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  let robots = `User-agent: *\n`;
  robots += `Allow: /\n\n`;
  robots += `Sitemap: ${host}/sitemap.xml\n`;
  
  res.header('Content-Type', 'text/plain');
  res.send(robots);
});

// --- SEO CRAWLER DELEGATE AND RICH PREVIEW INJECTION ---
const injectMetaTagsAndServe = (req: express.Request, res: express.Response, isProd: boolean) => {
  const slug = req.params.slug;
  const prompt = db.findPromptBySlug(slug);

  let templatePath = path.join(process.cwd(), isProd ? 'dist/index.html' : 'index.html');
  if (!fs.existsSync(templatePath)) {
    // Fallback if compilation dist is not built yet
    templatePath = path.join(process.cwd(), 'index.html');
  }

  let html = fs.readFileSync(templatePath, 'utf8');

  // Insert general-purpose responsive and metadata headers (viewport already in html)
  if (prompt) {
    const fullPageUrl = `${process.env.APP_URL || `${req.protocol}://${req.get('host')}`}/prompt/${prompt.slug}`;
    const pageTitle = `${prompt.title} - AI Image Prompt on MokkaPix Vault`;
    const pageDesc = `Copy "${prompt.title}" generation settings by Mohamed Riham. Trained on ${prompt.ai_model} for ${prompt.category}. Prompt: ${prompt.prompt_text.substring(0, 110)}...`;
    const imageUrl = prompt.image_url.startsWith('/') 
      ? `${process.env.APP_URL || `${req.protocol}://${req.get('host')}`}${prompt.image_url}` 
      : prompt.image_url;

    const opengraphTags = `
    <!-- MokkaPix Vault Rich Open Graph Metadata -->
    <title>${pageTitle}</title>
    <meta name="description" content="${pageDesc}">
    <meta name="keywords" content="${prompt.title}, ${prompt.category}, ${prompt.tags.join(', ')}, mohamed riham, riham, aimbot, rhm, riham prompts, data science mohamed riham, MokkaPix Vault, prompt engineering">
    <meta name="author" content="Mohamed Riham">
    <meta property="og:title" content="${pageTitle}" />
    <meta property="og:description" content="${pageDesc}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${fullPageUrl}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:site_name" content="MokkaPix Vault" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${pageTitle}" />
    <meta name="twitter:description" content="${pageDesc}" />
    <meta name="twitter:image" content="${imageUrl}" />
    `;

    // Inject before </head>
    html = html.replace('</head>', `${opengraphTags}\n</head>`);
  } else {
    // Standard branding headers
    const pageTitle = "MokkaPix Vault - Premium AI Image Prompt Gallery & Data Science by Mohamed Riham";
    const pageDesc = "Discover, copy, and optimize professional AI image prompts on MokkaPix Vault. High-performance configurations curated by Mohamed Riham (riham / rhm), data science specialist.";
    const genericTags = `
    <title>${pageTitle}</title>
    <meta name="description" content="${pageDesc}">
    <meta name="keywords" content="mohamed riham, riham, aimbot, rhm, riham prompts, data science mohamed riham, MokkaPix Vault, prompt vault, image generation prompts, flux pro prompts, midjourney v6, text to image prompts, ai photography">
    <meta name="author" content="Mohamed Riham">
    <meta property="og:title" content="${pageTitle}" />
    <meta property="og:description" content="${pageDesc}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="MokkaPix Vault" />
    `;
    html = html.replace('</head>', `${genericTags}\n</head>`);
  }

  res.send(html);
};

// Catch-all prompt dynamic handler for scraper crawler injections
app.get('/prompt/:slug', (req, res) => {
  injectMetaTagsAndServe(req, res, process.env.NODE_ENV === 'production');
});


// --- INTEGRATING DEVELOP / PRODUCTION LAYERS ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Vite Dev Server middleware mode (Vite intercepts development scripts dynamically)
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    
    // Mount Vite dev middlewares
    app.use(vite.middlewares);

    // Fallback for SPA routing in development
    app.use('*', (req, res, next) => {
      // Exclude API routes or static files
      if (req.originalUrl.startsWith('/api/') || req.originalUrl.startsWith('/uploads/') || req.originalUrl.startsWith('/images/')) {
        return next();
      }
      injectMetaTagsAndServe(req, res, false);
    });
  } else {
    // Production serving static compiled folder "dist"
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false })); // Exclude handling index.html automatically to inject SEO dynamically for index root too!

    app.all('*', (req, res, next) => {
      if (req.originalUrl.startsWith('/api/') || req.originalUrl.startsWith('/uploads/') || req.originalUrl.startsWith('/images/')) {
        return next();
      }
      // Extract prompt slug if applicable for dynamic SEO mapping
      if (req.originalUrl.startsWith('/prompt/')) {
        const slug = req.originalUrl.split('/prompt/')[1]?.split('?')[0];
        (req.params as any).slug = slug;
        injectMetaTagsAndServe(req, res, true);
      } else {
        // Serve injection for main landing index
        (req.params as any).slug = '';
        injectMetaTagsAndServe(req, res, true);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MokkaPix Vault Server booting up on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Critical server bootstrap error:", err);
});
