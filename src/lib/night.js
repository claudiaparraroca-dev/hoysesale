// "La noche" va de 12:00 a 11:59 del día siguiente (hora de Madrid):
// lo que marques el sábado a las 3 de la mañana cuenta como la noche del viernes.
const TZ = 'Europe/Madrid'

function madridParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const get = t => Number(parts.find(p => p.type === t).value)
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') }
}

export function nightKey(now = Date.now()) {
  const p = madridParts(new Date(now - 12 * 3600 * 1000))
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
}

export function nightLabel(key = nightKey()) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const wd = date.toLocaleDateString('es-ES', { weekday: 'long', timeZone: 'UTC' })
  return `Noche del ${wd} ${d}`
}

export function hash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193)
  return h >>> 0
}
