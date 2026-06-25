import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  RenderConfig,
  TextConfig,
  BackgroundConfig,
  OverlayConfig,
  WatermarkConfig,
  ShadowConfig,
  OutlineConfig,
  SprayPaintConfig,
} from '../engine/types'
import { defaultConfig } from '../engine/types'
import type { Locks } from '../shuffle/shuffle'

const DEFAULT_LOCKS: Locks = {
  layout: false,
  fonts: false,
  scale: false,
  effects: false,
  color: false,
}

interface StoreState {
  config: RenderConfig
  locks: Locks
  activeVibe: string
  // Average color of the current background image, keyed by its asset id so
  // shuffle can verify it still matches before using it for contrast. Computed
  // on the main thread by PreviewCanvas, which holds the decoded bitmap.
  bgAvgColor: { id: string; color: string } | null
  setBgAvgColor: (v: { id: string; color: string } | null) => void
  setActiveVibe: (id: string) => void
  setConfig: (config: RenderConfig) => void
  patchConfig: (partial: Partial<RenderConfig>) => void
  // Section-scoped setters that deep-merge each sub-object, preserving sibling fields.
  patchText: (partial: Partial<TextConfig>) => void
  patchBackground: (partial: Partial<BackgroundConfig>) => void
  patchOverlay: (partial: Partial<OverlayConfig>) => void
  patchWatermark: (partial: Partial<WatermarkConfig>) => void
  patchShadow: (partial: Partial<ShadowConfig>) => void
  patchOutline: (partial: Partial<OutlineConfig>) => void
  patchSprayPaint: (partial: Partial<SprayPaintConfig>) => void
  setMeme: (enabled: boolean) => void
  setLocks: (locks: Locks) => void
  reroll: (seed: number) => void
  reset: () => void
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      config: defaultConfig(),
      locks: DEFAULT_LOCKS,
      activeVibe: 'none',
      bgAvgColor: null,
      setBgAvgColor: (v) => set({ bgAvgColor: v }),
      setActiveVibe: (id) => set({ activeVibe: id }),
      setConfig: (config) => set({ config }),
      patchConfig: (partial) =>
        set((state) => ({ config: { ...state.config, ...partial } })),
      patchText: (partial) =>
        set((state) => ({
          config: { ...state.config, text: { ...state.config.text, ...partial } },
        })),
      patchBackground: (partial) =>
        set((state) => ({
          config: { ...state.config, background: { ...state.config.background, ...partial } },
        })),
      patchOverlay: (partial) =>
        set((state) => ({
          config: { ...state.config, overlay: { ...state.config.overlay, ...partial } },
        })),
      patchWatermark: (partial) =>
        set((state) => ({
          config: { ...state.config, watermark: { ...state.config.watermark, ...partial } },
        })),
      patchShadow: (partial) =>
        set((state) => ({
          config: {
            ...state.config,
            text: {
              ...state.config.text,
              shadow: { ...state.config.text.shadow, ...partial },
            },
          },
        })),
      patchOutline: (partial) =>
        set((state) => ({
          config: {
            ...state.config,
            text: {
              ...state.config.text,
              outline: { ...state.config.text.outline, ...partial },
            },
          },
        })),
      patchSprayPaint: (partial) =>
        set((state) => ({
          config: {
            ...state.config,
            text: {
              ...state.config.text,
              sprayPaint: { ...state.config.text.sprayPaint, ...partial },
            },
          },
        })),
      setMeme: (enabled) =>
        set((state) => {
          const text = state.config.text
          const prev = text.meme ?? { style: 'overlay' as const, topText: '', bottomText: '', captionScale: 1 }
          const meme = { ...prev, enabled }
          if (!enabled) {
            return { config: { ...state.config, text: { ...text, meme } } }
          }
          // Seed sample captions on first enable so the canvas shows a meme
          // immediately; leave any captions the user already typed untouched.
          if (!meme.topText && !meme.bottomText) {
            meme.topText = 'Hello my name is'
            meme.bottomText = 'TypeWall'
          }
          return {
            config: {
              ...state.config,
              fontRef: { id: 'fonts/Anton.ttf', kind: 'bundled' as const },
              text: {
                ...text,
                color: '#ffffff',
                alignment: 'center' as const,
                lineSpacingPct: 0.035,
                // Meme captions sit closer to the edges than normal text.
                paddingPctHeight: 0.06,
                outline: { ...text.outline, enabled: true, color: '#000000', ratio: 0.05 },
                meme,
              },
            },
          }
        }),
      setLocks: (locks) => set({ locks }),
      reroll: (seed) =>
        set((state) => ({ config: { ...state.config, seed } })),
      reset: () => set({ config: defaultConfig(), locks: DEFAULT_LOCKS, activeVibe: 'none', bgAvgColor: null }),
    }),
    {
      name: 'imagegen',
      // Backfill config keys added after a user's state was persisted. A
      // shallow merge of the stored config over the current defaults ensures
      // new top-level fields (e.g. `border`) are never undefined, which would
      // otherwise crash the UI on load from a stale localStorage entry.
      merge: (persisted, current) => {
        const p = persisted as Partial<StoreState> | undefined
        if (!p || typeof p !== 'object') return current
        return {
          ...current,
          ...p,
          config: { ...current.config, ...(p.config ?? {}) },
          locks: { ...current.locks, ...(p.locks ?? {}) },
          // Vibe is a per-session choice, not persisted: always start at 'none'
          // so a previously selected vibe does not silently bias the next visit.
          activeVibe: 'none',
          // Derived from the decoded background bitmap; recomputed on load.
          bgAvgColor: null,
        }
      },
    },
  ),
)
