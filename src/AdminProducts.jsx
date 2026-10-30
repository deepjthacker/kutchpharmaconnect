import React,{useEffect,useMemo,useState} from 'react'
import {ArrowLeft,Package,LoaderCircle,Search,RefreshCw,Save,X} from 'lucide-react'
import {supabase} from './lib/supabase'

const PAGE=500
async function loadAll(query){const rows=[];let from=0;while(true){const {data,error}=await query.range(from,from+PAGE-1);if(error)throw error;rows.push(...(data||[]));if(!data||data.length<PAGE)break;from+=PAGE}return rows}

export default function AdminProducts({onBack}){
 const [rows,setRows]=useState([]),[companies,setCompanies]=useState([]),[divisions,setDivisions]=useState([])
 const [query,setQuery]=useState(''),[status,setStatus]=useState('active'),[loading,setLoading]=useState(true),[error,setError]=useState('')
 const [selected,setSelected]=useState(null),[form,setForm]=useState({}),[busy,setBusy]=useState(false)
 async function load(){setLoading(true);setError('');try{
  const [p,c,d]=await Promise.all([
   loadAll(supabase.from('products').select('id,product_name,company_id,division_id,category_id,generic_name,strength,dosage_form,pack_size,normalized_product_name,status').order('product_name')),
   loadAll(supabase.from('companies').select('id,company_name').order('company_name')),
   loadAll(supabase.from('divisions').select('id,company_id,division_name').order('division_name'))
  ]);setRows(p);setCompanies(c);setDivisions(d)
 }catch(e){setError(e.message||'Could not load products.')}setLoading(false)}
 useEffect(()=>{load()},[])
 const cm=new Map(companies.map(x=>[x.id,x.company_name])),dm=new Map(divisions.map(x=>[x.id,x.division_name]))
 const filtered=useMemo(()=>rows.filter(x=>(status==='all'||x.status===status)&&(!query.trim()||[x.product_name,cm.get(x.company_id),x.generic_name,x.strength].filter(Boolean).some(v=>String(v).toLowerCase().includes(query.toLowerCase())))),[rows,query,status,companies])
 function edit(x){setSelected(x);setForm({...x})}
 async function save(e){e.preventDefault();if(!selected)return;setBusy(true);setError('')
  const name=form.product_name.trim()
  const r=await supabase.from('products').update({product_name:name,normalized_product_name:name.toLowerCase().replace(/[^a-z0-9]+/g,''),company_id:form.company_id,division_id:form.division_id||null,generic_name:form.generic_name?.trim()||null,strength:form.strength?.trim()||null,dosage_form:form.dosage_form?.trim()||null,pack_size:form.pack_size?.trim()||null,status:form.status||'active'}).eq('id',selected.id).select('id,product_name,company_id,division_id,category_id,generic_name,strength,dosage_form,pack_size,normalized_product_name,status').single()
  if(r.error)setError(r.error.message);else{setRows(prev=>prev.map(x=>x.id===r.data.id?r.data:x));setSelected(null)}setBusy(false)
 }
 return <div className="admin-page">
  <div className="admin-head"><div><button className="admin-back" onClick={onBack}><ArrowLeft size={15}/> Dashboard</button><p className="section-kicker">PRODUCT DIRECTORY</p><h1>Products</h1><p>Search and maintain the product catalogue linked to companies and divisions.</p></div><button className="admin-refresh" onClick={load} disabled={loading}><RefreshCw className={loading?'spin':''} size={15}/> Refresh</button></div>
  {error&&<div className="admin-error">{error}</div>}
  <div className="admin-toolbar"><div className="admin-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search product, company, generic name..."/></div><div className="admin-filters">{['active','inactive','all'].map(x=><button key={x} className={status===x?'selected':''} onClick={()=>setStatus(x)}>{x==='all'?'All':x==='active'?'Active':'Inactive'}</button>)}</div></div>
  <div className="admin-list-head"><strong>{filtered.length.toLocaleString()}</strong> products shown <span style={{marginLeft:10,color:'var(--muted,#64748b)'}}>· {rows.filter(x=>x.status==='active').length.toLocaleString()} active total</span></div>
  {loading?<div className="admin-state"><LoaderCircle className="spin" size={20}/> Loading products…</div>:filtered.length?<div className="admin-company-list">{filtered.map(x=><button className="admin-company-card" key={x.id} onClick={()=>edit(x)}><span className="admin-company-icon"><Package size={18}/></span><span className="admin-company-copy"><strong>{x.product_name}</strong><span>{cm.get(x.company_id)||'Company not linked'}{x.division_id&&dm.get(x.division_id)?' • '+dm.get(x.division_id):''}</span><small>{[x.generic_name,x.strength,x.dosage_form,x.pack_size].filter(Boolean).join(' • ')||x.status}</small></span><span className={`admin-company-status ${x.status}`}>{x.status}</span></button>)}</div>:<div className="result-state">No products match the current filters.</div>}
  {selected&&<div className="report-overlay" onMouseDown={e=>e.target===e.currentTarget&&!busy&&setSelected(null)}><div className="report-modal admin-edit-modal"><button className="report-close" onClick={()=>!busy&&setSelected(null)}><X size={18}/></button><p className="section-kicker">PRODUCT RECORD</p><h2>Edit Product</h2><form onSubmit={save}>
   <label>Product name<input required value={form.product_name||''} onChange={e=>setForm({...form,product_name:e.target.value})}/></label>
   <label>Company<select required value={form.company_id||''} onChange={e=>setForm({...form,company_id:e.target.value,division_id:null})}>{companies.map(x=><option key={x.id} value={x.id}>{x.company_name}</option>)}</select></label>
   <label>Division <span className="optional-label">optional</span><select value={form.division_id||''} onChange={e=>setForm({...form,division_id:e.target.value||null})}><option value="">Directly under company</option>{divisions.filter(x=>x.company_id===form.company_id).map(x=><option key={x.id} value={x.id}>{x.division_name}</option>)}</select></label>
   {['generic_name','strength','dosage_form','pack_size'].map(k=><label key={k}>{k.replace(/_/g,' ')}<input value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}
   <label>Status<select value={form.status||'active'} onChange={e=>setForm({...form,status:e.target.value})}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
   <button className="report-submit" disabled={busy}>{busy?<><LoaderCircle className="spin" size={16}/> Saving…</>:<><Save size={16}/> Save Changes</>}</button>
  </form></div></div>}
 </div>
}
