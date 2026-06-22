import React from 'react';
import { Prompt, WatermarkSettings } from '../types';
import WatermarkedImage from './WatermarkedImage';

interface PromptCardProps {
  prompt: Prompt;
  watermark: WatermarkSettings;
  onSelect: (prompt: Prompt) => void;
  onCopySuccess: (message: string) => void;
}

export default function PromptCard({ prompt, watermark, onSelect, onCopySuccess }: PromptCardProps) {
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering card selection click
    navigator.clipboard.writeText(prompt.prompt_text);
    onCopySuccess(`Copied "${prompt.title}" to clipboard!`);

    // Increment backend copy counter
    fetch(`/api/prompts/${prompt.id}/copy`, {
      method: 'POST'
    }).catch(() => {});
  };

  return (
    <div 
      onClick={() => onSelect(prompt)}
      className="group rounded-3xl overflow-hidden glass-card transition-all duration-300 hover:-translate-y-1.5 cursor-pointer flex flex-col h-full neon-glow-indigo"
    >
      {/* Covered Image Area */}
      <div className="relative aspect-square w-full bg-slate-950 overflow-hidden">
        <WatermarkedImage 
          src={prompt.image_url} 
          alt={prompt.title} 
          watermarkText={watermark.text}
          watermarkEnabled={watermark.enabled}
          className="w-full h-full object-cover rounded-t-3xl"
          onImageProtectedClick={(msg) => onCopySuccess(msg)}
        />
        
        {/* Category Floating Badge */}
        <div className="absolute top-3 left-3 z-10">
          <span className="px-2.5 py-1 text-[10px] font-bold font-display uppercase tracking-wider bg-black/40 text-indigo-300 backdrop-blur-md rounded-md border border-white/15 shadow">
            {prompt.category}
          </span>
        </div>

        {/* AI Model Badge */}
        <div className="absolute top-3 right-3 z-10">
          <span className="px-2 py-1 text-[9px] font-bold font-mono tracking-wide bg-indigo-500 text-white backdrop-blur-md rounded-md border border-indigo-400/30">
            {prompt.ai_model}
          </span>
        </div>
      </div>

      {/* Info Context area */}
      <div className="p-4 flex flex-col flex-grow justify-between gap-3">
        <div>
          {/* Header Title */}
          <h3 className="text-sm font-bold font-display tracking-tight text-slate-100 group-hover:text-indigo-400 transition-colors line-clamp-1">
            {prompt.title}
          </h3>

          {/* Quick Stats subheader */}
          <div className="flex items-center gap-3.5 mt-1 text-[10px] text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              👁️ {prompt.views} views
            </span>
            <span className="flex items-center gap-1">
              📋 {prompt.copy_count} copies
            </span>
          </div>

          {/* Prompt text crop */}
          <div className="relative mt-2.5">
            <p className="text-xs text-slate-400 font-mono italic line-clamp-3 leading-relaxed">
              "{prompt.prompt_text}"
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
          {/* Tags */}
          {prompt.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {prompt.tags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="text-[9px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                  #{tag}
                </span>
              ))}
              {prompt.tags.length > 3 && (
                <span className="text-[9px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                  +{prompt.tags.length - 3}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-[10px] text-indigo-400/80 font-mono uppercase font-semibold group-hover:underline flex items-center gap-1">
              Inspect Prompt
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" x2="19" y1="12" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </span>
            
            <button 
              onClick={handleCopy}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 hover:scale-105 active:scale-95 text-white text-[11px] font-medium font-mono rounded-lg transition-all shadow shadow-indigo-950/50 flex items-center gap-1 cursor-pointer"
            >
              📋 Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
