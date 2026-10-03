import React,{useState} from 'react'
import {CheckCircle2,Download,FileSpreadsheet,LoaderCircle,Plus,Send,Upload,X,PackagePlus} from 'lucide-react'
import * as XLSX from 'xlsx'
import {supabase} from './lib/supabase'

const blank=()=>({product_name:'',company:'',division:'',category:'Pharmaceutical',generic_name:'',strength:'',dosage_form:'',pack_size:''})
const clean=v=>String(v??'').trim()
function parseRows(rows){return rows.map(r=>({
  product_name:clean(r['Product Name']??r['product_name']??r['Product']),
  company:clean(r['Company']??r['Company Name']??r['company']),
  division:clean(r['Division']??r['division']),
  category:clean(r['Category']??r['category'])||'Pharmaceutical',
  generic_name:clean(r['Generic Name']??r['generic_name']),
  strength:clean(r['Strength']??r['strength']),
  dosage_form:clean(r['Dosage Form']??r['dosage_form']),
  pack_size:clean(r['Pack Size']??r['pack_size'])
})).filter(r=>r.product_name)}
function sample(){const a=document.createElement('a');a.href='/distributor-product-upload-sample.csv';a.download='KutchPharmaConnect_Distributor_Product_Upload_Sample.csv';a.click()}

