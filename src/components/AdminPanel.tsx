import React, { useState, useEffect } from 'react';
import { Prompt, WatermarkSettings, AdminStats } from '../types';

interface AdminPanelProps {
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
  watermark: WatermarkSettings;
  onWatermarkUpdated: () => void;
}

export default function AdminPanel({ onNotify, watermark, onWatermarkUpdated }: AdminPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [lockoutSecs, setLockoutSecs] = useState<number>(0);

  // Dashboard Stats
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Watermark Settings Form
  const [wmEnabled, setWmEnabled] = useState(watermark.enabled);
  const [wmText, setWmText] = useState(watermark.text);
  const [updatingWm, setUpdatingWm] = useState(false);

  // CRUD Forms State
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // New/Edit Prompt Form variables
  const [formTitle, setFormTitle] = useState('');
  const [formPromptText, setFormPromptText] = useState('');
  const [formModel, setFormModel] = useState('Flux Pro');
  const [formCategory, setFormCategory] = useState('Fantasy');
  const [formTags, setFormTags] = useState('');
  const [formFeatured, setFormFeatured] = useState(false);
  
  // Custom Raw Base64 upload holders
  const [uploadedBase64, setUploadedBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [savingPrompt, setSavingPrompt] = useState(false);

  // Check login on load
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const resp = await fetch('/api/admin/me');
      const data = await resp.json();
      if (data.success) {
        setIsAuthenticated(true);
        fetchDashboardData();
      } else {
        setIsAuthenticated(false);
      }
    } catch (e) {
      setIsAuthenticated(false);
    }
  };

  const fetchDashboardData = async () => {
    setLoadingDashboard(true);
    try {
      // Parallelize admin fetches (Header/Dashboard state)
      const [statsResp, promptsResp] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/prompts?sort=newest')
      ]);

      const statsData = await statsResp.json();
      const promptsData = await promptsResp.json();

      if (statsData.success) setStats(statsData.data);
      if (promptsData.success) setPrompts(promptsData.data);
    } catch (err) {
      onNotify('Failed to fetch dashboard data.', 'error');
    } finally {
      setLoadingDashboard(false);
    }
  };

  // Login handler with failed-attempt lockout display
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      onNotify('Username and password are required credentials.', 'error');
      return;
    }

    setLoggingIn(true);
    try {
      const resp = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await resp.json();

      if (resp.status === 429) {
        onNotify(data.error || 'Too many attempts.', 'error');
        setLockoutSecs(60);
        return;
      }

      if (data.success) {
        setIsAuthenticated(true);
        onNotify('Welcome back, Admin. Security session authorized.', 'success');
        fetchDashboardData();
      } else {
        onNotify(data.error || 'Authentication rejected.', 'error');
      }
    } catch (err) {
      onNotify('Server connection refused.', 'error');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      setIsAuthenticated(false);
      onNotify('Session cleared successfully.', 'info');
    } catch (e) {
      setIsAuthenticated(false);
    }
  };

  // Watermark save settings
  const handleSaveWatermark = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingWm(true);
    try {
      const resp = await fetch('/api/admin/watermark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: wmEnabled, text: wmText })
      });
      const data = await resp.json();
      if (data.success) {
        onNotify('Watermark settings synced with database.', 'success');
        onWatermarkUpdated(); // Bubble triggers to index ref
      } else {
        onNotify(data.error || 'Error saving watermark configurations.', 'error');
      }
    } catch (err) {
      onNotify('Server save connection failed.', 'error');
    } finally {
      setUpdatingWm(false);
    }
  };

  // Handle Client-Side File Base64 parsing & safety validations
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Size constraint (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      onNotify('File size exceeded. Maximum allowed upload is 5MB.', 'error');
      e.target.value = ''; // Reset input
      return;
    }

    // 2. MIME type verification
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.type)) {
      onNotify('Unsupported format. Please choose an image in JPG, PNG, or WEBP format.', 'error');
      e.target.value = '';
      return;
    }

    // 3. Read image as Base64 string safely
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadedBase64(reader.result);
        setImagePreview(reader.result);
        onNotify('Secure image upload package successfully initialized.', 'success');
      }
    };
    reader.onerror = () => {
      onNotify('Error compiling image components.', 'error');
    };
    reader.readAsDataURL(file);
  };

  // Add/Edit trigger helper
  const handleOpenCreateForm = () => {
    setEditingPrompt(null);
    setFormTitle('');
    setFormPromptText('');
    setFormModel('Flux Pro');
    setFormCategory('Fantasy');
    setFormTags('');
    setFormFeatured(false);
    setUploadedBase64(null);
    setImagePreview(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setFormTitle(prompt.title);
    setFormPromptText(prompt.prompt_text);
    setFormModel(prompt.ai_model);
    setFormCategory(prompt.category);
    setFormTags(prompt.tags.join(', '));
    setFormFeatured(prompt.featured);
    setUploadedBase64(null);
    setImagePreview(prompt.image_url); // Pre-fill with current database asset URL
    setIsFormOpen(true);
  };

  // CRUD Action: Submit Prompt ADD or EDIT
  const handleSavePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formPromptText.trim() || !formCategory.trim() || !formModel.trim()) {
      onNotify('Please complete all core specifications.', 'error');
      return;
    }

    if (!editingPrompt && !uploadedBase64) {
      onNotify('An upload is required for fresh prompt entries!', 'error');
      return;
    }

    setSavingPrompt(true);
    try {
      const parsedTags = formTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const endpoint = editingPrompt 
        ? `/api/admin/prompts/${editingPrompt.id}` 
        : `/api/admin/prompts`;
      
      const method = editingPrompt ? 'PUT' : 'POST';

      const payload: any = {
        title: formTitle,
        prompt_text: formPromptText,
        category: formCategory,
        ai_model: formModel,
        tags: parsedTags,
        featured: formFeatured,
      };

      if (uploadedBase64) {
        payload.imageBase64 = uploadedBase64;
      } else if (editingPrompt) {
        payload.image_url = editingPrompt.image_url;
      }

      const resp = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await resp.json();
      if (data.success) {
        onNotify(editingPrompt ? 'Prompt parameters adjusted.' : 'Brand new prompt indexed successfully!', 'success');
        setIsFormOpen(false);
        fetchDashboardData();
      } else {
        onNotify(data.error || 'Server rejected instructions.', 'error');
      }
    } catch (err) {
      onNotify('Database submission connection failure.', 'error');
    } finally {
      setSavingPrompt(false);
    }
  };

  // CRUD Action: Submit Prompt DELETE with safety gates
  const handleDeletePrompt = async (id: string, name: string) => {
    const confirmation = window.confirm(`⚠️ WARNING: Are you sure you want to permanently delete "${name}"? This action cannot be undone.`);
    if (!confirmation) return;

    try {
      const resp = await fetch(`/api/admin/prompts/${id}`, { method: 'DELETE' });
      const data = await resp.json();
      if (data.success) {
        onNotify('Image and prompt deleted safely.', 'success');
        fetchDashboardData();
      } else {
        onNotify(data.error || 'Could not complete deletion.', 'error');
      }
    } catch (err) {
      onNotify('Service deletion connection interrupted.', 'error');
    }
  };

  // Countdown lockout helper
  useEffect(() => {
    if (lockoutSecs <= 0) return;
    const timer = setTimeout(() => setLockoutSecs(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [lockoutSecs]);

  // Auth loading barrier template
  if (isAuthenticated === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <svg className="animate-spin h-8 w-8 text-indigo-500 mb-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Verifying Admin Session Lock</span>
      </div>
    );
  }

  // Auth login prompt screen (Pure, highly secure layout)
  if (isAuthenticated === false) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 rounded-3xl glass-panel text-slate-100 animate-fadeIn">
        <div className="flex flex-col items-center gap-3 text-center mb-6">
          <div className="w-12 h-12 bg-indigo-600/15 border border-indigo-500/25 rounded-xl flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-400">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold font-display tracking-tight text-white uppercase">Vault Master login</h2>
          <p className="text-xs text-slate-400 font-mono">Sign in with credentials saved in your secure environment deployment (.env)</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Username</label>
            <input 
              type="text" 
              required
              placeholder="e.g. admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 text-slate-100 text-sm rounded-xl focus:border-indigo-500/80 focus:outline-none transition font-sans"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Secret Password</label>
            <input 
              type="password" 
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 text-slate-100 text-sm rounded-xl focus:border-indigo-500/80 focus:outline-none transition font-sans"
            />
          </div>

          {lockoutSecs > 0 && (
            <div className="text-[11px] font-mono p-2.5 text-center bg-red-950/30 border border-red-500/20 text-red-400 rounded-lg animate-pulse">
              🛡️ Brute-Force lockout: too many failures. Locked for {lockoutSecs}s.
            </div>
          )}

          <button 
            type="submit" 
            disabled={loggingIn || lockoutSecs > 0}
            className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-505 text-white text-sm font-semibold rounded-xl border border-indigo-500-30 transition cursor-pointer shadow-lg hover:scale-101 active:scale-99 disabled:opacity-50"
          >
            {loggingIn ? 'Evaluating Security Keys...' : 'Validate Session Keys'}
          </button>
        </form>
      </div>
    );
  }

  // Admin Dashboard template
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fadeIn">
      {/* Dashboard Toolbar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-bold text-indigo-400 font-mono uppercase tracking-widest">AISTUDIO SECURE DASHBOARD</span>
          <h1 className="text-3xl font-extrabold font-display tracking-tight text-white mt-1">MokkaPix Vault Analytics</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleOpenCreateForm}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-4 py-2 rounded-xl transition shadow shadow-indigo-950/50 flex items-center gap-1.5 cursor-pointer"
          >
            ➕ Index New Prompt
          </button>
          <button 
            onClick={handleLogout}
            className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-medium text-sm px-4 py-2 rounded-xl transition cursor-pointer"
          >
            Secure Sign-Out
          </button>
        </div>
      </div>

      {/* Analytics stats card deck */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="p-5 rounded-3xl glass-card">
            <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">Total Images Saved</span>
            <div className="font-display font-extrabold text-3xl mt-1 text-white">{stats.totalImages}</div>
            <span className="text-[9px] text-indigo-400 font-mono mt-0.5 block">Unique static buffers</span>
          </div>

          <div className="p-5 rounded-3xl glass-card">
            <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">Indexed Prompts</span>
            <div className="font-display font-extrabold text-3xl mt-1 text-white">{stats.totalPrompts}</div>
            <span className="text-[9px] text-indigo-400 font-mono mt-0.5 block">Alphanumeric tags logs</span>
          </div>

          <div className="p-5 rounded-3xl glass-card">
            <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">Aggregate Views</span>
            <div className="font-display font-extrabold text-3xl mt-1 text-white">{stats.totalViews}</div>
            <span className="text-[9px] text-green-400 font-mono mt-0.5 block">Real-time counts logs</span>
          </div>

          <div className="p-5 rounded-3xl glass-card">
            <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">Total Copies</span>
            <div className="font-display font-extrabold text-3xl mt-1 text-white">{stats.totalCopyCount}</div>
            <span className="text-[9px] text-emerald-400 font-mono mt-0.5 block">Conversion triggers</span>
          </div>
        </div>
      )}

      {/* Watermarking Control panel */}
      <div className="p-6 rounded-3xl glass-panel max-w-2xl mb-8">
        <h3 className="text-base font-bold text-white font-display uppercase tracking-wider mb-1 flex items-center gap-1.5">
          <span>🛡️</span> Security Watermark Protocol
        </h3>
        <p className="text-xs text-slate-400 font-mono mb-4">Protect uploaded AI images from unauthorized copy-reuse by binding watermarks permanently onto downloads.</p>

        <form onSubmit={handleSaveWatermark} className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5 bg-white/5 p-3 rounded-2xl border border-white/10">
            <input 
              type="checkbox" 
              id="wm_enabled"
              checked={wmEnabled}
              onChange={(e) => setWmEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
            />
            <label htmlFor="wm_enabled" className="text-xs font-semibold text-slate-200 select-none cursor-pointer">
              Enable watermarking on AI prompt illustrations
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Website Watermark Text</label>
            <input 
              type="text" 
              maxLength={30}
              placeholder="e.g. MokkaPix Vault"
              value={wmText}
              onChange={(e) => setWmText(e.target.value)}
              className="px-4 py-2.5 bg-white/5 border border-white/10 text-slate-100 text-xs sm:text-sm rounded-xl focus:border-indigo-500 focus:outline-none transition font-sans"
            />
          </div>

          <button 
            type="submit" 
            disabled={updatingWm}
            className="w-fit self-start px-5 py-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/25 hover:bg-indigo-600 hover:text-white transition rounded-xl text-xs font-semibold cursor-pointer"
          >
            {updatingWm ? 'Syncing...' : 'Lock and Apply settings'}
          </button>
        </form>
      </div>

      {/* Form Dialog Panel: CRUD Insert/Modify Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl glass-panel bg-slate-900 border-slate-800 p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white font-display uppercase tracking-wider">
                {editingPrompt ? 'Modify Record Parameters' : 'Register New AI Creation'}
              </h2>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-500 hover:text-slate-300 font-bold p-1 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleSavePrompt} className="flex flex-col gap-4">
              {/* Alphanumeric Title */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Prompt Title *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Steampunk Laboratory"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="px-4 py-2 bg-slate-950/80 border border-slate-800 text-slate-100 text-xs sm:text-sm rounded-xl focus:border-indigo-500 focus:outline-none transition"
                />
              </div>

              {/* Form Category / Form Model Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Category *</label>
                  <select 
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="px-3 py-2 bg-slate-950/80 border border-slate-800 text-slate-200 text-xs sm:text-sm rounded-xl focus:border-indigo-500 focus:outline-none transition cursor-pointer"
                  >
                    <option value="Fantasy">Fantasy</option>
                    <option value="Product Photography">Product Photography</option>
                    <option value="Sci-Fi">Sci-Fi</option>
                    <option value="Architecture">Architecture</option>
                    <option value="Nature">Nature</option>
                    <option value="Character Design">Character Design</option>
                    <option value="Abstract">Abstract</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">AI Model *</label>
                  <select 
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    className="px-3 py-2 bg-slate-950/80 border border-slate-800 text-slate-200 text-xs sm:text-sm rounded-xl focus:border-indigo-500 focus:outline-none transition cursor-pointer"
                  >
                    <option value="Flux Pro">Flux Pro</option>
                    <option value="Midjourney">Midjourney</option>
                    <option value="DALL-E 3">DALL-E 3</option>
                    <option value="Stable Diffusion">Stable Diffusion XL</option>
                  </select>
                </div>
              </div>

              {/* Exact Prompt Text */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Exact Generation Prompt Text *</label>
                <textarea 
                  required
                  rows={3}
                  placeholder="Paste the precise keyword structure used..."
                  value={formPromptText}
                  onChange={(e) => setFormPromptText(e.target.value)}
                  className="px-4 py-2 bg-slate-950/80 border border-slate-800 text-slate-100 text-xs font-mono rounded-xl focus:border-indigo-500 focus:outline-none transition resize-none"
                />
              </div>

              {/* Tags comma parser */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono font-sans">Semantic Tags (comma separated)</label>
                <input 
                  type="text" 
                  placeholder="cyberpunk, futuristic, 8k, neon"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="px-4 py-2 bg-slate-950/80 border border-slate-800 text-slate-100 text-xs sm:text-sm rounded-xl focus:border-indigo-500 focus:outline-none transition font-sans"
                />
              </div>

              {/* Image upload selection block */}
              <div className="flex flex-col gap-1 p-3 bg-slate-950/60 rounded-xl border border-slate-850">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Artwork Image Upload</label>
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileChange}
                  className="mt-1 text-slate-400 text-xs block w-full text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-600/20 file:text-indigo-400 hover:file:bg-indigo-600/30 file:cursor-pointer"
                />
                <span className="text-[9px] text-slate-500 font-mono mt-1">Accepts PNG, JPG, or WEBP. Limit size to 5MB max.</span>

                {imagePreview && (
                  <div className="relative mt-2 h-20 w-20 rounded border border-slate-800 overflow-hidden">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Featured toggle */}
              <div className="flex items-center gap-2 bg-slate-950/40 p-2.5 rounded-lg border border-slate-850-60">
                <input 
                  type="checkbox" 
                  id="featured"
                  checked={formFeatured}
                  onChange={(e) => setFormFeatured(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 accent-indigo-600 rounded cursor-pointer"
                />
                <label htmlFor="featured" className="text-xs text-slate-300 font-semibold select-none cursor-pointer">
                  Feature this prompt on landing highlights pool
                </label>
              </div>

              {/* Action submission buttons */}
              <div className="flex items-center gap-2 mt-2 border-t border-slate-800 pt-3">
                <button 
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={savingPrompt}
                  className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-xs font-semibold hover:from-indigo-500 shadow disabled:opacity-50 cursor-pointer"
                >
                  {savingPrompt ? 'Processing payload details...' : 'Integrate Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CRUD grid lists (Admin grid layout with view adjusters) */}
      <h3 className="text-base font-bold text-white font-display uppercase tracking-wider mb-4">Manage Core AI Prompts</h3>
      
      {loadingDashboard ? (
        <div className="flex items-center justify-center p-8 bg-slate-900/10 border border-slate-850/50 rounded-2xl">
          <svg className="animate-spin h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900/80 text-slate-400 font-mono border-b border-slate-800">
                <th className="p-3">Title / Specs</th>
                <th className="p-3">Model</th>
                <th className="p-3">Category</th>
                <th className="p-3">Metrics</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {prompts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 font-mono">No prompts currently indexed. Create the first database record!</td>
                </tr>
              ) : (
                prompts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-900/20 text-slate-300">
                    {/* Visual & Metadata cells */}
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded border border-slate-800 overflow-hidden bg-slate-950 shrink-0">
                          <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-1">
                            {p.title}
                            {p.featured && (
                              <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1 py-0.2 rounded font-mono uppercase font-bold text-[8px]">Featured</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 max-w-xs font-mono line-clamp-1 mt-0.5">"{p.prompt_text}"</div>
                        </div>
                      </div>
                    </td>

                    <td className="p-3 font-mono">{p.ai_model}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-900 text-indigo-300 border border-slate-800 text-[10px] font-bold">
                        {p.category}
                      </span>
                    </td>

                    {/* Views & Copies count cells */}
                    <td className="p-3 font-mono text-slate-400 text-[10px]">
                      <div>👁️ {p.views} views</div>
                      <div className="mt-0.5">📋 {p.copy_count} copies</div>
                    </td>

                    {/* CRUD Actions cells */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => handleOpenEditForm(p)}
                          className="bg-indigo-600/15 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition px-2 py-1.5 rounded-md font-semibold cursor-pointer"
                        >
                          Modify
                        </button>
                        <button 
                          onClick={() => handleDeletePrompt(p.id, p.title)}
                          className="bg-red-950/20 border border-red-500/20 text-red-400 hover:bg-red-600 hover:text-white transition px-2 py-1.5 rounded-md font-semibold cursor-pointer"
                        >
                          Purge
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
