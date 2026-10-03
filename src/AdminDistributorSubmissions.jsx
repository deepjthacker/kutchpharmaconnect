import React,{useEffect,useMemo,useState} from 'react'
import {CheckCircle2,Eye,LoaderCircle,RefreshCw,ShieldAlert,Truck,X,Search,Building2} from 'lucide-react'
import {supabase} from './lib/supabase'

const statuses=['open','under_review','approved','rejected']

export default function AdminDistributorSubmissions({onBack}){
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saving,setSaving]=useState(''),[selected,setSelected]=useState(null)
  const [companies,setCompanies]=useState([]),[distributors,setDistributors]=useState([]),[matchQuery,setMatchQuery]=useState('')

  async function load(){
    setLoading(true);setError('')
    const [subRes,companyRes,distributorRes]=await Promise.all([
      supabase.from('distributor_submissions').select('*').order('submitted_at',{ascending:false}),
      supabase.from('companies').select('id,company_name,legal_name,short_name,status').eq('status','active').order('company_name'),
      supabase.from('distributors').select('id,distributor_name,legal_name,contact_person,mobile,whatsapp,status').eq('status','active').order('distributor_name')
    ])
    const bad=[subRes,companyRes,distributorRes].find(x=>x.error)
    if(bad)setError(bad.error.message)
    else{
      setRows(subRes.data||[])
      setCompanies(companyRes.data||[])
      setDistributors(distributorRes.data||[])
    }
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

  function openReview(row){
    setSelected(row)
    setMatchQuery('')
  }

  function closeReview(){
    if(!saving)setSelected(null)
  }

  const distributorMatches=useMemo(()=>{
    if(!selected)return []
    const q=(matchQuery||selected.distributor_name||'').trim().toLowerCase()
    if(!q)return []
    return distributors.filter(d=>[d.distributor_name,d.legal_name,d.contact_person,d.mobile,d.whatsapp].filter(Boolean).some(v=>String(v).toLowerCase().includes(q))).slice(0,8)
  },[selected,distributors,matchQuery])

  const companyMatches=useMemo(()=>{
    if(!selected)return []
    const q=(matchQuery||selected.companies_handled||'').trim().toLowerCase()
    if(!q)return []
    return companies.filter(c=>[c.company_name,c.legal_name,c.short_name].filter(Boolean).some(v=>String(v).toLowerCase().includes(q))).slice(0,8)
  },[selected,companies,matchQuery])

  return <div className="admin-page">
    <div className="admin-head">
      <div><button className="admin-back" onClick={onBack}><span>←</span> Dashboard</button><p className="section-kicker">ADMIN</p><h1>Distributor Submissions</h1><p>Review distributor-provided information before adding it to the live directory.</p></div>
      <button className="admin-refresh" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button>
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
          {(r.status==='open'||r.status==='under_review')&&<button onClick={()=>openReview(r)}><Eye size={14}/> Review & Match</button>}
          {r.status==='open'&&<button onClick={()=>updateStatus(r.id,'under_review')} disabled={saving===r.id}>Mark Under Review</button>}
          {r.status!=='approved'&&<button className="primary" onClick={()=>openReview(r)} disabled={saving===r.id}><CheckCircle2 size={14}/> Review Before Approve</button>}
          {r.status!=='rejected'&&<button onClick={()=>updateStatus(r.id,'rejected')} disabled={saving===r.id}>Reject</button>}
          {r.status!=='open'&&<button onClick={()=>updateStatus(r.id,'open')} disabled={saving===r.id}>Reopen</button>}
        </div>
      </div>)}</div>}

    {selected&&<div className="report-overlay" onMouseDown={e=>e.target===e.currentTarget&&closeReview()}>
      <div className="report-modal admin-edit-modal" style={{maxWidth:'760px'}}>
        <button className="report-close" onClick={closeReview} aria-label="Close"><X size={18}/></button>
        <p className="section-kicker">SUBMISSION REVIEW</p>
        <h2>{selected.distributor_name}</h2>
        <p className="report-help">Review the submitted information first. Matching and publishing will be added in the next step; this screen currently does not create or modify live directory records.</p>

        <div className="submission-review-grid">
          <div>
            <h3>Distributor information</h3>
            <p><strong>Distributor name</strong><br/>{selected.distributor_name||'—'}</p>
            <p><strong>Legal name</strong><br/>{selected.legal_name||'—'}</p>
            <p><strong>Contact person</strong><br/>{selected.contact_person||'—'}</p>
            <p><strong>Mobile</strong><br/>{selected.mobile||'—'}</p>
            <p><strong>WhatsApp</strong><br/>{selected.whatsapp||'—'}</p>
            <p><strong>Email</strong><br/>{selected.email||'—'}</p>
            <p><strong>Address</strong><br/>{selected.address||'—'}</p>
            <p><strong>City / District / State</strong><br/>{[selected.city,selected.district,selected.state].filter(Boolean).join(', ')||'—'}</p>
            <p><strong>Maps</strong><br/>{selected.maps_url||'—'}</p>
            <p><strong>Website</strong><br/>{selected.website||'—'}</p>
            <p><strong>Notes</strong><br/>{selected.notes||'—'}</p>
          </div>

          <div>
            <h3>Submitted companies / divisions</h3>
            <pre style={{whiteSpace:'pre-wrap',margin:0}}>{selected.companies_handled||'—'}</pre>

            <div style={{marginTop:'20px'}}>
              <label>Search existing distributor/company
                <div className="admin-search" style={{marginTop:'6px'}}>
                  <Search size={16}/><input value={matchQuery} onChange={e=>setMatchQuery(e.target.value)} placeholder="Search existing records..." />
                </div>
              </label>
            </div>

            {matchQuery.trim()&&<div style={{marginTop:'14px'}}>
              <strong>Existing distributor matches</strong>
              {distributorMatches.length?<div className="admin-company-list">{distributorMatches.map(d=><div className="admin-company-card" key={d.id}><span className="admin-company-icon"><Truck size={18}/></span><span className="admin-company-copy"><strong>{d.distributor_name}</strong><span>{d.contact_person||'No contact person'}</span><small>{d.mobile||'No mobile'}</small></span></div>)}</div>:<p className="report-help">No distributor match found.</p>}
            </div>}

            {matchQuery.trim()&&<div style={{marginTop:'14px'}}>
              <strong>Existing company matches</strong>
              {companyMatches.length?<div className="admin-company-list">{companyMatches.map(c=><div className="admin-company-card" key={c.id}><span className="admin-company-icon"><Building2 size={18}/></span><span className="admin-company-copy"><strong>{c.company_name}</strong><span>{c.legal_name||c.short_name||'Existing company'}</span><small>{c.status}</small></span></div>)}</div>:<p className="report-help">No company match found.</p>}
            </div>}
          </div>
        </div>

        <div className="admin-actions" style={{marginTop:'20px'}}>
          <button onClick={()=>updateStatus(selected.id,'under_review')} disabled={saving===selected.id}>Mark Under Review</button>
          <button onClick={closeReview}>Close</button>
        </div>
      </div>
    </div>}
  </div>
}
