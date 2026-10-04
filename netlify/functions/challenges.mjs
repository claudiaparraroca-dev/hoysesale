// GET  /api/challenges?city=                 → retos de esta noche + los que ya hice + mis puntos
// POST /api/challenges/complete              { city, challenge, image, venueWall, groups: [gid] }
// GET  /api/ranking?city=&scope=city|venue:<id>|group:<gid>
// GET  /api/proposals?city=                  → retos propuestos por la gente de la ciudad
// POST /api/proposals                        { city, text, emoji }
// POST /api/proposals/vote                   { city, id }
import { nightKey } from '../../src/lib/night.js'
import { HOME } from '../../src/lib/cities.js'
import { auth, body, json, randomId, cleanText } from '../lib/http.mjs'
import { read, update, photos } from '../lib/db.mjs'
import { judge, parseImage, isRateLimit } from '../lib/referee.mjs'
import { validCity, nightChallenges, publicChallenge, goingDoc, cards, MAX_TRIES } from '../lib/game.mjs'

const MAX_PROPOSALS = 200

export default async (req) => {
  const user = await auth(req)
  if (!user) return json({ error: 'auth' }, 401)
  const url = new URL(req.url)
  const p = url.pathname
  if (p === '/api/challenges' && req.method === 'GET') return list(user, url)
  if (p === '/api/challenges/complete' && req.method === 'POST') return complete(user, req)
  if (p === '/api/ranking' && req.method === 'GET') return ranking(user, url)
  if (p === '/api/proposals' && req.method === 'GET') return proposals(user, url)
  if (p === '/api/proposals' && req.method === 'POST') return propose(user, req)
  if (p === '/api/proposals/vote' && req.method === 'POST') return vote(user, req)
  return json({ error: 'not-found' }, 400)
}

async function list(user, url) {
  const city = validCity(url.searchParams.get('city'))
  if (!city) return json({ error: 'city' }, 400)
  const night = nightKey()
  const challenges = await nightChallenges(city, night)
  const mine = (await read(`score/${city}/${night}`))?.u?.[user.id]
  return json({ night, challenges: challenges.map(publicChallenge), done: mine?.done || [], pts: mine?.pts || 0 })
}

async function complete(user, req) {
  const input = await body(req)
  const city = validCity(input?.city)
  const image = parseImage(input?.image)
  if (!city || !image) return json({ error: 'bad-input' }, 400)
  const night = nightKey()
  const challenge = (await nightChallenges(city, night)).find(c => c.id === input.challenge)
  if (!challenge) return json({ error: 'challenge' }, 400)

  const score = await read(`score/${city}/${night}`)
  if (score?.u?.[user.id]?.done?.includes(challenge.id)) return json({ ok: false, reason: '¡Este reto ya lo tienes!', already: true })

  let over = false
  await update(`tries/${night}/${user.id}`, n => { if ((n || 0) >= MAX_TRIES) { over = true; return undefined } return (n || 0) + 1 })
  if (over) return json({ ok: false, reason: 'Has llegado al máximo de fotos de esta noche.', limit: true })

  let verdict
  try { verdict = await judge(image, challenge) } catch (err) {
    if (isRateLimit(err)) return json({ error: 'busy' }, 429)
    console.error('referee failed', err)
    return json({ error: 'upstream' }, 502)
  }
  if (!verdict.ok) return json({ ok: false, reason: verdict.reason })

  // Puntos (una vez por reto y noche)
  let gained = 0
  await update(`score/${city}/${night}`, doc => {
    doc ||= { u: {} }
    const e = doc.u[user.id] || { pts: 0, done: [] }
    if (e.done.includes(challenge.id)) return undefined
    e.done.push(challenge.id)
    e.pts += challenge.pts
    gained = challenge.pts
    doc.u[user.id] = e
    return doc
  })

  // Guardar la foto y publicarla en los muros elegidos
  const photoId = randomId(12)
  await photos().set(photoId, Buffer.from(image.data, 'base64'), { metadata: { type: image.mediaType, uid: user.id } })
  const rooms = []
  if (input.venueWall) {
    const going = (await goingDoc(city, night)).u[user.id]
    if (going && going.v !== HOME.id) rooms.push(`v:${city}:${going.v}`)
  }
  for (const gid of Array.isArray(input.groups) ? input.groups.slice(0, 10) : []) {
    if (user.groups.includes(gid)) rooms.push(`g:${gid}`)
  }
  const post = { id: photoId, uid: user.id, ch: { id: challenge.id, emoji: challenge.emoji, text: challenge.text, pts: challenge.pts }, at: Date.now(), reports: [] }
  for (const room of rooms) {
    await update(`wall/${room}/${night}`, doc => {
      doc ||= { posts: [] }
      doc.posts = [post, ...doc.posts].slice(0, 300)
      return doc
    })
  }
  // Las fotos guardan en qué salas están (para comprobar quién puede verlas)
  await update(`photo-meta/${photoId}`, () => ({ uid: user.id, rooms, city, night }))
  // …y el usuario sabe qué fotos son suyas (para poder borrarlas si borra la cuenta)
  await update(`user/${user.id}`, u => ({ ...u, photos: [...(u.photos || []), photoId].slice(-500) }))

  return json({ ok: true, reason: verdict.reason, points: gained, rooms })
}

