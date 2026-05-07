import * as Network from 'expo-network'
import { storage } from './storage'
import { supabase } from './supabase'
import { removeCache, CACHE_KEYS } from './cacheService'

const PENDING_KEY = 'offline_pending_actions'

export interface PendingAction {
  id: string
  type: 'bookmark' | 'unbookmark' | 'join_event' | 'leave_event'
  payload: Record<string, any>
  createdAt: number
}

export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync()
    return !!(state.isConnected && state.isInternetReachable)
  } catch {
    return true // assume online if check fails
  }
}

export async function getPendingActions(): Promise<PendingAction[]> {
  try {
    const raw = await storage.getItem(PENDING_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export async function addPendingAction(
  type: PendingAction['type'],
  payload: Record<string, any>
): Promise<void> {
  const actions = await getPendingActions()
  const action: PendingAction = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type,
    payload,
    createdAt: Date.now(),
  }
  await storage.setItem(PENDING_KEY, JSON.stringify([...actions, action]))
}

async function removePendingAction(id: string): Promise<void> {
  const actions = await getPendingActions()
  await storage.setItem(PENDING_KEY, JSON.stringify(actions.filter(a => a.id !== id)))
}

export async function syncPendingActions(): Promise<void> {
  const online = await isOnline()
  if (!online) return

  const actions = await getPendingActions()
  if (actions.length === 0) return

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'bookmark':
          await supabase.from('bookmarks').insert(action.payload).select().single()
          break
        case 'unbookmark':
          await supabase.from('bookmarks')
            .delete()
            .eq('user_id', action.payload.user_id)
            .eq('target_id', action.payload.target_id)
          break
        case 'join_event':
          await supabase.from('event_attendees').insert(action.payload)
          break
        case 'leave_event':
          await supabase.from('event_attendees')
            .delete()
            .eq('event_id', action.payload.event_id)
            .eq('user_id', action.payload.user_id)
          break
      }
      await removePendingAction(action.id)
    } catch {
      // leave in queue to retry next time
    }
  }

  // Invalidate bookmarks cache so next load fetches fresh data
  await removeCache(CACHE_KEYS.BOOKMARKS)
}
