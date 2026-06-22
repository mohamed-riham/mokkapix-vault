import fs from 'fs';
import path from 'path';
import { Prompt, WatermarkSettings } from '../types';

const DB_DIR = path.join(process.cwd(), 'db_data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Interface for actual database structure
export interface Schema {
  prompts: Prompt[];
  watermark: WatermarkSettings;
}

// Default initial state
const defaultDb: Schema = {
  prompts: [
    {
      id: "sample-1",
      title: "Cyberpunk Warrior",
      slug: "cyberpunk-warrior",
      image_url: "/images/cyberpunk_warrior.jpg",
      prompt_text: "A futuristic cyberpunk warrior standing in a neon city, cinematic lighting, ultra realistic, highly detailed armor, realistic photography, 8K",
      ai_model: "Flux Pro",
      category: "Fantasy",
      tags: ["cyberpunk", "warrior", "neon", "realistic", "8k"],
      views: 128,
      copy_count: 42,
      featured: true,
      created_at: new Date("2026-06-20T10:00:00.000Z").toISOString(),
      updated_at: new Date("2026-06-20T10:00:00.000Z").toISOString()
    },
    {
      id: "sample-2",
      title: "Luxury Car Advertisement",
      slug: "luxury-car-advertisement",
      image_url: "/images/luxury_sports_car.jpg",
      prompt_text: "A luxury sports car on a futuristic road, dramatic cinematic lighting, premium advertisement photography, ultra realistic details",
      ai_model: "Midjourney",
      category: "Product Photography",
      tags: ["car", "luxury", "advertisement", "cinematic"],
      views: 245,
      copy_count: 89,
      featured: true,
      created_at: new Date("2026-06-21T12:00:00.000Z").toISOString(),
      updated_at: new Date("2026-06-21T12:00:00.000Z").toISOString()
    }
  ],
  watermark: {
    enabled: true,
    text: "MokkaPix Vault"
  }
};

class Database {
  private data: Schema;

  constructor() {
    this.data = { prompts: [], watermark: { enabled: true, text: "MokkaPix Vault" } };
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(fileContent);
        // Guarantee structure
        if (!this.data.prompts) this.data.prompts = [];
        if (!this.data.watermark) this.data.watermark = { enabled: true, text: "MokkaPix Vault" };
      } else {
        this.data = defaultDb;
        this.save();
      }
    } catch (e) {
      console.error("Database initialization error, falling back to default memory state:", e);
      this.data = defaultDb;
    }
  }

  private save() {
    try {
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (e) {
      console.error("Database save failed:", e);
    }
  }

  // Get watermark settings
  public getWatermark(): WatermarkSettings {
    this.init(); // Refresh before returning
    return this.data.watermark;
  }

  // Update watermark settings
  public updateWatermark(settings: Partial<WatermarkSettings>): WatermarkSettings {
    this.init();
    this.data.watermark = { ...this.data.watermark, ...settings };
    this.save();
    return this.data.watermark;
  }

  // Get prompts
  public getPrompts(): Prompt[] {
    this.init();
    return this.data.prompts;
  }

  // Find prompt by ID or Slug
  public findPromptById(id: string): Prompt | undefined {
    this.init();
    return this.data.prompts.find(p => p.id === id);
  }

  public findPromptBySlug(slug: string): Prompt | undefined {
    this.init();
    return this.data.prompts.find(p => p.slug === slug);
  }

  // Create prompt
  public createPrompt(promptData: Omit<Prompt, 'id' | 'views' | 'copy_count' | 'created_at' | 'updated_at' | 'slug'>): Prompt {
    this.init();
    
    // Generate simple clean slug
    let rawSlug = promptData.title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-');
    
    // Ensure uniqueness of slug
    let slug = rawSlug;
    let count = 1;
    while (this.data.prompts.some(p => p.slug === slug)) {
      slug = `${rawSlug}-${count++}`;
    }

    const newPrompt: Prompt = {
      ...promptData,
      id: Math.random().toString(36).substring(2, 11),
      slug,
      views: 0,
      copy_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.data.prompts.unshift(newPrompt); // Add to beginning of sequence (newest first)
    this.save();
    return newPrompt;
  }

  // Update prompt
  public updatePrompt(id: string, promptData: Partial<Omit<Prompt, 'id' | 'created_at' | 'updated_at' | 'slug'>>): Prompt | undefined {
    this.init();
    const index = this.data.prompts.findIndex(p => p.id === id);
    if (index === -1) return undefined;

    const current = this.data.prompts[index];
    
    // Compute slug if title changes
    let slug = current.slug;
    if (promptData.title && promptData.title !== current.title) {
      let rawSlug = promptData.title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-');
      slug = rawSlug;
      let count = 1;
      while (this.data.prompts.some(p => p.slug === slug && p.id !== id)) {
        slug = `${rawSlug}-${count++}`;
      }
    }

    const updatedPrompt: Prompt = {
      ...current,
      ...promptData,
      slug,
      updated_at: new Date().toISOString()
    };

    this.data.prompts[index] = updatedPrompt;
    this.save();
    return updatedPrompt;
  }

  // Delete prompt
  public deletePrompt(id: string): boolean {
    this.init();
    const index = this.data.prompts.findIndex(p => p.id === id);
    if (index === -1) return false;

    // Optional: remove physical file if it was uploaded and inside /public/uploads/
    const prompt = this.data.prompts[index];
    if (prompt.image_url.startsWith('/uploads/')) {
      const filePath = path.join(process.cwd(), 'public', prompt.image_url);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error("Could not delete physical image file:", filePath, e);
        }
      }
    }

    this.data.prompts.splice(index, 1);
    this.save();
    return true;
  }

  // Record a view
  public incrementView(slugOrId: string): void {
    this.init();
    const prompt = this.data.prompts.find(p => p.id === slugOrId || p.slug === slugOrId);
    if (prompt) {
      prompt.views++;
      this.save();
    }
  }

  // Record a copy action
  public incrementCopy(id: string): void {
    this.init();
    const prompt = this.data.prompts.find(p => p.id === id);
    if (prompt) {
      prompt.copy_count++;
      this.save();
    }
  }
}

export const db = new Database();
