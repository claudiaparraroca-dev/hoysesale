import { useCallback, useEffect, useState } from 'react'
import { Moon, Target, MessageCircle, User } from 'lucide-react'
import { CITIES } from './lib/cities'
import { api, getSession, setSession } from './lib/api'
import Onboarding from './components/Onboarding'
import NightTab from './components/NightTab'
import ChallengesTab from './components/ChallengesTab'
import GroupsTab from './components/GroupsTab'
import ProfileTab from './components/ProfileTab'
import { Spinner } from './components/ui'

// Enlace "pasar cuenta a otro móvil": /#login=<id>.<token>
function takeLoginFromHash() {
  const m = /^#login=([\w-]+)\.([\w-]+)$/.exec(location.hash)
  if (!m) return
  setSession({ id: m[1], token: m[2] })
  history.replaceState(null, '', location.pathname + location.search)
}
takeLoginFromHash()

export default function App() {
  const [session, setSessionState] = useState(getSession)
  const [me, setMe] = useState(null)
  const [city, setCity] = useState(null)
  const [tab, setTab] = useState('noche')
  const [openVenue, setOpenVenue] = useState(null)
  const [openGroup, setOpenGroup] = useState(null)
  const [night, setNight] = useState(null)
  const [inviteCode, setInviteCode] = useState(() => new URLSearchParams(location.search).get('grupo')?.toUpperCase() || null)
  const [cityPicker, setCityPicker] = useState(false)
  const [toast, setToast] = useState('')

  const refreshMe = useCallback(async () => {
    try {
      const m = await api('/api/me')
      setMe(m)
      setCity(c => c || m.user.city)
    } catch (err) {
      if (err.status === 401) { setSession(null); setSessionState(null) }
    }
  }, [])

  useEffect(() => { if (session) refreshMe() }, [session, refreshMe])
  useEffect(() => {
    if (new URLSearchParams(location.search).has('grupo')) history.replaceState(null, '', '/')
  }, [])
  useEffect(() => { if (inviteCode && me) setTab('grupos') }, [inviteCode, me])

  function flash(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  if (!session) return <Onboarding onDone={s => { setSession(s); setSessionState(s) }} />
  if (!me || !city) return <div className="app center-screen"><Spinner size={28} /></div>

  return (
    <div className="app">
      <header className="top">
        <h1 className="brand">hoy<span>se</span>sale</h1>
        <button className="city-pill" onClick={() => setCityPicker(v => !v)}>{CITIES[city].emoji} {CITIES[city].name} ▾</button>
      </header>
      {cityPicker && (
        <div className="city-menu">
          {Object.entries(CITIES).map(([id, c]) => (
            <button key={id} className={id === city ? 'sel' : ''} onClick={() => { setCity(id); setOpenVenue(null); setCityPicker(false) }}>{c.emoji} {c.name}</button>
          ))}
        </div>
      )}

      {tab === 'noche' && <NightTab city={city} me={me} onToast={flash} openVenue={openVenue} setOpenVenue={setOpenVenue} onNight={setNight} />}
      {tab === 'retos' && <ChallengesTab city={city} me={me} night={night} onToast={flash} />}
      {tab === 'grupos' && (
        <GroupsTab me={me} city={city} refreshMe={refreshMe} openGroup={openGroup} setOpenGroup={setOpenGroup}
          inviteCode={inviteCode} clearInvite={() => setInviteCode(null)} onToast={flash} />
      )}
      {tab === 'perfil' && <ProfileTab me={me} refreshMe={refreshMe} onToast={flash} />}

      <nav className="tabs">
        <TabBtn id="noche" tab={tab} setTab={t => { setOpenVenue(null); setTab(t) }} icon={<Moon size={20} />} label="Noche" />
        <TabBtn id="retos" tab={tab} setTab={setTab} icon={<Target size={20} />} label="Retos" />
        <TabBtn id="grupos" tab={tab} setTab={t => { setOpenGroup(null); setTab(t) }} icon={<MessageCircle size={20} />} label="Grupos" />
        <TabBtn id="perfil" tab={tab} setTab={setTab} icon={<User size={20} />} label="Perfil" badge={me.reqIn.length} />
      </nav>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function TabBtn({ id, tab, setTab, icon, label, badge }) {
  return (
    <button className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
      {icon}<span>{label}</span>{badge > 0 && <i className="badge">{badge}</i>}
    </button>
  )
}
