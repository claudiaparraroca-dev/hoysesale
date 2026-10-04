// POST   /api/signup             { username, name, birthdate, city, public, terms }
// GET    /api/me                 → mi usuario, amigos, solicitudes y grupos
// PATCH  /api/me                 { name?, city?, public? }
// DELETE /api/me                 → borra la cuenta y todos sus datos
// POST   /api/logout             → cierra la sesión de este dispositivo
// POST   /api/logout-others      → cierra la sesión en el resto de dispositivos
// POST   /api/sessions/link      → código de un solo uso (10 min) para entrar desde otro móvil
// POST   /api/sessions/claim     { code } → crea una sesión nueva en este dispositivo
// GET    /api/users/:username    → perfil de otra persona (lo que me deja ver)
// GET    /api/search?q=          → buscar por @usuario
import { randomInt } from 'node:crypto'
import { auth, body, json, randomId, cleanText, card, newSession, clientKey, rateLimit } from '../lib/http.mjs'
import { read, write, update, store } from '../lib/db.mjs'
import { validCity, cards } from '../lib/game.mjs'
import { deleteAccount } from '../lib/account.mjs'
import { CITIES } from '../../src/lib/cities.js'
import { nightKey } from '../../src/lib/night.js'
import { TERMS_VERSION } from '../../src/lib/legal.js'

