import { useCallback, useEffect, useState } from 'react'
import { Trash2, RotateCcw, Ban, Search } from 'lucide-react'
import { CITIES } from '../lib/cities'
import { api, errorText } from '../lib/api'
import { Sheet, Spinner, Seg, Avatar, AuthImg, timeAgo } from './ui'

export default function AdminPanel({ onClose, onToast }) {
  const [tab, setTab] = useState('reports')
  return (
    <Sheet title="Panel de moderación" onClose={onClose}>
      <Seg value={tab} onChange={setTab} options={[['reports', 'Denuncias'], ['users', 'Usuarios'], ['stats', 'Números']]} />
      {tab === 'reports' && <Reports onToast={onToast} />}
      {tab === 'users' && <Users onToast={onToast} />}
      {tab === 'stats' && <Stats />}
    </Sheet>
  )
}

function Reports({ onToast }) {
  const [items, setItems] = useState(null)
  const load = useCallback(() => api('/api/admin/reports').then(r => setItems(r.items)).catch(err => { onToast(errorText(err)); setItems([]) }), [])
  useEffect(() => { load() }, [load])

  async function act(item, action) {
    try {
      if (action === 'ban') {
        if (!confirm(`¿Expulsar a @${item.by?.un}? Se borran todos sus datos y no podrá volver con ese @.`)) return
        await api('/api/admin/ban', { method: 'POST', body: { uid: item.uid } })
      } else {
        await api('/api/admin/resolve', { method: 'POST', body: { key: item.key, action } })
      }
      onToast(action === 'delete' ? 'Borrado' : action === 'restore' ? 'Restaurado' : 'Usuario expulsado')
      load()
    } catch (err) { onToast(errorText(err)) }
  }

  if (!items) return <p className="empty"><Spinner /></p>
  if (!items.length) return <p className="empty">No hay denuncias pendientes. 🎉</p>
  return (
    <div className="reports">
      {items.map(i => (
        <div key={i.key} className="report">
          <div className="report-head">
            {i.by && <Avatar p={i.by} size="sm" />}
            <span><strong>@{i.by?.un || 'usuario borrado'}</strong> · {i.kind === 'msg' ? 'mensaje' : 'foto'} · {i.room.startsWith('g:') ? 'grupo privado' : 'sala de local'}</span>
            <span className="report-count">{i.reports} ⚑</span>
          </div>
          {i.kind === 'post' && <div className="report-photo"><AuthImg id={i.id} alt="" /></div>}
          <p className="report-text">{i.text}</p>
          <span className="small">{timeAgo(i.at)}</span>
          <div className="row-actions">
            <button className="chip-btn" onClick={() => act(i, 'delete')}><Trash2 size={14} /> Borrar</button>
            <button className="chip-btn" onClick={() => act(i, 'restore')}><RotateCcw size={14} /> Restaurar</button>
            {i.by && <button className="chip-btn danger-chip" onClick={() => act(i, 'ban')}><Ban size={14} /> Expulsar</button>}
          </div>
        </div>
      ))}
    </div>
  )
}

function Stats() {
  const [s, setS] = useState(null)
  useEffect(() => { api('/api/admin/stats').then(setS).catch(() => setS({})) }, [])
  if (!s) return <p className="empty"><Spinner /></p>
  return (
    <div className="admin-stats">
      <div className="venue-stat"><strong>{s.users ?? '–'}</strong><span>usuarios</span></div>
      <div className="venue-stat"><strong>{s.openReports ?? '–'}</strong><span>denuncias abiertas</span></div>
      {Object.entries(s.tonight || {}).map(([city, t]) => (
        <div key={city} className="venue-stat"><strong>{t.going}</strong><span>salen hoy en {CITIES[city].name}</span></div>
      ))}
    </div>
  )
}

function Users({ onToast }) {
  const [q, setQ] = useState('')
  const [data, setData] = useState(null)
  const load = useCallback(term => api(`/api/admin/users?q=${encodeURIComponent(term)}`).then(setData).catch(err => { onToast(errorText(err)); setData({ users: [] }) }), [])
  useEffect(() => { const t = setTimeout(() => load(q), 300); return () => clearTimeout(t) }, [q, load])

  async function ban(u) {
    if (!confirm(`¿Expulsar a @${u.un}? Se borran todos sus datos y no podrá volver con ese @.`)) return
    try { await api('/api/admin/ban', { method: 'POST', body: { uid: u.id } }); onToast('Usuario expulsado'); load(q) }
    catch (err) { onToast(errorText(err)) }
  }

  return (
    <div>
      <div className="search-box users-search"><Search size={16} /><input value={q} placeholder="Buscar por @ o nombre" autoCapitalize="none" onChange={e => setQ(e.target.value)} /></div>
      {!data && <p className="empty"><Spinner /></p>}
      {data && <p className="small">{data.total} usuarios registrados{q ? ` · ${data.users.length} coinciden` : ''}</p>}
      {data?.users.map(u => (
        <div key={u.id} className="user-row">
          <Avatar p={u} size="sm" />
          <span className="person-names">
            <strong>{u.n} {u.banned && <span className="tag red">expulsado</span>} {u.verified && <span className="tag">verificado</span>}</strong>
            <span className="user-meta">@{u.un} · {CITIES[u.city]?.name || '–'} · {u.public ? 'público' : 'privado'} · {u.friends} amigos · alta {new Date(u.createdAt).toLocaleDateString('es-ES')}</span>
          </span>
          {!u.banned && <button className="chip-btn danger-chip" onClick={() => ban(u)} aria-label={`Expulsar a ${u.un}`}><Ban size={14} /></button>}
        </div>
      ))}
    </div>
  )
}
