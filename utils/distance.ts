import { Coordinates } from '../services/locationService'

/**
 * Tính khoảng cách giữa hai điểm dùng Haversine formula
 * Trả về khoảng cách theo km
 */
export function calculateDistance(
  from: Coordinates,
  to: Coordinates
): number {
  const R = 6371 // Bán kính Trái Đất (km)
  
  const dLat = toRad(to.latitude - from.latitude)
  const dLng = toRad(to.longitude - from.longitude)
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Chuyển độ sang radian
 */
function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Format khoảng cách để hiển thị
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`
  }
  return `${distanceKm.toFixed(1)}km`
}

/**
 * Sắp xếp địa điểm theo khoảng cách từ vị trí hiện tại
 * Hỗ trợ cả { latitude, longitude } và { lat, lng }
 */
export function sortByDistance<T extends Record<string, any>>(
  places: T[],
  userLocation: Coordinates
): T[] {
  return [...places].sort((a, b) => {
    const coordsA = {
      latitude: a.latitude ?? a.lat ?? 0,
      longitude: a.longitude ?? a.lng ?? 0,
    }
    const coordsB = {
      latitude: b.latitude ?? b.lat ?? 0,
      longitude: b.longitude ?? b.lng ?? 0,
    }
    
    const distA = calculateDistance(userLocation, coordsA)
    const distB = calculateDistance(userLocation, coordsB)
    return distA - distB
  })
}

/**
 * Lọc địa điểm trong bán kính nhất định (km)
 * Hỗ trợ cả { latitude, longitude } và { lat, lng }
 */
export function filterByRadius<T extends Record<string, any>>(
  places: T[],
  userLocation: Coordinates,
  radiusKm: number
): T[] {
  return places.filter((place) => {
    const coords = {
      latitude: place.latitude ?? place.lat ?? 0,
      longitude: place.longitude ?? place.lng ?? 0,
    }
    const distance = calculateDistance(userLocation, coords)
    return distance <= radiusKm
  })
}

/**
 * Tạo URL Google Maps dẫn đường
 */
export function getGoogleMapsDirectionsUrl(
  from: Coordinates,
  to: Coordinates
): string {
  return `https://www.google.com/maps/dir/${from.latitude},${from.longitude}/${to.latitude},${to.longitude}`
}

/**
 * Tạo URL Google Maps xem bản đồ
 */
export function getGoogleMapsUrl(location: Coordinates): string {
  return `https://maps.google.com/?q=${location.latitude},${location.longitude}`
}
