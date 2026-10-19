import React,{useEffect,useMemo,useState} from 'react'
import {CheckCircle2,Eye,LoaderCircle,RefreshCw,ShieldAlert,Truck,X,Search,Building2,AlertTriangle,Check,Send,FileText} from 'lucide-react'
import {supabase} from './lib/supabase'

function norm(v){
  return String(v||'').toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/&/g,' and ')
    .replace(/[^a-z0-9]+/g,' ')
    .trim().replace(/\s+/g,' ')
}
function compactNorm(v){return norm(v).replace(/[^a-z0-9]/g,'')}
const GENERIC_COMPANY_WORDS=new Set([
  'a','an','and','the','of','for','in','on','at','to',
  'pharma','pharmaceutical','pharmaceuticals','healthcare','health','medical',
  'industries','industry','private','limited','ltd','pvt','inc','incorporated',
  'company','co','corporation','corp','india','indian','international',
  'enterprise','enterprises','trading','agency','agencies','distributor',
  'distributors','wholesale','wholesaler','group','llp','llc','plc'
])
function meaningfulTokens(v){
  return [...new Set(norm(v).split(' ').filter(t=>t.length>1&&!GENERIC_COMPANY_WORDS.has(t)))]
}
function editSimilarity(a,b){
  if(!a||!b)return 0
  if(a===b)return 1
  if(Math.min(a.length,b.length)<5)return 0
  let prev=Array.from({length:b.length+1},(_,i)=>i)
  for(let i=1;i<=a.length;i++){
    const cur=[i]
    for(let j=1;j<=b.length;j++){
      cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1))
    }
    prev=cur
  }
  return 1-prev[b.length]/Math.max(a.length,b.length)
}
function companyNameScore(query,candidate){
  const q=norm(query), n=norm(candidate)
  if(!q||!n)return 0
  if(q===n)return 1
  const qc=compactNorm(q),nc=compactNorm(n)
  if(qc===nc)return 0.99
  if(Math.min(qc.length,nc.length)>=5&&(
    nc.startsWith(qc)||qc.startsWith(nc)||
    (nc.includes(qc)&&qc.length/nc.length>=0.55)||
    (qc.includes(nc)&&nc.length/qc.length>=0.55)
  ))return 0.93
  const qt=meaningfulTokens(q),nt=meaningfulTokens(n)
  const shared=qt.filter(t=>nt.includes(t))
  if(shared.length){
    const coverage=shared.length/Math.max(1,Math.min(qt.length,nt.length))
    const distinctive=shared.some(t=>t.length>=5)
    if(distinctive)return Math.min(0.88,0.62+0.14*coverage+0.04*Math.min(shared.length-1,2))
    if(shared.length>=2)return Math.min(0.78,0.56+0.12*coverage)
  }
  const similarity=editSimilarity(qc,nc)
  if(similarity>=0.82)return Math.min(0.86,similarity)
  // Compare a submitted short name against distinctive words inside a longer legal name.
  const tokenSimilarity=Math.max(0,...meaningfulTokens(n).map(token=>editSimilarity(qc,compactNorm(token))))
  if(tokenSimilarity>=0.82)return Math.min(0.88,tokenSimilarity)
  return 0
}
function entriesOf(row){
  if(Array.isArray(row.company_entries)&&row.company_entries.length)return row.company_entries
  return String(row.companies_handled||'').split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean).map(company_name=>({company_name,handled_as:'company',brand:'',division:'',category:'Pharmaceutical'}))
}

