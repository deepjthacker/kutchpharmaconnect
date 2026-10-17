import React,{useEffect,useMemo,useState} from 'react'
import {ArrowLeft,Building2,Truck,Link2,Plus,LoaderCircle,CheckCircle2} from 'lucide-react'
import {supabase} from './lib/supabase'

const blankCompany={company_name:'',legal_name:'',short_name:'',description:'',status:'active'}
const blankDistributor={distributor_name:'',legal_name:'',contact_person:'',mobile:'',whatsapp:'',email:'',address:'',city_id:'',maps_url:'',website:'',notes:'',status:'active'}
const blankRelationship={company_id:'',division_id:'',distributor_id:'',category_id:'',location_id:'',territory:'',handled_as:'company',source:'Manual admin entry',verification_status:'unverified',verification_notes:''}
const optional=v=>String(v??'').trim()||null

export default function AdminSingleEntry({onBack}){
 const [tab,setTab]=useState('distributor')
 const [companies,setCompanies]=useState([])
 const [distributors,setDistributors]=useState([])
 const [divisions,setDivisions]=useState([])
 const [categories,setCategories]=useState([])
 const [locations,setLocations]=useState([])
 const [company,setCompany]=useState(blankCompany)
 const [companyCategories,setCompanyCategories]=useState([])
 const [distributor,setDistributor]=useState(blankDistributor)
 const [relationship,setRelationship]=useState(blankRelationship)
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')

 async function loadOptions(){
  setLoading(true);setError('')
  const [c,d,v,k,l]=await Promise.all([
   supabase.from('companies').select('id,company_name,status').eq('status','active').order('company_name'),
   supabase.from('distributors').select('id,distributor_name,status').eq('status','active').order('distributor_name'),
   supabase.from('divisions').select('id,company_id,division_name,status').eq('status','active').order('division_name'),
   supabase.from('categories').select('*').order('id'),
   supabase.from('locations').select('id,city,district,state,pincode').order('city')
  ])
  const bad=[c,d,v,k,l].find(x=>x.error)
  if(bad)setError('Could not load dropdown options: '+bad.error.message)
  else{setCompanies(c.data||[]);setDistributors(d.data||[]);setDivisions(v.data||[]);setCategories(k.data||[]);setLocations(l.data||[])}
  setLoading(false)
 }
 useEffect(()=>{loadOptions()},[])
 const categoryName=x=>x.category_name||x.name||'Unnamed category'
 const filteredDivisions=useMemo(()=>divisions.filter(x=>!relationship.company_id||x.company_id===relationship.company_id),[divisions,relationship.company_id])
 const field=(label,key,value,setter,opts={})=><label key={key}>{label}{opts.required&&<span className="required"> *</span>}{opts.multiline?<textarea rows={3} required={opts.required} value={value||''} placeholder={opts.placeholder||''} onChange={e=>setter(s=>({...s,[key]:e.target.value}))}/>:<input type={opts.type||'text'} required={opts.required} value={value||''} placeholder={opts.placeholder||''} onChange={e=>setter(s=>({...s,[key]:e.target.value}))}/>}</label>
 const selectField=(label,key,value,setter,items,opts={})=><label key={key}>{label}{opts.required&&<span className="required"> *</span>}<select required={opts.required} value={value||''} onChange={e=>setter(s=>({...s,[key]:e.target.value}))}><option value="">{opts.placeholder||'Select '+label.toLowerCase()}</option>{items.map(x=><option key={x.id} value={x.id}>{opts.label?opts.label(x):x.name}</option>)}</select></label>

 async function saveCompany(e){
  e.preventDefault();if(busy)return
  setBusy(true);setError('');setSuccess('')
  const name=company.company_name.trim()
  const duplicateRows=await supabase.from('companies').select('company_name')
  if(duplicateRows.error){setError(duplicateRows.error.message);setBusy(false);return}
  const duplicate=(duplicateRows.data||[]).some(x=>x.company_name.trim().toLowerCase()===name.toLowerCase())
  if(duplicate){setError('A company with this exact name already exists. Select Companies to edit the existing record instead.');setBusy(false);return}
  const r=await supabase.from('companies').insert({company_name:name,legal_name:optional(company.legal_name),short_name:optional(company.short_name),description:optional(company.description),status:company.status}).select('id,company_name,status').single()
  if(r.error){setError(r.error.message);setBusy(false);return}
  if(companyCategories.length){
   const linked=await supabase.from('company_categories').insert(companyCategories.map(category_id=>({company_id:r.data.id,category_id})))
   if(linked.error){setError('Company was created, but category links could not be saved: '+linked.error.message);setSuccess('Company created: '+r.data.company_name);setCompanies(prev=>[...prev,r.data].sort((a,b)=>a.company_name.localeCompare(b.company_name)));setCompany(blankCompany);setCompanyCategories([]);setBusy(false);return}
  }
  setCompanies(prev=>[...prev,r.data].sort((a,b)=>a.company_name.localeCompare(b.company_name)))
  setCompany(blankCompany);setCompanyCategories([]);setSuccess('Company added successfully: '+r.data.company_name);setBusy(false)
 }
 async function saveDistributor(e){
  e.preventDefault();if(busy)return
  setBusy(true);setError('');setSuccess('')
  const name=distributor.distributor_name.trim()
  const duplicateRows=await supabase.from('distributors').select('distributor_name')
  if(duplicateRows.error){setError(duplicateRows.error.message);setBusy(false);return}
  const duplicate=(duplicateRows.data||[]).some(x=>x.distributor_name.trim().toLowerCase()===name.toLowerCase())
  if(duplicate){setError('A distributor with this exact name already exists. Open Distributors to edit the existing record instead.');setBusy(false);return}
  const payload={distributor_name:name,legal_name:optional(distributor.legal_name),contact_person:optional(distributor.contact_person),mobile:optional(distributor.mobile),whatsapp:optional(distributor.whatsapp),email:optional(distributor.email),address:optional(distributor.address),city_id:distributor.city_id||null,maps_url:optional(distributor.maps_url),website:optional(distributor.website),notes:optional(distributor.notes),status:distributor.status}
  const r=await supabase.from('distributors').insert(payload).select('id,distributor_name,status').single()
  if(r.error){setError(r.error.message);setBusy(false);return}
  setDistributors(prev=>[...prev,r.data].sort((a,b)=>a.distributor_name.localeCompare(b.distributor_name)))
  setDistributor(blankDistributor);setSuccess('Distributor added successfully: '+r.data.distributor_name);setBusy(false)
 }
 async function saveRelationship(e){
  e.preventDefault();if(busy)return
  setBusy(true);setError('');setSuccess('')
  if(relationship.division_id){
   const selectedDivision=divisions.find(x=>x.id===relationship.division_id)
   if(!selectedDivision||selectedDivision.company_id!==relationship.company_id){setError('The selected division does not belong to the selected company.');setBusy(false);return}
  }
  const duplicateQuery=supabase.from('distributorships').select('id,division_id').eq('company_id',relationship.company_id).eq('distributor_id',relationship.distributor_id).eq('category_id',relationship.category_id).eq('location_id',relationship.location_id).eq('handled_as',relationship.handled_as).eq('status','active')
  const duplicate=await duplicateQuery
  if(duplicate.error){setError(duplicate.error.message);setBusy(false);return}
  const existing=(duplicate.data||[]).find(x=>(x.division_id||null)===(relationship.division_id||null))
  if(existing){setError('An active relationship with these details already exists. Check the Distributorships page before adding another.');setBusy(false);return}
  const payload={company_id:relationship.company_id,division_id:relationship.division_id||null,brand_id:null,handled_as:relationship.handled_as,distributor_id:relationship.distributor_id,category_id:relationship.category_id,location_id:relationship.location_id,territory:optional(relationship.territory),status:'active',verification_status:'unverified',verification_note:null,verified_date:null,verification_notes:optional(relationship.verification_notes),source:optional(relationship.source)||'Manual admin entry'}
  const r=await supabase.from('distributorships').insert(payload).select('id').single()
  if(r.error){setError(r.error.message);setBusy(false);return}
  setRelationship(blankRelationship);setSuccess('Distributorship added successfully. It is marked Unverified until supporting evidence is checked.');setBusy(false)
 }
 const tabs=[['distributor','Distributor',Truck],['company','Company',Building2],['relationship','Distributorship',Link2]]
 return <div className="admin-page">
  <div className="admin-head"><div><button className="admin-back" onClick={onBack}><ArrowLeft size={15}/> Dashboard</button><p className="section-kicker">ADMINISTRATION</p><h1>Manual Single Entry</h1><p>Add one distributor, one company, or one company–distributor relationship at a time.</p></div><button className="admin-refresh" onClick={loadOptions} disabled={loading}><LoaderCircle className={loading?'spin':''} size={15}/> Refresh options</button></div>
  <div className="admin-single-entry-tabs">{tabs.map(([id,label,Icon])=><button type="button" key={id} className={tab===id?'selected':''} onClick={()=>{setTab(id);setError('');setSuccess('')}}><Icon size={16}/>{'Add '+label}</button>)}</div>
  {error&&<div className="admin-error" role="alert">{error}</div>}
  {success&&<div className="admin-success" role="status"><CheckCircle2 size={17}/>{success}</div>}
  {loading?<div className="admin-state"><LoaderCircle className="spin" size={20}/> Loading companies, distributors, categories and locations…</div>:<>
   {tab==='company'&&<section className="admin-panel admin-single-entry-panel"><div className="admin-panel-heading"><div><p className="section-kicker">NEW RECORD</p><h2>Add a Company</h2><p>Enter the company once. Divisions and brands can be added separately.</p></div><Building2 size={20}/></div><form className="admin-single-entry-form" onSubmit={saveCompany}>
    {field('Company name','company_name',company.company_name,setCompany,{required:true,placeholder:'e.g. Sun Pharmaceutical Industries'})}
    {field('Legal name','legal_name',company.legal_name,setCompany,{placeholder:'Optional'})}
    {field('Short name','short_name',company.short_name,setCompany,{placeholder:'Optional'})}
    {field('Description','description',company.description,setCompany,{multiline:true,placeholder:'Optional notes about the company'})}
    <label>Status<select value={company.status} onChange={e=>setCompany(s=>({...s,status:e.target.value}))}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
    <fieldset className="admin-category-checks"><legend>Categories (optional)</legend><p>A company can belong to more than one category.</p><div>{categories.map(c=><label key={c.id}><input type="checkbox" checked={companyCategories.includes(c.id)} onChange={e=>setCompanyCategories(prev=>e.target.checked?[...prev,c.id]:prev.filter(id=>id!==c.id))}/>{categoryName(c)}</label>)}</div></fieldset>
    <button className="report-submit" disabled={busy}>{busy?<><LoaderCircle className="spin" size={16}/> Saving…</>:<><Plus size={16}/> Add Company</>}</button>
   </form></section>}
   {tab==='distributor'&&<section className="admin-panel admin-single-entry-panel"><div className="admin-panel-heading"><div><p className="section-kicker">NEW RECORD</p><h2>Add a Distributor</h2><p>Contact information and operating location for a single distributor.</p></div><Truck size={20}/></div><form className="admin-single-entry-form" onSubmit={saveDistributor}>
    {field('Distributor name','distributor_name',distributor.distributor_name,setDistributor,{required:true,placeholder:'e.g. Example Medical Agencies'})}
    {field('Legal name','legal_name',distributor.legal_name,setDistributor)}
    {field('Contact person','contact_person',distributor.contact_person,setDistributor)}
    {field('Mobile','mobile',distributor.mobile,setDistributor,{type:'tel',placeholder:'+91 …'})}
    {field('WhatsApp','whatsapp',distributor.whatsapp,setDistributor,{type:'tel',placeholder:'+91 …'})}
    {field('Email','email',distributor.email,setDistributor,{type:'email'})}
    {field('Address','address',distributor.address,setDistributor,{multiline:true})}
    {selectField('City / location','city_id',distributor.city_id,setDistributor,locations,{label:x=>[x.city,x.district,x.state,x.pincode].filter(Boolean).join(', ')})}
    {field('Google Maps URL','maps_url',distributor.maps_url,setDistributor,{type:'url',placeholder:'https://maps.google.com/…'})}
    {field('Website','website',distributor.website,setDistributor,{type:'url',placeholder:'https://…'})}
    {field('Notes','notes',distributor.notes,setDistributor,{multiline:true})}
    <label>Status<select value={distributor.status} onChange={e=>setDistributor(s=>({...s,status:e.target.value}))}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
    <button className="report-submit" disabled={busy}>{busy?<><LoaderCircle className="spin" size={16}/> Saving…</>:<><Plus size={16}/> Add Distributor</>}</button>
   </form></section>}
   {tab==='relationship'&&<section className="admin-panel admin-single-entry-panel"><div className="admin-panel-heading"><div><p className="section-kicker">NEW RECORD</p><h2>Add a Distributorship</h2><p>Link one company to one distributor for a selected category and Kutch location.</p></div><Link2 size={20}/></div><form className="admin-single-entry-form" onSubmit={saveRelationship}>
    {selectField('Company','company_id',relationship.company_id,(updater)=>setRelationship(s=>{const next=typeof updater==='function'?updater(s):updater;return {...next,division_id:''}}),companies,{required:true,label:x=>x.company_name})}
    {selectField('Division (optional)','division_id',relationship.division_id,setRelationship,filteredDivisions,{label:x=>x.division_name,placeholder:'Company-level relationship / no division'})}
    {selectField('Distributor','distributor_id',relationship.distributor_id,setRelationship,distributors,{required:true,label:x=>x.distributor_name})}
    {selectField('Category','category_id',relationship.category_id,setRelationship,categories,{required:true,label:categoryName})}
    {selectField('Operating location','location_id',relationship.location_id,setRelationship,locations,{required:true,label:x=>[x.city,x.district,x.state,x.pincode].filter(Boolean).join(', ')})}
    <label>Handled as<select value={relationship.handled_as} onChange={e=>setRelationship(s=>({...s,handled_as:e.target.value,division_id:e.target.value==='division'?s.division_id:''}))}><option value="company">Company</option><option value="division">Division</option><option value="brand">Brand</option><option value="unclear">Unclear / needs confirmation</option></select></label>
    {field('Territory','territory',relationship.territory,setRelationship,{placeholder:'e.g. Mundra, Gandhidham, all Kutch'})}
    {field('Source / evidence reference','source',relationship.source,setRelationship,{placeholder:'e.g. distributor confirmation, PDF filename'})}
    {field('Verification notes','verification_notes',relationship.verification_notes,setRelationship,{multiline:true,placeholder:'What evidence should be checked?'})}
    <div className="admin-entry-note">New relationships are always saved as <strong>Unverified</strong>. Verify them later from the Verification section after checking evidence.</div>
    <button className="report-submit" disabled={busy||!companies.length||!distributors.length||!categories.length||!locations.length}>{busy?<><LoaderCircle className="spin" size={16}/> Saving…</>:<><Plus size={16}/> Add Distributorship</>}</button>
   </form></section>}
  </>}
 </div>
}
