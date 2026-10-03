import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, Globe, Users, EyeOff, Check, Sofa, MapPin, Flame } from 'lucide-react'
import { CITIES, HOME, TYPE_LABEL, venueById } from '../lib/cities'
import { api, errorText } from '../lib/api'
import { Sheet, Spinner, Seg, Faces, Person, VenueCover } from './ui'
import Chat from './Chat'
import Wall from './Wall'
import Ranking from './Ranking'

const VIS = {
  public: { icon: <Globe size={18} />, label: 'Público', desc: 'Apareces con tu @ en la lista del local.' },
  friends: { icon: <Users size={18} />, label: 'Solo amigos', desc: 'Sumas al contador; solo tus amigos ven que eres tú.' },
  anon: { icon: <EyeOff size={18} />, label: 'Anónimo', desc: 'Solo sumas al contador. Nadie sabe que eres tú.' },
}

const FILTERS = [['all', 'Todo'], ['club', 'Discotecas'], ['pub', 'Pubs'], ['bar', 'Bares']]

export default function NightTab({ city, me, onToast, openVenue, setOpenVenue, onNight }) {
  const [night, setNight] = useState(null)
  const [picking, setPicking] = useState(null)
  const [filter, setFilter] = useState('all')

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
      onToast(venue === HOME.id ? 'Apuntado: hoy no sales' : `Apuntado: vas a ${venueById(city, venue).name}`)
      load()
    } catch (err) { onToast(errorText(err)) }
  }

  async function notGoing() {
    try { await api(`/api/going?city=${city}`, { method: 'DELETE' }); load() }
    catch (err) { onToast(errorText(err)) }
  }

  // al cambiar de ciudad, `night` aún trae los datos de la anterior hasta que llega la respuesta nueva:
  // pintar la lista nueva con datos viejos rompía el orden (friends undefined) y dejaba la pantalla en negro
  if (!night || night.city !== city) return <main><p className="empty"><Spinner size={24} /></p></main>

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
          city={city} venue={venueById(city, openVenue)} data={counts[openVenue]} mine={night.mine} photos={night.photos}
          onBack={() => setOpenVenue(null)} onGo={() => setPicking(openVenue)} onNotGoing={notGoing} onToast={onToast}
        />
        {picker}
      </>
    )
  }

  const venues = CITIES[city].venues
    .filter(v => filter === 'all' || v.type === filter)
    .map(v => ({ ...v, ...counts[v.id] }))
    .sort((a, b) => b.count - a.count || b.friends.length - a.friends.length || a.name.localeCompare(b.name))
  const home = counts[HOME.id]
  const mineVenue = night.mine && venueById(city, night.mine.venue)
  const friendsOut = night.venues.reduce((s, v) => s + v.friends.length, 0)

  return (
    <main className="night">
      <section className="hero-night">
        <p className="eyebrow">{night.label}</p>
        <h2>¿Dónde se sale hoy?</h2>
        <div className="stats-row">
          <span><strong>{night.total}</strong> salen hoy</span>
          <span><strong>{friendsOut}</strong> {friendsOut === 1 ? 'amigo' : 'amigos'}</span>
        </div>
      </section>

      {mineVenue ? (
        <button className="my-plan set" onClick={() => setPicking(night.mine.venue)}>
          {mineVenue.type === 'home'
            ? <span className="plan-icon"><Sofa size={20} /></span>
            : <VenueCover city={city} venue={mineVenue} photos={night.photos} className="plan-thumb" />}
          <span className="plan-body">
            <span className="small">Tu plan de esta noche</span>
            <strong>{mineVenue.name}</strong>
            <span className="vis-chip">{VIS[night.mine.vis].icon} {VIS[night.mine.vis].label}</span>
          </span>
          <span className="link">Cambiar</span>
        </button>
      ) : (
        <div className="my-plan"><MapPin size={18} /><p>Aún no has dicho dónde vas. Entra en un local y pulsa <strong>Voy</strong>.</p></div>
      )}

      <div className="chips">
        {FILTERS.map(([id, label]) => (
          <button key={id} className={`chip ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>

      <div className="venue-list">
        {venues.map((v, i) => (
          <button key={v.id} className={`venue-card ${night.mine?.venue === v.id ? 'mine' : ''}`} onClick={() => setOpenVenue(v.id)}>
            <VenueCover city={city} venue={v} photos={night.photos} photoBy={v.photoBy} />
            <span className="venue-overlay">
              {v.count > 0 && i < 3 && filter === 'all' && <span className="hot"><Flame size={12} /> Top {i + 1}</span>}
              {night.mine?.venue === v.id && <span className="hot going"><Check size={12} /> Vas</span>}
            </span>
            <span className="venue-info">
              <span className="venue-text">
                <span className="venue-name">{v.name}</span>
                <span className="venue-meta">{TYPE_LABEL[v.type]}{v.area ? ` · ${v.area}` : ''}</span>
              </span>
              <span className="venue-right">
                <span className="venue-count"><strong>{v.count}</strong> {v.count === 1 ? 'va' : 'van'}</span>
                {(v.friends.length > 0 || v.public.length > 0) && <Faces people={[...v.friends, ...v.public]} />}
              </span>
            </span>
          </button>
        ))}
      </div>

      <button className={`home-row ${night.mine?.venue === HOME.id ? 'mine' : ''}`} onClick={() => setPicking(HOME.id)}>
        <Sofa size={18} /><span>Hoy no salgo</span><span className="muted">{home?.count || 0}</span>
      </button>

      {picker}
    </main>
  )
}

function GoingPicker({ venue, current, isPublic, onPick, onClose, onNotGoing }) {
  const [vis, setVis] = useState(current?.vis || 'friends')
  const [busy, setBusy] = useState(false)
  const isHome = venue.type === 'home'
  return (
    <Sheet title={isHome ? 'Hoy no salgo' : `Voy a ${venue.name}`} onClose={onClose} busy={busy}>
      {!isHome && (
        <>
          <span className="label">¿Quién puede verte?</span>
          <div className="vis-list">
            {Object.entries(VIS).map(([id, v]) => {
              const disabled = id === 'public' && !isPublic
              return (
                <button key={id} className={`vis-opt ${vis === id ? 'sel' : ''}`} disabled={disabled} onClick={() => setVis(id)}>
                  <span className="vis-icon">{v.icon}</span>
                  <span className="vis-body"><strong>{v.label}</strong><span>{disabled ? 'Tu perfil es privado. Cámbialo en Perfil para salir en público.' : v.desc}</span></span>
                  <span className={`radio ${vis === id ? 'on' : ''}`} />
                </button>
              )
            })}
          </div>
        </>
      )}
      {vis === 'public' && !isHome && <p className="small warn">Cualquier usuario verá que estás en {venue.name} esta noche. Se borra solo a las 12:00.</p>}
      <button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); await onPick(isHome ? 'friends' : vis); setBusy(false) }}>
        {busy ? <Spinner /> : isHome ? 'Confirmar' : 'Confirmar plan'}
      </button>
      {onNotGoing && <button className="btn ghost" onClick={onNotGoing}>Quitar mi plan</button>}
    </Sheet>
  )
}

function VenueView({ city, venue, data, mine, photos, onBack, onGo, onNotGoing, onToast }) {
  const [tab, setTab] = useState('gente')
  const going = mine?.venue === venue.id
  const room = `v:${city}:${venue.id}`
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name} ${CITIES[city].name}`)}`
  return (
    <main className="venue-view">
      <div className="venue-hero">
        <VenueCover city={city} venue={venue} photos={photos} photoBy={data?.photoBy} className="hero-cover" />
        <button className="back-fab" onClick={onBack} aria-label="Volver"><ChevronLeft size={22} /></button>
        <div className="hero-text">
          <span className="venue-meta">{TYPE_LABEL[venue.type]}{venue.area ? ` · ${venue.area}` : ''} · {CITIES[city].name}</span>
          <h2>{venue.name}</h2>
        </div>
      </div>

      <div className="venue-bar">
        <div className="venue-stat"><strong>{data?.count || 0}</strong><span>{data?.count === 1 ? 'persona va' : 'personas van'} hoy</span></div>
        <div className="venue-stat"><strong>{data?.friends.length || 0}</strong><span>{data?.friends.length === 1 ? 'amigo' : 'amigos'}</span></div>
        <a className="venue-stat link-stat" href={mapsUrl} target="_blank" rel="noreferrer"><MapPin size={18} /><span>Cómo llegar</span></a>
      </div>

      <div className="cta-sticky">
        {going
          ? <button className="btn ghost" onClick={onGo}><Check size={18} /> Vas · {VIS[mine.vis].label}</button>
          : <button className="btn primary" onClick={onGo}>Voy esta noche</button>}
      </div>

      <Seg value={tab} onChange={setTab} options={[['gente', 'Quién va'], ['muro', 'Fotos'], ['chat', 'Chat'], ['ranking', 'Ranking']]} />

      {tab === 'gente' && (
        <div className="people">
          {data?.friends.length > 0 && <h3 className="mini-title">Tus amigos</h3>}
          {data?.friends.map(p => <Person key={p.id} p={p} />)}
          {data?.public.length > 0 && <h3 className="mini-title">Perfiles públicos</h3>}
          {data?.public.map(p => <Person key={p.id} p={p} />)}
          {!data?.friends.length && !data?.public.length && (
            <p className="empty">{data?.count ? `${data.count} ${data.count === 1 ? 'persona va' : 'personas van'} en modo privado.` : 'Aún no se ha apuntado nadie esta noche.'}</p>
          )}
          {going && <button className="btn ghost danger" onClick={onNotGoing}>Ya no voy</button>}
        </div>
      )}
      {tab === 'muro' && <Wall room={room} onToast={onToast} emptyText="Aún no hay fotos de retos aquí esta noche." />}
      {tab === 'chat' && <Chat room={room} onToast={onToast} emptyText={`Chat de ${venue.name} de esta noche. Se borra mañana.`} />}
      {tab === 'ranking' && <Ranking city={city} scope={`venue:${venue.id}`} emptyText="Nadie de aquí ha puntuado aún." />}
    </main>
  )
}
