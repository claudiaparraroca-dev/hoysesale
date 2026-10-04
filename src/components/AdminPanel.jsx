import { useCallback, useEffect, useState } from 'react'
import { Trash2, RotateCcw, Ban } from 'lucide-react'
import { CITIES } from '../lib/cities'
import { api, errorText } from '../lib/api'
import { Sheet, Spinner, Seg, Avatar, AuthImg, timeAgo } from './ui'

export default function AdminPanel({ onClose, onToast }) {
  const [tab, setTab] = useState('reports')
  return (
    <Sheet title="Panel de moderación" onClose={onClose}>
      <Seg value={tab} onChange={setTab} options={[['reports', 'Denuncias'], ['stats', 'Números']]} />
      {tab === 'reports' ? <Reports onToast={onToast} /> : <Stats />}
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
