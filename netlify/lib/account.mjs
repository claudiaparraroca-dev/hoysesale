// Borrado completo de una cuenta (derecho de supresión, RGPD art. 17).
// También lo usa el panel de admin al expulsar a alguien (con keepBan para que no vuelva con el mismo @).
import { CITIES } from '../../src/lib/cities.js'
import { nightKey } from '../../src/lib/night.js'
import { read, update, store, photos } from './db.mjs'

const without = (arr = [], id) => arr.filter(x => x !== id)

export async function deleteAccount(uid, { keepBan = false } = {}) {
  const user = await read(`user/${uid}`)
  if (!user) return
  const s = store()
  const night = nightKey()

  // Amistades y solicitudes
  for (const other of new Set([...user.friends, ...user.reqIn, ...user.reqOut])) {
    await update(`user/${other}`, u => (u ? { ...u, friends: without(u.friends, uid), reqIn: without(u.reqIn, uid), reqOut: without(u.reqOut, uid) } : undefined))
  }

  // Grupos: salir, borrar sus mensajes y, si se queda vacío, borrar el grupo
  for (const gid of user.groups) {
    const g = await update(`group/${gid}`, g => {
      if (!g?.members[uid]) return undefined
      delete g.members[uid]
      return g
    })
    await update(`chat/g:${gid}`, doc => (doc ? { ...doc, msgs: doc.msgs.filter(m => m.uid !== uid) } : undefined))
    if (g && Object.keys(g.members).length === 0) {
      await s.delete(`group/${gid}`)
      await s.delete(`gcode/${g.code}`)
      await s.delete(`chat/g:${gid}`)
    }
  }

  // Esta noche: plan, puntos y mensajes en chats de locales
  for (const city of Object.keys(CITIES)) {
    await update(`going/${city}/${night}`, doc => {
      if (!doc?.u?.[uid]) return undefined
      delete doc.u[uid]
      return doc
    })
    await update(`score/${city}/${night}`, doc => {
      if (!doc?.u?.[uid]) return undefined
      delete doc.u[uid]
      return doc
    })
    for (const venue of CITIES[city].venues) {
      await update(`chat/v:${city}:${venue.id}/${night}`, doc => {
        if (!doc?.msgs?.some(m => m.uid === uid)) return undefined
        return { ...doc, msgs: doc.msgs.filter(m => m.uid !== uid) }
      })
    }
    // Propuestas suyas fuera; sus votos también
    await update(`props/${city}`, doc => {
      if (!doc?.items) return undefined
      doc.items = doc.items.filter(i => i.by !== uid).map(i => { delete i.votes[uid]; return i })
      return doc
    })
  }

  // Fotos: quitar de los muros y borrar el archivo
  for (const pid of user.photos || []) {
    const meta = await read(`photo-meta/${pid}`)
    if (meta) {
      for (const room of meta.rooms) {
        await update(`wall/${room}/${meta.night}`, doc => (doc ? { ...doc, posts: doc.posts.filter(p => p.id !== pid) } : undefined))
      }
      await s.delete(`photo-meta/${pid}`)
    }
    await photos().delete(pid)
  }

  if (keepBan) {
    // Se queda un registro mínimo para que no pueda volver con el mismo @
    await s.setJSON(`user/${uid}`, { id: uid, username: user.username, name: 'Usuario expulsado', banned: true, bannedAt: Date.now(), friends: [], reqIn: [], reqOut: [], groups: [] })
  } else {
    await s.delete(`uname/${user.username}`)
    await s.delete(`user/${uid}`)
  }
}
