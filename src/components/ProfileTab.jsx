import { useEffect, useState } from 'react'
import { Globe, Lock, Search, UserPlus, UserCheck, X, Smartphone, LogOut, ShieldCheck, Trash2, FileText, MonitorSmartphone } from 'lucide-react'
import { CITIES } from '../lib/cities'
import { api, errorText, setSession } from '../lib/api'
import { Spinner, Person, Avatar, Sheet } from './ui'
import Legal from './Legal'
import AdminPanel from './AdminPanel'

export default function ProfileTab({ me, refreshMe, onToast }) {
  const { user } = me
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState(null) // 'link' | 'delete' | 'privacy' | 'terms' | 'admin'

  async function patch(body) {
    setBusy(true)
    try { await api('/api/me', { method: 'PATCH', body }); await refreshMe() } catch (err) { onToast(errorText(err)) }
    setBusy(false)
  }

  async function friendAction(id, action) {
    try { await api(`/api/friends/${id}/${action}`, { method: 'POST' }); await refreshMe() } catch (err) { onToast(errorText(err)) }
  }

  async function logout() {
    if (!confirm('¿Cerrar sesión en este móvil? Para volver a entrar necesitarás un código desde otro móvil donde tengas la sesión abierta.')) return
    try { await api('/api/logout', { method: 'POST' }) } catch { /* aunque falle, salimos */ }
    setSession(null)
    location.reload()
  }

  async function logoutOthers() {
    if (!confirm('¿Cerrar la sesión en todos los demás dispositivos?')) return
    try { await api('/api/logout-others', { method: 'POST' }); await refreshMe(); onToast('Listo: solo queda abierta en este móvil.') }
    catch (err) { onToast(errorText(err)) }
  }

  return (
    <main className="profile">
      <section className="me-card">
        <Avatar p={user} size="xl" />
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
          <button key={id} className={user.city === id ? 'sel' : ''} disabled={busy} onClick={() => patch({ city: id })}>{c.name}</button>
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

      {user.admin && (
        <>
          <h3 className="mini-title">Administración</h3>
          <button className="btn ghost" onClick={() => setSheet('admin')}><ShieldCheck size={16} /> Panel de moderación</button>
        </>
      )}

      <h3 className="mini-title">Cuenta y seguridad</h3>
      <div className="menu">
        <button onClick={() => setSheet('link')}><Smartphone size={18} /><span>Entrar desde otro móvil</span></button>
        <button onClick={logoutOthers}><MonitorSmartphone size={18} /><span>Cerrar sesión en otros dispositivos</span><em>{user.sessions}</em></button>
        <button onClick={() => setSheet('privacy')}><FileText size={18} /><span>Política de privacidad</span></button>
        <button onClick={() => setSheet('terms')}><FileText size={18} /><span>Condiciones de uso</span></button>
        <button onClick={logout}><LogOut size={18} /><span>Cerrar sesión</span></button>
        <button className="danger" onClick={() => setSheet('delete')}><Trash2 size={18} /><span>Borrar mi cuenta</span></button>
      </div>

      {sheet === 'link' && <LinkSheet onClose={() => setSheet(null)} />}
      {sheet === 'delete' && <DeleteSheet username={user.un} onClose={() => setSheet(null)} />}
      {(sheet === 'privacy' || sheet === 'terms') && <Legal page={sheet} onClose={() => setSheet(null)} />}
      {sheet === 'admin' && <AdminPanel onClose={() => setSheet(null)} onToast={onToast} />}
    </main>
  )
}

function LinkSheet({ onClose }) {
  const [code, setCode] = useState(null)
  const [error, setError] = useState('')
  const [left, setLeft] = useState(600)
  useEffect(() => {
    api('/api/sessions/link', { method: 'POST' }).then(r => setCode(r.code)).catch(err => setError(errorText(err)))
    const t = setInterval(() => setLeft(l => Math.max(0, l - 1)), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <Sheet title="Entrar desde otro móvil" onClose={onClose}>
      <p className="small">En el otro móvil abre la app, pulsa <strong>«Ya tengo cuenta en otro móvil»</strong> y escribe este código. Sirve una sola vez. No se lo enseñes a nadie.</p>
      {error && <p className="error">{error}</p>}
      {!code && !error && <Spinner />}
      {code && <div className="big-code">{code.slice(0, 4)} {code.slice(4)}</div>}
      {code && <p className="small center">{left > 0 ? `Caduca en ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Caducado. Cierra y genera otro.'}</p>}
    </Sheet>
  )
}

function DeleteSheet({ username, onClose }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function remove() {
    setBusy(true); setError('')
    try {
      await api('/api/me', { method: 'DELETE', body: { confirm: text.trim().toLowerCase() } })
      setSession(null)
      location.reload()
    } catch (err) { setError(errorText(err)); setBusy(false) }
  }
  return (
    <Sheet title="Borrar mi cuenta" onClose={onClose} busy={busy}>
      <p className="small">Se borrará al momento y para siempre: tu perfil, amistades, grupos, mensajes, fotos, puntos y propuestas. No se puede deshacer.</p>
      <label className="label" htmlFor="confirm">Escribe tu usuario <strong>{username}</strong> para confirmar</label>
      <input id="confirm" className="text-in" value={text} autoCapitalize="none" onChange={e => setText(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button className="btn danger-solid" disabled={busy || text.trim().toLowerCase() !== username} onClick={remove}>{busy ? <Spinner /> : 'Borrar mi cuenta para siempre'}</button>
    </Sheet>
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
