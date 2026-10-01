// POST /api/groups              { name, emoji } → crea grupo privado
// GET  /api/groups/:id          → miembros y dónde va cada uno esta noche (si no va en modo anónimo)
// POST /api/groups/join         { code }
// POST /api/groups/:id/leave
import { randomInt } from 'node:crypto'
import { nightKey } from '../../src/lib/night.js'
import { auth, body, json, randomId, cleanText, card } from '../lib/http.mjs'
import { read, update, store } from '../lib/db.mjs'
import { goingDoc, cards } from '../lib/game.mjs'
import { CITIES } from '../../src/lib/cities.js'

const MAX_MEMBERS = 60
const MAX_GROUPS = 15
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const newCode = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

export default async (req, context) => {
  const user = await auth(req)
  if (!user) return json({ error: 'auth' }, 401)
  const p = new URL(req.url).pathname
  const id = context.params?.id
  if (p === '/api/groups' && req.method === 'POST') return create(user, req)
  if (p === '/api/groups/join' && req.method === 'POST') return join(user, req)
  if (id && p.endsWith('/leave') && req.method === 'POST') return leave(user, id)
  if (id && req.method === 'GET') return get(user, id)
  return json({ error: 'not-found' }, 400)
}

async function create(user, req) {
  if (user.groups.length >= MAX_GROUPS) return json({ error: 'too-many-groups' }, 400)
  const input = await body(req)
  const name = cleanText(input?.name, 30)
  if (name.length < 2) return json({ error: 'name' }, 400)
  const id = randomId(8)
  for (let i = 0; i < 5; i++) {
    const code = newCode()
    const res = await store().setJSON(`gcode/${code}`, { id }, { onlyIfNew: true })
    if (!res.modified) continue
    const group = { id, code, name, emoji: cleanText(input?.emoji, 4) || '🥂', owner: user.id, members: { [user.id]: Date.now() }, createdAt: Date.now() }
    await store().setJSON(`group/${id}`, group)
    await update(`user/${user.id}`, u => ({ ...u, groups: [...u.groups, id] }))
    return json({ id, code, name: group.name, emoji: group.emoji })
  }
  return json({ error: 'try-again' }, 503)
}

async function join(user, req) {
  const code = String((await body(req))?.code || '').toUpperCase().trim()
  const ref = await read(`gcode/${code}`)
  if (!ref) return json({ error: 'not-found' }, 400)
  if (user.groups.includes(ref.id)) return json({ id: ref.id })
  if (user.groups.length >= MAX_GROUPS) return json({ error: 'too-many-groups' }, 400)
  let full = false
  await update(`group/${ref.id}`, g => {
    if (Object.keys(g.members).length >= MAX_MEMBERS) { full = true; return undefined }
    g.members[user.id] = Date.now()
    return g
  })
  if (full) return json({ error: 'full' }, 400)
  await update(`user/${user.id}`, u => ({ ...u, groups: [...new Set([...u.groups, ref.id])] }))
  return json({ id: ref.id })
}

async function leave(user, id) {
  await update(`group/${id}`, g => {
    if (!g?.members[user.id]) return undefined
    delete g.members[user.id]
    return g
  })
  await update(`user/${user.id}`, u => ({ ...u, groups: u.groups.filter(g => g !== id) }))
  return json({ ok: true })
}

async function get(user, id) {
  const group = await read(`group/${id}`)
  if (!group?.members[user.id]) return json({ error: 'forbidden' }, 400)
  const memberIds = Object.keys(group.members)
  const people = await cards(memberIds)
  // Dónde va cada miembro esta noche (en cualquier ciudad), salvo modo anónimo
  const night = nightKey()
  const where = {}
  for (const city of Object.keys(CITIES)) {
    const going = (await goingDoc(city, night)).u
    for (const uid of memberIds) {
      const g = going[uid]
      if (g && g.vis !== 'anon') where[uid] = { city, venue: g.v }
    }
  }
  return json({
    id: group.id, name: group.name, emoji: group.emoji, code: group.code, owner: group.owner === user.id,
    members: memberIds.map(uid => ({ ...people[uid], tonight: where[uid] || null })).filter(m => m.id),
    me: card(user),
  })
}

export const config = { path: ['/api/groups', '/api/groups/join', '/api/groups/:id', '/api/groups/:id/leave'] }
