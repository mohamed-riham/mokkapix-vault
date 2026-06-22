import React, { useState } from 'react';

interface WatermarkedImageProps {
  src: string;
  alt: string;
  watermarkText?: string;
  watermarkEnabled?: boolean;
  className?: string;
  onImageProtectedClick?: (message: string) => void;
}

export default function WatermarkedImage({
  src,
  alt,
  watermarkText = 'MokkaPix Vault',
  watermarkEnabled = true,
  className = 'w-full h-full object-cover rounded-t-xl',
  onImageProtectedClick
}: WatermarkedImageProps) {
  const [showWarning, setShowWarning] = useState(false);

  // Formulate security warnings
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowWarning(true);
    if (onImageProtectedClick) {
      onImageProtectedClick("🔒 Digital protection enabled. Use the secure 'Download' button below.");
    }
    setTimeout(() => setShowWarning(false), 3000);
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none group" onContextMenu={handleContextMenu}>
      {/* Actual Image Tag */}
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        className={`${className} transition-transform duration-500 group-hover:scale-105 pointer-events-none select-none`}
        draggable={false}
      />

      {/* Elegant watermark overlay */}
      {watermarkEnabled && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center z-10 pointer-events-none">
          <div className="bg-black/45 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/12 flex items-center gap-1.5 shadow-lg">
            {/* Website vector branding shield logo */}
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-400">
              <path d="M20 13c0 5-3.5 7.5-7.66 9.7a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .76-.97l8-2a1 1 0 0 1 .48 0l8 2A1 1 0 0 1 20 6z"/>
            </svg>
            <span className="text-[10px] uppercase tracking-widest font-bold text-white/90 font-mono">
              {watermarkText}
            </span>
          </div>
        </div>
      )}

      {/* Extra diagonal repeating faint watermarks for full canvas coverage */}
      {watermarkEnabled && (
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-5 pointer-events-none z-0">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-center -rotate-25 text-sm font-bold uppercase font-mono tracking-widest text-white">
              {watermarkText}
            </div>
          ))}
        </div>
      )}

      {/* Invisible Layer shielding click and Touch triggers */}
      <div 
        className="absolute inset-0 bg-transparent z-10 cursor-default select-none touch-none"
        onClick={() => {
          if (onImageProtectedClick) {
            onImageProtectedClick("💡 This AI creation is protected. Tap the copy button below or open details to download.");
          }
        }}
      />

      {/* Dynamic inline warning popups */}
      {showWarning && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-4 text-center transition-all duration-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-400 mb-2 animate-bounce">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <p className="text-xs font-semibold text-gray-200 uppercase tracking-widest font-mono">Anti-Theft Active</p>
          <p className="text-[11px] text-gray-400 mt-1 max-w-[80%]">Right-click is protected to guard creators. Use the official Download features.</p>
        </div>
      )}
    </div>
  );
}
