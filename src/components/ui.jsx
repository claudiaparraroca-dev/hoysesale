import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { photoUrl } from '../lib/api'
import { hash } from '../lib/night'
import { TYPE_LABEL } from '../lib/cities'

export function Sheet({ title, onClose, children, busy }) {
  return (
    <div className="overlay" onClick={busy ? undefined : onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <span className="sheet-title">{title}</span>
          {!busy && <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>}
        </div>
        {children}
      </div>
    </div>
  )
}

export const Spinner = ({ size = 18 }) => <Loader2 className="spin" size={size} />

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg" role="tablist">
      {options.map(([id, label]) => (
        <button key={id} role="tab" aria-selected={value === id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>{label}</button>
      ))}
    </div>
  )
}

// Iniciales con un color fijo por persona (sin avatares)
const initials = name => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
const hue = key => hash(String(key || '')) % 360

export function Avatar({ p, size = 'md' }) {
  const [broken, setBroken] = useState(false)
  const photo = p?.p && p?.id && !broken
  return (
    <span className={`av ${size}`} style={{ '--h': hue(p?.un || p?.n) }} title={p?.un ? `@${p.un}` : undefined}>
      {photo ? <img src={`/api/avatar/${p.id}?v=${p.p}`} alt="" loading="lazy" onError={() => setBroken(true)} /> : initials(p?.n)}
    </span>
  )
}

export function Person({ p, onClick, right }) {
  return (
    <div className="person" onClick={onClick} role={onClick ? 'button' : undefined}>
      <Avatar p={p} />
      <span className="person-names"><strong>{p.n}</strong><span>@{p.un}</span></span>
      {right}
    </div>
  )
}

export function Faces({ people, max = 4 }) {
  if (!people?.length) return null
  return (
    <span className="faces">
      {people.slice(0, max).map(p => <Avatar key={p.id} p={p} size="xs" />)}
      {people.length > max && <span className="more">+{people.length - max}</span>}
    </span>
  )
}

// Portada de un local: foto de Google Maps si hay, si no un "cartel" generado con el nombre
export function VenueCover({ city, venue, photos, photoBy, className = '' }) {
  const [failed, setFailed] = useState(false)
  const h = hue(venue.id)
  const showPhoto = photos && !failed && venue.type !== 'home'
  return (
    <div className={`cover ${className}`} style={{ '--h': h }}>
      {showPhoto && (
        <img src={`/api/venue-photo/${city}/${venue.id}`} alt={`Fachada de ${venue.name}`} loading="lazy" onError={() => setFailed(true)} />
      )}
      {!showPhoto && (
        <div className="cover-art" aria-hidden="true">
          <span className="cover-type">{TYPE_LABEL[venue.type] || ''}</span>
          <span className="cover-name">{venue.name}</span>
        </div>
      )}
      {showPhoto && photoBy && <span className="cover-credit">Foto: {photoBy} · Google</span>}
    </div>
  )
}

export function AuthImg({ id, alt }) {
  const [src, setSrc] = useState(null)
  useEffect(() => { let alive = true; photoUrl(id).then(u => alive && setSrc(u)); return () => { alive = false } }, [id])
  return src ? <img src={src} alt={alt} loading="lazy" /> : <div className="img-ph"><Spinner /></div>
}

export function timeAgo(ts) {
  const m = Math.round((Date.now() - ts) / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  return `hace ${h} h`
}
