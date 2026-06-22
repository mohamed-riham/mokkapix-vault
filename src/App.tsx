import React, { useState, useEffect } from 'react';
import { Prompt, WatermarkSettings } from './types';
import PromptCard from './components/PromptCard';
import PromptDetail from './components/PromptDetail';
import AdminPanel from './components/AdminPanel';
import { 
  getFavoritesCache, 
  saveFavoritesCache, 
  cacheApiResponse, 
  getCachedApiResponse,
  preloadImagesInCache 
} from './utils/cache';

export default function App() {
  // Page states
  const [currentView, setCurrentView] = useState<'home' | 'detail' | 'admin'>('home');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter terms
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');

  // Filter metadata list (fetched from database filters)
  const [categories, setCategories] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);

  // User Local Favorites lists
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  // Global Watermark Settings
  const [watermark, setWatermark] = useState<WatermarkSettings>({ enabled: true, text: 'MokkaPix Vault' });

  // Custom Toast notifications holders
  interface Toast {
    id: string;
    message: string;
    type: 'success' | 'info' | 'error';
  }
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addNotify = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // 1. Initial State Route Parsing
  useEffect(() => {
    const handleUrlRouting = () => {
      const path = window.location.pathname;
      if (path === '/admin') {
        setCurrentView('admin');
        window.scrollTo(0, 0);
      } else if (path.startsWith('/prompt/')) {
        const slug = path.split('/prompt/')[1];
        if (slug) {
          fetchSinglePrompt(slug);
        } else {
          setCurrentView('home');
        }
      } else {
        setCurrentView('home');
        setSelectedPrompt(null);
      }
    };

    // Load initial routing
    handleUrlRouting();

    // Listen to history changes
    window.addEventListener('popstate', handleUrlRouting);
    return () => window.removeEventListener('popstate', handleUrlRouting);
  }, []);

  // 2. Fetch Single Prompt for SEO link entry
  const fetchSinglePrompt = async (slug: string) => {
    try {
      setLoading(true);
      const resp = await fetch(`/api/prompts/${slug}`);
      const data = await resp.json();
      if (data.success) {
        setSelectedPrompt(data.data);
        setCurrentView('detail');
        window.scrollTo(0, 0);
      } else {
        addNotify('Requested prompt page not found. Navigating to gallery', 'error');
        navigateTo('/');
      }
    } catch (err) {
      addNotify('Error loading target link.', 'error');
      navigateTo('/');
    } finally {
      setLoading(false);
    }
  };

  // 3. Navigation controller (maintains slug synchronization synchronously)
  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    const event = new PopStateEvent('popstate');
    window.dispatchEvent(event);
  };

  // 4. One-time Initialization of Favorites, Filters, and Watermark Settings
  useEffect(() => {
    // Initial loading of favorites from custom Cache Storage with LocalStorage fallback
    const loadFavorites = async () => {
      const cachedFavs = await getFavoritesCache();
      setFavorites(cachedFavs);
    };
    loadFavorites();

    fetchFilters();
    fetchWatermark();
  }, []);

  // 5. Fetch Public Datasets on query/filter parameters updates
  useEffect(() => {
    fetchPrompts();
  }, [searchQuery, selectedCategory, selectedModel, sortBy]);

  // Dynamic automatic SEO Document Title handler
  useEffect(() => {
    if (currentView === 'detail' && selectedPrompt) {
      document.title = `${selectedPrompt.title} - AI Prompt on MokkaPix Vault`;
    } else if (currentView === 'admin') {
      document.title = `Admin System - MokkaPix Vault`;
    } else {
      document.title = `MokkaPix Vault - Premium AI Image Prompt Gallery & Data Science by Mohamed Riham`;
    }
  }, [currentView, selectedPrompt]);

  const fetchPrompts = async () => {
    // Generate URL string
    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);
    if (selectedCategory) params.append('category', selectedCategory);
    if (selectedModel) params.append('model', selectedModel);
    params.append('sort', sortBy);
    const apiUrl = `/api/prompts?${params.toString()}`;

    // Read cached API response for high-speed rendering first
    const cached = await getCachedApiResponse<any>(apiUrl);
    if (cached && cached.success) {
      setPrompts(cached.data);
      // Preload cached images in background
      const cachedImages = cached.data.map((p: Prompt) => p.image_url);
      preloadImagesInCache(cachedImages);
    } else {
      // Show loading only if we do not even have cached representation
      setLoading(true);
    }

    try {
      const resp = await fetch(apiUrl);
      const data = await resp.json();
      if (data.success) {
        setPrompts(data.data);
        // Cache latest response for current URL query
        await cacheApiResponse(apiUrl, data);
        // Preload newly fetched images in background
        const fetchedImages = data.data.map((p: Prompt) => p.image_url);
        preloadImagesInCache(fetchedImages);
      }
    } catch (err) {
      // Connection failed message is only critical if we don't have any data shown
      if (!cached) {
        addNotify('Connection to central server failed.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchFilters = async () => {
    const filtersUrl = '/api/filters';
    const cached = await getCachedApiResponse<any>(filtersUrl);
    if (cached && cached.success) {
      setCategories(cached.data.categories || []);
      setModels(cached.data.models || []);
    }

    try {
      const resp = await fetch(filtersUrl);
      const data = await resp.json();
      if (data.success) {
        setCategories(data.data.categories || []);
        setModels(data.data.models || []);
        await cacheApiResponse(filtersUrl, data);
      }
    } catch (err) {
      console.error("Filter specs fetching error:", err);
    }
  };

  const fetchWatermark = async () => {
    const wmUrl = '/api/admin/watermark';
    const cached = await getCachedApiResponse<any>(wmUrl);
    if (cached && cached.success) {
      setWatermark(cached.data);
    }

    try {
      const resp = await fetch(wmUrl);
      const data = await resp.json();
      if (data.success) {
        setWatermark(data.data);
        await cacheApiResponse(wmUrl, data);
      }
    } catch (err) {
      console.error("Failed to load global protection watermark settings:", err);
    }
  };

  // Toggle dynamic favorites helper (saves to Cache Storage & LocalStorage)
  const toggleFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    let updated: string[];
    if (favorites.includes(id)) {
      updated = favorites.filter((favId) => favId !== id);
      addNotify('Prompt removed from favorites list.', 'info');
    } else {
      updated = [...favorites, id];
      addNotify('Prompt pinned to favorites locker!', 'success');
    }
    setFavorites(updated);
    await saveFavoritesCache(updated);
  };

  const handleCardDetailsSelect = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    navigateTo(`/prompt/${prompt.slug}`);
  };

  // Filter set shortcuts
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedModel('');
    setSortBy('newest');
    setShowOnlyFavorites(false);
    addNotify('Applied filter resetting.', 'info');
  };

  // Calculate matching dataset
  const filteredPrompts = showOnlyFavorites
    ? prompts.filter((p) => favorites.includes(p.id))
    : prompts;

  return (
    <div className="relative overflow-hidden min-h-screen bg-[#050508] text-slate-100 flex flex-col justify-between font-sans selection:bg-indigo-600/60 selection:text-white pb-6">
      {/* Background Mesh Orbs */}
      <div className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none z-0" />
      {/* Dynamic Floating Toast Alerts */}
      <div className="fixed top-5 right-5 z-55 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md border animate-slideIn ${
              toast.type === 'success'
                ? 'bg-emerald-950/85 border-emerald-500/30 text-emerald-100'
                : toast.type === 'error'
                ? 'bg-rose-950/85 border-rose-500/30 text-rose-100'
                : 'bg-slate-900/85 border-slate-700/30 text-indigo-300'
            }`}
          >
            {toast.type === 'success' && (
              <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" /><line x1="15" x2="9" y1="9" y2="15" /><line x1="9" x2="15" y1="9" y2="15" />
              </svg>
            )}
            {toast.type === 'info' && (
              <svg className="w-5 h-5 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="16" y2="12" /><line x1="12" x2="12.01" y1="8" y2="8" />
              </svg>
            )}
            <span className="text-xs font-semibold leading-relaxed font-mono">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Floating Header */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/10 shadow-xl select-none backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo Branding */}
          <div 
            onClick={() => navigateTo('/')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-indigo-500 flex items-center justify-center border border-indigo-400/25 group-hover:scale-105 transition-transform duration-300 shadow shadow-indigo-600/30 neon-glow-indigo">
              {/* Star constellation vector */}
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white animate-pulse">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold font-display tracking-wider text-white uppercase group-hover:text-indigo-400 transition-colors">
                MokkaPix Vault
              </span>
              <span className="text-[8px] font-mono tracking-widest text-slate-500 uppercase -mt-0.5">Premium AI Prompt Archive</span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="flex items-center gap-2 text-xs font-mono select-none">
            <button 
              onClick={() => navigateTo('/')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                currentView !== 'admin' 
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🌌 Explore Gallery
            </button>
            <button 
              onClick={() => navigateTo('/admin')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                currentView === 'admin' 
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🛡️ Vault Admin Portal
            </button>
          </nav>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-grow relative z-10">
        {currentView === 'home' && (
          <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col gap-8 animate-fadeIn">
            {/* Elegant Hero Landing Section */}
            <div className="relative rounded-3xl overflow-hidden glass-panel border-white/10 py-12 px-6 sm:px-12 text-center flex flex-col items-center gap-4 shadow-2xl bg-white/[0.01] neon-glow-indigo">
              {/* Spotlight blur circles */}
              <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[350px] h-[350px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />
              
              <div className="relative z-10 flex flex-col items-center gap-2.5 max-w-2xl">
                <span className="text-[10px] font-extrabold tracking-widest font-mono text-indigo-400 uppercase bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/25">
                  ✨ Instant Metadata Generator
                </span>
                <h1 className="text-4xl sm:text-5xl font-black font-display tracking-tight text-white mt-1 leading-tight uppercase font-display">
                  Discover the precise <br />
                  <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-indigo-400 bg-clip-text text-transparent">
                    AI prompts key settings
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 font-medium leading-relaxed mt-1">
                  MokkaPix Vault is a premium AI image prompt config archive designed by data science specialist <strong>Mohamed Riham (riham/rhm/aimbot)</strong>. We catalog stable prompt sequences, custom tags, and configurations for Flux, Midjourney, and top generation platforms. For custom prompt engineering, contact Mohamed Riham prompts specialist.
                </p>
              </div>

              {/* Summary badges carousel */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2 select-none">
                <span className="text-[10px] font-mono text-slate-500">Popular:</span>
                <span className="px-2.5 py-1 bg-slate-950/60 border border-slate-800 text-[9px] font-mono text-slate-400 rounded-lg">#cyberpunk</span>
                <span className="px-2.5 py-1 bg-slate-950/60 border border-slate-800 text-[9px] font-mono text-slate-400 rounded-lg">#luxury-car</span>
                <span className="px-2.5 py-1 bg-slate-950/60 border border-slate-800 text-[9px] font-mono text-slate-400 rounded-lg">#digitalart</span>
                <span className="px-2.5 py-1 bg-slate-950/60 border border-slate-800 text-[9px] font-mono text-slate-400 rounded-lg">#fantasy</span>
              </div>
            </div>

            {/* Public search bar & filter selectors */}
            <div className="p-5 rounded-2xl glass-panel bg-white/[0.01] flex flex-col gap-4 select-none">
              {/* Search line */}
              <div className="relative flex-1">
                <input 
                  type="text"
                  placeholder="Query prompt terms, categories, models, tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-slate-100 text-sm bg-white/5 border border-white/10 p-3 pl-10 rounded-xl focus:border-indigo-500/55 focus:outline-none transition leading-none font-sans"
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Filters dropdown parameters row */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                {/* Category filters */}
                <div className="flex-1 min-w-[130px]">
                  <select 
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white/5 border border-white/10 text-slate-200 rounded-xl cursor-pointer focus:outline-none focus:border-indigo-500 transition hover:bg-white/[0.08]"
                  >
                    <option value="" className="bg-slate-950 text-slate-200">All Categories</option>
                    {categories.map((c, i) => (
                      <option key={i} value={c} className="bg-slate-950 text-slate-200">{c}</option>
                    ))}
                  </select>
                </div>

                {/* AI Models filter */}
                <div className="flex-1 min-w-[130px]">
                  <select 
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white/5 border border-white/10 text-slate-200 rounded-xl cursor-pointer focus:outline-none focus:border-indigo-500 transition hover:bg-white/[0.08]"
                  >
                    <option value="" className="bg-slate-950 text-slate-200">All AI Engines</option>
                    {models.map((m, i) => (
                      <option key={i} value={m} className="bg-slate-950 text-slate-200">{m}</option>
                    ))}
                  </select>
                </div>

                {/* Sorting options */}
                <div className="w-[120px] shrink-0">
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white/5 border border-white/10 text-slate-200 rounded-xl cursor-pointer focus:outline-none focus:border-indigo-500 transition font-mono hover:bg-white/[0.08]"
                  >
                    <option value="newest" className="bg-slate-950 text-slate-200">🕒 Newest</option>
                    <option value="popular" className="bg-slate-950 text-slate-200">🔥 Trending</option>
                  </select>
                </div>

                {/* My Locker favorites toggle */}
                <button 
                  onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition cursor-pointer select-none ${
                    showOnlyFavorites 
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                      : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>⭐</span>
                  Locker Favorites {favorites.length > 0 && `(${favorites.length})`}
                </button>

                {/* Reset button */}
                <button 
                  onClick={clearFilters}
                  className="px-3 py-2 text-xs bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl border border-white/10 transition cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Gallery Section Grid */}
            <div>
              <div className="flex items-center justify-between mb-5 border-b border-slate-900 pb-2.5">
                <h3 className="text-lg font-bold text-white uppercase font-display tracking-tight flex items-center gap-2">
                  <span>🌌</span> AI Creations Gallery
                  <span className="text-xs bg-slate-900 text-slate-500 font-mono px-2 py-0.5 rounded-full border border-slate-800">
                    {filteredPrompts.length} cards matching
                  </span>
                </h3>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center p-20 min-h-[40vh]">
                  <svg className="animate-spin h-8 w-8 text-indigo-500 mb-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-xs text-slate-500 font-mono uppercase tracking-widest mt-1">Retrieving AI vault archive</span>
                </div>
              ) : filteredPrompts.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 text-center bg-slate-900/10 border border-slate-850/50 rounded-2xl select-none">
                  <span className="text-4xl mb-3">🛸</span>
                  <h4 className="text-base font-bold text-white uppercase font-display">No prompts aligned with search</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1 font-mono">Verify spelling variables, select wider category ranges, or drop favorites filtering locks.</p>
                  <button 
                    onClick={clearFilters}
                    className="mt-4 px-4 py-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600 hover:text-white transition rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Clear Filter Parameters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredPrompts.map((p) => {
                    const isFav = favorites.includes(p.id);
                    return (
                      <div key={p.id} className="relative group">
                        {/* Favorite button float over card */}
                        <button 
                          onClick={(e) => toggleFavorite(e, p.id)}
                          className="absolute top-14 right-3 z-20 w-8 h-8 rounded-full bg-slate-950/85 backdrop-blur-md border flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-90 cursor-pointer shadow-md shadow-black/40 group-hover:opacity-100 sm:opacity-0"
                          style={{ borderColor: isFav ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.1)' }}
                          title={isFav ? "Pinned Favorite" : "Favorite Prompt"}
                        >
                          <span className={`text-sm transition duration-305 ${isFav ? 'text-amber-400 animate-pulse' : 'text-slate-400 hover:text-white'}`}>
                            ⭐
                          </span>
                        </button>

                        <PromptCard 
                          prompt={p} 
                          watermark={watermark}
                          onSelect={handleCardDetailsSelect} 
                          onCopySuccess={(msg) => addNotify(msg, 'success')}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {currentView === 'detail' && selectedPrompt && (
          <PromptDetail 
            prompt={selectedPrompt} 
            watermark={watermark}
            onBack={() => navigateTo('/')} 
            onNotify={addNotify}
          />
        )}

        {currentView === 'admin' && (
          <AdminPanel 
            onNotify={addNotify} 
            watermark={watermark}
            onWatermarkUpdated={fetchWatermark}
          />
        )}
      </main>

      {/* Footer Area */}
      <footer className="mt-16 bg-black/40 border-t border-white/10 backdrop-blur-md relative z-10 select-none">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <span className="text-sm font-black font-display uppercase tracking-widest text-indigo-400">MokkaPix Vault</span>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5">© 2026 MokkaPix Vault. Created by Mohamed Riham (rhm/aimbot). Dynamic data science - mohamed riham prompts. All Rights Reserved.</span>
          </div>

          <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            <button onClick={() => navigateTo('/')} className="hover:text-slate-350 cursor-pointer">Exploring</button>
            <span>•</span>
            <button onClick={() => navigateTo('/admin')} className="hover:text-slate-350 cursor-pointer">Vault Console</button>
            <span>•</span>
            <span className="text-slate-600 font-normal">Sandbox Encrypted SSL v1.0.3</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
