import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Spinner } from './ui'

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function Ranking({ city, scope = 'city', refreshKey, emptyText = 'Nadie ha puntuado aún esta noche.' }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    let alive = true
    api(`/api/ranking?city=${city}&scope=${encodeURIComponent(scope)}`)
      .then(r => alive && setRows(r.rows))
      .catch(() => alive && setRows([]))
    return () => { alive = false }
  }, [city, scope, refreshKey])

  if (!rows) return <p className="empty"><Spinner /></p>
  if (!rows.length) return <p className="empty">{emptyText}</p>
  return (
    <ol className="rank-list">
      {rows.map(r => (
        <li key={r.id} className={r.me ? 'me' : ''}>
          <span className="pos">{MEDAL[r.rank] || r.rank}</span>
          <span className="who">{r.e} {r.n} <em>@{r.un}</em></span>
          <span className="pts">{r.pts}</span>
        </li>
      ))}
    </ol>
  )
}
