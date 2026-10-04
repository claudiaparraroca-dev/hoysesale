import { useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { api, errorText } from '../lib/api'
import { compressImage } from '../lib/image'
import { Sheet, Spinner, Avatar } from './ui'

export default function EditProfile({ user, refreshMe, onToast, onClose }) {
  const [name, setName] = useState(user.n)
  const [username, setUsername] = useState(user.un)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoMsg, setPhotoMsg] = useState('')
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const canChangeUsername = Date.now() >= (user.usernameNext || 0)
  const nextDate = new Date(user.usernameNext || 0).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const image = await compressImage(file, 512)
    setPreview(image); setPhotoBusy(true); setPhotoMsg('')
    try {
      const r = await api('/api/me/photo', { method: 'POST', body: { image } })
      setPhotoMsg(r.reason)
      if (r.ok) await refreshMe()
      else setPreview(null)
    } catch (err) { setPhotoMsg(errorText(err)); setPreview(null) }
    setPhotoBusy(false)
  }

  async function removePhoto() {
    setPhotoBusy(true)
    try { await api('/api/me/photo', { method: 'DELETE' }); setPreview(null); setPhotoMsg(''); await refreshMe() }
    catch (err) { onToast(errorText(err)) }
    setPhotoBusy(false)
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      if (name.trim() !== user.n) await api('/api/me', { method: 'PATCH', body: { name } })
      if (username !== user.un) await api('/api/me/username', { method: 'PATCH', body: { username } })
      await refreshMe()
      onToast('Perfil actualizado')
      onClose()
    } catch (err) { setError(errorText(err)); setSaving(false) }
  }

  return (
    <Sheet title="Editar perfil" onClose={onClose} busy={saving || photoBusy}>
      <div className="edit-photo">
        <div className="edit-avatar">
          {preview ? <span className="av xl"><img src={preview} alt="" /></span> : <Avatar p={user} size="xl" />}
          {photoBusy && <span className="edit-avatar-busy"><Spinner /></span>}
        </div>
        <div className="edit-photo-actions">
          <button type="button" className="chip-btn" disabled={photoBusy} onClick={() => { fileRef.current.value = ''; fileRef.current.click() }}>
            <Camera size={14} /> {user.p ? 'Cambiar foto' : 'Añadir foto'}
          </button>
          {user.p && <button type="button" className="chip-btn" disabled={photoBusy} onClick={removePhoto}><Trash2 size={14} /> Quitar</button>}
          {photoMsg && <span className="small">{photoMsg}</span>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>

      <form className="card-form" onSubmit={save}>
        <label htmlFor="ename">Nombre</label>
        <input id="ename" value={name} maxLength={30} onChange={e => setName(e.target.value)} />

        <label htmlFor="eusername">@usuario</label>
        <input id="eusername" value={username} maxLength={20} autoCapitalize="none" disabled={!canChangeUsername}
          onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))} />
        <span className="small">{canChangeUsername ? 'Puedes cambiar tu @ una vez cada 7 días.' : `Podrás volver a cambiar tu @ a partir del ${nextDate}.`}</span>

        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={saving || name.trim().length < 2 || username.length < 3 || (name.trim() === user.n && username === user.un)}>
          {saving ? <Spinner /> : 'Guardar cambios'}
        </button>
      </form>
    </Sheet>
  )
}
