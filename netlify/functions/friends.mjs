// POST /api/friends/:id/:action   action = request | accept | remove
//   request: envía solicitud (si la otra persona ya te la había enviado, os hace amigos)
//   accept:  acepta una solicitud recibida
//   remove:  borra amistad, rechaza o cancela solicitud
import { auth, json } from '../lib/http.mjs'
import { read, update } from '../lib/db.mjs'

const MAX_FRIENDS = 500
const without = (arr, id) => arr.filter(x => x !== id)
const withId = (arr, id) => (arr.includes(id) ? arr : [...arr, id])

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const me = await auth(req)
  if (!me) return json({ error: 'auth' }, 401)
  const otherId = context.params.id
  const action = context.params.action
  if (otherId === me.id) return json({ error: 'self' }, 400)
  const other = await read(`user/${otherId}`)
  if (!other) return json({ error: 'not-found' }, 400)

  if (action === 'request' || action === 'accept') {
    const mutual = me.reqIn.includes(otherId)
    if (action === 'accept' && !mutual) return json({ error: 'no-request' }, 400)
    if (me.friends.length >= MAX_FRIENDS) return json({ error: 'too-many' }, 400)
    if (mutual) {
      await update(`user/${me.id}`, u => ({ ...u, friends: withId(u.friends, otherId), reqIn: without(u.reqIn, otherId), reqOut: without(u.reqOut, otherId) }))
      await update(`user/${otherId}`, u => ({ ...u, friends: withId(u.friends, me.id), reqIn: without(u.reqIn, me.id), reqOut: without(u.reqOut, me.id) }))
      return json({ relation: 'friend' })
    }
    if (me.friends.includes(otherId)) return json({ relation: 'friend' })
    await update(`user/${me.id}`, u => ({ ...u, reqOut: withId(u.reqOut, otherId) }))
    await update(`user/${otherId}`, u => ({ ...u, reqIn: withId(u.reqIn, me.id) }))
    return json({ relation: 'sent' })
  }

  if (action === 'remove') {
    const clean = id => u => ({ ...u, friends: without(u.friends, id), reqIn: without(u.reqIn, id), reqOut: without(u.reqOut, id) })
    await update(`user/${me.id}`, clean(otherId))
    await update(`user/${otherId}`, clean(me.id))
    return json({ relation: 'none' })
  }
  return json({ error: 'not-found' }, 400)
}

export const config = { path: '/api/friends/:id/:action' }
