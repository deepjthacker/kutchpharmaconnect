import {useEffect,useState} from 'react'
import {CheckCircle2,Download,LoaderCircle,Send,Upload,X,Edit3,ChevronRight,ClipboardCheck,ArrowLeft,Building2,FileSpreadsheet,FileText} from 'lucide-react'
import {supabase} from './lib/supabase'

const CATEGORIES=['Pharmaceutical','Surgical','OTC','Ayurvedic','Nutraceutical','Medical Devices','Diagnostic','Veterinary']
const initial={distributor_name:'',legal_name:'',contact_person:'',mobile:'',whatsapp:'',email:'',address:'',city:'',district:'Kutch',state:'Gujarat',maps_url:'',website:'',notes:''}
const FIELDS=[['company_name','Company Name'],['category','Category'],['subsidiary','Subsidiary'],['division','Division'],['brand','Brand'],['product','Product']]
function clean(v){return String(v??'').trim()}
function parseCsvLine(line){
  const values=[];let value='';let quoted=false
  for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(ch===','&&!quoted){values.push(value);value=''}else value+=ch}
  values.push(value);return values
}
function parseCsv(text){
  const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim())
  if(!lines.length)return []
  const headers=parseCsvLine(lines[0]).map(h=>clean(h).toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' '))
  const aliases={'company name':'company_name','company':'company_name','company_name':'company_name','category':'category','subsidiary':'subsidiary','subsidiary name':'subsidiary','division':'division','division name':'division','brand':'brand','brand name':'brand','product':'product','product name':'product'}
  return lines.slice(1).map(line=>{const values=parseCsvLine(line),row={};headers.forEach((h,i)=>{const key=aliases[h]||h;row[key]=values[i]??''});return row})
}
function rowsFromSheet(rows){
  return rows.map(r=>({company_name:clean(r.company_name??r['Company Name']),category:clean(r.category??r.Category)||'Pharmaceutical',subsidiary:clean(r.subsidiary??r.Subsidiary),division:clean(r.division??r.Division),brand:clean(r.brand??r.Brand),product:clean(r.product??r.Product)})).filter(r=>r.company_name)
}
function downloadSample(){
  const a=document.createElement('a');a.href=`${import.meta.env.BASE_URL}distributor-company-upload-sample.csv`;a.download='KutchPharmaConnect_Distributor_Company_Upload_Sample.csv';a.click()
}
function csvEscape(v){const s=String(v??'');return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function downloadCurrent(entries){
  const csv=[FIELDS.map(([,label])=>label).join(','),...entries.map(r=>FIELDS.map(([key])=>csvEscape(r[key])).join(','))].join('\r\n')
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='KutchPharmaConnect_Companies_Review.csv';a.click();URL.revokeObjectURL(url)
}

export default function DistributorSubmission({open=false,onClose=()=>{}}){
  const [form,setForm]=useState(initial),[entries,setEntries]=useState([]),[selectedFile,setSelectedFile]=useState(null)
  const [step,setStep]=useState(1),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState(''),[bulkInfo,setBulkInfo]=useState(null)
  useEffect(()=>{if(!open)return;const onKeyDown=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',onKeyDown);return()=>document.removeEventListener('keydown',onKeyDown)},[open])
  function reset(){setForm(initial);setEntries([]);setSelectedFile(null);setStep(1);setSent(false);setError('');setBusy(false);setBulkInfo(null)}
  function close(){onClose();reset()}
  function update(key,value){setForm(x=>({...x,[key]:value}))}
  function applyBulk(rows,source,fileName){
    if(!rows.length){setError('No usable rows found. Please use the six-column sample CSV.');return}
    const invalid=rows.findIndex(r=>!clean(r.company_name)||!CATEGORIES.includes(clean(r.category)||'Pharmaceutical'))
    if(invalid>=0){setError(`Please check row ${invalid+2}: Company Name is required and Category must match a listed category.`);return}
    const messy=rows.findIndex(r=>clean(r.company_name).length>100||/[;,\n\r]/.test(clean(r.company_name))||/\b(all|every)\s+(the\s+)?generic\s+companies\b/i.test(clean(r.company_name)))
    if(messy>=0){setError(`Please correct row ${messy+2}: enter only one official company name in the Company Name column. Do not combine multiple companies, product names, or general descriptions in one cell. Put divisions in the Division column and brands in the Brand column.`);return}
    setEntries(rows.map(r=>({company_name:'',category:'Pharmaceutical',subsidiary:'',division:'',brand:'',product:'',...r,category:clean(r.category)||'Pharmaceutical'})));setBulkInfo({source,fileName,count:rows.length});setError('')
  }
  async function ensureXlsx(){
    if(window.XLSX)return window.XLSX
    await new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-kpc-xlsx]')
      if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}
      const script=document.createElement('script');script.dataset.kpcXlsx='1'
      script.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
      script.onload=resolve;script.onerror=()=>reject(new Error('Could not load the Excel reader.'))
      document.head.appendChild(script)
    })
    if(!window.XLSX)throw new Error('Excel reader did not initialize.')
    return window.XLSX
  }
  async function handleFile(e){
    const file=e.target.files?.[0];e.target.value='';if(!file)return
    const ext=file.name.toLowerCase().split('.').pop()
    if(!['csv','xls','xlsx','pdf'].includes(ext)){setError('Please upload a CSV, Excel (.xls/.xlsx), or PDF file.');return}
    if(file.size>15*1024*1024){setError('The file must be 15 MB or smaller.');return}
    setError('');setEntries([]);setSelectedFile(file);setBulkInfo({source:ext==='pdf'?'pdf':ext==='csv'?'csv':'excel',fileName:file.name,count:0})
    if(ext==='pdf'){setEntries([]);return}
    try{
      let rows
      if(ext==='csv')rows=rowsFromSheet(parseCsv(await file.text()))
      else{
        const XLSX=await ensureXlsx()
        const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'})
        rows=rowsFromSheet(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{defval:'',raw:false}))
      }
      applyBulk(rows,ext==='csv'?'csv':'excel',file.name)
    }catch(err){setError(err?.message||'Could not read this file. Please check the column headings and try again.')}
  }
  function continueFromBusiness(e){e.preventDefault();if(!clean(form.distributor_name)||!clean(form.mobile)){setError('Distributor name and mobile are required.');return}setError('');setStep(2)}
  function continueToReview(){if(!selectedFile){setError('Please upload your company list as a CSV, Excel, or PDF file.');return}if(bulkInfo?.source!=='pdf'&&!entries.length){setError('No company rows were detected. Please check the file and try again.');return}setError('');setStep(3)}
  async function submit(){
    if(!selectedFile){setError('Please select a file before submitting.');return}
    setBusy(true);setError('')
    const cleaned=entries.map(r=>({company_name:clean(r.company_name),category:clean(r.category)||'Pharmaceutical',subsidiary:clean(r.subsidiary),division:clean(r.division),brand:clean(r.brand),product:clean(r.product),handled_as:clean(r.product)?'product':clean(r.brand)?'brand':clean(r.division)?'division':'company'})).filter(r=>r.company_name)
    const ext=selectedFile.name.toLowerCase().split('.').pop()
    const safeName=selectedFile.name.replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-120)
    const filePath='incoming/'+crypto.randomUUID()+'-'+safeName
    const {error:uploadError}=await supabase.storage.from('distributor-submission-files').upload(filePath,selectedFile,{contentType:selectedFile.type||'application/octet-stream',upsert:false})
    if(uploadError){setError('The file could not be uploaded: '+uploadError.message);setBusy(false);return}
    const companies_handled=cleaned.map(r=>[r.company_name,r.subsidiary,r.division,r.brand,r.product].filter(Boolean).join(' — ')).join('\n')
    const payload={...form,distributor_name:clean(form.distributor_name),mobile:clean(form.mobile),whatsapp:clean(form.whatsapp),companies_handled,email:clean(form.email)||null,company_entries:cleaned,bulk_source:bulkInfo?.source||ext,bulk_file_name:selectedFile.name,bulk_file_path:filePath,bulk_row_count:cleaned.length,notes:[clean(form.notes),'Uploaded company list: '+selectedFile.name+'. File type: '+ext.toUpperCase()+'.'].filter(Boolean).join('\n')}
    const {error}=await supabase.from('distributor_submissions').insert(payload)
    if(error){setError(error.message);setBusy(false);return}setSent(true);setBusy(false)
  }
  const stepLabels=['Business Details','Companies You Handle','Review & Submit']
  return <>
    {open&&<div className="report-overlay" onMouseDown={e=>e.target===e.currentTarget&&close()}>
      <div className="report-modal distributor-submit-modal distributor-form-modal distributor-wizard-modal" role="dialog" aria-modal="true" aria-labelledby="distributor-submit-dialog-title">
        <button className="report-close" onClick={close} aria-label="Close"><X size={18}/></button>
        {!sent&&<>
          <div className="submission-top wizard-top">
            <div><p className="section-kicker">KUTCHPHARMACONNECT · DISTRIBUTOR REGISTRATION</p><h2 id="distributor-submit-dialog-title">Are You a Distributor?</h2><p className="report-help">Share your business details and the companies you handle in Kutch.</p></div>
          </div>
          <div className="wizard-progress" aria-label={`Step ${step} of 3`}>
            {stepLabels.map((label,i)=><div className={`wizard-progress-step ${step===i+1?'current':step>i+1?'done':''}`} key={label}><span>{step>i+1?<CheckCircle2 size={16}/>:i+1}</span><div><strong>Step {i+1}</strong><small>{label}</small></div></div>)}
          </div>
          {step===1&&<form onSubmit={continueFromBusiness}>
            <section className="submission-section wizard-section">
              <div className="submission-section-heading"><span className="submission-section-number">1</span><div><h3>Business Details</h3><p>Tell retailers how to identify and contact your business.</p></div></div>
              <div className="submission-form-grid">
                <label>Distributor name <span className="required">*</span><input required value={form.distributor_name} onChange={e=>update('distributor_name',e.target.value)} placeholder="Business / distributor name"/></label>
                <label>Legal name <span className="optional-label">optional</span><input value={form.legal_name} onChange={e=>update('legal_name',e.target.value)} placeholder="Legal entity name"/></label>
                <label>Contact person<input value={form.contact_person} onChange={e=>update('contact_person',e.target.value)} placeholder="Name"/></label>
                <label>Mobile <span className="required">*</span><input required type="tel" value={form.mobile} onChange={e=>update('mobile',e.target.value)} placeholder="+91 98765 43210"/></label>
                <label>WhatsApp<input type="tel" value={form.whatsapp} onChange={e=>update('whatsapp',e.target.value)} placeholder="+91 98765 43210"/></label>
                <label>Email<input type="email" value={form.email} onChange={e=>update('email',e.target.value)} placeholder="business@example.com"/></label>
                <label>City<input value={form.city} onChange={e=>update('city',e.target.value)} placeholder="Bhuj, Gandhidham, Mundra..."/></label>
                <label>Google Maps link<input type="url" value={form.maps_url} onChange={e=>update('maps_url',e.target.value)} placeholder="Paste your Google Maps link"/></label>
                <label className="submission-wide">Business address<input value={form.address} onChange={e=>update('address',e.target.value)} placeholder="Full business address"/></label>
                <label>Website<input type="url" value={form.website} onChange={e=>update('website',e.target.value)} placeholder="https://..."/></label>
                <label>Additional notes<textarea rows="2" value={form.notes} onChange={e=>update('notes',e.target.value)} placeholder="Territory or anything else we should know"/></label>
              </div>
            </section>
            {error&&<div className="report-error">{error}</div>}
            <div className="wizard-footer"><span><strong>Step 1 of 3</strong><small>Your company list comes next.</small></span><button className="report-submit" type="submit">Continue to companies <ChevronRight size={16}/></button></div>
          </form>}
          {step===2&&<section className="submission-section wizard-section wizard-company-step">
            <div className="submission-section-heading"><span className="submission-section-number">2</span><div><h3>Upload Your Company List</h3><p>Do not type company names manually. Upload your existing CSV, Excel, or PDF list. Our admin team will review it before anything is published.</p></div></div>
            <div className="company-tools wizard-company-tools">
              <button type="button" className="submission-tool-button" onClick={downloadSample}><Download size={15}/> Download sample CSV</button>
              <label className="submission-tool-button"><Upload size={15}/> Choose CSV / Excel / PDF<input type="file" accept=".csv,.xls,.xlsx,.pdf,text/csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleFile} hidden/></label>
            </div>
            <div className="wizard-csv-hint"><FileSpreadsheet size={17}/><span><strong>CSV / Excel format:</strong> use columns Company Name, Category, Subsidiary, Division, Brand, Product. One company per row. PDF files can be uploaded as received; our admin team will check the document.</span></div>
            <div className="wizard-csv-hint"><FileText size={17}/><span><strong>File requirements:</strong> CSV, Excel (.xls/.xlsx), or PDF; maximum 15 MB. Please upload the original company/distributorship list, not a paragraph combining multiple companies and products.</span></div>
            {selectedFile&&<div className="bulk-loaded"><ClipboardCheck size={15}/><span><strong>{selectedFile.name}</strong><br/>{bulkInfo?.source==='pdf'?'PDF attached for admin review. Company names will be checked from the document.':entries.length+' company rows detected. The original file will also be attached for admin review.'}</span></div>}
            {entries.length>0&&<><div className="wizard-company-list-heading"><div><h4>Detected company rows</h4><p>{entries.length} rows ready for review</p></div><span className="wizard-row-count">{entries.length} rows</span></div><div className="wizard-table-wrap"><table className="wizard-company-table"><thead><tr>{FIELDS.map(([,label])=><th key={label}>{label}</th>)}</tr></thead><tbody>{entries.slice(0,100).map((r,i)=><tr key={i}>{FIELDS.map(([key])=><td key={key}>{r[key]||<span className="wizard-empty-cell">—</span>}</td>)}</tr>)}</tbody></table>{entries.length>100&&<p className="report-help">Showing the first 100 of {entries.length} detected rows. The full file is attached for admin review.</p>}</div></>}
            {error&&<div className="report-error">{error}</div>}
            <div className="wizard-footer wizard-footer-split"><button type="button" className="submission-secondary" onClick={()=>{setStep(1);setError('')}}><ArrowLeft size={15}/> Back to business details</button><button type="button" className="report-submit" onClick={continueToReview}>Review submission <ChevronRight size={16}/></button></div>
          </section>}
          {step===3&&<div className="final-review wizard-review-step">
            <section className="final-review-section"><div className="final-review-heading"><div><h3>Business details</h3><span>Step 1</span></div><button type="button" onClick={()=>{setStep(1);setError('')}}><Edit3 size={13}/> Edit</button></div>
              <div className="final-review-grid">{[['Distributor name',form.distributor_name],['Legal name',form.legal_name],['Contact person',form.contact_person],['Mobile',form.mobile],['WhatsApp',form.whatsapp],['Email',form.email],['City',form.city],['Address',form.address],['Google Maps',form.maps_url],['Website',form.website],['Additional notes',form.notes]].map(([k,v])=><div key={k}><small>{k}</small><strong>{v||'—'}</strong></div>)}</div>
            </section>
            <section className="final-review-section"><div className="final-review-heading"><div><h3>Uploaded company list</h3><span>{selectedFile?.name||'No file selected'} · Step 2</span></div><button type="button" onClick={()=>{setStep(2);setError('')}}><Edit3 size={13}/> Edit upload</button></div>
              <p className="report-help">{bulkInfo?.source==='pdf'?'Your PDF will be attached to the submission for the admin team to review.':'The original file will be attached. '+entries.length+' company rows were detected for easier review.'}</p>
              {entries.length>0&&<div className="wizard-review-table-wrap"><table className="wizard-company-table"><thead><tr>{FIELDS.map(([,label])=><th key={label}>{label}</th>)}</tr></thead><tbody>{entries.slice(0,100).map((r,i)=><tr key={i}>{FIELDS.map(([key])=><td key={key}>{r[key]||<span className="wizard-empty-cell">—</span>}</td>)}</tr>)}</tbody></table></div>}
            </section>
            {error&&<div className="report-error">{error}</div>}
            <div className="wizard-footer wizard-footer-split"><button type="button" className="submission-secondary" onClick={()=>{setStep(2);setError('')}}><ArrowLeft size={15}/> Back to companies</button><button type="button" className="report-submit" onClick={submit} disabled={busy}>{busy?<><LoaderCircle className="spin" size={16}/> Sending…</>:<><Send size={16}/> Submit for review</>}</button></div>
          </div>}
        </>}
        {sent&&<div className="report-success"><CheckCircle2 size={42}/><h2>Submission received</h2><p>Thank you. Your details have been sent to the KutchPharmaConnect admin team. We will check the company names and distributorship information before publication.</p><button onClick={close}>Close</button></div>}
      </div>
    </div>}
  </>
}

function Building2IconFallback(){
  return <div className="company-empty-icon"><Truck size={22}/></div>
}
