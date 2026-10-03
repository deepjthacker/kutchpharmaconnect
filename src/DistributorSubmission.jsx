import React,{useState} from 'react'
import {CheckCircle2,Download,FileSpreadsheet,LoaderCircle,Plus,Send,Truck,Upload,X} from 'lucide-react'
import * as XLSX from 'xlsx'
import {supabase} from './lib/supabase'

const blankEntry=()=>({company_name:'',division:'',category:'Pharmaceutical',products_brands:''})
const initial={distributor_name:'',legal_name:'',contact_person:'',mobile:'',whatsapp:'',email:'',address:'',city:'',district:'Kutch',state:'Gujarat',maps_url:'',website:'',notes:''}

function clean(v){return String(v??'').trim()}
function rowsFromSheet(rows){
  return rows.map(r=>({
    company_name:clean(r['Company Name']??r['company_name']??r['Company']),
    division:clean(r['Division']??r['division']),
    category:clean(r['Category']??r['category'])||'Pharmaceutical',
    products_brands:clean(r['Products / Brands']??r['Products/Brands']??r['products_brands']??r['Products'])
  })).filter(r=>r.company_name||r.division||r.products_brands)
}
function downloadSample(){
  const a=document.createElement('a')
  a.href='/distributor-company-upload-sample.csv'
  a.download='KutchPharmaConnect_Distributor_Company_Upload_Sample.csv'
  a.click()
}

