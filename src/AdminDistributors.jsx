import { useEffect,useMemo,useState } from 'react'
import { ArrowLeft,Truck,Edit3,LoaderCircle,Search,Save,X,Phone,MessageCircle,MapPin,Mail } from 'lucide-react'
import { supabase } from './lib/supabase'

export default function AdminDistributors({onBack}){
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[q,setQ]=useState(''),[status,setStatus]=useState('active'),[selected,setSelected]=useState(null),[busy,setBusy]=useState(false)
 const [form,setForm]=useState({})
 async function load(){
  setLoading(true);setError('')
  const {data,error}=await supabase.from('distributors').select('id,distributor_name,legal_name,contact_person,mobile,whatsapp,email,address,city_id,maps_url,website,notes,status').order('distributor_name')
  if(error){setError(error.message);setRows([])} else {
   const ids=(data||[]).map(x=>x.id)
   let counts={}
   if(ids.length){const r=await supabase.from('distributorships').select('distributor_id').in('distributor_id',ids).eq('status','active');if(r.error){setError(r.error.message)};(r.data||[]).forEach(x=>counts[x.distributor_id]=(counts[x.distributor_id]||0)+1)}
   setRows((data||[]).map(x=>({...x,relationship_count:counts[x.id]||0})))
  }
  setLoading(false)
 }
 useEffect(()=>{load()},[])
 const filtered=useMemo(()=>rows.filter(x=>(status==='all'||x.status===status)&&(!q.trim()||[x.distributor_name,x.legal_name,x.contact_person,x.mobile,x.email,x.address].filter(Boolean).some(v=>v.toLowerCase().includes(q.toLowerCase())))),[rows,q,status])
 function edit(x){setSelected(x);setForm({...x})}
 async function save(e){e.preventDefault();setBusy(true);setError('')
  const payload={distributor_name:form.distributor_name.trim(),legal_name:form.legal_name?.trim()||null,contact_person:form.contact_person?.trim()||null,mobile:form.mobile?.trim()||null,whatsapp:form.whatsapp?.trim()||null,email:form.email?.trim()||null,address:form.address?.trim()||null,maps_url:form.maps_url?.trim()||null,website:form.website?.trim()||null,notes:form.notes?.trim()||null,status:form.status}
  const r=await supabase.from('distributors').update(payload).eq('id',selected.id).select('id,distributor_name,legal_name,contact_person,mobile,whatsapp,email,address,city_id,maps_url,website,notes,status').single()
  if(r.error){setError(r.error.message)}else{setRows(x=>x.map(v=>v.id===r.data.id?{...v,...r.data}:v));setSelected(null)}setBusy(false)
 }
 return <div className="admin-page"><div className="admin-head"><div><button className="admin-back" onClick={onBack}><ArrowLeft size={15}/> Dashboard</button><p className="section-kicker">ADMINISTRATION</p><h1>Distributors</h1><p>Manage distributor identity and contact information.</p></div><button className="admin-refresh" onClick={load} disabled={loading}><LoaderCircle className={loading?'spin':''} size={15}/> Refresh</button></div>
 {error&&<div className="admin-error">{error}</div>}<div className="admin-toolbar"><div className="admin-search"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search distributor, contact, mobile, email..."/></div><div className="admin-filters">{['active','inactive','all'].map(x=><button className={status===x?'selected':''} key={x} onClick={()=>setStatus(x)}>{x}</button>)}</div></div>
 <div className="admin-list-head"><strong>{filtered.length}</strong> distributors shown</div>{loading?<div className="admin-state"><LoaderCircle className="spin" size={20}/> Loading distributors…</div>:<div className="admin-company-list">{filtered.map(x=><button className="admin-company-card" key={x.id} onClick={()=>edit(x)}><span className="admin-company-icon"><Truck size={18}/></span><span className="admin-company-copy"><strong>{x.distributor_name}</strong>{x.contact_person&&<span>{x.contact_person}</span>}<small>{x.relationship_count} active {x.relationship_count===1?'relationship':'relationships'}{x.mobile?' • '+x.mobile:''}</small></span><span className={`admin-company-status ${x.status}`}>{x.status}</span><Edit3 size={15}/></button>)}</div>}
 {selected&&<div className="report-overlay"><div className="report-modal admin-edit-modal"><button className="report-close" onClick={()=>!busy&&setSelected(null)}><X size={18}/></button><p className="section-kicker">DISTRIBUTOR RECORD</p><h2>Edit Distributor</h2><form onSubmit={save}>
 {['distributor_name','legal_name','contact_person','mobile','whatsapp','email','address','maps_url','website'].map(k=><label key={k}>{k.replaceAll('_',' ')}{k==='distributor_name'&&<span className="required"> *</span>}<input required={k==='distributor_name'} value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}
 <label>Notes<textarea rows="3" value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})}/></label><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="active">Active</option><option value="inactive">Inactive</option></select></label><button className="report-submit" disabled={busy}>{busy?<><LoaderCircle className="spin" size={16}/> Saving…</>:<><Save size={16}/> Save Changes</>}</button></form></div></div>}</div>
}