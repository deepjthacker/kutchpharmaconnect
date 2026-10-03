import React,{useEffect,useMemo,useState} from 'react'
import {AlertTriangle,Check,Eye,LoaderCircle,Package,RefreshCw,ShieldAlert,X} from 'lucide-react'
import {supabase} from './lib/supabase'

const norm=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')
const entriesOf=r=>Array.isArray(r.product_entries)?r.product_entries:[]
const clean=v=>String(v??'').trim()

export default function AdminProductSubmissions({onBack}){
 const [rows,setRows]=useState([]),[companies,setCompanies]=useState([]),[products,setProducts]=useState([]),[distributors,setDistributors]=useState([]),[divisions,setDivisions]=useState([]),[categories,setCategories]=useState([]),[locations,setLocations]=useState([])
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[selected,setSelected]=useState(null),[saving,setSaving]=useState(''),[decisions,setDecisions]=useState({}),[distributorChoice,setDistributorChoice]=useState(''),[createDistributor,setCreateDistributor]=useState(false),[adminNotes,setAdminNotes]=useState('')

 async function load(){
  setLoading(true);setError('')
  const [s,c,p,d,v,cat,l]=await Promise.all([
   supabase.from('product_submissions').select('*').order('submitted_at',{ascending:false}),
   supabase.from('companies').select('id,company_name,legal_name,short_name,status').eq('status','active').order('company_name'),
   supabase.from('products').select('id,product_name,normalized_product_name,company_id,division_id,category_id,status').eq('status','active').limit(5000),
   supabase.from('distributors').select('id,distributor_name,legal_name,mobile,status').eq('status','active').order('distributor_name'),
   supabase.from('divisions').select('id,company_id,division_name,division_code,status').eq('status','active').order('division_name'),
   supabase.from('categories').select('id,name,status').eq('status','active').order('display_order').order('name'),
   supabase.from('locations').select('id,city,district,state,pincode,status').eq('status','active').order('city')
  ])
  const bad=[s,c,p,d,v,cat,l].find(x=>x.error)
  if(bad)setError(bad.error.message)
  else{setRows(s.data||[]);setCompanies(c.data||[]);setProducts(p.data||[]);setDistributors(d.data||[]);setDivisions(v.data||[]);setCategories(cat.data||[]);setLocations(l.data||[])}
  setLoading(false)
 }
 useEffect(()=>{load()},[])

 async function status(id,status){
  setSaving(id)
  const {data:{user}}=await supabase.auth.getUser()
  const patch={status,reviewed_at:status==='rejected'?new Date().toISOString():null,reviewed_by:status==='rejected'?user?.id:null}
  const {error}=await supabase.from('product_submissions').update(patch).eq('id',id)
  if(error)setError(error.message);else setRows(x=>x.map(r=>r.id===id?{...r,...patch}:r))
  setSaving('')
 }

 function companyMatch(name){
  const q=norm(name);if(!q)return {kind:'incomplete',label:'Company missing'}
  const exact=companies.find(c=>norm(c.company_name)===q)
  if(exact)return {kind:'matched',label:exact.company_name,company:exact,method:'Exact'}
  const exactAlt=companies.filter(c=>[c.legal_name,c.short_name].filter(Boolean).some(v=>norm(v)===q))
  if(exactAlt.length===1)return {kind:'suggested',label:exactAlt[0].company_name,company:exactAlt[0],method:'Legal / short name'}
  const partial=companies.filter(c=>[c.company_name,c.legal_name,c.short_name].filter(Boolean).some(v=>{const n=norm(v);return n.length>=4&&(n.includes(q)||q.includes(n))}))
  if(partial.length===1)return {kind:'suggested',label:partial[0].company_name,company:partial[0],method:'Possible match'}
  if(partial.length>1)return {kind:'review',label:partial.slice(0,4).map(c=>c.company_name).join(' / '),candidates:partial,method:'Multiple matches'}
  return {kind:'new',label:'No existing company match'}
 }

 function productMatches(e,companyId){
  if(!companyId)return []
  const q=norm(e.product_name)
  return products.filter(p=>norm(p.product_name)===q&&p.company_id===companyId)
 }

 function openReview(r){
  const next={}
  entriesOf(r).forEach((e,i)=>{
   const m=companyMatch(e.company)
   next[i]=m.kind==='matched'?{company_id:m.company.id,company_mode:'existing'}:{company_id:'',company_mode:'existing'}
  })
  setSelected(r);setDecisions(next);setDistributorChoice(r.distributor_id||'');setCreateDistributor(false);setAdminNotes(r.admin_notes||'');setError('')
 }

 function setDecision(i,key,value){setDecisions(x=>({...x,[i]:{...(x[i]||{}),[key]:value}}))}

 const selectedEntries=selected?entriesOf(selected):[]
 const summary=useMemo(()=>{
  const x={matched:0,suggested:0,review:0,incomplete:0,newCompany:0,duplicates:0,unmapped:0}
  selectedEntries.forEach((e,i)=>{
   const d=decisions[i]||{},m=companyMatch(e.company),cid=d.company_id||null
   if(cid){if(m.company?.id===cid&&m.kind==='matched')x.matched++;else x.suggested++}
   else if(d.company_mode==='new')x.newCompany++
   else if(m.kind==='incomplete')x.incomplete++
   else x.unmapped++
   if(productMatches(e,cid).length)x.duplicates++
   if(m.kind==='review')x.review++
  })
  return x
 },[selected,decisions,companies,products])

 const canPublish=selectedEntries.length>0 && selectedEntries.every((e,i)=>{
  const d=decisions[i]||{}
  return d.company_id || d.company_mode==='new'
 }) && (!!distributorChoice || createDistributor)

 async function publish(){
  if(!selected||!canPublish)return
  setSaving(selected.id);setError('')
  try{
   const {data:{user}}=await supabase.auth.getUser()
   if(!user)throw new Error('Admin session expired. Please log in again.')
   const payload=selectedEntries.map((e,i)=>{
    const d=decisions[i]||{}
    return {
      company_id:d.company_mode==='new'?null:(d.company_id||null),
      create_company:d.company_mode==='new',
      product_id:d.product_id||null,
      create_product:!d.product_id,
      division_id:d.division_id||null,
      category_id:d.category_id||null,
      location_id:d.location_id||null,
      territory:clean(d.territory),
      notes:clean(d.notes)
    }
   })
   const {data,rpcError}=await supabase.rpc('publish_product_submission',{
    p_submission_id:selected.id,
    p_distributor_id:createDistributor?null:(distributorChoice||null),
    p_create_distributor:createDistributor,
    p_distributor_data:createDistributor?{distributor_name:selected.distributor_name,mobile:selected.mobile,email:selected.email||null,notes:selected.notes||null}:{},
    p_decisions:payload,
    p_admin_notes:adminNotes||null
   })
   if(rpcError)throw rpcError
   setRows(x=>x.map(r=>r.id===selected.id?{...r,status:'approved',reviewed_at:new Date().toISOString(),reviewed_by:user.id}:r))
   setSelected(null);setDecisions({});setDistributorChoice('');setCreateDistributor(false)
   window.alert('Published successfully. '+(data?.rows_published||selectedEntries.length)+' product rows processed.')
  }catch(e){setError(e.message||'Publish failed. No partial publish should have been committed.')}
  setSaving('')
 }

 return <div className="admin-page">
  <div className="admin-head"><div><button className="admin-back" onClick={onBack}>← Dashboard</button><p className="section-kicker">ADMIN</p><h1>Product Submissions</h1><p>Review uploaded product lists, confirm company identities, then publish them into the directory.</p></div><button className="admin-refresh" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
  {error&&<div className="admin-error"><ShieldAlert size={16}/>{error}</div>}
  {loading?<div className="admin-state"><LoaderCircle className="spin" size={20}/> Loading product submissions…</div>:<div className="admin-table">{rows.length?rows.map(r=><div className="admin-report" key={r.id}><div className="admin-report-top"><span className={'admin-status '+r.status}>{r.status.replace('_',' ')}</span><small>{new Date(r.submitted_at).toLocaleString()}</small></div><h3>{r.distributor_name}</h3><p><strong>Contact:</strong> {r.mobile} · <strong>Rows:</strong> {r.row_count||entriesOf(r).length} · <strong>Source:</strong> {r.source}</p><div className="admin-actions">{(r.status==='open'||r.status==='under_review'||r.status==='ready')&&<button onClick={()=>openReview(r)}><Eye size={14}/> Review & Publish</button>}{r.status==='open'&&<button onClick={()=>status(r.id,'under_review')}>Mark Under Review</button>}{r.status!=='rejected'&&r.status!=='approved'&&<button onClick={()=>status(r.id,'rejected')}>Reject</button>}{r.status!=='open'&&r.status!=='approved'&&<button onClick={()=>status(r.id,'open')}>Reopen</button>}</div></div>):<div className="admin-state"><Package size={22}/> No product submissions yet.</div>}</div>}

  {selected&&<div className="report-overlay" onMouseDown={e=>e.target===e.currentTarget&&!saving&&setSelected(null)}><div className="report-modal admin-edit-modal" style={{maxWidth:'1150px'}}>
   <button className="report-close" onClick={()=>!saving&&setSelected(null)}><X size={18}/></button>
   <p className="section-kicker">PRODUCT REVIEW & PUBLISH</p><h2>{selected.distributor_name}</h2>
   <p className="report-help">Exact company names are pre-matched. Suggested or ambiguous company names must be explicitly selected. Nothing is published until you click Publish.</p>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',margin:'14px 0'}}>
    <label><strong>Distributor mapping</strong><select value={createDistributor?'__new__':distributorChoice} onChange={e=>{const v=e.target.value;setCreateDistributor(v==='__new__');setDistributorChoice(v==='__new__'?'':v)}}><option value="">Select existing distributor…</option>{distributors.map(d=><option key={d.id} value={d.id}>{d.distributor_name} — {d.mobile||'no mobile'}</option>)}<option value="__new__">+ Create new distributor from submission</option></select></label>
    <label><strong>Admin notes</strong><input value={adminNotes} onChange={e=>setAdminNotes(e.target.value)} placeholder="Optional publication note"/></label>
   </div>
   <div style={{display:'flex',gap:'8px',flexWrap:'wrap',margin:'12px 0 18px'}}>
    <span className="admin-status approved">✓ {summary.matched} exact</span><span className="admin-status under_review">⚠ {summary.suggested} mapped/review</span>{summary.review>0&&<span className="admin-status under_review">! {summary.review} ambiguous</span>}<span className="admin-status open">＋ {summary.newCompany} new company</span><span className="admin-status rejected">× {summary.unmapped} unmapped</span><span className="admin-status under_review">↻ {summary.duplicates} existing product match</span>
   </div>
   <div style={{display:'grid',gap:'10px',maxHeight:'610px',overflowY:'auto'}}>
   {selectedEntries.map((e,i)=>{
    const m=companyMatch(e.company),d=decisions[i]||{},cid=d.company_id||'',dups=productMatches(e,cid),companyOptions=m.candidates||[],divs=divisions.filter(x=>x.company_id===cid)
    return <div key={i} style={{border:'1px solid var(--border,#e5e7eb)',borderRadius:'10px',padding:'12px'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:'12px',marginBottom:'10px'}}><div><strong>{i+1}. {e.product_name}</strong><div className="report-help">Submitted company: {e.company||'—'}{e.generic_name&&<> · {e.generic_name}</>}{e.strength&&<> · {e.strength}</>}</div></div><span className={'admin-status '+(cid?'approved':d.company_mode==='new'?'open':'rejected')}>{cid?'Company selected':d.company_mode==='new'?'Create new company':'Company required'}</span></div>
      <div style={{display:'grid',gridTemplateColumns:'1.6fr 1fr 1fr 1fr',gap:'8px'}}>
       <label>Company<select value={d.company_mode==='new'?'__new__':cid} onChange={ev=>{const v=ev.target.value;if(v==='__new__'){setDecision(i,'company_mode','new');setDecision(i,'company_id','')}else{setDecision(i,'company_mode','existing');setDecision(i,'company_id',v);setDecision(i,'division_id','')}}}><option value="">Select canonical company…</option>{m.kind==='suggested'&&m.company&&<option value={m.company.id}>Suggested: {m.company.company_name}</option>}{companyOptions.map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}{companies.filter(c=>!companyOptions.some(x=>x.id===c.id)&&(!m.company||c.id!==m.company.id)).map(c=><option key={c.id} value={c.id}>{c.company_name}</option>)}<option value="__new__">+ Create new company from submitted name</option></select></label>
       <label>Division<select value={d.division_id||''} onChange={ev=>setDecision(i,'division_id',ev.target.value)} disabled={!cid||d.company_mode==='new'}><option value="">No division / not specified</option>{divs.map(x=><option key={x.id} value={x.id}>{x.division_name}{x.division_code?' ('+x.division_code+')':''}</option>)}</select></label>
       <label>Category<select value={d.category_id||''} onChange={ev=>setDecision(i,'category_id',ev.target.value)}><option value="">Use submitted/default category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
       <label>Location<select value={d.location_id||''} onChange={ev=>setDecision(i,'location_id',ev.target.value)}><option value="">No location specified</option>{locations.map(l=><option key={l.id} value={l.id}>{l.city}, {l.district}</option>)}</select></label>
      </div>
      {d.company_mode==='new'&&<p className="report-help" style={{margin:'8px 0 0'}}>This will create a new active company named <strong>{e.company}</strong>. Use this only when you have confirmed it is genuinely new.</p>}
      {dups.length>0&&<div style={{marginTop:'9px',padding:'8px 10px',borderRadius:'8px',background:'#fff7ed',display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}><AlertTriangle size={14}/><span>Existing product match:</span>{dups.map(x=><button key={x.id} type="button" onClick={()=>setDecision(i,'product_id',x.id)}>{x.product_name}</button>)}{d.product_id&&<button type="button" onClick={()=>setDecision(i,'product_id','')}>Use submitted product instead</button>}</div>}
      <div className="report-help" style={{marginTop:'7px'}}>Submitted details: {e.division||'no division'} · {e.category||'Pharmaceutical'} · {e.dosage_form||'no dosage form'} · {e.pack_size||'no pack size'}</div>
    </div>
   })}
   </div>
   {!canPublish&&<div className="admin-note" style={{marginTop:'14px'}}>Before publishing: select a distributor and map every product row to an existing company or explicitly choose “Create new company”.</div>}
   {error&&<div className="report-error">{error}</div>}
   <div className="admin-actions" style={{marginTop:'16px'}}><button onClick={()=>!saving&&setSelected(null)}>Close</button><button disabled={!canPublish||!!saving} onClick={publish}>{saving?<><LoaderCircle className="spin" size={14}/> Publishing…</>:<><Check size={14}/> Publish {selectedEntries.length} Product Rows</>}</button></div>
  </div></div>}
 </div>
}
