import { useState } from 'react'
import { Globe, Lock } from 'lucide-react'
import { CITIES } from '../lib/cities'
import { TERMS_VERSION } from '../lib/legal'
import { api, errorText } from '../lib/api'
import { Spinner } from './ui'
import Legal from './Legal'

export default function Onboarding({ onDone }) {
  const [mode, setMode] = useState('signup') // signup | code
  const [f, setF] = useState({ name: '', username: '', birthdate: '', city: 'girona', public: true })
  const [accepted, setAccepted] = useState(false)
  const [code, setCode] = useState('')
  const [legal, setLegal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setF(s => ({ ...s, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      onDone(mode === 'signup'
        ? await api('/api/signup', { method: 'POST', body: { ...f, terms: TERMS_VERSION } })
        : await api('/api/sessions/claim', { method: 'POST', body: { code } }))
    } catch (err) { setError(errorText(err)); setBusy(false) }
  }

  const ready = mode === 'signup'
    ? f.name.trim().length >= 2 && f.username.length >= 3 && f.birthdate && accepted
    : code.replace(/[^a-z0-9]/gi, '').length === 8

  return (
    <div className="app onboarding">
      <div className="hero">
        <h1 className="brand-big">hoy<span>se</span>sale</h1>
        <p>Descubre dónde sale la gente esta noche, queda con tu grupo y completa los retos de la noche.</p>
      </div>

      {mode === 'signup' ? (
        <form className="card-form" onSubmit={submit}>
          <label htmlFor="name">Nombre</label>
          <input id="name" value={f.name} maxLength={30} autoComplete="given-name" placeholder="Cómo te llaman" onChange={e => set('name', e.target.value)} />

          <label htmlFor="username">@usuario</label>
          <input id="username" value={f.username} maxLength={20} autoCapitalize="none" autoComplete="username" placeholder="tu_usuario"
            onChange={e => set('username', e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))} />

          <label htmlFor="birth">Fecha de nacimiento <span className="muted">(solo +18)</span></label>
          <input id="birth" type="date" value={f.birthdate} max={new Date().toISOString().slice(0, 10)} onChange={e => set('birthdate', e.target.value)} />

          <span className="label">¿Dónde sales?</span>
          <div className="city-grid">
            {Object.entries(CITIES).map(([id, c]) => (
              <button type="button" key={id} className={f.city === id ? 'sel' : ''} onClick={() => set('city', id)}>{c.name}</button>
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

          <label className="check terms">
            <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
            <span>Tengo 18 años o más y acepto las <button type="button" className="inline-link" onClick={() => setLegal('terms')}>condiciones de uso</button> y la <button type="button" className="inline-link" onClick={() => setLegal('privacy')}>política de privacidad</button>.</span>
          </label>

          {error && <p className="error">{error}</p>}
          <button className="btn primary" disabled={busy || !ready}>{busy ? <Spinner /> : 'Crear cuenta'}</button>
          <button type="button" className="btn ghost" onClick={() => { setMode('code'); setError('') }}>Ya tengo cuenta en otro móvil</button>
        </form>
      ) : (
        <form className="card-form" onSubmit={submit}>
          <p className="small">En tu otro móvil ve a <strong>Perfil → Entrar desde otro móvil</strong> y escribe aquí el código de 8 letras. Caduca en 10 minutos.</p>
          <label htmlFor="code">Código</label>
          <input id="code" className="code-input" value={code} maxLength={9} autoCapitalize="characters" autoComplete="one-time-code" onChange={e => setCode(e.target.value.toUpperCase())} />
          {error && <p className="error">{error}</p>}
          <button className="btn primary" disabled={busy || !ready}>{busy ? <Spinner /> : 'Entrar'}</button>
          <button type="button" className="btn ghost" onClick={() => { setMode('signup'); setError('') }}>Crear una cuenta nueva</button>
        </form>
      )}

      {legal && <Legal page={legal} onClose={() => setLegal(null)} />}
    </div>
  )
}
