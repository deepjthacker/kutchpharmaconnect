import React,{useEffect,useMemo,useState} from 'react'
import {CheckCircle2,Eye,LoaderCircle,RefreshCw,ShieldAlert,Truck,X,Search,Building2,AlertTriangle,Check} from 'lucide-react'
import {supabase} from './lib/supabase'

function norm(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\\s+/g,' ')}
function entriesOf(row){
  if(Array.isArray(row.company_entries)&&row.company_entries.length)return row.company_entries
  return String(row.companies_handled||'').split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean).map(company_name=>({company_name,division:'',category:'Pharmaceutical',products_brands:''}))
}

export default function AdminDistributorSubmissions({onBack}){
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saving,setSaving]=useState(''),[selected,setSelected]=useState(null)
  const [companies,setCompanies]=useState([]),[distributors,setDistributors]=useState([]),[aliases,setAliases]=useState([]),[matchQuery,setMatchQuery]=useState('')

  async function load(){
    setLoading(true);setError('')
    const [subRes,companyRes,distributorRes,aliasRes]=await Promise.all([
      supabase.from('distributor_submissions').select('*').order('submitted_at',{ascending:false}),
      supabase.from('companies').select('id,company_name,legal_name,short_name,status').eq('status','active').order('company_name'),
      supabase.from('distributors').select('id,distributor_name,legal_name,contact_person,mobile,whatsapp,status').eq('status','active').order('distributor_name'),
      supabase.from('search_aliases').select('entity_type,entity_id,alias,normalized_alias').eq('entity_type','company')
    ])
    const bad=[subRes,companyRes,distributorRes,aliasRes].find(x=>x.error)
    if(bad)setError(bad.error.message)
    else{setRows(subRes.data||[]);setCompanies(companyRes.data||[]);setDistributors(distributorRes.data||[]);setAliases(aliasRes.data||[])}
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
  function openReview(row){setSelected(row);setMatchQuery('')}
  function closeReview(){if(!saving)setSelected(null)}

  const distributorMatches=useMemo(()=>{
    if(!selected)return []
    const q=(matchQuery||selected.distributor_name||'').trim().toLowerCase()
    if(!q)return []
    return distributors.filter(d=>[d.distributor_name,d.legal_name,d.contact_person,d.mobile,d.whatsapp].filter(Boolean).some(v=>String(v).toLowerCase().includes(q))).slice(0,8)
  },[selected,distributors,matchQuery])

  const companyMatches=useMemo(()=>{
    if(!selected)return []
    const q=(matchQuery||'').trim().toLowerCase()
    if(!q)return []
    return companies.filter(c=>[c.company_name,c.legal_name,c.short_name].filter(Boolean).some(v=>String(v).toLowerCase().includes(q))).slice(0,8)
  },[selected,companies,matchQuery])

  function matchCompany(entry){
    const q=norm(entry.company_name)
    if(!q)return {kind:'incomplete',label:'Company missing'}
    const exact=companies.find(c=>norm(c.company_name)===q)
    if(exact)return {kind:'matched',label:exact.company_name,company:exact,method:'Exact'}
    const alias=aliases.find(a=>norm(a.normalized_alias||a.alias)===q)
    if(alias){const c=companies.find(x=>x.id===alias.entity_id);if(c)return {kind:'matched',label:c.company_name,company:c,method:'Alias'}}
    const candidates=companies.filter(c=>[c.company_name,c.legal_name,c.short_name].filter(Boolean).some(v=>{const n=norm(v);return n.includes(q)||q.includes(n)})).slice(0,3)
    if(candidates.length===1)return {kind:'suggested',label:candidates[0].company_name,company:candidates[0],method:'Possible match'}
    if(candidates.length>1)return {kind:'review',label:candidates.map(c=>c.company_name).join(' / '),candidates,method:'Multiple matches'}
    return {kind:'new',label:'No existing company match',method:'New / review'}
  }

  const reviewEntries=selected?entriesOf(selected):[]
  const matchSummary=useMemo(()=>{
    const counts={matched:0,suggested:0,review:0,new:0,incomplete:0}
    reviewEntries.forEach(e=>counts[matchCompany(e).kind]++)
    return counts
  },[selected,companies,aliases])

  return <div className="admin-page">
    <div className="admin-head">
      <div><button className="admin-back" onClick={onBack}><span>←</span> Dashboard</button><p className="section-kicker">ADMIN</p><h1>Distributor Submissions</h1><p>Review submitted distributor information and resolve only the items that need a decision.</p></div>
      <button className="admin-refresh" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button>
    </div>
    {error&&<div className="admin-error"><ShieldAlert size={16}/>{error}</div>}
    {loading?<div className="admin-state"><LoaderCircle className="spin" size={20}/> Loading submissions…</div>:rows.length===0?<div className="admin-state"><Truck size={22}/> No distributor submissions yet.</div>:
      <div className="admin-table">{rows.map(r=>{
        const es=entriesOf(r)
        return <div className="admin-report" key={r.id}>
          <div className="admin-report-top"><span className={'admin-status '+r.status}>{r.status.replace('_',' ')}</span><small>{new Date(r.submitted_at).toLocaleString()}</small></div>
          <h3>{r.distributor_name}</h3>
          <p><strong>Contact:</strong> {r.contact_person||'—'} · {r.mobile}</p>
          <p><strong>Email:</strong> {r.email||'—'} · <strong>Location:</strong> {[r.city,r.district,r.state].filter(Boolean).join(', ')||'—'}</p>
          <p><strong>Companies:</strong> {es.length}{r.bulk_source&&<> · <strong>Source:</strong> {r.bulk_source==='manual'?'Manual':r.bulk_source==='paste'?'Pasted list':'Excel / CSV'}</>}</p>
          {r.notes&&<p><strong>Notes:</strong> {r.notes}</p>}
          <div className="admin-actions">
            {(r.status==='open'||r.status==='under_review')&&<button onClick={()=>openReview(r)}><Eye size={14}/> Review & Match</button>}
            {r.status==='open'&&<button onClick={()=>updateStatus(r.id,'under_review')} disabled={saving===r.id}>Mark Under Review</button>}
            {r.status!=='approved'&&<button className="primary" onClick={()=>openReview(r)} disabled={saving===r.id}><CheckCircle2 size={14}/> Review Before Approve</button>}
            {r.status!=='rejected'&&<button onClick={()=>updateStatus(r.id,'rejected')} disabled={saving===r.id}>Reject</button>}
            {r.status!=='open'&&<button onClick={()=>updateStatus(r.id,'open')} disabled={saving===r.id}>Reopen</button>}
          </div>
        </div>
      })}</div>}

    {selected&&<div className="report-overlay" onMouseDown={e=>e.target===e.currentTarget&&closeReview()}>
      <div className="report-modal admin-edit-modal" style={{maxWidth:'980px'}}>
        <button className="report-close" onClick={closeReview} aria-label="Close"><X size={18}/></button>
        <p className="section-kicker">SUBMISSION REVIEW</p><h2>{selected.distributor_name}</h2>
        <p className="report-help">The system matches obvious company names automatically. You only need to review suggestions, ambiguous names, missing companies, or genuinely new companies.</p>

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
            {selected.bulk_file_name&&<p><strong>Upload file</strong><br/>{selected.bulk_file_name} · {selected.bulk_row_count||reviewEntries.length} rows</p>}
          </div>
          <div>
            <h3>Company matching</h3>
            <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'14px'}}>
              <span className="admin-status approved">✓ {matchSummary.matched} matched</span>
              <span className="admin-status under_review">⚠ {matchSummary.suggested+matchSummary.review} review</span>
              <span className="admin-status open">＋ {matchSummary.new} new</span>
              {matchSummary.incomplete>0&&<span className="admin-status rejected">! {matchSummary.incomplete} incomplete</span>}
            </div>
            <div style={{display:'grid',gap:'8px'}}>
              {reviewEntries.map((e,i)=>{
                const m=matchCompany(e)
                return <div key={i} style={{border:'1px solid var(--border,#e5e7eb)',borderRadius:'10px',padding:'10px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:'12px',alignItems:'center'}}>
                    <div><strong>{e.company_name||'Company not provided'}</strong>{e.division&&<div className="report-help">Division: {e.division}</div>}{e.products_brands&&<div className="report-help">Products / Brands: {e.products_brands}</div>}</div>
                    <span className={'admin-status '+(m.kind==='matched'?'approved':m.kind==='new'||m.kind==='incomplete'?'rejected':'under_review')}>{m.kind==='matched'?<><Check size={13}/> {m.label}</>:m.kind==='new'?'New / review':m.kind==='incomplete'?'Missing company':<>Review: {m.label}</>}</span>
                  </div>
                  {m.kind!=='matched'&&m.kind!=='incomplete'&&<div className="report-help" style={{marginTop:'5px'}}>Suggested by {m.method}. No live record has been changed.</div>}
                </div>
              })}
            </div>

            <div style={{marginTop:'18px'}}>
              <h3>Search existing records</h3>
              <div className="admin-search" style={{marginTop:'6px'}}><Search size={16}/><input value={matchQuery} onChange={e=>setMatchQuery(e.target.value)} placeholder="Search distributor or company..." /></div>
              {matchQuery.trim()&&<div style={{marginTop:'12px'}}>
                <strong>Distributor matches</strong>
                {distributorMatches.length?<div className="admin-company-list">{distributorMatches.map(d=><div className="admin-company-card" key={d.id}><span className="admin-company-icon"><Truck size={18}/></span><span className="admin-company-copy"><strong>{d.distributor_name}</strong><span>{d.contact_person||'No contact person'}</span><small>{d.mobile||'No mobile'}</small></span></div>)}</div>:<p className="report-help">No distributor match found.</p>}
                <strong style={{display:'block',marginTop:'12px'}}>Company matches</strong>
                {companyMatches.length?<div className="admin-company-list">{companyMatches.map(c=><div className="admin-company-card" key={c.id}><span className="admin-company-icon"><Building2 size={18}/></span><span className="admin-company-copy"><strong>{c.company_name}</strong><span>{c.legal_name||c.short_name||'Existing company'}</span><small>{c.status}</small></span></div>)}</div>:<p className="report-help">No company match found.</p>}
              </div>}
            </div>
          </div>
        </div>

        <div className="admin-actions" style={{marginTop:'20px'}}><button onClick={()=>updateStatus(selected.id,'under_review')} disabled={saving===selected.id}>Mark Under Review</button><button onClick={closeReview}>Close</button></div>
      </div>
    </div>}
  </div>
}
