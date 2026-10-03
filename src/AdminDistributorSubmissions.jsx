import React,{useEffect,useMemo,useState} from 'react'
import {CheckCircle2,Eye,LoaderCircle,RefreshCw,ShieldAlert,Truck,X,Search,Building2,AlertTriangle,Check,Send} from 'lucide-react'
import {supabase} from './lib/supabase'

function norm(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\\s+/g,' ')}
function entriesOf(row){
  if(Array.isArray(row.company_entries)&&row.company_entries.length)return row.company_entries
  return String(row.companies_handled||'').split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean).map(company_name=>({company_name,division:'',category:'Pharmaceutical'}))
}

export default function AdminDistributorSubmissions({onBack}){
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saving,setSaving]=useState(''),[selected,setSelected]=useState(null)
  const [companies,setCompanies]=useState([]),[distributors,setDistributors]=useState([]),[aliases,setAliases]=useState([]),[divisions,setDivisions]=useState([]),[categories,setCategories]=useState([]),[locations,setLocations]=useState([])
  const [matchQuery,setMatchQuery]=useState(''),[mappings,setMappings]=useState({}),[selectedDistributor,setSelectedDistributor]=useState(''),[adminNotes,setAdminNotes]=useState('')

  async function load(){
    setLoading(true);setError('')
    const [subRes,companyRes,distributorRes,aliasRes,divisionRes,categoryRes,locationRes]=await Promise.all([
      supabase.from('distributor_submissions').select('*').order('submitted_at',{ascending:false}),
      supabase.from('companies').select('id,company_name,legal_name,short_name,status').eq('status','active').order('company_name'),
      supabase.from('distributors').select('id,distributor_name,legal_name,contact_person,mobile,whatsapp,status').eq('status','active').order('distributor_name'),
      supabase.from('search_aliases').select('entity_type,entity_id,alias,normalized_alias').eq('entity_type','company'),
      supabase.from('divisions').select('id,division_name,division_code,company_id,status').eq('status','active').order('division_name'),
      supabase.from('categories').select('id,name,status').eq('status','active').order('name'),
      supabase.from('locations').select('id,city,district,state,pincode,status').eq('status','active').order('city')
    ])
    const bad=[subRes,companyRes,distributorRes,aliasRes,divisionRes,categoryRes,locationRes].find(x=>x.error)
    if(bad)setError(bad.error.message)
    else{setRows(subRes.data||[]);setCompanies(companyRes.data||[]);setDistributors(distributorRes.data||[]);setAliases(aliasRes.data||[]);setDivisions(divisionRes.data||[]);setCategories(categoryRes.data||[]);setLocations(locationRes.data||[])}
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

  function matchCompany(entry){
    const q=norm(entry.company_name)
    if(!q)return {kind:'incomplete',label:'Company missing'}
    const exact=companies.find(c=>norm(c.company_name)===q)
    if(exact)return {kind:'matched',label:exact.company_name,company:exact,method:'Exact'}
    const alias=aliases.find(a=>norm(a.normalized_alias||a.alias)===q)
    if(alias){const c=companies.find(x=>x.id===alias.entity_id);if(c)return {kind:'matched',label:c.company_name,company:c,method:'Alias'}}
    const candidates=companies.filter(c=>[c.company_name,c.legal_name,c.short_name].filter(Boolean).some(v=>{const n=norm(v);return n.includes(q)||q.includes(n)})).slice(0,5)
    if(candidates.length===1)return {kind:'suggested',label:candidates[0].company_name,company:candidates[0],candidates,method:'Possible match'}
    if(candidates.length>1)return {kind:'review',label:candidates.map(c=>c.company_name).join(' / '),candidates,method:'Multiple matches'}
    return {kind:'new',label:'No existing company match',method:'New / review'}
  }

  function divisionFor(entry,companyId){
    const q=norm(entry.division)
    if(!q)return null
    return divisions.find(d=>d.company_id===companyId&&(norm(d.division_name)===q||norm(d.division_code)===q))||null
  }

  function locationForSubmission(row){
    const q=norm(row.city)
    return locations.find(l=>q&&norm(l.city)===q)||null
  }

  function distributorForSubmission(row){
    const q=norm(row.distributor_name)
    const mobile=String(row.mobile||'').replace(/\\D/g,'')
    return distributors.find(d=>norm(d.distributor_name)===q || (mobile&&String(d.mobile||'').replace(/\\D/g,'')===mobile))||null
  }

  function prepareReview(row){
    const next={}
    entriesOf(row).forEach((e,i)=>{
      const m=matchCompany(e)
      if(m.company){
        const div=divisionFor(e,m.company.id)
        next[i]={action:'match',company_id:m.company.id,division_id:div?.id||'',category:(e.category||'Pharmaceutical'),category_id:'',location_id:locationForSubmission(row)?.id||'',territory:'',company_name:e.company_name}
      }else{
        next[i]={action:'',company_id:'',division_id:'',category:(e.category||'Pharmaceutical'),category_id:'',location_id:locationForSubmission(row)?.id||'',territory:'',company_name:e.company_name}
      }
    })
    const exactDist=distributorForSubmission(row)
    setSelected(row);setMappings(next);setSelectedDistributor(exactDist?.id||'');setAdminNotes('');setMatchQuery('')
  }

  function closeReview(){if(!saving)setSelected(null)}

  function updateMap(i,patch){setMappings(x=>({...x,[i]:{...x[i],...patch}}))}

  function chooseCompany(i,companyId){
    const entry=entriesOf(selected)[i]
    const div=divisionFor(entry,companyId)
    updateMap(i,{action:'match',company_id:companyId,division_id:div?.id||''})
  }

  const reviewEntries=selected?entriesOf(selected):[]
  const summary=useMemo(()=>{
    let matched=0,create=0,review=0
    reviewEntries.forEach((e,i)=>{const m=mappings[i];if(m?.action==='match'&&m.company_id)matched++;else if(m?.action==='create')create++;else review++})
    return {matched,create,review}
  },[selected,mappings])

  const locationDefault=selected?locationForSubmission(selected):null
  const companySearch=useMemo(()=>{
    const q=norm(matchQuery);if(!q)return []
    return companies.filter(c=>[c.company_name,c.legal_name,c.short_name].filter(Boolean).some(v=>norm(v).includes(q))).slice(0,10)
  },[companies,matchQuery])

  async function publish(){
    if(!selected)return
    setSaving(selected.id);setError('')
    const unresolved=reviewEntries.some((e,i)=>!mappings[i]?.action||!mappings[i]?.category)
    if(unresolved){setError('Resolve every company row before publishing.');setSaving('');return}
    if(!selectedDistributor && !selected.city){setError('A distributor or submission city is required.');setSaving('');return}
    const categoryMap=new Map(categories.map(c=>[norm(c.name),c.id]))
    const payload=reviewEntries.map((e,i)=>{
      const m=mappings[i]
      return {...m,category_id:m.category_id||categoryMap.get(norm(m.category))||'',location_id:m.location_id||locationDefault?.id||''}
    })
    if(payload.some(x=>!x.category_id)){setError('One or more categories could not be matched.');setSaving('');return}
    if(payload.some(x=>!x.location_id)){setError('One or more rows have no Kutch location. Add the location before publishing.');setSaving('');return}
    const {data,error}=await supabase.rpc('publish_distributor_submission',{p_submission_id:selected.id,p_mappings:payload,p_admin_notes:adminNotes||null})
    if(error){setError(error.message);setSaving('');return}
    setRows(x=>x.map(r=>r.id===selected.id?{...r,status:'approved',reviewed_at:new Date().toISOString()}:r))
    setSelected(null);setSaving('')
    alert(`Published successfully. ${data?.created_relationships||0} new relationships created.`)
  }

  return <div className="admin-page">
    <div className="admin-head">
      <div><button className="admin-back" onClick={onBack}><span>←</span> Dashboard</button><p className="section-kicker">ADMIN</p><h1>Distributor Submissions</h1><p>Review submitted distributor information, match companies, and publish only after admin confirmation.</p></div>
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
            {(r.status==='open'||r.status==='under_review')&&<button onClick={()=>prepareReview(r)}><Eye size={14}/> Review & Match</button>}
            {r.status==='open'&&<button onClick={()=>updateStatus(r.id,'under_review')} disabled={saving===r.id}>Mark Under Review</button>}
            {r.status!=='approved'&&<button className="primary" onClick={()=>prepareReview(r)} disabled={saving===r.id}><CheckCircle2 size={14}/> Review & Publish</button>}
            {r.status!=='rejected'&&<button onClick={()=>updateStatus(r.id,'rejected')} disabled={saving===r.id}>Reject</button>}
            {r.status!=='open'&&<button onClick={()=>updateStatus(r.id,'open')} disabled={saving===r.id}>Reopen</button>}
          </div>
        </div>
      })}</div>}

    {selected&&<div className="report-overlay" onMouseDown={e=>e.target===e.currentTarget&&closeReview()}>
      <div className="report-modal admin-edit-modal distributor-admin-review-modal">
        <button className="report-close" onClick={closeReview} aria-label="Close"><X size={18}/></button>
        <p className="section-kicker">SUBMISSION REVIEW</p>
        <h2>{selected.distributor_name}</h2>
        <p className="report-help">Nothing is published until you confirm the distributor, company, division, category and location mappings.</p>

        <div className="admin-publish-summary">
          <span><Check size={13}/> {summary.matched} matched</span><span><Building2 size={13}/> {summary.create} new</span><span><AlertTriangle size={13}/> {summary.review} unresolved</span>
        </div>

        <section className="admin-publish-section">
          <div className="admin-publish-section-head"><h3>1. Distributor</h3><span>Select an existing record or leave blank to create from this submission.</span></div>
          <select value={selectedDistributor} onChange={e=>setSelectedDistributor(e.target.value)}>
            <option value="">Create / use submitted distributor details</option>
            {distributors.map(d=><option key={d.id} value={d.id}>{d.distributor_name} — {d.mobile||'no mobile'}</option>)}
          </select>
          <div className="admin-publish-meta">{selected.mobile||'No mobile'} · {[selected.city,selected.district,selected.state].filter(Boolean).join(', ')||'No location'} · {selected.address||'No address'}</div>
        </section>

        <section className="admin-publish-section">
          <div className="admin-publish-section-head"><h3>2. Company & relationship matching</h3><span>Resolve every row before publishing.</span></div>
          <div className="admin-company-publish-list">
            {reviewEntries.map((e,i)=>{
              const auto=matchCompany(e), m=mappings[i]||{}
              const candidates=auto.candidates||((auto.company)?[auto.company]:[])
              return <div className="admin-company-publish-row" key={i}>
                <div className="admin-company-publish-top">
                  <div><strong>{e.company_name||'Company missing'}</strong><small>{e.division||'No division'} · {e.category||'Pharmaceutical'}</small></div>
                  <span className={'admin-status '+(m.action==='match'?'approved':m.action==='create'?'open':'under_review')}>{m.action==='match'?'Matched':m.action==='create'?'New company':'Needs decision'}</span>
                </div>
                <div className="admin-company-publish-controls">
                  <select value={m.action||''} onChange={ev=>updateMap(i,{action:ev.target.value,company_id:ev.target.value==='match'?(auto.company?.id||''):''})}>
                    <option value="">Choose action…</option><option value="match">Match existing company</option><option value="create">Create new company</option>
                  </select>
                  {m.action==='match'&&<select value={m.company_id||''} onChange={ev=>chooseCompany(i,ev.target.value)}>
                    <option value="">Select company…</option>
                    {candidates.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}
                    {companySearch.filter(c=>!candidates.some(x=>x.id===c.id)).map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}
                  </select>}
                  {m.action==='create'&&<input value={m.company_name||e.company_name||''} onChange={ev=>updateMap(i,{company_name:ev.target.value})} placeholder="New company name"/>}
                  <select value={m.category||'Pharmaceutical'} onChange={ev=>updateMap(i,{category:ev.target.value})}>
                    {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  {m.action==='match'&&<select value={m.division_id||''} onChange={ev=>updateMap(i,{division_id:ev.target.value})}>
                    <option value="">No division / select if applicable</option>
                    {divisions.filter(d=>d.company_id===m.company_id).map(d=><option key={d.id} value={d.id}>{d.division_name}</option>)}
                  </select>}
                  <select value={m.location_id||locationDefault?.id||''} onChange={ev=>updateMap(i,{location_id:ev.target.value})}>
                    <option value="">Select location…</option>
                    {locations.map(l=><option key={l.id} value={l.id}>{l.city}, {l.district}, {l.state}</option>)}
                  </select>
                </div>
                {auto.kind!=='matched'&&<div className="admin-company-publish-hint">{auto.kind==='suggested'?'Possible match: '+auto.label:auto.kind==='review'?'Multiple possible matches: '+auto.label:auto.kind==='new'?'No existing company found.': 'Company name is missing.'}</div>}
              </div>
            })}
          </div>
        </section>

        <section className="admin-publish-section">
          <div className="admin-publish-section-head"><h3>3. Final check</h3><span>Add an internal note if needed.</span></div>
          <textarea value={adminNotes} onChange={e=>setAdminNotes(e.target.value)} rows="3" placeholder="Admin note, source verification, or reason for a manual match…"/>
        </section>

        {error&&<div className="admin-error">{error}</div>}
        <div className="admin-actions admin-publish-actions">
          <button onClick={closeReview}>Cancel</button>
          <button className="primary" onClick={publish} disabled={saving===selected.id||summary.review>0||!reviewEntries.length}>
            {saving===selected.id?<><LoaderCircle className="spin" size={15}/> Publishing…</>:<><Send size={15}/> Review complete — Publish</>}
          </button>
        </div>
      </div>
    </div>}
  </div>
}
