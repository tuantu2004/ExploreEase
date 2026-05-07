export async function searchPlaces(query: string) {
  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(query)}&` +
    `format=json&` +
    `countrycodes=vn&` +
    `limit=10`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'AppExploreEase/1.0' },
  })

  const data = await res.json()
  return data.map((item: any) => ({
    id: item.place_id,
    name: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
  }))
}

export async function getDirections(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${fromLng},${fromLat};${toLng},${toLat}` +
    `?overview=full&geometries=geojson`

  const res = await fetch(url)
  const data = await res.json()
  return data.routes[0]
}