async function ranking(user, url) {
  const city = validCity(url.searchParams.get('city'))
  if (!city) return json({ error: 'city' }, 400)
  const scope = url.searchParams.get('scope') || 'city'
  const night = nightKey()
  const score = (await read(`score/${city}/${night}`))?.u || {}
  let ids = Object.keys(score)

  if (scope.startsWith('venue:')) {
    const venue = scope.slice(6)
    const going = (await goingDoc(city, night)).u
    ids = ids.filter(id => going[id]?.v === venue)
  } else if (scope.startsWith('group:')) {
    const group = await read(`group/${scope.slice(6)}`)
    if (!group?.members[user.id]) return json({ error: 'not-member' }, 400)
    ids = ids.filter(id => group.members[id])
  }

  const people = await cards(ids)
  const rows = ids
    .filter(id => score[id].pts > 0 && people[id])
    .sort((a, b) => score[b].pts - score[a].pts)
    .slice(0, 50)
    .map((id, i) => ({ rank: i + 1, ...people[id], pts: score[id].pts, me: id === user.id }))
  return json({ rows })
}

async function proposals(user, url) {
  const city = validCity(url.searchParams.get('city'))
  if (!city) return json({ error: 'city' }, 400)
  const items = (await read(`props/${city}`))?.items || []
  return json({
    items: items
      .map(i => ({ id: i.id, text: i.text, emoji: i.emoji, by: i.un, votes: Object.keys(i.votes).length, voted: !!i.votes[user.id], mine: i.by === user.id }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 50),
  })
}

async function propose(user, req) {
  const input = await body(req)
  const city = validCity(input?.city)
  const text = cleanText(input?.text, 90)
  if (!city || text.length < 8) return json({ error: 'text' }, 400)
  const emoji = cleanText(input?.emoji, 4) || '🔥'
  let limited = false
  await update(`props/${city}`, doc => {
    doc ||= { items: [] }
    if (doc.items.filter(i => i.by === user.id).length >= 3) { limited = true; return undefined } // máx 3 propuestas vivas por persona
    doc.items = [{ id: randomId(6), text, emoji, by: user.id, un: user.username, votes: { [user.id]: 1 }, at: Date.now() }, ...doc.items].slice(0, MAX_PROPOSALS)
    return doc
  })
  if (limited) return json({ error: 'too-many-proposals' }, 400)
  return json({ ok: true })
}

async function vote(user, req) {
  const input = await body(req)
  const city = validCity(input?.city)
  if (!city) return json({ error: 'city' }, 400)
  await update(`props/${city}`, doc => {
    const item = doc?.items.find(i => i.id === input.id)
    if (!item) return undefined
    if (item.votes[user.id]) delete item.votes[user.id]
    else item.votes[user.id] = 1
    return doc
  })
  return json({ ok: true })
}

export const config = { path: ['/api/challenges', '/api/challenges/complete', '/api/ranking', '/api/proposals', '/api/proposals/vote'] }
