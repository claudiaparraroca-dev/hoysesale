// GET    /api/night?city=        → locales con contador, amigos y nombres públicos de esta noche
// POST   /api/going { city, venue, vis }   vis: 'public' | 'friends' | 'anon'
// DELETE /api/going?city=
//
// Privacidad:
//   - El contador cuenta a todo el mundo.
//   - Tus amigos te ven si vis es 'friends' o 'public'.
//   - Desconocidos solo te ven si vis es 'public' y tu perfil es público.
import { CITIES, HOME } from '../../src/lib/cities.js'
import { nightKey, nightLabel } from '../../src/lib/night.js'
import { auth, body, json } from '../lib/http.mjs'
import { update } from '../lib/db.mjs'
import { goingDoc, validCity, cards } from '../lib/game.mjs'

const NAMES_PER_VENUE = 30
const VIS = ['public', 'friends', 'anon']

export default async (req) => {
  const user = await auth(req)
  if (!user) return json({ error: 'auth' }, 401)
  const url = new URL(req.url)
  if (url.pathname === '/api/night' && req.method === 'GET') return night(user, url)
  if (url.pathname === '/api/going' && req.method === 'POST') return going(user, req)
  if (url.pathname === '/api/going' && req.method === 'DELETE') return notGoing(user, url)
  return json({ error: 'not-found' }, 400)
}

async function night(user, url) {
  const city = validCity(url.searchParams.get('city'))
  if (!city) return json({ error: 'city' }, 400)
  const night = nightKey()
  const doc = await goingDoc(city, night)
  const friends = new Set(user.friends)

  const venues = {}
  const visibleIds = []
  for (const [uid, g] of Object.entries(doc.u)) {
    const v = (venues[g.v] ||= { count: 0, friends: [], public: [] })
    v.count++
    if (uid === user.id) continue
    if (friends.has(uid) && g.vis !== 'anon') { v.friends.push(uid); visibleIds.push(uid) }
    else if (g.vis === 'public' && g.pub && v.public.length < NAMES_PER_VENUE) { v.public.push(uid); visibleIds.push(uid) }
  }
  const people = await cards(visibleIds)
  const list = [...CITIES[city].venues, HOME].map(venue => {
    const v = venues[venue.id] || { count: 0, friends: [], public: [] }
    return {
      id: venue.id,
      count: v.count,
      friends: v.friends.map(id => people[id]).filter(Boolean),
      public: v.public.map(id => people[id]).filter(Boolean),
    }
  })
  const mine = doc.u[user.id] || null
  return json({
    city, night, label: nightLabel(night),
    total: Object.values(doc.u).filter(g => g.v !== HOME.id).length,
    venues: list,
    mine: mine && { venue: mine.v, vis: mine.vis },
  })
}

async function going(user, req) {
  const input = await body(req)
  const city = validCity(input?.city)
  if (!city) return json({ error: 'city' }, 400)
  const venue = input.venue === HOME.id ? HOME : CITIES[city].venues.find(v => v.id === input.venue)
  if (!venue) return json({ error: 'venue' }, 400)
  let vis = VIS.includes(input.vis) ? input.vis : 'friends'
  if (vis === 'public' && !user.public) vis = 'friends' // perfil privado: nunca sale en público
  const night = nightKey()
  await update(`going/${city}/${night}`, doc => {
    doc ||= { u: {} }
    doc.u[user.id] = { v: venue.id, vis, pub: user.public, at: Date.now() }
    return doc
  })
  return json({ ok: true, venue: venue.id, vis })
}

async function notGoing(user, url) {
  const city = validCity(url.searchParams.get('city'))
  if (!city) return json({ error: 'city' }, 400)
  await update(`going/${city}/${nightKey()}`, doc => {
    if (!doc?.u[user.id]) return undefined
    delete doc.u[user.id]
    return doc
  })
  return json({ ok: true })
}

export const config = { path: ['/api/night', '/api/going'] }
