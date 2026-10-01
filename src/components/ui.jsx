import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { photoUrl } from '../lib/api'

export function Sheet({ title, onClose, children, busy }) {
  return (
    <div className="overlay" onClick={busy ? undefined : onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="sheet-title">{title}</span>
          {!busy && <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={22} /></button>}
        </div>
        {children}
      </div>
    </div>
  )
}

export const Spinner = ({ size = 18 }) => <Loader2 className="spin" size={size} />

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map(([id, label]) => (
        <button key={id} className={value === id ? 'on' : ''} onClick={() => onChange(id)}>{label}</button>
      ))}
    </div>
  )
}

export function Person({ p, onClick, right }) {
  return (
    <button className="person" onClick={onClick} disabled={!onClick}>
      <span className="av">{p.e}</span>
      <span className="person-names"><strong>{p.n}</strong><span>@{p.un}</span></span>
      {right}
    </button>
  )
}

export function Faces({ people, max = 5 }) {
  if (!people?.length) return null
  return (
    <span className="faces">
      {people.slice(0, max).map(p => <span key={p.id} className="av sm" title={`@${p.un}`}>{p.e}</span>)}
      {people.length > max && <span className="more">+{people.length - max}</span>}
    </span>
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
