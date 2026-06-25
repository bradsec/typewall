// Persistent store for user-uploaded fonts.
//
// Font bytes are kept in IndexedDB (localStorage is too small for binary font
// data and only holds strings). On startup loadAll() rehydrates each font:
// it re-registers a blob URL in the session asset registry and exposes the
// fonts to the FontPicker. Persisted fonts survive reloads until the user
// clears the site's browser data.

import { create } from 'zustand'
import type { AssetRef } from '../engine/types'
import { uploadId, registerUploadedBlob } from './assets'

export interface UploadedFontEntry {
  id: string
  name: string
  url: string
  kind: 'uploaded'
}

interface FontRecord {
  id: string
  name: string
  blob: Blob
}

const DB_NAME = 'imagegen-uploads'
const STORE = 'fonts'
const VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(record: FontRecord): Promise<void> {
  return openDb().then(db => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  }))
}

function idbGetAll(): Promise<FontRecord[]> {
  return openDb().then(db => new Promise<FontRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const rq = tx.objectStore(STORE).getAll()
    rq.onsuccess = () => resolve(rq.result as FontRecord[])
    rq.onerror = () => reject(rq.error)
  }))
}

function idbDelete(id: string): Promise<void> {
  return openDb().then(db => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  }))
}

interface UploadedFontsState {
  fonts: UploadedFontEntry[]
  loaded: boolean
  loadAll: () => Promise<void>
  addFromFile: (file: File) => Promise<AssetRef>
  remove: (id: string) => Promise<void>
}

export const useUploadedFonts = create<UploadedFontsState>((set, get) => ({
  fonts: [],
  loaded: false,
  loadAll: async () => {
    if (get().loaded) return
    try {
      const records = await idbGetAll()
      const fonts = records.map((r) => ({
        id: r.id,
        name: r.name,
        url: registerUploadedBlob(r.id, r.name, r.blob),
        kind: 'uploaded' as const,
      }))
      set({ fonts, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },
  addFromFile: async (file) => {
    const id = uploadId(file, 'uploaded/fonts')
    const url = registerUploadedBlob(id, file.name, file)
    await idbPut({ id, name: file.name, blob: file })
    set((state) => ({
      fonts: state.fonts.some((f) => f.id === id)
        ? state.fonts
        : [...state.fonts, { id, name: file.name, url, kind: 'uploaded' as const }],
    }))
    return { id, kind: 'uploaded' }
  },
  remove: async (id) => {
    await idbDelete(id)
    set((state) => ({ fonts: state.fonts.filter((f) => f.id !== id) }))
  },
}))