export default function ProductSubmission(){
 const [open,setOpen]=useState(false),[form,setForm]=useState({distributor_name:'',mobile:'',email:'',notes:''}),[rows,setRows]=useState([blank()]),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState(''),[file,setFile]=useState('')
 const update=(k,v)=>setForm(x=>({...x,[k]:v}))
 const updateRow=(i,k,v)=>setRows(x=>x.map((r,n)=>n===i?{...r,[k]:v}:r))
 const add=()=>setRows(x=>[...x,blank()])
 const remove=i=>setRows(x=>x.length===1?x:x.filter((_,n)=>n!==i))
 async function upload(e){const f=e.target.files?.[0];e.target.value='';if(!f)return;try{const wb=XLSX.read(await f.arrayBuffer(),{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];const parsed=parseRows(XLSX.utils.sheet_to_json(ws,{defval:''}));if(!parsed.length){setError('No usable product rows found. Please use the sample format.');return}setRows(parsed);setFile(f.name);setError('')}catch{setError('Could not read this file. Please use the sample CSV/XLSX format.')}}
 function paste(){const t=window.prompt('Paste one product per line: Product | Company | Division | Category');if(t===null)return;const parsed=t.split(/\r?\n/).map(line=>{const p=line.split('|').map(clean);return {product_name:p[0]||'',company:p[1]||'',division:p[2]||'',category:p[3]||'Pharmaceutical',generic_name:'',strength:'',dosage_form:'',pack_size:''}}).filter(r=>r.product_name);if(!parsed.length){setError('No product rows found.');return}setRows(parsed);setFile('Pasted product list');setError('')}
 async function submit(e){e.preventDefault();setError('');setBusy(true);const cleanRows=rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,clean(v)]))).filter(r=>r.product_name);if(!form.distributor_name.trim()||!form.mobile.trim()){setError('Distributor name and mobile are required.');setBusy(false);return}if(!cleanRows.length){setError('Add at least one product.');setBusy(false);return}const {error}=await supabase.from('product_submissions').insert({distributor_name:clean(form.distributor_name),mobile:clean(form.mobile),email:clean(form.email)||null,product_entries:cleanRows,source:file==='Pasted product list'?'paste':file?'excel_csv':'manual',file_name:file||null,row_count:cleanRows.length,notes:clean(form.notes)||null});if(error)setError(error.message);else setSent(true);setBusy(false)}
 function close(){setOpen(false);setSent(false);setError('')}
 return <>
  <button className="distributor-submit-cta" onClick={()=>setOpen(true)}><PackagePlus size={17}/><span><strong>Already listed? Add your products</strong><small>Upload the products you distribute</small></span></button>
  {open&&<div className="report-overlay" onMouseDown={e=>e.target===e.currentTarget&&close()}><div className="report-modal distributor-submit-modal" style={{maxWidth:'1050px'}}>
   <button className="report-close" onClick={close}><X size={18}/></button>
   {!sent?<><p className="section-kicker">PRODUCT SUBMISSION</p><h2>Upload Products You Distribute</h2><p className="report-help">Products are reviewed and matched to existing company records before publication. Do not worry if company names are written slightly differently.</p>
   <form onSubmit={submit}>
    <div className="submission-form-grid">
      <label>Distributor name <span className="required">*</span><input required value={form.distributor_name} onChange={e=>update('distributor_name',e.target.value)} placeholder="Aakash Medical Agencies"/></label>
      <label>Mobile <span className="required">*</span><input required value={form.mobile} onChange={e=>update('mobile',e.target.value)} placeholder="+91..."/></label>
      <label>Email<input type="email" value={form.email} onChange={e=>update('email',e.target.value)}/></label>
      <label className="submission-wide">Notes<textarea rows="2" value={form.notes} onChange={e=>update('notes',e.target.value)} placeholder="Optional notes about this product list"/></label>
    </div>
    <div style={{marginTop:'20px'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:'10px',alignItems:'center',flexWrap:'wrap'}}><div><h3 style={{margin:0}}>Product List</h3><p className="report-help" style={{margin:'4px 0 0'}}>Product Name and Company are recommended. Other fields are optional.</p></div><button type="button" className="admin-back" onClick={sample}><Download size={15}/> Sample CSV</button></div>
      <div style={{display:'flex',gap:'8px',flexWrap:'wrap',margin:'12px 0'}}><button type="button" className="admin-actions button" onClick={add}><Plus size={14}/> Add Product</button><button type="button" className="admin-actions button" onClick={paste}><Upload size={14}/> Paste Bulk List</button><label className="admin-actions button" style={{cursor:'pointer'}}><FileSpreadsheet size={14}/> Upload Excel / CSV<input type="file" accept=".csv,.xlsx,.xls" onChange={upload} style={{display:'none'}}/></label></div>
      {file&&<p className="report-help">Loaded <strong>{rows.length}</strong> rows from {file}.</p>}
      <div style={{display:'grid',gap:'8px',maxHeight:'430px',overflowY:'auto'}}>{rows.map((r,i)=><div key={i} style={{border:'1px solid var(--border,#e5e7eb)',borderRadius:'10px',padding:'10px'}}>
        <div style={{display:'grid',gridTemplateColumns:'1.5fr 1.3fr 1.1fr 1fr 1fr 1fr 1fr auto',gap:'7px',alignItems:'end'}}>
          {['product_name','company','division','category','generic_name','strength','dosage_form','pack_size'].map((k,n)=><label key={k}>{['Product Name','Company','Division','Category','Generic Name','Strength','Dosage Form','Pack Size'][n]}{(k==='product_name'||k==='company')&&<span className="required"> *</span>}{k==='category'?<select value={r[k]} onChange={e=>updateRow(i,k,e.target.value)}><option>Pharmaceutical</option><option>Surgical</option><option>OTC</option><option>Ayurvedic</option><option>Nutraceutical</option><option>Medical Devices</option><option>Diagnostic</option><option>Veterinary</option></select>:<input value={r[k]} onChange={e=>updateRow(i,k,e.target.value)} placeholder="Optional" />}</label>)}
          <button type="button" onClick={()=>remove(i)} style={{height:'38px'}}>×</button>
        </div>
      </div>)}</div>
    </div>
    {error&&<div className="report-error">{error}</div>}<button className="report-submit" disabled={busy}>{busy?<><LoaderCircle className="spin" size={16}/> Submitting…</>:<><Send size={16}/> Submit Product List</>}</button>
   </form></>:<div className="report-success"><CheckCircle2 size={42}/><h2>Product list received</h2><p>Your product list has been sent for company/product matching and review before publication.</p><button onClick={close}>Close</button></div>}
  </div></div>}
 </>
}