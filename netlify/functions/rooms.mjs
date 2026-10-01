// GET  /api/wall?room=            → fotos de retos de esta noche en la sala
// GET  /api/photo/:id             → la foto (solo si puedes ver alguna sala donde está)
// GET  /api/chat?room=&since=     → mensajes (la app pregunta cada pocos segundos)
// POST /api/chat                  { room, text }
// POST /api/report                { room, kind: 'post'|'msg', id }
//
// Salas: 'v:{city}:{venue}' es la sala pública del local (leer: cualquiera; escribir: quien
// ha marcado que va esta noche). 'g:{gid}' es un grupo privado (solo miembros).
// El chat de los locales se reinicia cada noche; el de los grupos se mantiene.
import { nightKey } from '../../src/lib/night.js'
import { auth, body, json, randomId, cleanText } from '../lib/http.mjs'
import { read, update, photos } from '../lib/db.mjs'
import { roomAccess, cards, HIDE_AFTER_REPORTS } from '../lib/game.mjs'

const MAX_MSGS = 200
const MIN_GAP_MS = 1500

const chatKey = (room, night) => (room.startsWith('v:') ? `chat/${room}/${night}` : `chat/${room}`)

export default async (req, context) => {
  const user = await auth(req)
  if (!user) return json({ error: 'auth' }, 401)
  const url = new URL(req.url)
  const p = url.pathname
  if (context.params?.id && p.startsWith('/api/photo/')) return photo(user, context.params.id)
  if (p === '/api/wall') return wall(user, url)
  if (p === '/api/chat' && req.method === 'GET') return getChat(user, url)
  if (p === '/api/chat' && req.method === 'POST') return postChat(user, req)
  if (p === '/api/report' && req.method === 'POST') return report(user, req)
  return json({ error: 'not-found' }, 400)
}

async function wall(user, url) {
  const room = url.searchParams.get('room') || ''
  const night = nightKey()
  const access = await roomAccess(user, room, night)
  if (!access.ok) return json({ error: 'forbidden' }, 400)
  const posts = ((await read(`wall/${room}/${night}`))?.posts || []).filter(p => p.reports.length < HIDE_AFTER_REPORTS)
  const people = await cards(posts.map(p => p.uid))
  return json({
    posts: posts.map(p => ({ id: p.id, ch: p.ch, at: p.at, by: people[p.uid] || null, mine: p.uid === user.id, reported: p.reports.includes(user.id) })),
  })
}

async function photo(user, id) {
  const meta = await read(`photo-meta/${id}`)
  if (!meta) return json({ error: 'not-found' }, 400)
  let allowed = meta.uid === user.id
  for (const room of meta.rooms) {
    if (allowed) break
    allowed = (await roomAccess(user, room, meta.night)).ok
  }
  if (!allowed) return json({ error: 'forbidden' }, 400)
  const blob = await photos().getWithMetadata(id, { type: 'arrayBuffer' })
  if (!blob) return json({ error: 'not-found' }, 400)
  return new Response(blob.data, {
    headers: { 'content-type': blob.metadata?.type || 'image/jpeg', 'cache-control': 'private, max-age=86400' },
  })
}

async function getChat(user, url) {
  const room = url.searchParams.get('room') || ''
  const since = Number(url.searchParams.get('since')) || 0
  const night = nightKey()
  const access = await roomAccess(user, room, night)
  if (!access.ok) return json({ error: 'forbidden' }, 400)
  const msgs = ((await read(chatKey(room, night)))?.msgs || []).filter(m => m.at > since && m.reports.length < HIDE_AFTER_REPORTS)
  const people = await cards(msgs.map(m => m.uid))
  return json({
    canWrite: access.write,
    msgs: msgs.map(m => ({ id: m.id, t: m.t, at: m.at, by: people[m.uid] || null, mine: m.uid === user.id })),
  })
}

async function postChat(user, req) {
  const input = await body(req)
  const room = String(input?.room || '')
  const text = cleanText(input?.text, 400)
  if (!text) return json({ error: 'empty' }, 400)
  const night = nightKey()
  const access = await roomAccess(user, room, night)
  if (!access.ok) return json({ error: 'forbidden' }, 400)
  if (!access.write) return json({ error: 'not-going' }, 400)
  let tooFast = false
  const msg = { id: randomId(8), uid: user.id, t: text, at: Date.now(), reports: [] }
  await update(chatKey(room, night), doc => {
    doc ||= { msgs: [] }
    const last = [...doc.msgs].reverse().find(m => m.uid === user.id)
    if (last && msg.at - last.at < MIN_GAP_MS) { tooFast = true; return undefined }
    doc.msgs = [...doc.msgs, msg].slice(-MAX_MSGS)
    return doc
  })
  if (tooFast) return json({ error: 'too-fast' }, 429)
  return json({ ok: true, id: msg.id, at: msg.at })
}

async function report(user, req) {
  const input = await body(req)
  const room = String(input?.room || '')
  const night = nightKey()
  const access = await roomAccess(user, room, night)
  if (!access.ok) return json({ error: 'forbidden' }, 400)
  const key = input.kind === 'msg' ? chatKey(room, night) : `wall/${room}/${night}`
  const field = input.kind === 'msg' ? 'msgs' : 'posts'
  await update(key, doc => {
    const item = doc?.[field]?.find(x => x.id === input.id)
    if (!item || item.reports.includes(user.id)) return undefined
    item.reports.push(user.id)
    return doc
  })
  console.log(`report ${input.kind} ${input.id} in ${room} by ${user.id}`)
  return json({ ok: true })
}

export const config = { path: ['/api/wall', '/api/photo/:id', '/api/chat', '/api/report'] }
