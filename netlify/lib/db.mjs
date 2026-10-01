// Acceso a Netlify Blobs con escrituras atómicas (reintenta si otro jugador escribió a la vez).
import { getStore } from '@netlify/blobs'

export const store = () => getStore({ name: 'hoysesale', consistency: 'strong' })

export async function read(key) {
  return store().get(key, { type: 'json' })
}

export async function write(key, value) {
  await store().setJSON(key, value)
}

// update(key, fn): fn recibe el valor actual (o null) y devuelve el nuevo.
// Devuelve el valor que quedó guardado.
export async function update(key, fn, tries = 10) {
  const s = store()
  for (let i = 0; i < tries; i++) {
    const current = await s.getWithMetadata(key, { type: 'json' })
    const next = fn(current ? structuredClone(current.data) : null)
    if (next === undefined) return current?.data ?? null // sin cambios
    const res = current
      ? await s.setJSON(key, next, { onlyIfMatch: current.etag })
      : await s.setJSON(key, next, { onlyIfNew: true })
    if (res.modified) return next
    await new Promise(r => setTimeout(r, 30 + Math.random() * 120))
  }
  throw new Error(`update conflict on ${key}`)
}

// Fotos (binario) en un almacén aparte
export const photos = () => getStore({ name: 'hoysesale-photos', consistency: 'strong' })
