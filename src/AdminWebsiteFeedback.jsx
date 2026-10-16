import React, { useEffect, useState } from 'react'
import { ArrowLeft, Check, Eye, RefreshCw, LoaderCircle, Star, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from './lib/supabase'

const labels = { general:'Website experience', bug:'Something is not working', performance:'Performance / slow loading', mobile:'Mobile / layout', data_accuracy:'Directory data accuracy', suggestion:'Suggestion', other:'Other' }
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n)

export default function AdminWebsiteFeedback({ onBack }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  async function load() {
    setLoading(true); setError('')
    const { data, error: queryError } = await supabase.from('website_feedback')
      .select('id,rating,feedback_type,feedback_text,page_path,contact_email,status,created_at')
      .in('status', ['open','reviewing'])
      .order('created_at', { ascending: true })
    if (queryError) setError(queryError.message)
    else setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function updateStatus(row, status) {
    setBusyId(row.id); setError('')
    const { data: userData } = await supabase.auth.getUser()
    const { error: updateError } = await supabase.from('website_feedback').update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: userData?.user?.id || null
    }).eq('id', row.id).in('status', ['open','reviewing'])
    if (updateError) setError(updateError.message)
    else if (status === 'reviewing') setRows(current => current.map(x => x.id === row.id ? { ...x, status } : x))
    else setRows(current => current.filter(x => x.id !== row.id))
    setBusyId('')
  }

  return <div className="admin-page">
    <div className="admin-head">
      <div><p className="section-kicker">KUTCHPHARMACONNECT ADMIN</p><h1>Website Feedback</h1><p>Review visitor ratings, broken features, performance complaints, mobile issues, and directory-data feedback.</p></div>
      <div className="admin-review-head-actions"><button className="admin-refresh" onClick={onBack}><ArrowLeft size={15}/> Back</button><button className="admin-refresh" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
    </div>
    {error && <div className="admin-error">{error}</div>}
    {loading ? <div className="admin-state"><LoaderCircle className="spin" size={20}/> Loading website feedback…</div> :
      rows.length ? <div className="admin-review-queue">{rows.map(row => <article className="admin-panel admin-review-card" key={row.id}>
        <div className="admin-review-meta"><span className="admin-review-type">{labels[row.feedback_type] || row.feedback_type}</span><span className="admin-review-stars"><Star size={14} fill="currentColor"/>{row.rating}/5 <span>{stars(row.rating)}</span></span><small>{new Date(row.created_at).toLocaleString('en-IN')}</small></div>
        <p>{row.feedback_text}</p>
        <div className="site-feedback-admin-details"><span><strong>Page:</strong> {row.page_path || 'Not recorded'}</span>{row.contact_email && <span><strong>Follow-up:</strong> {row.contact_email}</span>}</div>
        <div className="admin-review-actions"><button className="admin-review-approve" onClick={() => updateStatus(row, 'resolved')} disabled={busyId === row.id}><CheckCircle2 size={15}/> Mark Resolved</button><button className="admin-review-neutral" onClick={() => updateStatus(row, 'reviewing')} disabled={busyId === row.id}><Eye size={15}/> Mark Reviewing</button><button className="admin-review-reject" onClick={() => updateStatus(row, 'dismissed')} disabled={busyId === row.id}><XCircle size={15}/> Dismiss</button></div>
      </article>)}</div> : <div className="admin-state">No open website feedback reports. Use Refresh to check for new submissions.</div>}
  </div>
}
