import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Globe, Users, EyeOff, Check } from 'lucide-react'
import { CITIES, HOME, TYPE_EMOJI, TYPE_LABEL, venueById } from '../lib/cities'
import { api, errorText } from '../lib/api'
import { Sheet, Spinner, Seg, Faces, Person } from './ui'
import Chat from './Chat'
import Wall from './Wall'
import Ranking from './Ranking'

const VIS = {
  public: { icon: <Globe size={16} />, label: 'Público', desc: 'Sales con tu @ en el local para todo el mundo.' },
  friends: { icon: <Users size={16} />, label: 'Solo amigos', desc: 'Cuentas en el contador; solo tus amigos ven que eres tú.' },
  anon: { icon: <EyeOff size={16} />, label: 'Anónimo', desc: 'Solo sumas al contador. Nadie sabe que eres tú.' },
}

export default function NightTab({ city, me, onToast, openVenue, setOpenVenue, onNight }) {
  const [night, setNight] = useState(null)
  const [picking, setPicking] = useState(null) // venue id para el selector de visibilidad

  const load = useCallback(async () => {
    try {
      const n = await api(`/api/night?city=${city}`)
      setNight(n)
      onNight(n)
    } catch (err) { onToast(errorText(err)) }
  }, [city])

  useEffect(() => {
    setNight(null)
    load()
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 30000)
    return () => clearInterval(t)
  }, [load])

  async function go(venue, vis) {
    try {
      await api('/api/going', { method: 'POST', body: { city, venue, vis } })
      setPicking(null)
      onToast(venue === HOME.id ? 'Plan de sofá apuntado 🛋️' : `¡Apuntado! Vas a ${venueById(city, venue).name} 🪩`)
      load()
    } catch (err) { onToast(errorText(err)) }
  }

  async function notGoing() {
    try { await api(`/api/going?city=${city}`, { method: 'DELETE' }); load() }
    catch (err) { onToast(errorText(err)) }
  }

  if (!night) return <main><p className="empty"><Spinner size={24} /></p></main>

  const counts = Object.fromEntries(night.venues.map(v => [v.id, v]))
  const picker = picking && (
    <GoingPicker
      venue={venueById(city, picking)} current={night.mine} isPublic={me.user.public}
      onPick={vis => go(picking, vis)} onClose={() => setPicking(null)}
      onNotGoing={night.mine ? () => { setPicking(null); notGoing() } : null}
    />
  )

  if (openVenue) {
    return (
      <>
        <VenueView
          city={city} venue={venueById(city, openVenue)} data={counts[openVenue]} mine={night.mine}
          onBack={() => setOpenVenue(null)} onGo={() => setPicking(openVenue)} onNotGoing={notGoing} onToast={onToast}
        />
        {picker}
      </>
    )
  }

  const venues = CITIES[city].venues
    .map(v => ({ ...v, ...counts[v.id] }))
    .sort((a, b) => b.count - a.count || b.friends.length - a.friends.length || a.name.localeCompare(b.name))
  const max = Math.max(1, ...venues.map(v => v.count))
  const home = counts[HOME.id]
  const mineVenue = night.mine && venueById(city, night.mine.venue)

  return (
    <main className="night">
      <section className="hero-night">
        <p className="eyebrow">{night.label}</p>
        <h2>¿Dónde se sale hoy?</h2>
        <p className="big-count"><strong>{night.total}</strong> {night.total === 1 ? 'persona sale' : 'personas salen'} en {CITIES[city].name}</p>
      </section>

      <section className={`my-plan ${night.mine ? 'set' : ''}`}>
        {mineVenue ? (
          <>
            <span className="plan-emoji">{mineVenue.type === 'home' ? '🛋️' : TYPE_EMOJI[mineVenue.type]}</span>
            <div className="plan-body">
              <span className="small">Tu plan de esta noche</span>
              <strong>{mineVenue.name}</strong>
              <span className="vis-chip">{VIS[night.mine.vis].icon} {VIS[night.mine.vis].label}</span>
            </div>
            <button className="chip-btn" onClick={() => setPicking(night.mine.venue)}>Cambiar</button>
          </>
        ) : (
          <p>Aún no has dicho dónde vas. Toca un local y dale a <strong>"Voy"</strong>.</p>
        )}
      </section>

      <div className="venue-list">
        {venues.map(v => (
          <button key={v.id} className={`venue ${night.mine?.venue === v.id ? 'mine' : ''}`} onClick={() => setOpenVenue(v.id)}>
            <span className="venue-emoji">{TYPE_EMOJI[v.type]}</span>
            <span className="venue-body">
              <span className="venue-name">{v.name}</span>
              <span className="venue-meta">{TYPE_LABEL[v.type]}{v.area ? ` · ${v.area}` : ''}</span>
              <span className="heat"><span style={{ width: `${(v.count / max) * 100}%` }} /></span>
              {(v.friends.length > 0 || v.public.length > 0) && (
                <span className="venue-people">
                  <Faces people={[...v.friends, ...v.public]} />
                  {v.friends.length > 0 && <span className="friends-txt">{v.friends.length} {v.friends.length === 1 ? 'amigo' : 'amigos'}</span>}
                </span>
              )}
            </span>
            <span className="venue-count">{v.count > 0 && '🔥'}<strong>{v.count}</strong></span>
            <ChevronRight size={18} className="muted" />
          </button>
        ))}
        <button className={`venue home ${night.mine?.venue === HOME.id ? 'mine' : ''}`} onClick={() => setPicking(HOME.id)}>
          <span className="venue-emoji">🛋️</span>
          <span className="venue-body">
            <span className="venue-name">{HOME.name}</span>
            <span className="venue-meta">{HOME.area}</span>
          </span>
          <span className="venue-count"><strong>{home?.count || 0}</strong></span>
        </button>
      </div>

      {picker}
    </main>
  )
}

