// PATCH  /api/me/username   { username } → cambiar @ (como mucho una vez cada 7 días)
// POST   /api/me/photo      { image }    → foto de perfil (la revisa la IA)
// DELETE /api/me/photo
// GET    /api/avatar/:uid               → la foto (pública, para poder usarla en <img>)
import { auth, body, json, card, rateLimit } from '../lib/http.mjs'
import { read, update, store, photos } from '../lib/db.mjs'
import { judgeAvatar, parseImage, isRateLimit } from '../lib/referee.mjs'
import { indexUser } from '../lib/search.mjs'

const USERNAME = /^[a-z0-9_.]{3,20}$/
const COOLDOWN = 7 * 86400 * 1000
const RESERVED = new Set(['admin', 'administrador', 'hoysesale', 'soporte', 'support', 'moderador', 'oficial'])

export default async (req, context) => {
  const p = new URL(req.url).pathname
  if (p.startsWith('/api/avatar/')) return avatar(context.params.uid)
  const user = await auth(req)
  if (!user) return json({ error: 'auth' }, 401)
  if (p === '/api/me/username' && req.method === 'PATCH') return changeUsername(user, req)
  if (p === '/api/me/photo' && req.method === 'POST') return setPhoto(user, req)
  if (p === '/api/me/photo' && req.method === 'DELETE') return removePhoto(user)
  return json({ error: 'not-found' }, 400)
}

async function changeUsername(user, req) {
  const username = String((await body(req))?.username || '').toLowerCase().trim()
  if (username === user.username) return json({ user: card(user) })
  if (!USERNAME.test(username)) return json({ error: 'username' }, 400)
  if (RESERVED.has(username) || [...RESERVED].some(r => username.startsWith(r))) return json({ error: 'username-taken' }, 409)
  const last = user.usernameChangedAt || 0
  if (Date.now() - last < COOLDOWN) return json({ error: 'username-cooldown', next: last + COOLDOWN }, 400)

  const s = store()
  const res = await s.setJSON(`uname/${username}`, { id: user.id }, { onlyIfNew: true })
  if (!res.modified) return json({ error: 'username-taken' }, 409)
  const next = await update(`user/${user.id}`, u => ({ ...u, username, usernameChangedAt: Date.now(), previousUsernames: [...(u.previousUsernames || []), u.username].slice(-5) }))
  await s.delete(`uname/${user.username}`)
  await indexUser(next)
  return json({ user: card(next) })
}

async function setPhoto(user, req) {
  if (!(await rateLimit(`avatar/${user.id}`, 10, 86400 * 1000))) return json({ error: 'too-many' }, 429)
  const image = parseImage((await body(req))?.image)
  if (!image) return json({ error: 'bad-input' }, 400)
  let verdict
  try { verdict = await judgeAvatar(image) } catch (err) {
    if (isRateLimit(err)) return json({ error: 'busy' }, 429)
    console.error('avatar check failed', err)
    return json({ error: 'upstream' }, 502)
  }
  if (!verdict.safe) return json({ ok: false, reason: verdict.reason })
  await photos().set(`avatar/${user.id}`, Buffer.from(image.data, 'base64'), { metadata: { type: image.mediaType } })
  const next = await update(`user/${user.id}`, u => ({ ...u, photo: { v: Date.now() } }))
  await indexUser(next)
  return json({ ok: true, reason: verdict.reason, user: card(next) })
}

async function removePhoto(user) {
  await photos().delete(`avatar/${user.id}`)
  const next = await update(`user/${user.id}`, u => { delete u.photo; return u })
  await indexUser(next)
  return json({ ok: true, user: card(next) })
}

async function avatar(uid) {
  const user = await read(`user/${uid}`)
  if (!user?.photo || user.banned) return new Response('no photo', { status: 400, headers: { 'cache-control': 'public, max-age=300' } })
  const blob = await photos().getWithMetadata(`avatar/${uid}`, { type: 'arrayBuffer' })
  if (!blob) return new Response('no photo', { status: 400 })
  // La URL lleva ?v=<versión>, así que se puede cachear mucho tiempo
  return new Response(blob.data, {
    headers: { 'content-type': blob.metadata?.type || 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' },
  })
}

export const config = { path: ['/api/me/username', '/api/me/photo', '/api/avatar/:uid'] }
