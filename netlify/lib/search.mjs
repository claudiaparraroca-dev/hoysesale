// Buscador de personas tipo Instagram: por @ o por nombre, sin importar acentos ni mayúsculas,
// tolerando una errata, y priorizando a quien tiene amigos en común contigo.
//
// Índice: index/users → { u: { uid: [username, nombre, fotoVersión] } }
// Se actualiza al registrarse, cambiar nombre/@/foto, borrar cuenta o ser expulsado.
import { read, update, store } from './db.mjs'

const KEY = 'index/users'

export const normalize = s => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/^@/, '')
  .replace(/[^a-z0-9_. ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export async function indexUser(u) {
  if (!u || u.banned) return unindexUser(u?.id)
  await getIndex()
  await update(KEY, doc => {
    doc ||= { u: {} }
    doc.u[u.id] = [u.username, u.name, u.photo?.v || null]
    return doc
  })
}

export async function unindexUser(uid) {
  if (!uid) return
  await getIndex()
  await update(KEY, doc => {
    if (!doc?.u?.[uid]) return undefined
    delete doc.u[uid]
    return doc
  })
}

// La primera vez (o si se pierde) se reconstruye desde los usuarios guardados
async function getIndex() {
  const existing = await read(KEY)
  if (existing) return existing.u
  const u = {}
  for await (const page of store().list({ prefix: 'user/', paginate: true })) {
    const users = await Promise.all(page.blobs.map(b => read(b.key)))
    for (const x of users) if (x && !x.banned) u[x.id] = [x.username, x.name, x.photo?.v || null]
  }
  await update(KEY, doc => doc || { u })
  return u
}

// Distancia de edición (para tolerar una errata: "lauar" → "laura")
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

function score(q, username, name) {
  const un = username
  const nn = normalize(name)
  const words = nn.split(' ')
  if (un === q || nn === q) return 100
  if (words.includes(q)) return 92
  if (un.startsWith(q)) return 85
  if (nn.startsWith(q) || words.some(w => w.startsWith(q))) return 75
  if (un.includes(q) || nn.includes(q)) return 55
  if (q.length >= 3) {
    const max = q.length >= 6 ? 2 : 1
    const candidates = [un.slice(0, q.length), ...words.map(w => w.slice(0, q.length)), nn.slice(0, q.length)]
    if (candidates.some(c => lev(q, c) <= max)) return 35
  }
  return 0
}

export async function searchPeople(viewer, rawQuery, limit = 20) {
  const q = normalize(rawQuery)
  if (q.length < 1) return []
  const index = await getIndex()
  const scored = []
  for (const [uid, [username, name, photo]] of Object.entries(index)) {
    if (uid === viewer.id) continue
    const s = score(q, username, name)
    if (s > 0) scored.push({ uid, username, name, photo, s })
  }
  // Los mejores 40 por texto; luego se suman los amigos en común
  const top = scored.sort((a, b) => b.s - a.s).slice(0, 40)
  const myFriends = new Set(viewer.friends)
  const docs = await Promise.all(top.map(t => read(`user/${t.uid}`)))
  return top
    .map((t, i) => {
      const mutual = (docs[i]?.friends || []).filter(f => myFriends.has(f)).length
      return { ...t, mutual, rank: t.s + Math.min(mutual, 5) * 8 + (myFriends.has(t.uid) ? 8 : 0) }
    })
    .filter((t, i) => docs[i] && !docs[i].banned)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)
    .map(t => ({ id: t.uid, un: t.username, n: t.name, p: t.photo, mutual: t.mutual, relation: relationOf(viewer, t.uid) }))
}

export function relationOf(viewer, uid) {
  if (viewer.friends.includes(uid)) return 'friend'
  if (viewer.reqOut.includes(uid)) return 'sent'
  if (viewer.reqIn.includes(uid)) return 'received'
  return 'none'
}

// "Amigos en común": gente que tus amigos tienen agregada y tú no
export async function suggestions(viewer, limit = 20) {
  const exclude = new Set([viewer.id, ...viewer.friends, ...viewer.reqOut, ...(viewer.dismissed || [])])
  const counts = new Map()
  const friendDocs = await Promise.all(viewer.friends.slice(0, 100).map(f => read(`user/${f}`)))
  for (const f of friendDocs) {
    if (!f || f.banned) continue
    for (const id of f.friends || []) {
      if (exclude.has(id)) continue
      const c = counts.get(id) || { n: 0, via: [] }
      c.n++
      if (c.via.length < 2) c.via.push(f.name)
      counts.set(id, c)
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, limit)
  const docs = await Promise.all(top.map(([id]) => read(`user/${id}`)))
  return top
    .map(([id, c], i) => docs[i] && !docs[i].banned && ({
      id, un: docs[i].username, n: docs[i].name, p: docs[i].photo?.v || null,
      mutual: c.n, via: c.via, relation: relationOf(viewer, id),
    }))
    .filter(Boolean)
}
