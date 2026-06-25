import { create } from 'zustand'

// Coordinates the "pick a color from the canvas" flow between any ColorField
// and the preview. A ColorField calls begin() with its setter; the preview
// samples the clicked pixel and calls sample(), which forwards the hex to that
// setter and clears the pending pick. Not persisted (holds a live callback).
interface EyedropperState {
  pick: ((hex: string) => void) | null
  begin: (cb: (hex: string) => void) => void
  cancel: () => void
  sample: (hex: string) => void
}

export const useEyedropper = create<EyedropperState>((set, get) => ({
  pick: null,
  begin: (cb) => set({ pick: cb }),
  cancel: () => set({ pick: null }),
  sample: (hex) => {
    const cb = get().pick
    set({ pick: null })
    if (cb) cb(hex)
  },
}))
