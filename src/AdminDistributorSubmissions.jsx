import React,{useEffect,useMemo,useState} from 'react'
import {CheckCircle2,Eye,LoaderCircle,RefreshCw,ShieldAlert,Truck,X,Search,Building2,AlertTriangle,Check,Send} from 'lucide-react'
import {supabase} from './lib/supabase'

function norm(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\\s+/g,' ')}
function entriesOf(row){
  if(Array.isArray(row.company_entries)&&row.company_entries.length)return row.company_entries
  return String(row.companies_handled||'').split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean).map(company_name=>({company_name,handled_as:'company',brand:'',division:'',category:'Pharmaceutical'}))
}

export default function AdminDistributorSubmissions({onBack}){
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saving,setSaving]=useState(''),[selected,setSelected]=useState(null)
  const [companies,setCompanies]=useState([]),[distributors,setDistributors]=useState([]),[aliases,setAliases]=useState([]),[divisions,setDivisions]=useState([]),[brands,setBrands]=useState([]),[categories,setCategories]=useState([]),[locations,setLocations]=useState([])
  const [mappings,setMappings]=useState({}),[selectedDistributor,setSelectedDistributor]=useState(''),[selectedLocation,setSelectedLocation]=useState(''),[companySearches,setCompanySearches]=useState({}),[adminNotes,setAdminNotes]=useState('')

  async function load(){
    setLoading(true);setError('')
    const [subRes,companyRes,distributorRes,aliasRes,divisionRes,brandRes,categoryRes,locationRes]=await Promise.all([
      supabase.from('distributor_submissions').select('*').order('submitted_at',{ascending:false}),
      supabase.from('companies').select('id,company_name,legal_name,short_name,status').eq('status','active').order('company_name'),
      supabase.from('distributors').select('id,distributor_name,legal_name,contact_person,mobile,whatsapp,status').eq('status','active').order('distributor_name'),
      supabase.from('search_aliases').select('entity_type,entity_id,alias,normalized_alias').eq('entity_type','company'),
      supabase.from('divisions').select('id,division_name,division_code,company_id,status').eq('status','active').order('division_name'),
      supabase.from('brands').select('id,brand_name,company_id,division_id,status').eq('status','active').order('brand_name'),
      supabase.from('categories').select('id,name,status').eq('status','active').order('name'),
      supabase.from('locations').select('id,city,district,state,pincode,status').eq('status','active').order('city')
    ])
    const bad=[subRes,companyRes,distributorRes,aliasRes,divisionRes,brandRes,categoryRes,locationRes].find(x=>x.error)
    if(bad)setError(bad.error.message)
    else{setRows(subRes.data||[]);setCompanies(companyRes.data||[]);setDistributors(distributorRes.data||[]);setAliases(aliasRes.data||[]);setDivisions(divisionRes.data||[]);setBrands(brandRes.data||[]);setCategories(categoryRes.data||[]);setLocations(locationRes.data||[])}
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
    if(alias){const c=companies.find(x=>x.id===alias.entity_id);if(c)return {kind:'matched',label:c.company_name,company:c,method:'Alias',aliasUsed:alias.alias}}
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
        const b=brands.find(x=>x.company_id===m.company.id&&norm(x.brand_name)===norm(e.brand||''))
        next[i]={action:'',company_id:m.company.id,handled_as:e.brand?'brand':e.division?'division':'company',brand_id:b?.id||'',brand_name:e.brand||'',division_id:div?.id||'',category:(e.category||'Pharmaceutical'),category_id:'',territory:'',company_name:e.company_name}
      }else{
        next[i]={action:'',company_id:'',handled_as:e.brand?'brand':e.division?'division':'company',brand_id:'',brand_name:e.brand||'',division_id:'',category:(e.category||'Pharmaceutical'),category_id:'',territory:'',company_name:e.company_name}
      }
    })
    const exactDist=distributorForSubmission(row)
    setSelected(row);setMappings(next);setSelectedDistributor(exactDist?.id||'');setSelectedLocation('');setCompanySearches({});setAdminNotes('')
  }

  function closeReview(){if(!saving)setSelected(null)}

  function updateMap(i,patch){setMappings(x=>({...x,[i]:{...x[i],...patch}}))}

  function chooseCompany(i,companyId){
    const entry=entriesOf(selected)[i]
    const div=divisionFor(entry,companyId)
    const entryBrand=norm(entry.brand||'')
    const b=brands.find(x=>x.company_id===companyId&&entryBrand&&norm(x.brand_name)===entryBrand)
    updateMap(i,{action:'match',company_id:companyId,division_id:div?.id||'',brand_id:b?.id||'',brand_name:entry.brand||'',handled_as:entry.brand?'brand':entry.division?'division':'company'})
    setCompanySearches(x=>{const n={...x};delete n[i];return n})
  }

  function setCompanySearch(i,value){setCompanySearches(x=>({...x,[i]:value}))}

  function companyOptions(i,auto){
    const q=norm(companySearches[i]||'')
    const base=q?companies.filter(c=>[c.company_name,c.legal_name,c.short_name].filter(Boolean).some(v=>norm(v).includes(q))).slice(0,12):(auto.candidates||((auto.company)?[auto.company]:[]))
    const unique=[];const seen=new Set()
    base.forEach(c=>{if(c&&!seen.has(c.id)){seen.add(c.id);unique.push(c)}})
    return unique
  }

  const reviewEntries=selected?entriesOf(selected):[]
  const summary=useMemo(()=>{
    let matched=0,create=0,review=0
    reviewEntries.forEach((e,i)=>{const m=mappings[i];if(m?.action==='match'&&m.company_id)matched++;else if(m?.action==='create')create++;else review++})
    return {matched,create,review}
  },[selected,mappings])

  const locationDefault=selected?locationForSubmission(selected):null

  async function publish(){
    if(!selected)return
    setSaving(selected.id);setError('')
    const unresolved=reviewEntries.some((e,i)=>!mappings[i]?.action||!mappings[i]?.category||false)
    if(unresolved){setError('Resolve every company row before publishing.');setSaving('');return}
    if(!selectedDistributor && !selected.city){setError('A distributor or submitted distributor location is required.');setSaving('');return}
    const categoryMap=new Map(categories.map(c=>[norm(c.name),c.id]))
    const payload=reviewEntries.map((e,i)=>{
      const m=mappings[i]
      return {...m,category_id:m.category_id||categoryMap.get(norm(m.category))||''}
    })
    if(payload.some(x=>!x.category_id)){setError('One or more categories could not be matched.');setSaving('');return}
    if(!selectedLocation && !locationDefault && !selected.city){setError('Select a distributor location or provide a submitted city.');setSaving('');return}
    const {data,error}=await supabase.rpc('publish_distributor_submission',{p_submission_id:selected.id,p_mappings:payload,p_admin_notes:adminNotes||null,p_distributor_id:selectedDistributor||null,p_location_id:selectedLocation||null})
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
          <p><strong>Companies:</strong> {es.length}{r.bulk_source&&<> · <strong>Source:</strong> {r.bulk_source==='manual'?'Manual':r.bulk_source==='paste'?'Pasted list':'CSV'}</>}</p>
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
        <p className="report-help">Nothing is published until you confirm the distributor, company, brand/division classification, category and distributor location. Approve & Publish automatically records the relationship as Verified.</p>

        <div className="admin-publish-summary">
          <span><Check size={13}/> {summary.matched} matched</span><span><Building2 size={13}/> {summary.create} new</span><span><AlertTriangle size={13}/> {summary.review} unresolved</span>
        </div>

        <section className="admin-publish-section">
          <div className="admin-publish-section-head"><h3>1. Distributor & location</h3><span>Confirm the distributor record and its location once. This location applies to every company relationship below.</span></div>
          <select value={selectedDistributor} onChange={e=>setSelectedDistributor(e.target.value)}>
            <option value="">Create / use submitted distributor details</option>
            {distributors.map(d=><option key={d.id} value={d.id}>{d.distributor_name} — {d.mobile||'no mobile'}</option>)}
          </select>
          <div className="admin-publish-meta">{selected.mobile||'No mobile'} · {selected.address||'No address'}</div>
          <label className="admin-publish-location-label">Distributor location</label>
          <select value={selectedLocation} onChange={e=>setSelectedLocation(e.target.value)}>
            <option value="">Use submitted location — {[selected.city,selected.district,selected.state].filter(Boolean).join(', ')||'No submitted location'} {locationDefault?'':'(created if needed)'}</option>
            {locations.map(l=><option key={l.id} value={l.id}>{l.city}, {l.district}, {l.state}{l.pincode?' — '+l.pincode:''}</option>)}
          </select>
          <div className="admin-publish-location-note">
            Submitted distributor location: <strong>{[selected.city,selected.district,selected.state].filter(Boolean).join(', ')||'Not provided'}</strong>
            {locationDefault&&<> · Existing directory location found</>}
            {!locationDefault&&selected.city&&<> · This location will be created in the directory when you publish.</>}
          </div>
        </section>

        <section className="admin-publish-section">
          <div className="admin-publish-section-head"><h3>2. Company matching & relationships</h3><span>Confirm the company match first, then confirm division and category. Do not assign a location here.</span></div>
          <div className="admin-company-publish-list">
            {reviewEntries.map((e,i)=>{
              const auto=matchCompany(e), m=mappings[i]||{}
              return <div className="admin-company-publish-row" key={i}>
                <div className="admin-company-publish-top">
                  <div><strong>{e.company_name||'Company missing'}</strong><small>{e.handled_as==='brand'&&e.brand?'Brand: '+e.brand:e.handled_as==='division'&&e.division?'Division: '+e.division:e.handled_as==='unclear'?'Needs classification':'Company generally'} · {e.category||'Pharmaceutical'}</small></div>
                  <span className={'admin-status '+(m.action==='match'?'approved':m.action==='create'?'open':'under_review')}>{m.action==='match'?'Matched':m.action==='create'?'New company':'Needs decision'}</span>
                </div>
                <div className="admin-company-publish-controls admin-company-match-controls">
                  <div className="admin-company-match-card">
                    <div className="admin-company-match-line"><span>Submitted company</span><strong>{e.company_name||'Company missing'}</strong></div>
                    {auto.company&&<div className="admin-company-match-line"><span>{auto.kind==='matched'?'Matched company':'Suggested company'}</span><strong>{auto.company.company_name}</strong><small>Match source: {auto.method}{auto.aliasUsed?<> · Alias used: <b>{auto.aliasUsed}</b></>:''}</small></div>}
                    {!auto.company&&auto.kind==='review'&&<div className="admin-company-match-line"><span>Possible matches</span><strong>{auto.label}</strong><small>Choose the correct company manually.</small></div>}
                    {!auto.company&&auto.kind==='new'&&<div className="admin-company-match-line"><span>Match result</span><strong>No existing company found</strong><small>Create a new company only after checking the submitted name.</small></div>}
                  </div>
                  {m.action==='match' ? (
                    <div className="admin-company-selected">
                      <span>Accepted: <strong>{companies.find(c=>c.id===m.company_id)?.company_name||'Selected company'}</strong></span>
                      <button type="button" onClick={()=>setCompanySearch(i,'')}>Change company</button>
                    </div>
                  ) : (
                    <div className="admin-company-match-actions">
                      {auto.company&&<button type="button" className="primary" onClick={()=>chooseCompany(i,auto.company.id)}>Accept match</button>}
                      <button type="button" onClick={()=>setCompanySearch(i,'')}>Choose different company</button>
                      <button type="button" onClick={()=>updateMap(i,{action:'create',company_id:''})}>Create new company</button>
                    </div>
                  )}
                  {companySearches[i]!==undefined&&<div className="admin-company-search-box">
                    <input value={companySearches[i]} onChange={ev=>setCompanySearch(i,ev.target.value)} placeholder="Search existing company by name, legal name or short name…"/>
                    <select value={m.action==='match'?m.company_id:''} onChange={ev=>chooseCompany(i,ev.target.value)}>
                      <option value="">Select a company…</option>
                      {companyOptions(i,auto).map(c=><option key={c.id} value={c.id}>{c.company_name}{c.legal_name&&c.legal_name!==c.company_name?' — '+c.legal_name:''}</option>)}
                    </select>
                  </div>}
                  {m.action==='create'&&<input value={m.company_name||e.company_name||''} onChange={ev=>updateMap(i,{company_name:ev.target.value})} placeholder="New company name"/>}
                  <div className="admin-company-relationship-fields">
                    <label>Division <span className="optional-label">optional</span><select value={m.division_id||''} onChange={ev=>updateMap(i,{division_id:ev.target.value,handled_as:m.brand_id?'brand':ev.target.value?'division':'company'})}><option value="">None / not specified</option>{divisions.filter(d=>d.company_id===m.company_id).map(d=><option key={d.id} value={d.id}>{d.division_name}</option>)}</select></label>
                    <label>Brand <span className="optional-label">optional</span><select value={m.brand_id||''} onChange={ev=>{const b=brands.find(x=>x.id===ev.target.value);updateMap(i,{brand_id:ev.target.value,brand_name:b?.brand_name||'',handled_as:ev.target.value?'brand':m.division_id?'division':'company'})}}><option value="">None / not specified</option>{brands.filter(b=>b.company_id===m.company_id&&(!m.division_id||!b.division_id||b.division_id===m.division_id)).map(b=><option key={b.id} value={b.id}>{b.brand_name}</option>)}</select></label>
                    <label>Category<select value={m.category||'Pharmaceutical'} onChange={ev=>updateMap(i,{category:ev.target.value})}>
                      {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                    </select></label>
                    </div>
                </div>
                {auto.kind==='matched'&&<div className="admin-company-publish-hint admin-match-success">Company matched by {auto.method}{auto.aliasUsed?' using alias "'+auto.aliasUsed+'". Review and accept the match above.':'. Review and accept the match above.'}</div>}
                {auto.kind==='suggested'&&<div className="admin-company-publish-hint">Suggested match: {auto.label}. Accept it only after confirming the company identity.</div>}
                {auto.kind==='review'&&<div className="admin-company-publish-hint">Multiple possible matches: {auto.label}. Use “Choose different company” to select the correct record.</div>}
                {auto.kind==='new'&&<div className="admin-company-publish-hint">No existing company found. Create a new company only after checking the submitted name.</div>}
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
            {saving===selected.id?<><LoaderCircle className="spin" size={15}/> Publishing…</>:<><Send size={15}/> Approve & Publish to Directory</>}
          </button>
        </div>
      </div>
    </div>}
  </div>
}
