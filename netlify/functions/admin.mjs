// Panel de administración (solo usuarios en ADMIN_USERNAMES)
// GET  /api/admin/reports           → cola de denuncias
// POST /api/admin/resolve           { key, action: 'delete' | 'restore' }
// POST /api/admin/ban               { uid } → expulsa (borra sus datos y bloquea su @)
// GET  /api/admin/stats             → números rápidos
import { CITIES, HOME } from '../../src/lib/cities.js'
import { nightKey } from '../../src/lib/night.js'
import { auth, body, json } from '../lib/http.mjs'
import { read, update, store, photos } from '../lib/db.mjs'
import { cards } from '../lib/game.mjs'
import { deleteAccount } from '../lib/account.mjs'

export default async (req) => {
  const admin = await auth(req)
  if (!admin?.isAdmin) return json({ error: 'forbidden' }, 400)
  const p = new URL(req.url).pathname
  if (p === '/api/admin/reports' && req.method === 'GET') return reports()
  if (p === '/api/admin/resolve' && req.method === 'POST') return resolve(req)
  if (p === '/api/admin/ban' && req.method === 'POST') return ban(req, admin)
  if (p === '/api/admin/stats' && req.method === 'GET') return stats()
  return json({ error: 'not-found' }, 400)
}

async function reports() {
  const items = Object.values((await read('reports/open'))?.items || {}).sort((a, b) => b.reports - a.reports || b.at - a.at)
  const people = await cards(items.map(i => i.uid))
  return json({ items: items.map(i => ({ ...i, by: people[i.uid] || null })) })
}

async function resolve(req) {
  const { key, action } = (await body(req)) || {}
  const item = (await read('reports/open'))?.items?.[key]
  if (!item) return json({ error: 'not-found' }, 400)
  await update(item.docKey, doc => {
    const list = doc?.[item.field]
    if (!list) return undefined
    if (action === 'delete') doc[item.field] = list.filter(x => x.id !== item.id)
    else { const x = list.find(x => x.id === item.id); if (x) x.reports = [] }
    return doc
  })
  if (action === 'delete' && item.kind === 'post') {
    await photos().delete(item.id)
    await store().delete(`photo-meta/${item.id}`)
  }
  await update('reports/open', doc => { delete doc.items[key]; return doc })
  return json({ ok: true })
}

async function ban(req, admin) {
  const { uid } = (await body(req)) || {}
  if (!uid || uid === admin.id) return json({ error: 'bad-input' }, 400)
  await deleteAccount(uid, { keepBan: true })
  await update('reports/open', doc => {
    if (!doc) return undefined
    for (const [k, v] of Object.entries(doc.items)) if (v.uid === uid) delete doc.items[k]
    return doc
  })
  console.log(`ban ${uid} by ${admin.username}`)
  return json({ ok: true })
}

async function stats() {
  const night = nightKey()
  let users = 0
  for await (const page of store().list({ prefix: 'user/', paginate: true })) users += page.blobs.length
  const tonight = {}
  for (const city of Object.keys(CITIES)) {
    const going = Object.values((await read(`going/${city}/${night}`))?.u || {})
    tonight[city] = { going: going.filter(g => g.v !== HOME.id).length, home: going.filter(g => g.v === HOME.id).length }
  }
  const open = Object.keys((await read('reports/open'))?.items || {}).length
  return json({ users, tonight, openReports: open, night })
}

export const config = { path: ['/api/admin/reports', '/api/admin/resolve', '/api/admin/ban', '/api/admin/stats'] }
