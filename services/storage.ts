import { Platform } from 'react-native'

const webStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try { return localStorage.getItem(key) } catch { return null }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try { localStorage.setItem(key, value) } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    try { localStorage.removeItem(key) } catch {}
  },
}

// AsyncStorage for native — no 2 KB size limit unlike SecureStore
let _asyncStorage: typeof import('@react-native-async-storage/async-storage').default | null = null
const getAsyncStorage = async () => {
  if (!_asyncStorage) {
    const mod = await import('@react-native-async-storage/async-storage')
    _asyncStorage = mod.default
  }
  return _asyncStorage
}

const nativeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const s = await getAsyncStorage()
    return s.getItem(key)
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const s = await getAsyncStorage()
    await s.setItem(key, value)
  },
  removeItem: async (key: string): Promise<void> => {
    const s = await getAsyncStorage()
    await s.removeItem(key)
  },
}

export const storage = Platform.OS === 'web' ? webStorage : nativeStorage
