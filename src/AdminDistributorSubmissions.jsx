import React,{useEffect,useState} from 'react'
import {CheckCircle2,LoaderCircle,RefreshCw,ShieldAlert,Truck} from 'lucide-react'
import {supabase} from './lib/supabase'

const statuses=['open','under_review','approved','rejected']

export default function AdminDistributorSubmissions({onBack}){
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saving,setSaving]=useState('')
  async function load(){
    setLoading(true);setError('')
    const {data,error}=await supabase.from('distributor_submissions').select('*').order('submitted_at',{ascending:false})
    if(error)setError(error.message);else setRows(data||[])
    setLoading(false)
  }
  useEffect(()=>{load()},[])
  async function updateStatus(id,status){
    setSaving(id);setError('')
    const {data:{user}}=await supabase.auth.getUser()
    const patch={status,reviewed_at:status==='approved'||status==='rejected'?new Date().toISOString():null,reviewed_by:status==='approved'||status==='rejected'?user?.id:null}
    const {error}=await supabase.from('distributor_submissions').update(patch).eq('id',id)
    if(error)setError(error.message);else setRows(x=>x.map(r=>r.id===id?{...r,...patch}:r))
    setSaving('')
  }
  return <div className="admin-page">
    <div className="admin-head">
      <div><button className="admin-back" onClick={onBack}><span>←</span> Dashboard</button><p className="section-kicker">ADMIN</p><h1>Distributor Submissions</h1><p>Review distributor-provided information before adding it to the live directory.</p></div>
      <button className="admin-refresh" onClick={load}><RefreshCw size={15}/> Refresh</button>
    </div>
    {error&&<div className="admin-error"><ShieldAlert size={16}/>{error}</div>}
    {loading?<div className="admin-state"><LoaderCircle className="spin" size={20}/> Loading submissions…</div>:rows.length===0?<div className="admin-state"><Truck size={22}/> No distributor submissions yet.</div>:
      <div className="admin-table">{rows.map(r=><div className="admin-report" key={r.id}>
        <div className="admin-report-top"><span className={'admin-status '+r.status}>{r.status.replace('_',' ')}</span><small>{new Date(r.submitted_at).toLocaleString()}</small></div>
        <h3>{r.distributor_name}</h3>
        <p><strong>Contact:</strong> {r.contact_person||'—'} · {r.mobile}</p>
        <p><strong>Email:</strong> {r.email||'—'} · <strong>Location:</strong> {[r.city,r.district,r.state].filter(Boolean).join(', ')||'—'}</p>
        {r.address&&<p><strong>Address:</strong> {r.address}</p>}
        <div className="submission-companies"><strong>Companies / divisions handled:</strong><pre>{r.companies_handled}</pre></div>
        {r.website&&<p><strong>Website:</strong> {r.website}</p>}
        {r.maps_url&&<p><strong>Maps:</strong> {r.maps_url}</p>}
        {r.notes&&<p><strong>Notes:</strong> {r.notes}</p>}
        <div className="admin-actions">
          {r.status==='open'&&<button onClick={()=>updateStatus(r.id,'under_review')} disabled={saving===r.id}>Mark Under Review</button>}
          {r.status!=='approved'&&<button className="primary" onClick={()=>updateStatus(r.id,'approved')} disabled={saving===r.id}>{saving===r.id?<LoaderCircle className="spin" size={14}/>:<CheckCircle2 size={14}/>} Approve</button>}
          {r.status!=='rejected'&&<button onClick={()=>updateStatus(r.id,'rejected')} disabled={saving===r.id}>Reject</button>}
          {r.status!=='open'&&<button onClick={()=>updateStatus(r.id,'open')} disabled={saving===r.id}>Reopen</button>}
        </div>
      </div>)}</div>}
  </div>
}
