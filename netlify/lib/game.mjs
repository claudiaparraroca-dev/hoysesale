// Claves en Blobs (almacén "hoysesale"):
//   user/{id}                 usuario completo (friends, reqIn, reqOut, groups…)
//   uname/{username}          → { id }   (para que el @ sea único)
//   going/{city}/{night}      { u: { uid: { v: venueId, vis: 'public'|'friends'|'anon', at } } }
//   nightch/{city}/{night}    { list: [retos] }  (se fija la primera vez que alguien los pide)
//   props/{city}              { items: [{ id, text, emoji, by, votes: { uid: 1 }, at }] }
//   score/{city}/{night}      { u: { uid: { pts, done: [ids] } } }
//   wall/{room}/{night}       { posts: [{ id, uid, ch, at, reports: [] }] }
//   chat/{room}[/{night}]     { msgs: [{ id, uid, t, at, reports: [] }] }
//   group/{gid}, gcode/{code} grupos privados
//   tries/{night}/{uid}       nº de fotos enviadas (anti-abuso)
// room = 'v:{city}:{venue}' (sala pública de un local) | 'g:{gid}' (grupo privado)
import { CITIES } from '../../src/lib/cities.js'
import { challengesFor } from '../../src/lib/challenges.js'
import { read, update } from './db.mjs'

export const MAX_TRIES = 40
export const HIDE_AFTER_REPORTS = 3

export const validCity = city => (CITIES[city] ? city : null)

export async function goingDoc(city, night) {
  return (await read(`going/${city}/${night}`)) || { u: {} }
}

// Retos de la noche: se congelan la primera vez (con la propuesta más votada en ese momento)
export async function nightChallenges(city, night) {
  const existing = await read(`nightch/${city}/${night}`)
  if (existing) return existing.list
  const props = await read(`props/${city}`)
  const best = [...(props?.items || [])].sort((a, b) => Object.keys(b.votes).length - Object.keys(a.votes).length)[0]
  const top = best && Object.keys(best.votes).length >= 3 // mínimo 3 votos
    ? { id: `p-${best.id}`, pts: 25, emoji: best.emoji || '🔥', text: best.text, hint: 'A challenge proposed by local players. Judge by the text; be generous.', local: true, by: best.un }
    : null
  const list = challengesFor(city, night, top)
  let mine = false
  const saved = await update(`nightch/${city}/${night}`, d => { if (d) return undefined; mine = true; return { list } })
  // La propuesta ganadora sale de la lista de votación (solo si fuimos quienes fijamos la noche)
  if (mine && top) await update(`props/${city}`, doc => ({ ...doc, items: doc.items.filter(i => i.id !== best.id) }))
  return (saved || (await read(`nightch/${city}/${night}`))).list
}

export const publicChallenge = ({ hint, ...rest }) => rest

// ¿Puede este usuario ver / escribir en esta sala?
export async function roomAccess(user, room, night) {
  const [kind, a, b] = room.split(':')
  if (kind === 'v' && validCity(a) && CITIES[a].venues.some(v => v.id === b)) {
    const going = await goingDoc(a, night)
    return { ok: true, write: going.u[user.id]?.v === b, kind, city: a, venue: b }
  }
  if (kind === 'g') {
    const group = await read(`group/${a}`)
    if (!group?.members[user.id]) return { ok: false }
    return { ok: true, write: true, kind, group }
  }
  return { ok: false }
}

// Cache sencillo de tarjetas de usuario para pintar autores
export async function cards(ids) {
  const out = {}
  await Promise.all([...new Set(ids)].map(async id => {
    const u = await read(`user/${id}`)
    if (u && !u.banned) out[id] = { id, un: u.username, n: u.name, e: u.emoji, v: !!u.verified }
  }))
  return out
}
