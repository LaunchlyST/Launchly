import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ModelType = 'chatgpt' | 'grok';
export type GenerationType = 'image' | 'video';
export type StyleType = 'realistic' | 'cartoon';

export interface GenerationResult {
  type: GenerationType;
  url: string;
  model: ModelType;
  prompt: string;
  timestamp: number;
}

export interface GenerationUsage {
  image: number;
  video: number;
}

interface AppStore {
  openaiKey: string;
  grokKey: string;
  setOpenaiKey: (key: string) => void;
  setGrokKey: (key: string) => void;
  clearKeys: () => void;

  selectedModel: ModelType;
  selectedType: GenerationType;
  selectedStyle: StyleType;
  prompt: string;
  isGenerating: boolean;
  result: GenerationResult | null;
  error: string | null;
  videoJobId: string | null;
  videoStatus: string | null;
  generationUsage: GenerationUsage;

  setSelectedModel: (m: ModelType) => void;
  setSelectedType: (t: GenerationType) => void;
  setSelectedStyle: (s: StyleType) => void;
  setPrompt: (p: string) => void;
  setIsGenerating: (v: boolean) => void;
  setResult: (r: GenerationResult | null) => void;
  setError: (e: string | null) => void;
  setVideoJobId: (id: string | null) => void;
  setVideoStatus: (status: string | null) => void;
  incrementGenerationUsage: (type: GenerationType) => void;
  resetUserState: () => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      openaiKey: '',
      grokKey: '',
      setOpenaiKey: (key) => set({ openaiKey: key }),
      setGrokKey: (key) => set({ grokKey: key }),
      clearKeys: () => set({ openaiKey: '', grokKey: '' }),

      selectedModel: 'chatgpt',
      selectedType: 'image',
      selectedStyle: 'realistic',
      prompt: '',
      isGenerating: false,
      result: null,
      error: null,
      videoJobId: null,
      videoStatus: null,
      generationUsage: { image: 0, video: 0 },

      setSelectedModel: (m) =>
        set({ selectedModel: m, selectedType: m === 'chatgpt' ? 'image' : 'video' }),
      setSelectedType: (t) => set({ selectedType: t }),
      setSelectedStyle: (s) => set({ selectedStyle: s }),
      setPrompt: (p) => set({ prompt: p }),
      setIsGenerating: (v) => set({ isGenerating: v }),
      setResult: (r) => set({ result: r }),
      setError: (e) => set({ error: e }),
      setVideoJobId: (id) => set({ videoJobId: id }),
      setVideoStatus: (status) => set({ videoStatus: status }),
      incrementGenerationUsage: (type) =>
        set((state) => ({
          generationUsage: {
            ...state.generationUsage,
            [type]: state.generationUsage[type] + 1,
          },
        })),
      resetUserState: () =>
        set({
          openaiKey: '',
          grokKey: '',
          selectedModel: 'chatgpt',
          selectedType: 'image',
          selectedStyle: 'realistic',
          prompt: '',
          isGenerating: false,
          result: null,
          error: null,
          videoJobId: null,
          videoStatus: null,
          generationUsage: { image: 0, video: 0 },
        }),
    }),
    { name: 'tiktok-shop-creator-v2' }
  )
);
