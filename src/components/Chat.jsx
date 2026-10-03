import { useEffect, useRef, useState } from 'react'
import { Send, Flag } from 'lucide-react'
import { api, errorText } from '../lib/api'
import { Spinner, Avatar } from './ui'

const POLL_MS = 3000

// Chat por "polling": pregunta al servidor cada 3 s mientras está abierto
export default function Chat({ room, emptyText, onToast }) {
  const [msgs, setMsgs] = useState(null)
  const [canWrite, setCanWrite] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const since = useRef(0)
  const listRef = useRef(null)

  useEffect(() => {
    let alive = true
    since.current = 0
    setMsgs(null)
    async function poll() {
      if (document.visibilityState !== 'visible') return
      try {
        const r = await api(`/api/chat?room=${encodeURIComponent(room)}&since=${since.current}`)
        if (!alive) return
        setCanWrite(r.canWrite)
        setMsgs(prev => {
          const known = new Set((prev || []).map(m => m.id))
          const fresh = r.msgs.filter(m => !known.has(m.id))
          return [...(prev || []), ...fresh]
        })
        if (r.msgs.length) since.current = r.msgs[r.msgs.length - 1].at
      } catch { if (alive) setMsgs(m => m || []) }
    }
    poll()
    const t = setInterval(poll, POLL_MS)
    return () => { alive = false; clearInterval(t) }
  }, [room])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs?.length])

  async function send(e) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    setSending(true)
    try {
      const r = await api('/api/chat', { method: 'POST', body: { room, text: t } })
      setText('')
      // No movemos `since`: así no se pierden mensajes de otros que llegaron justo antes (se deduplica por id)
      setMsgs(m => [...(m || []), { id: r.id, t, at: r.at, mine: true, by: null }])
    } catch (err) { onToast(errorText(err)) }
    setSending(false)
  }

  async function report(m) {
    if (!confirm('¿Denunciar este mensaje? Si lo denuncian 3 personas, desaparece.')) return
    try { await api('/api/report', { method: 'POST', body: { room, kind: 'msg', id: m.id } }); onToast('Denunciado. Gracias.') }
    catch (err) { onToast(errorText(err)) }
  }

  return (
    <div className="chat">
      <div className="chat-list" ref={listRef}>
        {!msgs && <p className="empty"><Spinner /></p>}
        {msgs?.length === 0 && <p className="empty">{emptyText}</p>}
        {msgs?.map(m => (
          <div key={m.id} className={`msg ${m.mine ? 'mine' : ''}`}>
            {!m.mine && m.by && <span className="msg-by"><Avatar p={m.by} size="xs" /> @{m.by.un}</span>}
            <span className="msg-text">{m.t}</span>
            {!m.mine && <button className="msg-flag" onClick={() => report(m)} aria-label="Denunciar"><Flag size={12} /></button>}
          </div>
        ))}
      </div>
      {canWrite ? (
        <form className="chat-form" onSubmit={send}>
          <input value={text} maxLength={400} placeholder="Escribe algo…" onChange={e => setText(e.target.value)} />
          <button className="send" disabled={sending || !text.trim()} aria-label="Enviar"><Send size={18} /></button>
        </form>
      ) : (
        <p className="small center">Marca que vas a este local para poder escribir.</p>
      )}
    </div>
  )
}
