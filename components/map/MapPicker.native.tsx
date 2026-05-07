import { View, StyleSheet } from 'react-native'
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps'

interface MapPickerProps {
  mapRegion: {
    latitude: number
    longitude: number
    latitudeDelta: number
    longitudeDelta: number
  }
  onRegionChange: (region: any) => void
  onPress: (event: any) => void
  coords: { lat: number; lng: number } | null
  description?: string
  title?: string
}

export default function MapPicker({
  mapRegion,
  onRegionChange,
  onPress,
  coords,
  title,
  description,
}: MapPickerProps) {
  return (
    <View style={s.container}>
      <MapView
        style={s.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={mapRegion}
        region={mapRegion}
        onRegionChangeComplete={onRegionChange}
        onPress={onPress}
        showsUserLocation
        showsMyLocationButton
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />
        {coords && (
          <Marker
            coordinate={{ latitude: coords.lat, longitude: coords.lng }}
            title={title ?? 'Vị trí sự kiện'}
            description={description ?? 'Địa điểm đã chọn'}
          />
        )}
      </MapView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: 360 },
})