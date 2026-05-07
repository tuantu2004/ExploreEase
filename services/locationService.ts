import * as Location from 'expo-location'
import { Platform } from 'react-native'

export interface Coordinates {
  latitude: number
  longitude: number
}

export interface LocationData extends Coordinates {
  accuracy: number
  timestamp: number
}

class LocationService {
  private watchSubscription: any = null

  /**
   * Yêu cầu quyền truy cập vị trí
   * Hỗ trợ Android 12+ với FINE_LOCATION
   */
  async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      
      if (Platform.OS === 'android' && Platform.Version! >= 12) {
        // Android 12+ cần FINE_LOCATION
        const { status: backgroundStatus } = 
          await Location.requestBackgroundPermissionsAsync()
        return status === 'granted' && backgroundStatus === 'granted'
      }
      
      return status === 'granted'
    } catch (error) {
      console.error('Location permission error:', error)
      return false
    }
  }

  /**
   * Kiểm tra quyền truy cập vị trí hiện tại
   */
  async checkPermission(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync()
      return status === 'granted'
    } catch (error) {
      console.error('Check location permission error:', error)
      return false
    }
  }

  /**
   * Lấy vị trí hiện tại (one-shot)
   */
  async getCurrentLocation(): Promise<LocationData | null> {
    try {
      const hasPermission = await this.checkPermission()
      if (!hasPermission) {
        const granted = await this.requestPermission()
        if (!granted) return null
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      })

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        timestamp: location.timestamp,
      }
    } catch (error) {
      console.error('Get current location error:', error)
      return null
    }
  }

  /**
   * Theo dõi vị trí thời gian thực (subscription)
   * Callback được gọi mỗi khi vị trí thay đổi
   */
  async watchLocation(
    onLocationChange: (location: LocationData) => void,
    options?: { accuracy?: Location.Accuracy; distanceInterval?: number }
  ): Promise<boolean> {
    try {
      const hasPermission = await this.checkPermission()
      if (!hasPermission) {
        const granted = await this.requestPermission()
        if (!granted) return false
      }

      this.watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: options?.accuracy ?? Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: options?.distanceInterval ?? 10,
        },
        (location) => {
          onLocationChange({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || 0,
            timestamp: location.timestamp,
          })
        }
      )

      return true
    } catch (error) {
      console.error('Watch location error:', error)
      return false
    }
  }

  /**
   * Dừng theo dõi vị trí
   */
  stopWatchingLocation(): void {
    if (this.watchSubscription) {
      this.watchSubscription.remove()
      this.watchSubscription = null
    }
  }

  /**
   * Reverse geocoding: tọa độ → địa chỉ
   */
  async getAddressFromCoordinates(
    latitude: number,
    longitude: number
  ): Promise<string | null> {
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      })

      if (results.length > 0) {
        const address = results[0]
        return [
          address.name,
          address.street,
          address.district,
          address.city,
        ]
          .filter(Boolean)
          .join(', ')
      }

      return null
    } catch (error) {
      console.error('Reverse geocoding error:', error)
      return null
    }
  }

  /**
   * Forward geocoding: địa chỉ → tọa độ
   */
  async getCoordinatesFromAddress(
    address: string
  ): Promise<Coordinates | null> {
    try {
      const results = await Location.geocodeAsync(address)

      if (results.length > 0) {
        const location = results[0]
        return {
          latitude: location.latitude,
          longitude: location.longitude,
        }
      }

      return null
    } catch (error) {
      console.error('Forward geocoding error:', error)
      return null
    }
  }
}

export const locationService = new LocationService()
