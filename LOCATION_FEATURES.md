# 📍 Location-Based Exploration Features

## Overview
ExploreEase now supports real-time location tracking and location-based discovery with GPS integration, distance calculations, and intelligent place recommendations.

## 🎯 Features Implemented

### 1. GPS Integration (`services/locationService.ts`)
- **Real-time location tracking** - Monitor user position updates
- **One-shot location fetch** - Get current position instantly
- **Permission handling** - Proper Android 12+ FINE_LOCATION support
- **Reverse geocoding** - Convert coordinates to addresses
- **Forward geocoding** - Convert addresses to coordinates

**Key Methods:**
```typescript
// Get current location
const location = await locationService.getCurrentLocation()

// Watch location changes
await locationService.watchLocation((location) => {
  console.log(location.latitude, location.longitude)
})

// Get address from coordinates
const address = await locationService.getAddressFromCoordinates(lat, lng)

// Get coordinates from address
const coords = await locationService.getCoordinatesFromAddress('Saigon')
```

### 2. Distance Calculations (`utils/distance.ts`)
- **Haversine formula** - Accurate distance calculation using spherical geometry
- **Distance formatting** - Human-readable output (e.g., "2.3km", "500m")
- **Sorting by distance** - Automatically rank places by proximity
- **Radius filtering** - Find places within specified radius

**Key Functions:**
```typescript
// Calculate distance
const distKm = calculateDistance(from, to)

// Format for display
const text = formatDistance(2.345) // "2.3km"

// Sort places by distance
const sorted = sortByDistance(places, userLocation)

// Filter by radius
const nearby = filterByRadius(places, userLocation, 5) // Within 5km
```

### 3. Custom Hook (`hooks/useLocation.ts`)
React Hook for easy location integration in components.

**Usage:**
```typescript
const {
  location,        // Current location with accuracy
  loading,         // Loading state
  error,           // Error message
  permissionGranted, // Permission status
  requestPermission, // Request access
  startTracking,   // Start watching location
  stopTracking,    // Stop watching location
  getAddressFromCoordinates,
  getCoordinatesFromAddress,
} = useLocation()
```

### 4. Enhanced Map Screen (`app/(tabs)/map.tsx`)

#### Features:
- **User location marker** - Blue dot showing current position
- **Accuracy circle** - Visual representation of GPS accuracy
- **Distance display** - Show distance from user to each place
- **Manual location input** - Search by address for trip planning
- **Nearby category filtering** - Browse by type (Food, Culture, etc.)
- **Place details** - Tap markers to see name, rating, distance
- **Directions button** - Open Google Maps navigation
- **Location status** - Display accuracy in meters

#### UI Components:
1. **Search Bar** - Find places on map
2. **Current Location Button** - Activate GPS tracking
3. **Manual Input Box** - Enter address to plan route
4. **Location Status** - Shows GPS accuracy
5. **Bottom Sheet** - Place details card
6. **Category Chips** - Filter by category
7. **Distance Badge** - Show proximity to places

## 🔐 Permissions

### Android (`app.json`)
```json
{
  "permissions": [
    "ACCESS_FINE_LOCATION",      // Precise location
    "ACCESS_COARSE_LOCATION",    // Approximate location
    "ACCESS_BACKGROUND_LOCATION" // Background tracking
  ]
}
```

### iOS (`app.json`)
```json
{
  "infoPlist": {
    "NSLocationWhenInUseUsageDescription": "ExploreEase cần vị trí để tìm địa điểm gần bạn",
    "NSLocationAlwaysUsageDescription": "ExploreEase cần vị trí để gợi ý địa điểm"
  }
}
```

## 📱 Usage Examples

### Basic Location Tracking
```typescript
import { useLocation } from '../../hooks/useLocation'

function MyScreen() {
  const { location, requestPermission, startTracking } = useLocation()

  const handleGetLocation = async () => {
    const granted = await requestPermission()
    if (granted) {
      await startTracking()
    }
  }

  return (
    <TouchableOpacity onPress={handleGetLocation}>
      <Text>Get My Location</Text>
    </TouchableOpacity>
  )
}
```

### Distance Calculation
```typescript
import { calculateDistance, formatDistance } from '../../utils/distance'

const distance = calculateDistance(
  { latitude: 10.8231, longitude: 106.6297 },
  { latitude: 10.7538, longitude: 106.4109 }
)

console.log(formatDistance(distance)) // "25.4km"
```

### Find Nearby Places
```typescript
import { sortByDistance, filterByRadius } from '../../utils/distance'

// Sort places by distance
const nearby = sortByDistance(places, userLocation)

// Get places within 5km
const withinRadius = filterByRadius(places, userLocation, 5)
```

## 🗺️ Map Integration

### Leaflet (Web)
- Used for web mapping (OpenStreetMap tiles)
- User location marker with accuracy circle
- Place markers with popups
- Smooth zoom and pan

### React Native Maps (Mobile)
- Ready for native implementation
- Supports both iOS and Android
- Custom markers and clustering

## 🔄 Real-Time Updates

The location service uses a subscription-based approach for efficient real-time tracking:

```typescript
// Start watching with 10m minimum distance change
await locationService.watchLocation(
  (location) => {
    updateUI(location)
  },
  {
    accuracy: Location.Accuracy.High,
    distanceInterval: 10, // Update only if moved 10m+
  }
)

// Stop when done
locationService.stopWatchingLocation()
```

## ⚠️ Error Handling

All location operations include proper error handling:

```typescript
try {
  const location = await locationService.getCurrentLocation()
  if (!location) {
    // Permission denied or location unavailable
  }
} catch (error) {
  console.error('Location error:', error)
}
```

## 📊 Accuracy & Battery

The implementation balances accuracy and battery life:
- **High accuracy mode** - For map display and navigation
- **10m minimum distance** - Reduces updates and battery drain
- **5-second interval** - Prevents rapid-fire updates
- **Watch subscription** - Efficient native implementation

## 🔍 Geocoding Services

The app uses Expo's built-in geocoding (provided by system services):
- **No API key required** - Uses device's location services
- **Offline capable** - Cached results work offline
- **Fast** - Native implementation

## 🚀 Future Enhancements

1. **Geofencing** - Notify when entering/leaving areas
2. **Route optimization** - Sort multiple destinations efficiently
3. **Place suggestions** - Based on user history and preferences
4. **Offline maps** - Download maps for offline use
5. **Real-time traffic** - Integrate with mapping API
6. **POI clustering** - Better performance with many markers

## 📝 Notes

- Location tracking requires user permission
- Background location access requires explicit permission
- Accuracy depends on device GPS and network availability
- Reverse geocoding may fail in areas without mapping data
- Distance calculations are approximate (~0.1% error)

---

**Last Updated**: April 20, 2026
**Version**: 1.0.0
