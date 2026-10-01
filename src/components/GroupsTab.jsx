import { useEffect, useState } from 'react'
import { ChevronLeft, Plus, LogIn, Share2, LogOut, X } from 'lucide-react'
import { CITIES, TYPE_EMOJI, venueById } from '../lib/cities'
import { api, errorText } from '../lib/api'
import { Sheet, Spinner, Seg, Person } from './ui'
import Chat from './Chat'
import Wall from './Wall'
import Ranking from './Ranking'

const GROUP_EMOJIS = ['🥂', '🍾', '💃', '🔥', '👯', '🦄', '🍹', '🌙', '😈', '👑']

export default function GroupsTab({ me, city, refreshMe, openGroup, setOpenGroup, inviteCode, clearInvite, onToast }) {
  const [dialog, setDialog] = useState(null)

  if (openGroup) return <GroupView id={openGroup} city={city} onBack={() => setOpenGroup(null)} refreshMe={refreshMe} onToast={onToast} />

  return (
    <main className="groups">
      <div className="tab-head"><h2>Grupos</h2></div>
      <p className="small">Grupos privados con tus amigas: chat, dónde va cada una esta noche y retos solo para vosotras.</p>

      {inviteCode && <Invite code={inviteCode} onDismiss={clearInvite} onJoined={async id => { clearInvite(); await refreshMe(); setOpenGroup(id) }} />}

      <div className="room-actions">
        <button className="btn primary" onClick={() => setDialog('create')}><Plus size={18} /> Crear grupo</button>
        <button className="btn ghost" onClick={() => setDialog('join')}><LogIn size={18} /> Tengo código</button>
      </div>

      {me.groups.length === 0 && <p className="empty">Aún no tienes grupos.</p>}
      <div className="room-list">
        {me.groups.map(g => (
          <button key={g.id} className="room-card" onClick={() => setOpenGroup(g.id)}>
            <span className="room-emoji">{g.emoji}</span>
            <span className="room-info"><strong>{g.name}</strong><span>{g.members} {g.members === 1 ? 'miembro' : 'miembros'}</span></span>
          </button>
        ))}
      </div>

      {dialog === 'create' && <CreateGroup onClose={() => setDialog(null)} onCreated={async g => { setDialog(null); await refreshMe(); setOpenGroup(g.id); shareInvite(g, onToast) }} />}
      {dialog === 'join' && <JoinGroup onClose={() => setDialog(null)} onJoined={async id => { setDialog(null); await refreshMe(); setOpenGroup(id) }} />}
    </main>
  )
}

function GroupView({ id, city, onBack, refreshMe, onToast }) {
  const [g, setG] = useState(null)
  const [tab, setTab] = useState('chat')
  useEffect(() => {
    let alive = true
    const load = () => api(`/api/groups/${id}`).then(r => alive && setG(r)).catch(err => onToast(errorText(err)))
    load()
    const t = setInterval(load, 30000)
    return () => { alive = false; clearInterval(t) }
  }, [id])

  async function leave() {
    if (!confirm(`¿Salir de «${g.name}»?`)) return
    try { await api(`/api/groups/${id}/leave`, { method: 'POST' }); await refreshMe(); onBack() }
    catch (err) { onToast(errorText(err)) }
  }

  if (!g) return <main><p className="empty"><Spinner size={24} /></p></main>
  const room = `g:${id}`
  return (
    <main className="group-view">
      <div className="room-head">
        <button className="icon-btn" onClick={onBack} aria-label="Volver"><ChevronLeft size={24} /></button>
        <div className="room-title"><h2>{g.emoji} {g.name}</h2><span className="small">código <strong className="code">{g.code}</strong></span></div>
        <button className="chip-btn" onClick={() => shareInvite(g, onToast)}><Share2 size={16} /> Invitar</button>
      </div>
      <Seg value={tab} onChange={setTab} options={[['chat', 'Chat'], ['donde', 'Esta noche'], ['muro', 'Fotos'], ['top', 'Top']]} />
      {tab === 'chat' && <Chat room={room} onToast={onToast} emptyText="Empezad a liarla por aquí 💬" />}
      {tab === 'donde' && (
        <div className="people">
          {g.members.map(m => {
            const v = m.tonight && venueById(m.tonight.city, m.tonight.venue)
            return (
              <Person key={m.id} p={m} right={
                <span className="where">{v ? <>{v.type === 'home' ? '🛋️' : TYPE_EMOJI[v.type]} {v.name}{m.tonight.city !== city && <em> · {CITIES[m.tonight.city].name}</em>}</> : <span className="muted">Sin plan</span>}</span>
              } />
            )
          })}
        </div>
      )}
      {tab === 'muro' && <Wall room={room} onToast={onToast} emptyText="Las fotos de retos que mandéis al grupo salen aquí." />}
      {tab === 'top' && <Ranking city={city} scope={`group:${id}`} emptyText="Nadie del grupo ha puntuado esta noche." />}
      <button className="btn ghost danger" onClick={leave}><LogOut size={16} /> Salir del grupo</button>
    </main>
  )
}

