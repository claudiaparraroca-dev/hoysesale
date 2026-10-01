import { createHash, randomBytes } from 'node:crypto'
import { read } from './db.mjs'

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

export const sha256 = s => createHash('sha256').update(s).digest('hex')
export const randomId = (bytes = 9) => randomBytes(bytes).toString('base64url')

// Cabecera "Authorization: Bearer <id>.<token>" → usuario o null
export async function auth(req) {
  const m = /^Bearer ([\w-]+)\.([\w-]+)$/.exec(req.headers.get('authorization') || '')
  if (!m) return null
  const user = await read(`user/${m[1]}`)
  if (!user || user.tokenHash !== sha256(m[2])) return null
  return user
}

export async function body(req) {
  try { return await req.json() } catch { return null }
}

export const cleanText = (s, max) =>
  String(s || '').replace(/[\u0000-\u0008\u000b-\u001f<>]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max)

// Lo que otros pueden ver de un usuario
export const card = u => ({ id: u.id, un: u.username, n: u.name, e: u.emoji })