function GoingPicker({ venue, current, isPublic, onPick, onClose, onNotGoing }) {
  const [vis, setVis] = useState(current?.vis || 'friends')
  const [busy, setBusy] = useState(false)
  const isHome = venue.type === 'home'
  return (
    <Sheet title={isHome ? '🛋️ Hoy no salgo' : `Voy a ${venue.name}`} onClose={onClose} busy={busy}>
      {!isHome && (
        <div className="vis-list">
          {Object.entries(VIS).map(([id, v]) => {
            const disabled = id === 'public' && !isPublic
            return (
              <button key={id} className={`vis-opt ${vis === id ? 'sel' : ''}`} disabled={disabled} onClick={() => setVis(id)}>
                <span className="vis-icon">{v.icon}</span>
                <span className="vis-body"><strong>{v.label}</strong><span>{disabled ? 'Tu perfil es privado. Cámbialo en Perfil si quieres salir en público.' : v.desc}</span></span>
                {vis === id && <Check size={18} />}
              </button>
            )
          })}
        </div>
      )}
      {vis === 'public' && !isHome && <p className="small warn">Ojo: cualquiera verá que estás en {venue.name} esta noche. Se borra solo a las 12:00 del mediodía.</p>}
      <button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); await onPick(isHome ? 'friends' : vis); setBusy(false) }}>
        {busy ? <Spinner /> : isHome ? 'Me quedo en casa' : '¡Voy!'}
      </button>
      {onNotGoing && <button className="btn ghost" onClick={onNotGoing}>Quitar mi plan</button>}
    </Sheet>
  )
}

function VenueView({ city, venue, data, mine, onBack, onGo, onNotGoing, onToast }) {
  const [tab, setTab] = useState('gente')
  const going = mine?.venue === venue.id
  const room = `v:${city}:${venue.id}`
  return (
    <main className="venue-view">
      <div className="room-head">
        <button className="icon-btn" onClick={onBack} aria-label="Volver"><ChevronLeft size={24} /></button>
        <div className="room-title">
          <h2>{TYPE_EMOJI[venue.type]} {venue.name}</h2>
          <span className="small">{TYPE_LABEL[venue.type]}{venue.area ? ` · ${venue.area}` : ''}</span>
        </div>
      </div>

      <div className="venue-hero">
        <div><strong className="huge">{data?.count || 0}</strong><span>{data?.count === 1 ? 'persona va' : 'personas van'} esta noche</span></div>
        {going
          ? <button className="btn ghost small-btn" onClick={onGo}><Check size={16} /> Vas ({mine.vis === 'public' ? 'público' : mine.vis === 'friends' ? 'amigos' : 'anónimo'})</button>
          : <button className="btn primary small-btn" onClick={onGo}>🪩 Voy</button>}
      </div>

      <Seg value={tab} onChange={setTab} options={[['gente', 'Gente'], ['muro', 'Retos'], ['chat', 'Chat'], ['ranking', 'Top']]} />

      {tab === 'gente' && (
        <div className="people">
          {data?.friends.length > 0 && <h3 className="mini-title">Tus amigos</h3>}
          {data?.friends.map(p => <Person key={p.id} p={p} />)}
          {data?.public.length > 0 && <h3 className="mini-title">Gente que sale en público</h3>}
          {data?.public.map(p => <Person key={p.id} p={p} />)}
          {!data?.friends.length && !data?.public.length && (
            <p className="empty">{data?.count ? `${data.count} ${data.count === 1 ? 'persona va' : 'personas van'}, pero en modo privado 🤫` : 'Aún no se ha apuntado nadie. ¡Sé la primera persona!'}</p>
          )}
        </div>
      )}
      {tab === 'muro' && <Wall room={room} onToast={onToast} emptyText="Aún no hay fotos de retos aquí esta noche. Ve a la pestaña Retos y estrena el muro 📸" />}
      {tab === 'chat' && <Chat room={room} onToast={onToast} emptyText={`Chat de ${venue.name} de esta noche. Se borra mañana.`} />}
      {tab === 'ranking' && <Ranking city={city} scope={`venue:${venue.id}`} emptyText="Nadie de aquí ha puntuado aún." />}
      {going && tab === 'gente' && <button className="btn ghost danger" onClick={onNotGoing}>Ya no voy</button>}
    </main>
  )
}