function CreateGroup({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🥂')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try { onCreated(await api('/api/groups', { method: 'POST', body: { name, emoji } })) }
    catch (err) { setError(errorText(err)); setBusy(false) }
  }
  return (
    <Sheet title="Nuevo grupo" onClose={onClose}>
      <form className="card-form" onSubmit={submit}>
        <label htmlFor="gname">Nombre</label>
        <input id="gname" value={name} maxLength={30} placeholder="Las de siempre, Despedida Laura…" onChange={e => setName(e.target.value)} />
        <div className="avatar-grid">
          {GROUP_EMOJIS.map(x => <button type="button" key={x} className={x === emoji ? 'sel' : ''} onClick={() => setEmoji(x)}>{x}</button>)}
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy || name.trim().length < 2}>{busy ? <Spinner /> : 'Crear e invitar'}</button>
      </form>
    </Sheet>
  )
}

function JoinGroup({ onClose, onJoined }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try { onJoined((await api('/api/groups/join', { method: 'POST', body: { code } })).id) }
    catch (err) { setError(errorText(err)); setBusy(false) }
  }
  return (
    <Sheet title="Unirme a un grupo" onClose={onClose}>
      <form className="card-form" onSubmit={submit}>
        <label htmlFor="gcode">Código de 6 letras</label>
        <input id="gcode" className="code-input" value={code} maxLength={6} autoCapitalize="characters" onChange={e => setCode(e.target.value.toUpperCase())} />
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy || code.trim().length !== 6}>{busy ? <Spinner /> : 'Entrar'}</button>
      </form>
    </Sheet>
  )
}

function Invite({ code, onJoined, onDismiss }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function join() {
    setBusy(true)
    try { onJoined((await api('/api/groups/join', { method: 'POST', body: { code } })).id) }
    catch (err) { setError(errorText(err)); setBusy(false) }
  }
  return (
    <div className="invite">
      <button className="icon-btn invite-x" onClick={onDismiss} aria-label="Descartar"><X size={18} /></button>
      <span className="small">Te han invitado a un grupo</span>
      <strong className="invite-name code">{code}</strong>
      {error && <p className="error">{error}</p>}
      <button className="btn primary" disabled={busy} onClick={join}>{busy ? <Spinner /> : 'Unirme'}</button>
    </div>
  )
}

async function shareInvite(g, onToast) {
  const url = `${location.origin}/?grupo=${g.code}`
  const text = `¡Únete a «${g.name}» ${g.emoji} en hoysesale! Código: ${g.code}`
  if (navigator.share) { try { await navigator.share({ text, url }); return } catch { /* cancelado */ } }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); onToast('Invitación copiada. ¡Pásala por WhatsApp!') }
  catch { onToast(`Código del grupo: ${g.code}`) }
}
