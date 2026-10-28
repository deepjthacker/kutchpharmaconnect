import React, { useRef, useState } from 'react'
import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react'
import { supabase } from './lib/supabase'

export default function ProfileImageUpload({ entityType, entityId, imageUrl, onUploaded, onError }) {
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)
  async function upload(file) {
    if (!file) return
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) {
      onError('Choose a JPG, PNG, WEBP, or GIF image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      onError('Image must be 5 MB or smaller.')
      return
    }
    setBusy(true); onError('')
    const ext = ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'})[file.type]
    const path = entityType + '/' + entityId + '/' + crypto.randomUUID() + '.' + ext
    const stored = await supabase.storage.from('directory-profile-images').upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false })
    if (stored.error) { onError(stored.error.message); setBusy(false); return }
    const { data } = supabase.storage.from('directory-profile-images').getPublicUrl(path)
    const table = entityType === 'company' ? 'companies' : 'distributors'
    const saved = await supabase.from(table).update({ image_url: data.publicUrl }).eq('id', entityId)
    if (saved.error) { onError(saved.error.message); setBusy(false); return }
    onUploaded(data.publicUrl)
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }
  async function removeImage() {
    if (!window.confirm('Remove this image from the directory profile?')) return
    setBusy(true); onError('')
    const table = entityType === 'company' ? 'companies' : 'distributors'
    const saved = await supabase.from(table).update({ image_url: null }).eq('id', entityId)
    if (saved.error) onError(saved.error.message)
    else onUploaded('')
    setBusy(false)
  }
  return <div className="admin-image-upload">
    <div className="admin-image-preview">{imageUrl ? <img src={imageUrl} alt={entityType + ' logo preview'} /> : <ImagePlus size={24}/>}</div>
    <div className="admin-image-upload-copy">
      <strong>{entityType === 'company' ? 'Company image / logo' : 'Distributor image / shop photo'}</strong>
      <small>JPG, PNG, WEBP or GIF · max 5 MB</small>
      <div className="admin-image-upload-actions">
        <button type="button" className="admin-refresh" onClick={() => inputRef.current?.click()} disabled={busy}>{busy ? <><LoaderCircle className="spin" size={14}/> Uploading…</> : <><ImagePlus size={14}/> {imageUrl ? 'Replace image' : 'Upload image'}</>}</button>
        {imageUrl && <button type="button" className="admin-image-remove" onClick={removeImage} disabled={busy}><Trash2 size={14}/> Remove</button>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={e=>upload(e.target.files?.[0])}/>
    </div>
  </div>
}