export default function DistributorSubmission(){
  const [open,setOpen]=useState(false),[form,setForm]=useState(initial),[entries,setEntries]=useState([blankEntry()]),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState(''),[bulkInfo,setBulkInfo]=useState(null)
  function close(){setOpen(false);setSent(false);setError('');setBusy(false)}
  function update(key,value){setForm(x=>({...x,[key]:value}))}
  function updateEntry(i,key,value){setEntries(x=>x.map((r,n)=>n===i?{...r,[key]:value}:r))}
  function addEntry(){setEntries(x=>[...x,blankEntry()])}
  function removeEntry(i){setEntries(x=>x.length===1?x:x.filter((_,n)=>n!==i))}
  function applyBulk(rows,source,fileName){
    if(!rows.length){setError('No usable company rows were found in the uploaded file.');return}
    setEntries(rows);setBulkInfo({source,fileName,count:rows.length});setError('')
  }
  async function handleFile(e){
    const file=e.target.files?.[0];e.target.value=''
    if(!file)return
    try{
      const data=await file.arrayBuffer()
      const wb=XLSX.read(data,{type:'array'})
      const ws=wb.Sheets[wb.SheetNames[0]]
      const rows=rowsFromSheet(XLSX.utils.sheet_to_json(ws,{defval:''}))
      applyBulk(rows,'excel_csv',file.name)
    }catch(err){setError('Could not read this file. Please use the sample CSV/XLSX format.')}
  }
  function pasteBulk(){
    const text=window.prompt('Paste one company per line. You can also use: Company | Division | Category | Products / Brands')
    if(text===null)return
    const rows=text.split(/\\r?\\n/).map(line=>{
      const parts=line.split('|').map(clean)
      return {company_name:parts[0]||'',division:parts[1]||'',category:parts[2]||'Pharmaceutical',products_brands:parts.slice(3).join(' | ')}
    }).filter(r=>r.company_name)
    applyBulk(rows,'paste','Pasted company list')
  }
  async function submit(e){
    e.preventDefault();setBusy(true);setError('')
    const cleaned=entries.map(r=>({company_name:clean(r.company_name),division:clean(r.division),category:clean(r.category)||'Pharmaceutical',products_brands:clean(r.products_brands)})).filter(r=>r.company_name)
    if(!cleaned.length){setError('Add at least one company or upload a company list.');setBusy(false);return}
    const companies_handled=cleaned.map(r=>[r.company_name,r.division].filter(Boolean).join(' — ')).join('\\n')
    const payload={...form,distributor_name:clean(form.distributor_name),mobile:clean(form.mobile),whatsapp:clean(form.whatsapp),companies_handled,email:clean(form.email)||null,company_entries:cleaned,bulk_source:bulkInfo?.source||'manual',bulk_file_name:bulkInfo?.fileName||null,bulk_row_count:cleaned.length}
    const {error}=await supabase.from('distributor_submissions').insert(payload)
    if(error){setError(error.message);setBusy(false);return}
    setSent(true);setBusy(false)
  }
  return <>
    <button className="distributor-submit-cta" onClick={()=>{setOpen(true);setSent(false);setError('')}}><Truck size={17}/><span><strong>Are you a distributor?</strong><small>Add your company & distributorship details</small></span></button>
    {open&&<div className="report-overlay" onMouseDown={e=>e.target===e.currentTarget&&close()}>
      <div className="report-modal distributor-submit-modal" style={{maxWidth:'900px'}}>
        <button className="report-close" onClick={close} aria-label="Close"><X size={18}/></button>
        {!sent?<><p className="section-kicker">DISTRIBUTOR SUBMISSION</p><h2>List Your Distributorship</h2><p className="report-help">Submit your distributor details and the companies you handle. We will review and match the information before publication.</p>
          <form onSubmit={submit}>
            <div className="submission-form-grid">
              <label>Distributor name <span className="required">*</span><input required value={form.distributor_name} onChange={e=>update('distributor_name',e.target.value)} placeholder="Business / distributor name"/></label>
              <label>Legal name<input value={form.legal_name} onChange={e=>update('legal_name',e.target.value)} placeholder="Legal entity name"/></label>
              <label>Contact person<input value={form.contact_person} onChange={e=>update('contact_person',e.target.value)} placeholder="Name"/></label>
              <label>Mobile <span className="required">*</span><input required value={form.mobile} onChange={e=>update('mobile',e.target.value)} placeholder="+91..."/></label>
              <label>WhatsApp<input value={form.whatsapp} onChange={e=>update('whatsapp',e.target.value)} placeholder="+91..."/></label>
              <label>Email<input type="email" value={form.email} onChange={e=>update('email',e.target.value)} placeholder="business@example.com"/></label>
              <label>City<input value={form.city} onChange={e=>update('city',e.target.value)} placeholder="Bhuj, Gandhidham, Mundra..."/></label>
              <label>Google Maps link<input value={form.maps_url} onChange={e=>update('maps_url',e.target.value)} placeholder="https://maps.google.com/..."/></label>
              <label className="submission-wide">Address<textarea rows="2" value={form.address} onChange={e=>update('address',e.target.value)} placeholder="Business address"/></label>
            </div>

            <div style={{marginTop:'22px'}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:'12px',alignItems:'center',flexWrap:'wrap'}}>
                <div><h3 style={{margin:'0 0 4px'}}>Companies / Divisions You Handle</h3><p className="report-help" style={{margin:0}}>Add companies one by one, paste a list, or upload Excel/CSV.</p></div>
                <button type="button" className="admin-back" onClick={downloadSample}><Download size={15}/> Sample CSV</button>
              </div>

              <div style={{display:'flex',gap:'8px',flexWrap:'wrap',margin:'12px 0'}}>
                <button type="button" className="admin-actions button" onClick={addEntry}><Plus size={14}/> Add Company</button>
                <button type="button" className="admin-actions button" onClick={pasteBulk}><Upload size={14}/> Paste Bulk List</button>
                <label className="admin-actions button" style={{cursor:'pointer'}}><FileSpreadsheet size={14}/> Upload Excel / CSV<input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{display:'none'}}/></label>
              </div>

              {bulkInfo&&<div className="report-help" style={{marginBottom:'10px'}}>Loaded <strong>{bulkInfo.count}</strong> company rows from {bulkInfo.fileName}.</div>}

              <div style={{display:'grid',gap:'10px'}}>
                {entries.map((r,i)=><div key={i} style={{border:'1px solid var(--border,#e5e7eb)',borderRadius:'12px',padding:'12px',background:'#fafafa'}}>
                  <div style={{display:'grid',gridTemplateColumns:'2fr 1.4fr 1.2fr 2fr auto',gap:'8px',alignItems:'end'}}>
                    <label>Company / Organization <span className="required">*</span><input value={r.company_name} onChange={e=>updateEntry(i,'company_name',e.target.value)} placeholder="e.g. Cipla"/></label>
                    <label>Division / Unit<input value={r.division} onChange={e=>updateEntry(i,'division',e.target.value)} placeholder="Optional"/></label>
                    <label>Category<select value={r.category} onChange={e=>updateEntry(i,'category',e.target.value)}><option>Pharmaceutical</option><option>Surgical</option><option>OTC</option><option>Ayurvedic</option><option>Nutraceutical</option><option>Medical Devices</option><option>Diagnostic</option><option>Veterinary</option></select></label>
                    <label>Products / Brands<input value={r.products_brands} onChange={e=>updateEntry(i,'products_brands',e.target.value)} placeholder="Optional"/></label>
                    <button type="button" onClick={()=>removeEntry(i)} aria-label="Remove company" style={{height:'38px'}}>×</button>
                  </div>
                </div>)}
              </div>
            </div>

            <div className="submission-form-grid" style={{marginTop:'18px'}}>
              <label className="submission-wide">Website<input value={form.website} onChange={e=>update('website',e.target.value)} placeholder="https://..."/></label>
              <label className="submission-wide">Additional notes<textarea rows="3" value={form.notes} onChange={e=>update('notes',e.target.value)} placeholder="Territory, special divisions, or anything else we should know"/></label>
            </div>
            {error&&<div className="report-error">{error}</div>}
            <button className="report-submit" disabled={busy}>{busy?<><LoaderCircle className="spin" size={16}/> Submitting…</>:<><Send size={16}/> Submit Distributor Details</>}</button>
          </form>
        </>:<div className="report-success"><CheckCircle2 size={42}/><h2>Submission received</h2><p>Thank you. Your details have been sent to the KutchPharmaConnect admin for review. They will be checked before publication.</p><button onClick={close}>Close</button></div>}
      </div>
    </div>}
  </>
}
