import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  title: string
  body: string
  type: ToastType
}

interface ToastState {
  toasts: Toast[]
  show: (title: string, body: string, type?: ToastType) => void
  hide: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  show: (title, body, type = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    set(s => ({ toasts: [...s.toasts.slice(-2), { id, title, body, type }] }))
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
    }, 4500)
  },

  hide: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))
