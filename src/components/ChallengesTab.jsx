import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Check, ThumbsUp, Plus } from 'lucide-react'
import { CITIES, HOME, venueById } from '../lib/cities'
import { api, errorText } from '../lib/api'
import { compressImage } from '../lib/image'
import { Sheet, Spinner, Seg } from './ui'
import Ranking from './Ranking'

export default function ChallengesTab({ city, me, night, onToast }) {
  const [data, setData] = useState(null)
  const [view, setView] = useState('retos')
  const [active, setActive] = useState(null) // reto elegido
  const [rankKey, setRankKey] = useState(0)

  const load = useCallback(() => api(`/api/challenges?city=${city}`).then(setData).catch(err => onToast(errorText(err))), [city])
  useEffect(() => { setData(null); load() }, [load])

  return (
    <main className="challenges">
      <div className="tab-head">
        <h2>Retos de la noche</h2>
        {data && <span className="pts-badge">{data.pts} pts</span>}
      </div>
      <Seg value={view} onChange={setView} options={[['retos', 'Retos'], ['top', `Top ${CITIES[city].name}`], ['propuestas', 'Propón']]} />

      {view === 'retos' && (
        !data ? <p className="empty"><Spinner /></p> : (
          <div className="ch-list">
            {data.challenges.map(c => {
              const done = data.done.includes(c.id)
              return (
                <button key={c.id} className={`ch ${done ? 'done' : ''} ${c.local ? 'local' : ''}`} onClick={() => !done && setActive(c)}>
                  <span className="ch-emoji">{c.emoji}</span>
                  <span className="ch-body">
                    <span className="ch-text">{c.text}</span>
                    {c.local && <span className="ch-tag">Propuesto por @{c.by}</span>}
                  </span>
                  <span className="ch-pts">{done ? <Check size={18} /> : `+${c.pts}`}</span>
                </button>
              )
            })}
            <p className="small center">Los retos cambian cada noche. Cada uno puntúa una vez.</p>
          </div>
        )
      )}
      {view === 'top' && <Ranking city={city} refreshKey={rankKey} />}
      {view === 'propuestas' && <Proposals city={city} onToast={onToast} />}

      {active && (
        <CaptureFlow
          city={city} challenge={active} me={me} night={night} onToast={onToast}
          onClose={() => setActive(null)}
          onDone={() => { load(); setRankKey(k => k + 1) }}
        />
      )}
    </main>
  )
}

function CaptureFlow({ city, challenge, me, night, onClose, onDone, onToast }) {
  const goingVenue = night?.city === city && night.mine && night.mine.venue !== HOME.id ? venueById(city, night.mine.venue) : null
  const [venueWall, setVenueWall] = useState(!!goingVenue)
  const [groups, setGroups] = useState([])
  const [state, setState] = useState({ step: 'choose' }) // choose | checking | ok | fail
  const fileRef = useRef(null)

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const image = await compressImage(file)
    setState({ step: 'checking', image })
    try {
      const r = await api('/api/challenges/complete', { method: 'POST', body: { city, challenge: challenge.id, image, venueWall, groups } })
      setState({ step: r.ok ? 'ok' : 'fail', image, reason: r.reason, points: r.points, rooms: r.rooms })
      if (r.ok || r.already) onDone()
    } catch (err) {
      setState({ step: 'fail', image, reason: errorText(err) })
    }
  }

  const toggle = id => setGroups(g => (g.includes(id) ? g.filter(x => x !== id) : [...g, id]))

  return (
    <Sheet title={challenge.text} onClose={onClose} busy={state.step === 'checking'}>
      {state.image && (
        <div className={`photo ${state.step}`}>
          <img src={state.image} alt="" />
          {state.step === 'checking' && <div className="scan" />}
        </div>
      )}

      {state.step === 'choose' && (
        <>
          <span className="label">¿Dónde se publica la foto?</span>
          <label className={`check ${!goingVenue ? 'disabled' : ''}`}>
            <input type="checkbox" checked={venueWall} disabled={!goingVenue} onChange={e => setVenueWall(e.target.checked)} />
            <span>{goingVenue ? <>Muro público de <strong>{goingVenue.name}</strong></> : 'Muro de tu local (marca primero dónde vas)'}</span>
          </label>
          {me.groups.map(g => (
            <label key={g.id} className="check">
              <input type="checkbox" checked={groups.includes(g.id)} onChange={() => toggle(g.id)} />
              <span>{g.name} <span className="muted">· grupo privado</span></span>
            </label>
          ))}
          {venueWall && <p className="small warn">En el muro público sale tu @ con la foto, aunque vayas en modo amigos o anónimo.</p>}
          <p className="small">Si no marcas nada, sumas los puntos y la foto no la ve nadie. Fotos con desconocidos: que posen y estén de acuerdo.</p>
          <button className="btn primary" onClick={() => { fileRef.current.value = ''; fileRef.current.click() }}><Camera size={18} /> Hacer la foto (+{challenge.pts})</button>
        </>
      )}
      {state.step === 'checking' && <p className="verdict checking"><Spinner /> El árbitro está mirando tu foto…</p>}
      {state.step === 'ok' && (
        <>
          <div className="verdict ok"><span>✅ {state.reason}</span>{state.points > 0 && <span className="points-pop">+{state.points}</span>}</div>
          <button className="btn primary" onClick={onClose}>¡Siguiente!</button>
        </>
      )}
      {state.step === 'fail' && (
        <>
          <p className="verdict fail">❌ {state.reason}</p>
          <button className="btn primary" onClick={() => { fileRef.current.value = ''; fileRef.current.click() }}><Camera size={18} /> Probar otra foto</button>
        </>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
    </Sheet>
  )
}

function Proposals({ city, onToast }) {
  const [items, setItems] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => api(`/api/proposals?city=${city}`).then(r => setItems(r.items)).catch(() => setItems([])), [city])
  useEffect(() => { load() }, [load])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try { await api('/api/proposals', { method: 'POST', body: { city, text } }); setText(''); load(); onToast('Reto propuesto. Ahora que lo vote la gente.') }
    catch (err) { onToast(errorText(err)) }
    setBusy(false)
  }

  async function vote(id) {
    setItems(list => list.map(i => (i.id === id ? { ...i, voted: !i.voted, votes: i.votes + (i.voted ? -1 : 1) } : i)))
    try { await api('/api/proposals/vote', { method: 'POST', body: { city, id } }) } catch { load() }
  }

  return (
    <div className="proposals">
      <p className="small">Propón retos que solo pillen en {CITIES[city].name}. El más votado (mínimo 3 votos) entra en los retos de la noche siguiente y vale +25.</p>
      <form className="propose" onSubmit={submit}>
        <input value={text} maxLength={90} placeholder="Foto con el del kebab de la plaza…" onChange={e => setText(e.target.value)} />
        <button className="send" disabled={busy || text.trim().length < 8} aria-label="Proponer"><Plus size={18} /></button>
      </form>
      {!items && <p className="empty"><Spinner /></p>}
      {items?.length === 0 && <p className="empty">Nadie ha propuesto nada aún. ¡Estrénalo!</p>}
      {items?.map(i => (
        <div key={i.id} className="prop">
          <span className="ch-emoji">{i.emoji}</span>
          <span className="ch-body"><span className="ch-text">{i.text}</span><span className="small">@{i.by}</span></span>
          <button className={`vote ${i.voted ? 'on' : ''}`} onClick={() => vote(i.id)}><ThumbsUp size={16} /> {i.votes}</button>
        </div>
      ))}
    </div>
  )
}
