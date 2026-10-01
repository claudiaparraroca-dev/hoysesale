import { useEffect, useState } from 'react'
import { Globe, Lock, Search, UserPlus, UserCheck, X, Link2, LogOut } from 'lucide-react'
import { CITIES } from '../lib/cities'
import { api, errorText, getSession, setSession } from '../lib/api'
import { Spinner, Person } from './ui'

export default function ProfileTab({ me, refreshMe, onToast }) {
  const { user } = me
  const [busy, setBusy] = useState(false)

  async function patch(body) {
    setBusy(true)
    try { await api('/api/me', { method: 'PATCH', body }); await refreshMe() } catch (err) { onToast(errorText(err)) }
    setBusy(false)
  }

  async function friendAction(id, action) {
    try { await api(`/api/friends/${id}/${action}`, { method: 'POST' }); await refreshMe() } catch (err) { onToast(errorText(err)) }
  }

  async function copyLogin() {
    const s = getSession()
    // En el #fragmento: no viaja al servidor ni queda en los logs
    const url = `${location.origin}/#login=${s.id}.${s.token}`
    if (!confirm('Esto copia un enlace que abre TU cuenta en otro móvil. No se lo pases a nadie. ¿Copiar?')) return
    try { await navigator.clipboard.writeText(url); onToast('Enlace copiado. Ábrelo en tu otro móvil.') } catch { prompt('Copia este enlace:', url) }
  }

  function logout() {
    if (!confirm('Si sales sin guardar el enlace de acceso, no podrás volver a esta cuenta. ¿Salir?')) return
    setSession(null)
    location.reload()
  }

  return (
    <main className="profile">
      <section className="me-card">
        <span className="av xl">{user.e}</span>
        <div><h2>{user.n}</h2><span className="muted">@{user.un}</span></div>
      </section>

      <span className="label">Privacidad</span>
      <div className="privacy-grid">
        <button className={user.public ? 'sel' : ''} disabled={busy} onClick={() => !user.public && patch({ public: true })}>
          <Globe size={18} /><strong>Público</strong><span>Puedes salir con tu @ en los locales.</span>
        </button>
        <button className={!user.public ? 'sel' : ''} disabled={busy} onClick={() => user.public && patch({ public: false })}>
          <Lock size={18} /><strong>Privado</strong><span>Solo tus amigos ven dónde vas.</span>
        </button>
      </div>

      <span className="label">Mi zona</span>
      <div className="city-grid">
        {Object.entries(CITIES).map(([id, c]) => (
          <button key={id} className={user.city === id ? 'sel' : ''} disabled={busy} onClick={() => patch({ city: id })}><span>{c.emoji}</span>{c.name}</button>
        ))}
      </div>

      {me.reqIn.length > 0 && (
        <>
          <h3 className="mini-title">Solicitudes de amistad</h3>
          {me.reqIn.map(p => (
            <Person key={p.id} p={p} right={
              <span className="row-actions">
                <button className="chip-btn ok" onClick={() => friendAction(p.id, 'accept')}><UserCheck size={16} /></button>
                <button className="chip-btn" onClick={() => friendAction(p.id, 'remove')}><X size={16} /></button>
              </span>
            } />
          ))}
        </>
      )}

      <h3 className="mini-title">Añadir amigos</h3>
      <FriendSearch me={me} onAction={friendAction} />

      <h3 className="mini-title">Amigos ({me.friends.length})</h3>
      {me.friends.length === 0 && <p className="small">Busca a tus amigos por su @ para ver dónde salen.</p>}
      {me.friends.map(p => (
        <Person key={p.id} p={p} right={<button className="chip-btn" onClick={() => confirm(`¿Quitar a @${p.un}?`) && friendAction(p.id, 'remove')}><X size={16} /></button>} />
      ))}
      {me.reqOut.length > 0 && <p className="small">Pendientes: {me.reqOut.map(p => `@${p.un}`).join(', ')}</p>}

      <div className="danger-zone">
        <button className="btn ghost" onClick={copyLogin}><Link2 size={16} /> Pasar mi cuenta a otro móvil</button>
        <button className="btn ghost danger" onClick={logout}><LogOut size={16} /> Cerrar sesión</button>
      </div>
    </main>
  )
}

function FriendSearch({ me, onAction }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  useEffect(() => {
    if (q.length < 2) { setResults(null); return }
    const t = setTimeout(() => api(`/api/search?q=${encodeURIComponent(q)}`).then(r => setResults(r.results)).catch(() => setResults([])), 300)
    return () => clearTimeout(t)
  }, [q])
  const friends = new Set(me.friends.map(f => f.id))
  const sent = new Set(me.reqOut.map(f => f.id))
  return (
    <div className="search">
      <div className="search-box"><Search size={16} /><input value={q} placeholder="Buscar @usuario" autoCapitalize="none" onChange={e => setQ(e.target.value.toLowerCase())} /></div>
      {results === null && q.length >= 2 && <Spinner />}
      {results?.length === 0 && <p className="small">Nadie con ese @.</p>}
      {results?.map(p => (
        <Person key={p.id} p={p} right={
          friends.has(p.id) ? <span className="muted small">Amigos</span>
            : sent.has(p.id) ? <span className="muted small">Enviada</span>
            : <button className="chip-btn" onClick={() => onAction(p.id, 'request')}><UserPlus size={16} /> Añadir</button>
        } />
      ))}
    </div>
  )
}
