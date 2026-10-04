// Cliente del backend. La sesión (id + token) se guarda solo en este dispositivo.
const SESSION_KEY = 'hs:session'

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
}

export function setSession(s) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch { /* modo privado */ }
}

export class ApiError extends Error {
  constructor(status, code) {
    super(code || `HTTP ${status}`)
    this.status = status
    this.code = code
  }
}

const authHeader = () => {
  const s = getSession()
  return s ? { authorization: `Bearer ${s.id}.${s.token}` } : {}
}

export async function api(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(path, {
      method,
      headers: { 'content-type': 'application/json', ...authHeader() },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'offline')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error)
  return data
}

// Las fotos necesitan la cabecera de sesión, así que se descargan con fetch
const photoCache = new Map()
export function photoUrl(id) {
  if (!photoCache.has(id)) {
    photoCache.set(id, fetch(`/api/photo/${id}`, { headers: authHeader() })
      .then(r => (r.ok ? r.blob() : null))
      .then(b => (b ? URL.createObjectURL(b) : null))
      .catch(() => null))
  }
  return photoCache.get(id)
}

export const ERRORS = {
  offline: 'Sin conexión. Inténtalo en un momento.',
  busy: 'Mucha gente subiendo fotos. Prueba en unos segundos.',
  upstream: 'El árbitro va un poco perjudicado. Prueba otra vez.',
  username: 'El @usuario: 3-20 letras minúsculas, números, punto o guion bajo.',
  'username-taken': 'Ese @usuario ya está pillado.',
  name: 'Pon un nombre de al menos 2 letras.',
  age: 'Tienes que ser mayor de 18 años.',
  'not-found': 'No existe.',
  full: 'Ese grupo está lleno.',
  'too-many-groups': 'Puedes estar como mucho en 15 grupos.',
  'not-going': 'Para escribir aquí marca primero que vas a este local.',
  'too-fast': 'Más despacio, fiera.',
  text: 'El reto tiene que tener al menos 8 letras.',
  'too-many-proposals': 'Ya tienes 3 retos propuestos. Espera a que salgan.',
  forbidden: 'No tienes acceso.',
  terms: 'Tienes que aceptar las condiciones y la privacidad.',
  'too-many-signups': 'Demasiadas cuentas creadas desde esta conexión. Prueba mañana.',
  'too-many': 'Demasiados intentos. Espera un poco.',
  'bad-code': 'Código incorrecto o caducado.',
  confirm: 'Escribe tu usuario exactamente para confirmar.',
}

export const errorText = err => ERRORS[err?.code] || 'Algo ha fallado. Inténtalo de nuevo.'
