import React, { useState } from 'react';

interface SocialShareProps {
  id: string;
  slug: string;
  title: string;
  promptText: string;
  imageUrl: string;
  watermarkText?: string;
  watermarkEnabled?: boolean;
  onNotify: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export default function SocialShare({
  id,
  slug,
  title,
  promptText,
  imageUrl,
  watermarkText = 'MokkaPix Vault',
  watermarkEnabled = true,
  onNotify
}: SocialShareProps) {
  const [downloading, setDownloading] = useState(false);
  const [showInstaGuide, setShowInstaGuide] = useState(false);

  // Construct sharing link
  const getShareUrl = () => {
    return `${window.location.origin}/prompt/${slug}`;
  };

  const getShareText = () => {
    return `🔥 Check out this incredible AI image and get the exact prompt code for free on MokkaPix Vault: "${title}" ✨`;
  };

  // 1. Native Mobile Sharing
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `MokkaPix Vault - ${title}`,
          text: getShareText(),
          url: getShareUrl(),
        });
        onNotify('Shared successfully!', 'success');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          onNotify('Sharing canceled or unsupported.', 'info');
        }
      }
    } else {
      // Fallback: Copy Link
      handleCopyLink();
    }
  };

  // 2. Clear Copy Link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(getShareUrl());
    onNotify('Secure URL copied to clipboard! Share it with friends.', 'success');
    
    // Dynamic analytics callback increment views
    fetch(`/api/prompts/${id}/copy`, { method: 'POST' }).catch(() => {});
  };

  // 3. Download Watermarked Image through Client-Side Canvas
  const handleDownloadImage = async () => {
    setDownloading(true);
    try {
      // Force loading as resource
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const imageBlobUrl = URL.createObjectURL(blob);

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageBlobUrl;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not construct 2D graphics buffer.");

        // High DPI native dimensions
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        // Draw original prompt rendering
        ctx.drawImage(img, 0, 0);

        // Apply visual protection watermark overlay
        if (watermarkEnabled) {
          // Semi-transparent brand footer ribbon
          const bannerHeight = Math.max(35, Math.floor(canvas.height / 14));
          ctx.fillStyle = "rgba(9, 13, 22, 0.8)";
          ctx.fillRect(0, canvas.height - bannerHeight, canvas.width, bannerHeight);

          // Top border for ribbon
          ctx.fillStyle = "rgba(99, 102, 241, 0.4)";
          ctx.fillRect(0, canvas.height - bannerHeight, canvas.width, 2);

          // Watermark alphanumeric branding
          const fontSize = Math.max(12, Math.floor(bannerHeight / 2.2));
          ctx.font = `bold ${fontSize}px var(--font-mono, monospace)`;
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          
          // Draw watermark caption centered
          ctx.fillText(
            `© MOKKAPIX VAULT • WATERMARK ACTIVE [${watermarkText.toUpperCase()}]`,
            canvas.width / 2,
            canvas.height - bannerHeight / 2 + 1
          );

          // Subtle diagonal watermark pattern across image
          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(-Math.PI / 6); // -30 degrees
          ctx.font = `bold ${Math.max(14, Math.floor(canvas.width / 20))}px sans-serif`;
          ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
          ctx.textAlign = "center";
          ctx.fillText(watermarkText, 0, 0);
          ctx.restore();
        }

        // Output to download
        canvas.toBlob((optimizedBlob) => {
          if (!optimizedBlob) throw new Error("Optimized blob generation failed.");
          const downloadUrl = URL.createObjectURL(optimizedBlob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = `MokkaPix_Protected_${slug}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
          URL.revokeObjectURL(imageBlobUrl);
          onNotify('Protected creative downloaded successfully. Watermark embedded for security.', 'success');
          setDownloading(false);
        }, 'image/jpeg', 0.9);
      };

      img.onerror = () => {
        throw new Error("Embedded asset loading error.");
      };

    } catch (err: any) {
      console.error(err);
      onNotify('Download failed. Falling back to default raw URL download.', 'error');
      
      // Traditional raw file fallback
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `MokkaPix_Fallback_${slug}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloading(false);
    }
  };

  // Copy prompt text helper
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(promptText);
    onNotify('AI Prompt copied to clipboard! You are ready to generate.', 'success');
    
    // Register action count
    fetch(`/api/prompts/${id}/copy`, { method: 'POST' }).catch(() => {});
  };

  const shareUrl = getShareUrl();
  const shareText = getShareText();

  // Social URLs
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(`MokkaPix Vault AI - ${title}`)}&body=${encodeURIComponent(`Hey!\n\nI discovered a gorgeous prompt on MokkaPix Vault:\n\nTitle: ${title}\nPrompt: "${promptText}"\n\nCheckout the full layout and image previews here:\n${shareUrl}`)}`;

  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl glass-panel bg-slate-900/60 border-slate-800">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold tracking-wider uppercase text-slate-300 font-display">Viral Distribute System</h4>
        {navigator.share && (
          <button 
            onClick={handleNativeShare}
            className="text-xs bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 transition px-2.5 py-1 rounded-full border border-indigo-500/20 flex items-center gap-1 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
            System Share
          </button>
        )}
      </div>

      {/* Grid of sharing buttons */}
      <div className="grid grid-cols-5 gap-2">
        <a 
          href={whatsappUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-green-500/10 hover:bg-green-500/25 border border-green-500/15 group transition"
          title="Share via WhatsApp"
        >
          <span className="text-xl text-green-400 group-hover:scale-110 transition">💬</span>
          <span className="text-[10px] text-slate-400 font-mono">WhatsApp</span>
        </a>

        <a 
          href={twitterUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 group transition"
          title="Share on X / Twitter"
        >
          <span className="text-xl text-slate-200 group-hover:scale-110 transition">𝕏</span>
          <span className="text-[10px] text-slate-400 font-mono">X/Twitter</span>
        </a>

        <a 
          href={facebookUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/15 group transition"
          title="Share on Facebook"
        >
          <span className="text-xl text-blue-400 group-hover:scale-110 transition">📘</span>
          <span className="text-[10px] text-slate-400 font-mono">Facebook</span>
        </a>

        <a 
          href={telegramUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/15 group transition"
          title="Share via Telegram"
        >
          <span className="text-xl text-sky-400 group-hover:scale-110 transition">✈️</span>
          <span className="text-[10px] text-slate-400 font-mono">Telegram</span>
        </a>

        <a 
          href={emailUrl} 
          className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 group transition"
          title="Share via Email"
        >
          <span className="text-xl text-slate-300 group-hover:scale-110 transition">✉️</span>
          <span className="text-[10px] text-slate-400 font-mono">Email</span>
        </a>
      </div>

      <hr className="border-slate-800" />

      {/* Primary utility interactions */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <button 
          onClick={handleCopyLink}
          className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-750 transition px-4 py-2.5 text-sm font-medium rounded-xl border border-slate-700 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-400"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          Copy Link URL
        </button>

        <button 
          onClick={handleDownloadImage}
          disabled={downloading}
          className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white transition px-4 py-2.5 text-sm font-medium rounded-xl border border-indigo-500/30 shadow-md shadow-indigo-900/20 disabled:opacity-50 cursor-pointer"
        >
          {downloading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Applying Watermark...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              Download Secure Image
            </>
          )}
        </button>
      </div>

      {/* Specialized Instagram layout helper */}
      <div className="mt-1">
        <button 
          onClick={() => setShowInstaGuide(!showInstaGuide)}
          className="w-full text-center text-xs text-pink-400 hover:text-pink-300 font-medium py-1.5 flex items-center justify-center gap-1 bg-pink-500/5 hover:bg-pink-500/10 rounded-lg border border-pink-500/10 transition cursor-pointer"
        >
          <span>📸</span> Share on Instagram Guide
        </button>

        {showInstaGuide && (
          <div className="mt-2.5 p-3 rounded-lg bg-pink-950/20 border border-pink-500/20 text-xs text-slate-300 flex flex-col gap-2.5 animate-fadeIn">
            <p className="font-semibold text-pink-400 flex items-center gap-1">
              <span>Instagram Share Guide:</span>
            </p>
            <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-400 font-mono">
              <li>Click <strong className="text-pink-400">"Copy Prompt"</strong> below to copy code settings</li>
              <li>Click <strong className="text-pink-400">"Download Secure Image"</strong> to save high-fidelity image</li>
              <li>Open Instagram and choose the image you downloaded</li>
              <li>Paste the clipboard contents as the caption!</li>
            </ol>
            <div className="flex gap-2">
              <button 
                onClick={handleCopyPrompt}
                className="flex-1 py-1.5 px-2 bg-pink-900/30 hover:bg-pink-900/50 text-pink-300 border border-pink-500/30 rounded font-mono text-[10px] cursor-pointer"
              >
                1. Copy Prompt
              </button>
              <button 
                onClick={handleDownloadImage}
                className="flex-1 py-1.5 px-2 bg-pink-600/30 hover:bg-pink-600/50 text-white rounded font-mono text-[10px] cursor-pointer"
              >
                2. Save Image
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Embed Promotional Widget */}
      <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800 text-[10px] text-slate-500 text-center flex flex-col gap-1 select-none">
        <span className="font-semibold uppercase tracking-wider text-slate-400 font-mono">Share This AI Creation</span>
        <span className="font-mono">"Found a cool AI prompt? Share it with friends and inspire creations."</span>
      </div>
    </div>
  );
}
