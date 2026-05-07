import { useState, useEffect, useCallback } from 'react'
import { locationService, LocationData, Coordinates } from '../services/locationService'

interface UseLocationReturn {
  location: LocationData | null
  loading: boolean
  error: string | null
  permissionGranted: boolean
  requestPermission: () => Promise<boolean>
  startTracking: () => Promise<void>
  stopTracking: () => void
  getAddressFromCoordinates: (lat: number, lng: number) => Promise<string | null>
  getCoordinatesFromAddress: (address: string) => Promise<Coordinates | null>
}

export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<LocationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [isTracking, setIsTracking] = useState(false)

  // Kiểm tra quyền khi mount
  useEffect(() => {
    const checkPermission = async () => {
      const granted = await locationService.checkPermission()
      setPermissionGranted(granted)
      
      // Nếu có quyền, lấy vị trí hiện tại
      if (granted) {
        const currentLoc = await locationService.getCurrentLocation()
        if (currentLoc) {
          setLocation(currentLoc)
        }
      }
    }
    
    checkPermission()

    // Cleanup khi unmount
    return () => {
      if (isTracking) {
        locationService.stopWatchingLocation()
      }
    }
  }, [isTracking])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    setError(null)
    
    try {
      const granted = await locationService.requestPermission()
      setPermissionGranted(granted)
      
      if (granted) {
        const currentLoc = await locationService.getCurrentLocation()
        if (currentLoc) {
          setLocation(currentLoc)
        }
      }
      
      return granted
    } catch (err: any) {
      const errorMsg = err.message || 'Lỗi yêu cầu quyền vị trí'
      setError(errorMsg)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const startTracking = useCallback(async () => {
    if (!permissionGranted) {
      const granted = await requestPermission()
      if (!granted) return
    }

    setLoading(true)
    setError(null)
    
    try {
      const success = await locationService.watchLocation((newLocation) => {
        setLocation(newLocation)
      })
      
      if (success) {
        setIsTracking(true)
      } else {
        setError('Không thể theo dõi vị trí')
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi theo dõi vị trí')
    } finally {
      setLoading(false)
    }
  }, [permissionGranted, requestPermission])

  const stopTracking = useCallback(() => {
    locationService.stopWatchingLocation()
    setIsTracking(false)
  }, [])

  const getAddressFromCoordinates = useCallback(
    async (lat: number, lng: number): Promise<string | null> => {
      try {
        return await locationService.getAddressFromCoordinates(lat, lng)
      } catch (err) {
        console.error('Geocoding error:', err)
        return null
      }
    },
    []
  )

  const getCoordinatesFromAddress = useCallback(
    async (address: string): Promise<Coordinates | null> => {
      try {
        return await locationService.getCoordinatesFromAddress(address)
      } catch (err) {
        console.error('Geocoding error:', err)
        return null
      }
    },
    []
  )

  return {
    location,
    loading,
    error,
    permissionGranted,
    requestPermission,
    startTracking,
    stopTracking,
    getAddressFromCoordinates,
    getCoordinatesFromAddress,
  }
}
