import { createHash, randomBytes } from 'node:crypto'
import { read, update } from './db.mjs'

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

export const sha256 = s => createHash('sha256').update(s).digest('hex')
export const randomId = (bytes = 9) => randomBytes(bytes).toString('base64url')

export const MAX_SESSIONS = 10

// Cabecera "Authorization: Bearer <id>.<token>" → usuario o null.
// Cada dispositivo tiene su propia sesión (user.sessions); cerrar sesión la borra en el servidor.
export async function auth(req) {
  const m = /^Bearer ([\w-]+)\.([\w-]+)$/.exec(req.headers.get('authorization') || '')
  if (!m) return null
  const user = await read(`user/${m[1]}`)
  if (!user || user.banned) return null
  const h = sha256(m[2])
  const ok = user.sessions?.some(s => s.h === h) || user.tokenHash === h // tokenHash: cuentas antiguas
  if (!ok) return null
  user.sessionHash = h
  user.isAdmin = isAdmin(user)
  return user
}

export function isAdmin(user) {
  const admins = String(process.env.ADMIN_USERNAMES || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean)
  return admins.includes(user.username)
}

// Crea una sesión nueva para un usuario y devuelve el token (solo se ve una vez)
export async function newSession(userId) {
  const token = randomId(24)
  await update(`user/${userId}`, u => {
    u.sessions = [...(u.sessions || []), { h: sha256(token), at: Date.now() }].slice(-MAX_SESSIONS)
    return u
  })
  return token
}

export async function body(req) {
  try { return await req.json() } catch { return null }
}

export const cleanText = (s, max) =>
  String(s || '').replace(/[\u0000-\u0008\u000b-\u001f<>]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max)

// Lo que otros pueden ver de un usuario
export const card = u => ({ id: u.id, un: u.username, n: u.name, p: u.photo?.v || null, v: !!u.verified })

// IP del cliente (Netlify la da en context.ip); se guarda solo como hash
export const clientKey = (req, context) =>
  sha256(`hs:${context?.ip || req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'unknown'}`).slice(0, 24)

// Límite simple: como mucho `max` acciones por `key` en una ventana de `windowMs`
export async function rateLimit(key, max, windowMs) {
  const bucket = Math.floor(Date.now() / windowMs)
  const day = new Date().toISOString().slice(0, 10) // en la clave para que la limpieza diaria los borre
  let allowed = true
  await update(`rl/${day}/${key}/${bucket}`, n => {
    if ((n || 0) >= max) { allowed = false; return undefined }
    return (n || 0) + 1
  })
  return allowed
}
