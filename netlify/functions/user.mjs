// POST  /api/signup            { username, name, emoji, birthdate, city, public }
// GET   /api/me                → mi usuario, amigos, solicitudes y grupos
// PATCH /api/me                { name?, emoji?, city?, public? }
// GET   /api/users/:username   → perfil de otra persona (lo que me deja ver)
// GET   /api/search?q=         → buscar por @usuario
import { auth, body, json, sha256, randomId, cleanText, card } from '../lib/http.mjs'
import { read, write, update, store } from '../lib/db.mjs'
import { validCity, cards } from '../lib/game.mjs'
import { CITIES } from '../../src/lib/cities.js'
import { nightKey } from '../../src/lib/night.js'

export const AVATARS = ['😎', '💃', '🕺', '🦄', '👽', '🐯', '🦊', '🐸', '🍒', '🔥', '⚡', '👑', '🌈', '🪩', '🍑', '🌶️']
const USERNAME = /^[a-z0-9_.]{3,20}$/

export default async (req, context) => {
  const path = new URL(req.url).pathname
  if (path === '/api/signup' && req.method === 'POST') return signup(req)
  if (path === '/api/me' && req.method === 'GET') return me(req)
  if (path === '/api/me' && req.method === 'PATCH') return patchMe(req)
  if (path === '/api/search') return search(req)
  if (context.params?.username) return profile(req, context.params.username.toLowerCase())
  return json({ error: 'not-found' }, 400)
}

function age(birthdate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate || '')
  if (!m) return -1
  const b = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  const now = new Date()
  let a = now.getUTCFullYear() - b.getUTCFullYear()
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) a--
  return a
}

async function signup(req) {
  const input = await body(req)
  const username = String(input?.username || '').toLowerCase().trim()
  const name = cleanText(input?.name, 30)
  if (!USERNAME.test(username)) return json({ error: 'username' }, 400)
  if (name.length < 2) return json({ error: 'name' }, 400)
  const years = age(input?.birthdate)
  if (years < 18 || years > 100) return json({ error: 'age' }, 400)
  const city = validCity(input?.city) || 'girona'

  const id = randomId(9)
  const taken = await store().setJSON(`uname/${username}`, { id }, { onlyIfNew: true })
  if (!taken.modified) return json({ error: 'username-taken' }, 409)

  const token = randomId(24)
  const user = {
    id, username, name, city,
    emoji: AVATARS.includes(input?.emoji) ? input.emoji : AVATARS[0],
    public: input?.public !== false,
    birthdate: input.birthdate,
    tokenHash: sha256(token),
    friends: [], reqIn: [], reqOut: [], groups: [],
    createdAt: Date.now(),
  }
  await write(`user/${id}`, user)
  return json({ id, token })
}

async function me(req) {
  const user = await auth(req)
  if (!user) return json({ error: 'auth' }, 401)
  const people = await cards([...user.friends, ...user.reqIn, ...user.reqOut])
  const groups = (await Promise.all(user.groups.map(g => read(`group/${g}`)))).filter(Boolean)
  return json({
    user: { ...card(user), city: user.city, public: user.public },
    friends: user.friends.map(id => people[id]).filter(Boolean),
    reqIn: user.reqIn.map(id => people[id]).filter(Boolean),
    reqOut: user.reqOut.map(id => people[id]).filter(Boolean),
    groups: groups.map(g => ({ id: g.id, name: g.name, emoji: g.emoji, code: g.code, members: Object.keys(g.members).length })),
  })
}

async function patchMe(req) {
  const user = await auth(req)
  if (!user) return json({ error: 'auth' }, 401)
  const input = (await body(req)) || {}
  const next = await update(`user/${user.id}`, u => {
    if (input.name !== undefined) {
      const n = cleanText(input.name, 30)
      if (n.length >= 2) u.name = n
    }
    if (AVATARS.includes(input.emoji)) u.emoji = input.emoji
    if (validCity(input.city)) u.city = input.city
    if (typeof input.public === 'boolean') u.public = input.public
    return u
  })
  // Si pasa a privado, deja de salir en público ya esta noche
  if (input.public === false) {
    const night = nightKey()
    for (const city of Object.keys(CITIES)) {
      await update(`going/${city}/${night}`, doc => {
        const g = doc?.u?.[user.id]
        if (!g || g.pub === false) return undefined
        g.pub = false
        if (g.vis === 'public') g.vis = 'friends'
        return doc
      })
    }
  }
  return json({ user: { ...card(next), city: next.city, public: next.public } })
}

async function profile(req, username) {
  const viewer = await auth(req)
  if (!viewer) return json({ error: 'auth' }, 401)
  const ref = await read(`uname/${username}`)
  const u = ref && (await read(`user/${ref.id}`))
  if (!u) return json({ error: 'not-found' }, 400)
  const relation = u.id === viewer.id ? 'me'
    : viewer.friends.includes(u.id) ? 'friend'
    : viewer.reqOut.includes(u.id) ? 'sent'
    : viewer.reqIn.includes(u.id) ? 'received'
    : 'none'
  const visible = u.public || relation === 'friend' || relation === 'me'
  return json({
    ...card(u),
    public: u.public,
    relation,
    visible,
    friends: visible ? u.friends.length : null,
    city: visible ? u.city : null,
  })
}

async function search(req) {
  const viewer = await auth(req)
  if (!viewer) return json({ error: 'auth' }, 401)
  const q = String(new URL(req.url).searchParams.get('q') || '').toLowerCase().replace(/[^a-z0-9_.]/g, '')
  if (q.length < 2) return json({ results: [] })
  const { blobs } = await store().list({ prefix: `uname/${q}` })
  const ids = (await Promise.all(blobs.slice(0, 15).map(b => read(b.key)))).filter(Boolean).map(r => r.id)
  const people = await cards(ids)
  return json({ results: ids.map(id => people[id]).filter(p => p && p.id !== viewer.id) })
}

export const config = { path: ['/api/signup', '/api/me', '/api/search', '/api/users/:username'] }