const USERNAME = /^[a-z0-9_.]{3,20}$/
const HOUR = 3600 * 1000
const LINK_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export default async (req, context) => {
  const p = new URL(req.url).pathname
  const m = req.method
  if (p === '/api/signup' && m === 'POST') return signup(req, context)
  if (p === '/api/me' && m === 'GET') return me(req)
  if (p === '/api/me' && m === 'PATCH') return patchMe(req)
  if (p === '/api/me' && m === 'DELETE') return removeMe(req)
  if (p === '/api/logout' && m === 'POST') return logout(req, false)
  if (p === '/api/logout-others' && m === 'POST') return logout(req, true)
  if (p === '/api/sessions/link' && m === 'POST') return makeLink(req)
  if (p === '/api/sessions/claim' && m === 'POST') return claimLink(req, context)
  if (p === '/api/search') return search(req)
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

async function signup(req, context) {
  const input = await body(req)
  const username = String(input?.username || '').toLowerCase().trim()
  const name = cleanText(input?.name, 30)
  if (!USERNAME.test(username)) return json({ error: 'username' }, 400)
  if (name.length < 2) return json({ error: 'name' }, 400)
  const years = age(input?.birthdate)
  if (years < 18 || years > 100) return json({ error: 'age' }, 400)
  if (input?.terms !== TERMS_VERSION) return json({ error: 'terms' }, 400)
  const city = validCity(input?.city) || 'girona'

  // Anti-bots (solo cuentan los registros válidos): máx. 3 cuentas por conexión al día y 300 en total por hora
  const ip = clientKey(req, context)
  if (!(await rateLimit(`signup/${ip}`, 3, 24 * HOUR)) || !(await rateLimit('signup/all', 300, HOUR))) {
    return json({ error: 'too-many-signups' }, 429)
  }

  const id = randomId(9)
  const taken = await store().setJSON(`uname/${username}`, { id }, { onlyIfNew: true })
  if (!taken.modified) return json({ error: 'username-taken' }, 409)

  await write(`user/${id}`, {
    id, username, name, city,
    public: input?.public !== false,
    birthYear: Number(input.birthdate.slice(0, 4)), // solo guardamos el año: basta para saber que es +18
    terms: { version: TERMS_VERSION, at: Date.now() },
    sessions: [],
    friends: [], reqIn: [], reqOut: [], groups: [], photos: [],
    createdAt: Date.now(),
  })
  const token = await newSession(id)
  return json({ id, token })
}

async function me(req) {
  const user = await auth(req)
  if (!user) return json({ error: 'auth' }, 401)
  const people = await cards([...user.friends, ...user.reqIn, ...user.reqOut])
  const groups = (await Promise.all(user.groups.map(g => read(`group/${g}`)))).filter(Boolean)
  return json({
    user: { ...card(user), city: user.city, public: user.public, admin: user.isAdmin, sessions: (user.sessions || []).length || 1, usernameNext: (user.usernameChangedAt || 0) + 7 * 86400 * 1000 },
    friends: user.friends.map(id => people[id]).filter(Boolean),
    reqIn: user.reqIn.map(id => people[id]).filter(Boolean),
    reqOut: user.reqOut.map(id => people[id]).filter(Boolean),
    groups: groups.map(g => ({ id: g.id, name: g.name, code: g.code, members: Object.keys(g.members).length })),
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

async function removeMe(req) {
  const user = await auth(req)
  if (!user) return json({ error: 'auth' }, 401)
  const confirm = String((await body(req))?.confirm || '').toLowerCase()
  if (confirm !== user.username) return json({ error: 'confirm' }, 400)
  await deleteAccount(user.id)
  return json({ ok: true })
}

async function logout(req, others) {
  const user = await auth(req)
  if (!user) return json({ error: 'auth' }, 401)
  await update(`user/${user.id}`, u => {
    if (others) {
      u.sessions = (u.sessions || []).filter(s => s.h === user.sessionHash)
      if (u.tokenHash && u.tokenHash !== user.sessionHash) delete u.tokenHash
    } else {
      u.sessions = (u.sessions || []).filter(s => s.h !== user.sessionHash)
      if (u.tokenHash === user.sessionHash) delete u.tokenHash
    }
    return u
  })
  return json({ ok: true })
}

async function makeLink(req) {
  const user = await auth(req)
  if (!user) return json({ error: 'auth' }, 401)
  if (!(await rateLimit(`link/${user.id}`, 5, HOUR))) return json({ error: 'too-many' }, 429)
  const code = Array.from({ length: 8 }, () => LINK_ALPHABET[randomInt(LINK_ALPHABET.length)]).join('')
  await store().setJSON(`link/${code}`, { uid: user.id, exp: Date.now() + 10 * 60 * 1000 })
  return json({ code, expiresIn: 600 })
}

async function claimLink(req, context) {
  if (!(await rateLimit(`claim/${clientKey(req, context)}`, 10, HOUR))) return json({ error: 'too-many' }, 429)
  const code = String((await body(req))?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  let link = null
  // Un solo uso: lo borramos al leerlo
  await update(`link/${code}`, l => { link = l; return l ? { used: true } : undefined })
  if (!link || link.used || link.exp < Date.now()) return json({ error: 'bad-code' }, 400)
  const token = await newSession(link.uid)
  return json({ id: link.uid, token })
}

async function profile(req, username) {
  const viewer = await auth(req)
  if (!viewer) return json({ error: 'auth' }, 401)
  const ref = await read(`uname/${username}`)
  const u = ref && (await read(`user/${ref.id}`))
  if (!u || u.banned) return json({ error: 'not-found' }, 400)
  const relation = u.id === viewer.id ? 'me'
    : viewer.friends.includes(u.id) ? 'friend'
    : viewer.reqOut.includes(u.id) ? 'sent'
    : viewer.reqIn.includes(u.id) ? 'received'
    : 'none'
  const visible = u.public || relation === 'friend' || relation === 'me'
  return json({ ...card(u), public: u.public, relation, visible, friends: visible ? u.friends.length : null, city: visible ? u.city : null })
}

async function search(req) {
  const viewer = await auth(req)
  if (!viewer) return json({ error: 'auth' }, 401)
  if (!(await rateLimit(`search/${viewer.id}`, 60, 60 * 1000))) return json({ results: [] })
  const q = String(new URL(req.url).searchParams.get('q') || '').toLowerCase().replace(/[^a-z0-9_.]/g, '')
  if (q.length < 2) return json({ results: [] })
  const { blobs } = await store().list({ prefix: `uname/${q}` })
  const ids = (await Promise.all(blobs.slice(0, 15).map(b => read(b.key)))).filter(Boolean).map(r => r.id)
  const people = await cards(ids)
  return json({ results: ids.map(id => people[id]).filter(p => p && p.id !== viewer.id) })
}

export const config = {
  path: ['/api/signup', '/api/me', '/api/logout', '/api/logout-others', '/api/sessions/link', '/api/sessions/claim', '/api/search', '/api/users/:username'],
}
