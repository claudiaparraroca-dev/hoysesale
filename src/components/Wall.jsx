import { useEffect, useState } from 'react'
import { Flag } from 'lucide-react'
import { api, errorText } from '../lib/api'
import { AuthImg, Spinner, timeAgo } from './ui'

export default function Wall({ room, refreshKey, emptyText, onToast }) {
  const [posts, setPosts] = useState(null)

  useEffect(() => {
    let alive = true
    const load = () => api(`/api/wall?room=${encodeURIComponent(room)}`).then(r => alive && setPosts(r.posts)).catch(() => alive && setPosts(p => p || []))
    load()
    const t = setInterval(load, 20000)
    return () => { alive = false; clearInterval(t) }
  }, [room, refreshKey])

  async function report(p) {
    if (!confirm('¿Denunciar esta foto? Si la denuncian 3 personas, desaparece.')) return
    try {
      await api('/api/report', { method: 'POST', body: { room, kind: 'post', id: p.id } })
      setPosts(ps => ps.map(x => (x.id === p.id ? { ...x, reported: true } : x)))
      onToast('Denunciada. Gracias.')
    } catch (err) { onToast(errorText(err)) }
  }

  if (!posts) return <p className="empty"><Spinner /></p>
  if (!posts.length) return <p className="empty">{emptyText}</p>
  return (
    <div className="wall">
      {posts.map(p => (
        <figure key={p.id} className="post">
          <AuthImg id={p.id} alt={p.ch.text} />
          <figcaption>
            <span className="post-ch">{p.ch.emoji} {p.ch.text} <em>+{p.ch.pts}</em></span>
            <span className="post-by">{p.by ? `${p.by.e} @${p.by.un}` : ''} · {timeAgo(p.at)}</span>
            {!p.mine && !p.reported && <button className="post-flag" onClick={() => report(p)} aria-label="Denunciar"><Flag size={14} /></button>}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
