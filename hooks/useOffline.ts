import { useState, useEffect, useCallback, useRef } from 'react'
import * as Network from 'expo-network'
import { syncPendingActions } from '../services/offlineService'

export function useOffline() {
  const [isOnline, setIsOnline] = useState(true)
  const [isChecking, setIsChecking] = useState(true)
  const prevOnline = useRef(true)

  const checkNetwork = useCallback(async () => {
    try {
      const state = await Network.getNetworkStateAsync()
      const online = !!(state.isConnected && state.isInternetReachable)
      setIsOnline(online)

      // Came back online — flush pending actions
      if (online && !prevOnline.current) {
        syncPendingActions()
      }
      prevOnline.current = online
    } catch {
      setIsOnline(true)
    } finally {
      setIsChecking(false)
    }
  }, [])

  useEffect(() => {
    checkNetwork()
    const interval = setInterval(checkNetwork, 5000)
    return () => clearInterval(interval)
  }, [checkNetwork])

  return { isOnline, isChecking, checkNetwork }
}