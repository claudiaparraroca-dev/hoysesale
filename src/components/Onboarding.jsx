import { useState } from 'react'
import { Globe, Lock } from 'lucide-react'
import { CITIES } from '../lib/cities'
import { api, errorText } from '../lib/api'
import { Spinner } from './ui'

export default function Onboarding({ onDone }) {
  const [f, setF] = useState({ name: '', username: '', birthdate: '', city: 'girona', public: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try { onDone(await api('/api/signup', { method: 'POST', body: f })) }
    catch (err) { setError(errorText(err)); setBusy(false) }
  }

  const ready = f.name.trim().length >= 2 && f.username.length >= 3 && f.birthdate

  return (
    <div className="app onboarding">
      <div className="hero">
        <h1 className="brand-big">hoy<span>se</span>sale</h1>
        <p>Descubre dónde sale la gente esta noche, queda con tu grupo y completa los retos de la noche.</p>
      </div>

      <form className="card-form" onSubmit={submit}>
        <label htmlFor="name">Nombre</label>
        <input id="name" value={f.name} maxLength={30} placeholder="Cómo te llaman" onChange={e => set('name', e.target.value)} />

        <label htmlFor="username">@usuario</label>
        <input id="username" value={f.username} maxLength={20} autoCapitalize="none" placeholder="tu_usuario"
          onChange={e => set('username', e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))} />

        <label htmlFor="birth">Fecha de nacimiento <span className="muted">(solo +18)</span></label>
        <input id="birth" type="date" value={f.birthdate} max={new Date().toISOString().slice(0, 10)} onChange={e => set('birthdate', e.target.value)} />

        <span className="label">¿Dónde sales?</span>
        <div className="city-grid">
          {Object.entries(CITIES).map(([id, c]) => (
            <button type="button" key={id} className={f.city === id ? 'sel' : ''} onClick={() => set('city', id)}>
              {c.name}
            </button>
          ))}
        </div>

        <span className="label">Perfil</span>
        <div className="privacy-grid">
          <button type="button" className={f.public ? 'sel' : ''} onClick={() => set('public', true)}>
            <Globe size={18} /><strong>Público</strong><span>Puedes elegir salir con tu nombre en los locales.</span>
          </button>
          <button type="button" className={!f.public ? 'sel' : ''} onClick={() => set('public', false)}>
            <Lock size={18} /><strong>Privado</strong><span>Solo tus amigos ven dónde vas. Nunca sales en público.</span>
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy || !ready}>{busy ? <Spinner /> : 'Crear cuenta'}</button>
        <p className="small">Al entrar confirmas que tienes 18 años o más. Sin email ni contraseña: tu sesión vive en este móvil (desde Perfil puedes pasarla a otro).</p>
      </form>
    </div>
  )
}
