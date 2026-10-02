import { useEffect, useState } from 'react'
import { CheckCircle2, LoaderCircle, RefreshCw, ShieldAlert } from 'lucide-react'
import { supabase } from './lib/supabase'

const labels={
  incorrect_relationship:'Company / distributor relationship',
  incorrect_contact:'Contact details',
  incorrect_company_name:'Company or distributor name',
  other:'Other directory information'
}

export default function AdminReports(){
  const [reports,setReports]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saving,setSaving]=useState('')
  async function load(){
    setLoading(true);setError('')
    const {data,error}=await supabase.from('correction_reports').select('*').order('created_at',{ascending:false})
    if(error)setError(error.message)
    else setReports(data||[])
    setLoading(false)
  }
  useEffect(()=>{load()},[])
  async function updateStatus(id,status){
    setSaving(id)
    const {error}=await supabase.from('correction_reports').update({status,resolved_at:status==='resolved'?new Date().toISOString():null}).eq('id',id)
    if(error)setError(error.message);else setReports(x=>x.map(r=>r.id===id?{...r,status,resolved_at:status==='resolved'?new Date().toISOString():null}:r))
    setSaving('')
  }
  return <div className="admin-page">
    <div className="admin-head"><div><p className="section-kicker">ADMIN</p><h1>Correction Reports</h1><p>Review public reports before changing directory data.</p></div><button className="admin-refresh" onClick={load}><RefreshCw size={15}/> Refresh</button></div>
    {error&&<div className="admin-error"><ShieldAlert size={16}/>{error}</div>}
    {loading?<div className="admin-state"><LoaderCircle className="spin" size={20}/> Loading reports…</div>:reports.length===0?<div className="admin-state">No correction reports yet.</div>:
      <div className="admin-table">
        {reports.map(r=><div className="admin-report" key={r.id}>
          <div className="admin-report-top"><span className={'admin-status '+r.status}>{r.status.replace('_',' ')}</span><small>{new Date(r.created_at).toLocaleString()}</small></div>
          <strong>{labels[r.report_type]||r.report_type}</strong>
          <p>{r.message}</p>
          {r.contact&&<span className="admin-contact">Contact: {r.contact}</span>}
          <div className="admin-actions">
            {r.status!=='under_review'&&r.status!=='resolved'&&<button onClick={()=>updateStatus(r.id,'under_review')} disabled={saving===r.id}>Mark Under Review</button>}
            {r.status!=='resolved'&&<button className="primary" onClick={()=>updateStatus(r.id,'resolved')} disabled={saving===r.id}>{saving===r.id?<LoaderCircle className="spin" size={14}/>:<CheckCircle2 size={14}/>} Resolve</button>}
            {r.status==='resolved'&&<button onClick={()=>updateStatus(r.id,'open')} disabled={saving===r.id}>Reopen</button>}
          </div>
        </div>)}
      </div>}
  </div>
}
