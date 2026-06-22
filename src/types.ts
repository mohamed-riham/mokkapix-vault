export interface Prompt {
  id: string;
  title: string;
  slug: string;
  image_url: string;
  prompt_text: string;
  ai_model: string;
  category: string;
  tags: string[];
  views: number;
  copy_count: number;
  featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface WatermarkSettings {
  enabled: boolean;
  text: string;
}

export interface AdminStats {
  totalImages: number;
  totalPrompts: number;
  totalViews: number;
  totalCopyCount: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
