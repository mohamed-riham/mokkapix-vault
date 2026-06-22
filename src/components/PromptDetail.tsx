import React from 'react';
import { Prompt, WatermarkSettings } from '../types';
import WatermarkedImage from './WatermarkedImage';
import SocialShare from './SocialShare';

interface PromptDetailProps {
  prompt: Prompt;
  watermark: WatermarkSettings;
  onBack: () => void;
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export default function PromptDetail({ prompt, watermark, onBack, onNotify }: PromptDetailProps) {
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(prompt.prompt_text);
    onNotify('Copy instructions triggered: AI prompt code successfully added to clipboard!', 'success');
    
    // Register action count
    fetch(`/api/prompts/${prompt.id}/copy`, {
      method: 'POST'
    }).catch(() => {});
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fadeIn">
      {/* Back button */}
      <button 
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-white transition group py-1.5 cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:-translate-x-1 transition-transform">
          <line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Back to Gallery
      </button>

      {/* Main layout grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Huge visual illustration with context safe block */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="relative aspect-square w-full rounded-3xl overflow-hidden glass-card shadow-2xl">
            <WatermarkedImage 
              src={prompt.image_url} 
              alt={prompt.title} 
              watermarkText={watermark.text}
              watermarkEnabled={watermark.enabled}
              className="w-full h-full object-cover rounded-3xl"
              onImageProtectedClick={(msg) => onNotify(msg, 'info')}
            />
          </div>

          <div className="flex justify-between items-center px-2 text-xs text-slate-500 font-mono">
            <span>Uploaded: {new Date(prompt.created_at).toLocaleDateString()}</span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
              Secure SSL Sandbox Verified
            </span>
          </div>
        </div>

        {/* Right Column: Full specifications, specs, share elements */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            {/* Badges line */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-bold font-display uppercase tracking-wider bg-black/40 text-indigo-300 rounded-md border border-white/10">
                {prompt.category}
              </span>
              <span className="px-2.5 py-1 text-xs font-semibold font-mono tracking-wide bg-white/5 text-slate-200 rounded-md border border-white/10">
                🤖 Model: {prompt.ai_model}
              </span>
            </div>

            <h1 className="text-3xl font-extrabold font-display tracking-tight text-white mt-1">
              {prompt.title}
            </h1>

            {/* View indicators */}
            <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                👁️ <strong>{prompt.views}</strong> Views
              </span>
              <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                📋 <strong>{prompt.copy_count}</strong> Copies
              </span>
            </div>
          </div>

          {/* Prompt specifications box */}
          <div className="flex flex-col gap-2 rounded-2xl glass-panel p-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2.5">
              <span className="text-[9px] font-mono uppercase text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                Raw Prompt Code
              </span>
            </div>

            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-display">Generation Prompt</h3>
            
            <div className="bg-white/5 rounded-xl p-4 border border-white/5 mt-1 flex flex-col gap-3 relative">
              <p className="text-xs sm:text-sm font-mono text-indigo-100 leading-relaxed italic select-all break-words select-text">
                "{prompt.prompt_text}"
              </p>
              
              <button 
                onClick={handleCopyPrompt}
                className="self-end px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-semibold font-mono rounded-lg transition-all flex items-center gap-1.5 shadow cursor-pointer shadow-indigo-950/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                Copy Prompt Code
              </button>
            </div>
          </div>

          {/* Tags collection list */}
          {prompt.tags.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">Semantic tags</h4>
              <div className="flex flex-wrap gap-1.5">
                {prompt.tags.map((tag, idx) => (
                  <span key={idx} className="text-xs font-mono text-slate-200 bg-white/5 hover:bg-white/10 duration-200 cursor-default px-2.5 py-1 rounded-lg border border-white/10">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Social Share Integrator */}
          <SocialShare 
            id={prompt.id} 
            slug={prompt.slug} 
            title={prompt.title} 
            promptText={prompt.prompt_text} 
            imageUrl={prompt.image_url} 
            watermarkText={watermark.text}
            watermarkEnabled={watermark.enabled}
            onNotify={onNotify}
          />
        </div>
      </div>
    </div>
  );
}
