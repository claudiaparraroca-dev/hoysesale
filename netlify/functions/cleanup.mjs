// Limpieza diaria (minimización de datos, RGPD art. 5):
//   - planes, puntos, chats de locales, intentos y retos de la noche: se borran a los 7 días
//   - muros de fotos (y las fotos): a los 30 días
//   - contadores anti-bots: a los 2 días; enlaces de acceso caducados: al momento
import { store, photos } from '../lib/db.mjs'

const DAY = 86400000
const RULES = [
  { prefix: 'going/', days: 7 },
  { prefix: 'score/', days: 7 },
  { prefix: 'nightch/', days: 7 },
  { prefix: 'tries/', days: 7 },
  { prefix: 'chat/v:', days: 7 },
  { prefix: 'wall/', days: 30, photos: true },
  { prefix: 'rl/', days: 2 },
]

const keyDate = key => {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(key)
  return m ? Date.parse(`${m[1]}T00:00:00Z`) : null
}

async function inBatches(items, fn, size = 20) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn))
}

export default async () => {
  const s = store()
  const now = Date.now()
  let deleted = 0

  for (const rule of RULES) {
    const old = []
    for await (const page of s.list({ prefix: rule.prefix, paginate: true })) {
      for (const b of page.blobs) {
        const d = keyDate(b.key)
        if (d && now - d > rule.days * DAY) old.push(b.key)
      }
    }
    await inBatches(old, async key => {
      if (rule.photos) {
        const wall = await s.get(key, { type: 'json' })
        for (const p of wall?.posts || []) {
          await photos().delete(p.id)
          await s.delete(`photo-meta/${p.id}`)
        }
      }
      await s.delete(key)
      deleted++
    })
  }

  const links = []
  for await (const page of s.list({ prefix: 'link/', paginate: true })) links.push(...page.blobs.map(b => b.key))
  await inBatches(links, async key => {
    const l = await s.get(key, { type: 'json' })
    if (!l || l.used || l.exp < now) { await s.delete(key); deleted++ }
  })

  console.log(`cleanup: ${deleted} claves borradas`)
}

export const config = { schedule: '0 5 * * *' }
