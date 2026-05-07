import { View, StyleSheet } from 'react-native'
import MapView, { Marker, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps'
import { useEffect, useState } from 'react'
import { getPlaces, Place } from '../../services/placeService'

export default function AppMapNative() {
  const [places, setPlaces] = useState<Place[]>([])

  useEffect(() => {
    getPlaces({ limit: 20 }).then(setPlaces)
  }, [])

  return (
    <View style={s.screen}>
      <MapView
        style={s.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: 10.8231,
          longitude: 106.6297,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />
        {places.map((place) =>
          place.lat && place.lng ? (
            <Marker
              key={place.id}
              coordinate={{ latitude: place.lat, longitude: place.lng }}
              title={place.name}
              description={`⭐ ${place.rating} · ${place.category}`}
            />
          ) : null
        )}
      </MapView>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  map: { flex: 1 },
})