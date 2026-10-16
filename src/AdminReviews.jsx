import React, { useEffect, useState } from 'react'
import { ArrowLeft, Check, X, RefreshCw, LoaderCircle, Star } from 'lucide-react'
import { supabase } from './lib/supabase'

export default function AdminReviews({ onBack }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  async function load() {
    setLoading(true); setError('')
    const { data, error: queryError } = await supabase
      .from('profile_reviews')
      .select('id, entity_type, entity_id, reviewer_name, rating, review_text, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (queryError) setError(queryError.message)
    else setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function decide(row, status) {
    setBusyId(row.id); setError('')
    const { data: userData } = await supabase.auth.getUser()
    const { error: updateError } = await supabase.from('profile_reviews').update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: userData?.user?.id || null
    }).eq('id', row.id).eq('status', 'pending')
    if (updateError) setError(updateError.message)
    else setRows(current => current.filter(x => x.id !== row.id))
    setBusyId('')
  }

  return <div className="admin-page">
    <div className="admin-head">
      <div><p className="section-kicker">KUTCHPHARMACONNECT ADMIN</p><h1>Review Moderation</h1><p>Approve reviews before they appear on public company or distributor profiles.</p></div>
      <div className="admin-review-head-actions"><button className="admin-refresh" onClick={onBack}><ArrowLeft size={15}/> Back</button><button className="admin-refresh" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
    </div>
    {error && <div className="admin-error">{error}</div>}
    {loading ? <div className="admin-state"><LoaderCircle className="spin" size={20}/> Loading reviews…</div> :
      rows.length ? <div className="admin-review-queue">{rows.map(row => <article className="admin-panel admin-review-card" key={row.id}>
        <div className="admin-review-meta"><span className="admin-review-type">{row.entity_type === 'company' ? 'Company review' : 'Distributor review'}</span><span className="admin-review-stars"><Star size={14} fill="currentColor"/>{row.rating}/5</span><small>{new Date(row.created_at).toLocaleString('en-IN')}</small></div>
        <h2>{row.reviewer_name}</h2><p className="admin-review-target">Profile ID: {row.entity_id}</p><p>{row.review_text}</p>
        <div className="admin-review-actions"><button className="admin-review-approve" onClick={() => decide(row, 'approved')} disabled={busyId === row.id}><Check size={15}/> Approve</button><button className="admin-review-reject" onClick={() => decide(row, 'rejected')} disabled={busyId === row.id}><X size={15}/> Reject</button></div>
      </article>)}</div> : <div className="admin-state">No reviews are waiting for approval.</div>}
  </div>
}
