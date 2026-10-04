import { useEffect, useState } from 'react'
import { Search, UserPlus, UserCheck, Check, X } from 'lucide-react'
import { api } from '../lib/api'
import { Spinner, Person } from './ui'

// Buscador tipo Instagram + "Amigos en común" debajo cuando no estás buscando
export default function FindPeople({ me, onAction }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [suggested, setSuggested] = useState(null)
  const [pending, setPending] = useState({}) // id → relación tras pulsar (respuesta instantánea)

  useEffect(() => {
    const term = q.trim()
    if (!term) { setResults(null); return }
    setResults(r => r) // mantenemos los anteriores mientras llega la respuesta
    const t = setTimeout(() => {
      api(`/api/search?q=${encodeURIComponent(term)}`).then(r => setResults(r.results)).catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    api('/api/suggestions').then(r => setSuggested(r.results)).catch(() => setSuggested([]))
  }, [me.friends.length])

  async function act(p, action) {
    setPending(s => ({ ...s, [p.id]: action === 'accept' ? 'friend' : 'sent' }))
    await onAction(p.id, action)
  }

  async function dismiss(p) {
    setSuggested(list => list.filter(x => x.id !== p.id))
    api('/api/suggestions/dismiss', { method: 'POST', body: { id: p.id } }).catch(() => {})
  }

  const button = p => {
    const rel = pending[p.id] || p.relation
    if (rel === 'friend') return <span className="rel-tag"><Check size={14} /> Amigos</span>
    if (rel === 'sent') return <span className="rel-tag">Enviada</span>
    if (rel === 'received') return <button className="chip-btn ok" onClick={() => act(p, 'accept')}><UserCheck size={14} /> Aceptar</button>
    return <button className="chip-btn primary-chip" onClick={() => act(p, 'request')}><UserPlus size={14} /> Añadir</button>
  }

  const mutualText = p => p.mutual > 0
    ? (p.via?.length ? `Amigo de ${p.via.join(' y ')}${p.mutual > p.via.length ? ` y ${p.mutual - p.via.length} más` : ''}` : `${p.mutual} ${p.mutual === 1 ? 'amigo' : 'amigos'} en común`)
    : null

  return (
    <div className="find-people">
      <div className="search-box">
        <Search size={16} />
        <input value={q} placeholder="Buscar por nombre o @usuario" autoCapitalize="none" autoComplete="off" onChange={e => setQ(e.target.value)} />
        {q && <button className="icon-btn" onClick={() => setQ('')} aria-label="Borrar búsqueda"><X size={16} /></button>}
      </div>

      {q.trim() ? (
        <div className="people">
          {results === null && <p className="empty"><Spinner /></p>}
          {results?.length === 0 && <p className="small">No hay nadie que se parezca a «{q}».</p>}
          {results?.map(p => <PersonRow key={p.id} p={p} sub={mutualText(p)} right={button(p)} />)}
        </div>
      ) : (
        <>
          <h3 className="mini-title">Amigos en común</h3>
          {suggested === null && <p className="empty"><Spinner /></p>}
          {suggested?.length === 0 && (
            <p className="small">{me.friends.length ? 'Cuando tus amigos agreguen a más gente, aquí verás a quién podrías conocer.' : 'Añade a tus primeros amigos y aquí te saldrá gente que tenéis en común.'}</p>
          )}
          <div className="people">
            {suggested?.map(p => (
              <PersonRow key={p.id} p={p} sub={mutualText(p)} right={
                <span className="row-actions">
                  {button(p)}
                  {(pending[p.id] || p.relation) === 'none' && <button className="icon-btn" onClick={() => dismiss(p)} aria-label="No sugerir"><X size={16} /></button>}
                </span>
              } />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PersonRow({ p, sub, right }) {
  return (
    <div className="person-row">
      <Person p={p} right={right} />
      {sub && <span className="mutual">{sub}</span>}
    </div>
  )
}
