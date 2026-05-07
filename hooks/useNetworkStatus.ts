import { useEffect, useRef, useState } from 'react'
import { isOnline, syncPendingActions } from '../services/offlineService'

export function useNetworkStatus() {
  const [online, setOnline] = useState(true)
  const prevOnline = useRef(true)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const now = await isOnline()
      if (cancelled) return
      setOnline(now)

      // Came back online — sync queued actions
      if (now && !prevOnline.current) {
        syncPendingActions()
      }
      prevOnline.current = now
    }

    check()
    const interval = setInterval(check, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return online
}
