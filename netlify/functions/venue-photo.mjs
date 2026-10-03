// GET /api/venue-photo/:city/:venue → foto del local sacada de Google Maps (Places API New)
//
// Google no deja guardar el "name" de una foto, pero sí el place_id. Así que:
//   1. place_id del local: se busca una vez con Text Search y se guarda en vplace/{city}/{venue}
//   2. Place Details → primera foto + autoría (la autoría se guarda para mostrarla en la app)
//   3. Se devuelve la imagen y la CDN de Netlify la cachea 1 día
// Sin GOOGLE_MAPS_API_KEY la app pinta portadas generadas y no llama aquí.
import { CITIES, venueById } from '../../src/lib/cities.js'
import { read, update } from '../lib/db.mjs'

const AREAS = {
  'platja-daro': { town: "Platja d'Aro", center: { latitude: 41.8175, longitude: 3.067 }, radius: 4000 },
  girona: { town: 'Girona', center: { latitude: 41.9794, longitude: 2.8214 }, radius: 6000 },
  barcelona: { town: 'Barcelona', center: { latitude: 41.3874, longitude: 2.1686 }, radius: 12000 },
}
const TYPE_WORD = { club: 'discoteca', pub: 'pub', bar: 'bar' }
const API = 'https://places.googleapis.com/v1'

export default async (req, context) => {
  const key = process.env.GOOGLE_MAPS_API_KEY
  const { city, venue: venueId } = context.params
  const venue = CITIES[city] && venueById(city, venueId)
  if (!key || !venue || venue.type === 'home') return notFound()

  try {
    const placeId = await findPlace(key, city, venue)
    if (!placeId) return notFound()

    const details = await fetch(`${API}/places/${placeId}`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'photos' },
    }).then(r => r.json())
    const photo = details.photos?.[0]
    if (!photo) return notFound()

    const by = (photo.authorAttributions || []).map(a => a.displayName).filter(Boolean).join(', ')
    await update(`vplace/${city}`, doc => {
      doc ||= {}
      if (doc[venue.id]?.by === by) return undefined
      doc[venue.id] = { ...doc[venue.id], id: placeId, by }
      return doc
    })

    const img = await fetch(`${API}/${photo.name}/media?maxWidthPx=900&key=${key}`)
    if (!img.ok) return notFound()
    return new Response(img.body, {
      headers: {
        'content-type': img.headers.get('content-type') || 'image/jpeg',
        'cache-control': 'public, max-age=86400',
        'netlify-cdn-cache-control': 'public, s-maxage=86400, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    console.error('venue photo failed', city, venueId, err)
    return notFound()
  }
}

async function findPlace(key, city, venue) {
  const cached = (await read(`vplace/${city}`))?.[venue.id]
  if (cached?.id) return cached.id
  if (cached?.none && Date.now() - cached.at < 7 * 86400000) return null // no encontrado hace poco

  const area = AREAS[city]
  const town = venue.area === 'Salt' ? 'Salt' : area.town
  const res = await fetch(`${API}/places:searchText`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id' },
    body: JSON.stringify({
      textQuery: `${venue.name} ${TYPE_WORD[venue.type] || ''} ${town}`,
      languageCode: 'es',
      pageSize: 1,
      locationBias: { circle: { center: area.center, radius: area.radius } },
    }),
  }).then(r => r.json())
  const id = res.places?.[0]?.id || null
  await update(`vplace/${city}`, doc => ({ ...(doc || {}), [venue.id]: id ? { id } : { none: true, at: Date.now() } }))
  return id
}

// 400 y no 404: un 404 hace que Netlify reintente la función con otras rutas
const notFound = () => new Response('no photo', { status: 400, headers: { 'cache-control': 'public, max-age=3600' } })

export const config = { path: '/api/venue-photo/:city/:venue' }