export default function AdminDistributorSubmissions({onBack}){
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saving,setSaving]=useState(''),[selected,setSelected]=useState(null)
  const [companies,setCompanies]=useState([]),[distributors,setDistributors]=useState([]),[aliases,setAliases]=useState([]),[divisions,setDivisions]=useState([]),[brands,setBrands]=useState([]),[categories,setCategories]=useState([]),[locations,setLocations]=useState([])
  const [mappings,setMappings]=useState({}),[selectedDistributor,setSelectedDistributor]=useState(''),[selectedLocation,setSelectedLocation]=useState(''),[companySearches,setCompanySearches]=useState({}),[adminNotes,setAdminNotes]=useState('')

  const [referenceDataLoaded,setReferenceDataLoaded]=useState(false)
  const [loadingReferenceData,setLoadingReferenceData]=useState(false)

  async function load(){
    setLoading(true);setError('')
    const subRes=await supabase.from('distributor_submissions')
      .select('id,distributor_name,legal_name,contact_person,mobile,whatsapp,email,address,city,district,state,maps_url,website,companies_handled,notes,submitted_at,status,admin_notes,reviewed_at,reviewed_by,company_entries,bulk_source,bulk_file_name,bulk_file_path,bulk_row_count')
      .order('submitted_at',{ascending:false})
    if(subRes.error)setError(subRes.error.message)
    else setRows(subRes.data||[])
    setLoading(false)
  }

  async function loadReviewReferenceData(){
    if(referenceDataLoaded)return true
    setLoadingReferenceData(true);setError('')
    const [companyRes,distributorRes,aliasRes,divisionRes,brandRes,categoryRes,locationRes]=await Promise.all([
      supabase.from('companies').select('id,company_name,legal_name,short_name,status').eq('status','active').order('company_name'),
      supabase.from('distributors').select('id,distributor_name,legal_name,contact_person,mobile,whatsapp,status').eq('status','active').order('distributor_name'),
      supabase.from('search_aliases').select('entity_type,entity_id,alias,normalized_alias').eq('entity_type','company'),
      supabase.from('divisions').select('id,division_name,division_code,company_id,status').eq('status','active').order('division_name'),
      supabase.from('brands').select('id,brand_name,company_id,division_id,status').eq('status','active').order('brand_name'),
      supabase.from('categories').select('id,name,status').eq('status','active').order('name'),
      supabase.from('locations').select('id,city,district,state,pincode,status').eq('status','active').order('city')
    ])
    const bad=[companyRes,distributorRes,aliasRes,divisionRes,brandRes,categoryRes,locationRes].find(x=>x.error)
    if(bad){setError('Could not load matching data: '+bad.error.message);setLoadingReferenceData(false);return false}
    setCompanies(companyRes.data||[]);setDistributors(distributorRes.data||[]);setAliases(aliasRes.data||[])
    setDivisions(divisionRes.data||[]);setBrands(brandRes.data||[]);setCategories(categoryRes.data||[]);setLocations(locationRes.data||[])
    setReferenceDataLoaded(true);setLoadingReferenceData(false);return true
  }
  useEffect(()=>{load()},[])

  async function openUploadedFile(row){
    if(!row?.bulk_file_path){setError('No uploaded file is attached to this submission.');return}
    setSaving('file:'+row.id);setError('')
    const {data,error}=await supabase.storage.from('distributor-submission-files').createSignedUrl(row.bulk_file_path,300)
    if(error){setError('Could not open the uploaded file: '+error.message);setSaving('');return}
    window.open(data.signedUrl,'_blank','noopener,noreferrer')
    setSaving('')
  }

  async function deleteSubmission(row){
    if(!row?.id)return
    const ok=window.confirm('Delete this distributor request permanently? This removes only the submission from the Admin Inbox; it does not delete any published distributor or company records.')
    if(!ok)return
    setSaving(row.id);setError('')
    const {error}=await supabase.from('distributor_submissions').delete().eq('id',row.id)
    if(error){setError(error.message);setSaving('');return}
    setRows(x=>x.filter(r=>r.id!==row.id))
    if(selected?.id===row.id)setSelected(null)
    setSaving('')
  }

  async function updateStatus(id,status){
    setSaving(id);setError('')
    const {data:{user}}=await supabase.auth.getUser()
    const patch={status,reviewed_at:status==='approved'||status==='rejected'?new Date().toISOString():null,reviewed_by:status==='approved'||status==='rejected'?user?.id:null}
    const {error}=await supabase.from('distributor_submissions').update(patch).eq('id',id)
    if(error)setError(error.message);else setRows(x=>x.map(r=>r.id===id?{...r,...patch}:r))
    setSaving('')
  }

  function matchCompany(entry){
    const q=norm(entry.company_name), qc=compactNorm(entry.company_name)
    if(!q)return {kind:'incomplete',label:'Company missing'}

    const identityFields=c=>[c.company_name,c.legal_name,c.short_name].filter(Boolean)
    const exact=companies.filter(c=>identityFields(c).some(value=>norm(value)===q||compactNorm(value)===qc))
    const exactUnique=[...new Map(exact.map(c=>[c.id,c])).values()]
    if(exactUnique.length===1){
      const company=exactUnique[0]
      const method=norm(company.company_name)===q?'Exact company name':
        compactNorm(company.company_name)===qc?'Exact name ignoring spacing/punctuation':'Exact legal/short name'
      return {kind:'matched',label:company.company_name,company,candidates:[company],method}
    }
    if(exactUnique.length>1)return {kind:'review',label:exactUnique.map(c=>c.company_name).join(' / '),candidates:exactUnique.slice(0,5),method:'Conflicting normalized names'}

    const aliasMatches=aliases.filter(a=>norm(a.normalized_alias||a.alias)===q||compactNorm(a.normalized_alias||a.alias)===qc)
      .map(a=>({alias:a,company:companies.find(c=>c.id===a.entity_id)}))
      .filter(x=>x.company)
    const aliasCompanies=[...new Map(aliasMatches.map(x=>[x.company.id,x])).values()]
    if(aliasCompanies.length===1)return {kind:'matched',label:aliasCompanies[0].company.company_name,company:aliasCompanies[0].company,candidates:[aliasCompanies[0].company],method:'Verified alias',aliasUsed:aliasCompanies[0].alias.alias}
    if(aliasCompanies.length>1)return {kind:'review',label:aliasCompanies.map(x=>x.company.company_name).join(' / '),candidates:aliasCompanies.map(x=>x.company).slice(0,5),method:'Alias maps to multiple companies'}

    // Rank every active company by its strongest company/legal/short-name or alias match.
    // Distinctive partial names and spacing differences become suggestions, never silent merges.
    const ranked=companies.map(company=>{
      const fields=identityFields(company)
      const aliasNames=aliases.filter(a=>a.entity_id===company.id).flatMap(a=>[a.alias,a.normalized_alias]).filter(Boolean)
      const score=Math.max(0,...[...fields,...aliasNames].map(value=>companyNameScore(entry.company_name,value)))
      return {company,score}
    }).filter(x=>x.score>=0.56)
      .sort((a,b)=>b.score-a.score||a.company.company_name.localeCompare(b.company.company_name))
    const candidates=ranked.slice(0,5).map(x=>x.company)
    if(!ranked.length)return {kind:'new',label:'No close existing match found — check before creating',method:'No strong candidate'}
    const top=ranked[0], second=ranked[1]
    if(top.score>=0.90&&(!second||top.score-second.score>=0.10)){
      return {kind:'suggested',label:top.company.company_name,company:top.company,candidates,method:'Strong name similarity — confirm before publishing'}
    }
    return {kind:'review',label:candidates.map(c=>c.company_name).join(' / '),candidates,company:null,method:'Partial or fuzzy match — choose the correct company'}
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

  async function prepareReview(row){
    const ready=await loadReviewReferenceData()
    if(!ready)return
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
    const raw=String(companySearches[i]||'').trim()
    const q=norm(raw)
    let base
    if(q){
      base=companies.map(company=>{
        const fields=[company.company_name,company.legal_name,company.short_name].filter(Boolean)
        const aliasNames=aliases.filter(a=>a.entity_id===company.id).flatMap(a=>[a.alias,a.normalized_alias]).filter(Boolean)
        const score=Math.max(0,...[...fields,...aliasNames].map(value=>companyNameScore(raw,value)))
        return {company,score}
      }).filter(x=>x.score>=0.45)
        .sort((a,b)=>b.score-a.score||a.company.company_name.localeCompare(b.company.company_name))
        .slice(0,12).map(x=>x.company)
    }else{
      // With an empty search, expose the complete active company master rather than only auto-suggested candidates.
      // This lets admins deliberately replace a suggested match with any other existing company.
      base=[...companies].sort((a,b)=>a.company_name.localeCompare(b.company_name))
    }
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
            {(r.status==='open'||r.status==='under_review')&&<button onClick={()=>prepareReview(r)} disabled={loadingReferenceData}><Eye size={14}/>{loadingReferenceData?'Loading match data…':' Review & Match'}</button>}
            {r.status==='open'&&<button onClick={()=>updateStatus(r.id,'under_review')} disabled={saving===r.id}>Mark Under Review</button>}
            {r.status!=='approved'&&<button className="primary" onClick={()=>prepareReview(r)} disabled={saving===r.id||loadingReferenceData}><CheckCircle2 size={14}/> Review & Publish</button>}
            {r.status!=='rejected'&&<button onClick={()=>updateStatus(r.id,'rejected')} disabled={saving===r.id}>Reject</button>}
            <button className="danger" onClick={()=>deleteSubmission(r)} disabled={saving===r.id}>Delete</button>
            {r.status!=='open'&&<button onClick={()=>updateStatus(r.id,'open')} disabled={saving===r.id}>Reopen</button>}
          </div>
        </div>
      })}</div>}

    {selected&&<div className="report-overlay" onMouseDown={e=>e.target===e.currentTarget&&closeReview()}>
      <div className="report-modal admin-edit-modal distributor-admin-review-modal">
        <button className="report-close" onClick={closeReview} aria-label="Close"><X size={18}/></button>
        <p className="section-kicker">SUBMISSION REVIEW</p>
        <h2>{selected.distributor_name}</h2>
        {selected.bulk_file_path&&<div className="admin-publish-section" style={{marginBottom:'14px'}}><div className="admin-publish-section-head"><h3>Uploaded source file</h3><span>{selected.bulk_file_name||'Distributor company list'} · {selected.bulk_row_count||0} detected company rows</span></div><button type="button" className="report-submit" onClick={()=>openUploadedFile(selected)} disabled={saving==='file:'+selected.id}>{saving==='file:'+selected.id?<><LoaderCircle className="spin" size={15}/> Opening file…</>:<><FileText size={15}/> Open uploaded {String(selected.bulk_source||'').toUpperCase()} file</>}</button></div>}
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
                  <div><strong>{e.company_name||'Company missing'}</strong><small>{[['Category',e.category],['Subsidiary',e.subsidiary],['Division',e.division],['Brand',e.brand],['Product',e.product]].filter(([,v])=>v).map(([k,v])=>k+': '+v).join(' · ')||'Company generally'}</small></div>
                  <span className={'admin-status '+(m.action==='match'?'approved':m.action==='create'?'open':'under_review')}>{m.action==='match'?'Matched':m.action==='create'?'New company':'Needs decision'}</span>
                </div>
                <div className="admin-company-publish-controls admin-company-match-controls">
                  <div className="admin-company-match-card">
                    <div className="admin-company-match-line"><span>Submitted company</span><strong>{e.company_name||'Company missing'}</strong></div>
                    {(e.subsidiary||e.division||e.brand||e.product)&&<div className="admin-company-match-line"><span>Submitted hierarchy</span><strong>{[['Subsidiary',e.subsidiary],['Division',e.division],['Brand',e.brand],['Product',e.product]].filter(([,v])=>v).map(([k,v])=>k+': '+v).join(' · ')}</strong><small>Confirm names against the catalogue before publishing. Submitted product and subsidiary names are retained for review.</small></div>}
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
