import {useEffect,useState} from 'react'
import {CheckCircle2,Download,LoaderCircle,Send,Upload,X,Edit3,Trash2,ChevronRight,ClipboardCheck,ArrowLeft,Building2,FileSpreadsheet} from 'lucide-react'
import {supabase} from './lib/supabase'

const CATEGORIES=['Pharmaceutical','Surgical','OTC','Ayurvedic','Nutraceutical','Medical Devices','Diagnostic','Veterinary']
const blankEntry=()=>({company_name:'',category:'Pharmaceutical',subsidiary:'',division:'',brand:'',product:''})
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
  const [form,setForm]=useState(initial),[entries,setEntries]=useState([]),[draft,setDraft]=useState(blankEntry()),[editingIndex,setEditingIndex]=useState(null)
  const [step,setStep]=useState(1),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState(''),[bulkInfo,setBulkInfo]=useState(null)
  useEffect(()=>{if(!open)return;const onKeyDown=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',onKeyDown);return()=>document.removeEventListener('keydown',onKeyDown)},[open])
  function reset(){setForm(initial);setEntries([]);setDraft(blankEntry());setEditingIndex(null);setStep(1);setSent(false);setError('');setBusy(false);setBulkInfo(null)}
  function close(){onClose();reset()}
  function update(key,value){setForm(x=>({...x,[key]:value}))}
  function updateDraft(key,value){setDraft(x=>({...x,[key]:value}))}
  function saveDraft(){
    const company=clean(draft.company_name);if(!company){setError('Company Name is required.');return}
    const next={company_name:company,category:clean(draft.category)||'Pharmaceutical',subsidiary:clean(draft.subsidiary),division:clean(draft.division),brand:clean(draft.brand),product:clean(draft.product)}
    if(editingIndex===null)setEntries(x=>[...x,next]);else setEntries(x=>x.map((r,i)=>i===editingIndex?next:r))
    setDraft(blankEntry());setEditingIndex(null);setError('')
  }
  function editEntry(i){setDraft({...entries[i]});setEditingIndex(i);setError('')}
  function deleteEntry(i){setEntries(x=>x.filter((_,n)=>n!==i));if(editingIndex===i){setEditingIndex(null);setDraft(blankEntry())}setError('')}
  function applyBulk(rows,source,fileName){
    if(!rows.length){setError('No usable rows found. Please use the six-column sample CSV.');return}
    const invalid=rows.findIndex(r=>!clean(r.company_name)||!CATEGORIES.includes(clean(r.category)||'Pharmaceutical'))
    if(invalid>=0){setError(`Please check row ${invalid+2}: Company Name is required and Category must match a listed category.`);return}
    setEntries(rows.map(r=>({...blankEntry(),...r,category:clean(r.category)||'Pharmaceutical'})));setDraft(blankEntry());setEditingIndex(null);setBulkInfo({source,fileName,count:rows.length});setError('')
  }
  async function handleFile(e){
    const file=e.target.files?.[0];e.target.value='';if(!file)return
    if(!file.name.toLowerCase().endsWith('.csv')){setError('Please upload a CSV file.');return}
    try{applyBulk(rowsFromSheet(parseCsv(await file.text())),'csv',file.name)}catch{setError('Could not read this file. Please use the KutchPharmaConnect sample CSV format.')}
  }
  function continueFromBusiness(e){e.preventDefault();if(!clean(form.distributor_name)||!clean(form.mobile)){setError('Distributor name and mobile are required.');return}setError('');setStep(2)}
  function continueToReview(){if(!entries.length){setError('Please add or upload at least one company you handle.');return}setError('');setStep(3)}
  async function submit(){
    setBusy(true);setError('')
    const cleaned=entries.map(r=>({company_name:clean(r.company_name),category:clean(r.category)||'Pharmaceutical',subsidiary:clean(r.subsidiary),division:clean(r.division),brand:clean(r.brand),product:clean(r.product),handled_as:clean(r.product)?'product':clean(r.brand)?'brand':clean(r.division)?'division':'company'})).filter(r=>r.company_name)
    const companies_handled=cleaned.map(r=>[r.company_name,r.subsidiary,r.division,r.brand,r.product].filter(Boolean).join(' — ')).join('\n')
    const payload={...form,distributor_name:clean(form.distributor_name),mobile:clean(form.mobile),whatsapp:clean(form.whatsapp),companies_handled,email:clean(form.email)||null,company_entries:cleaned,bulk_source:bulkInfo?.source||'manual',bulk_file_name:bulkInfo?.fileName||null,bulk_row_count:cleaned.length}
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
            <div className="submission-section-heading"><span className="submission-section-number">2</span><div><h3>Companies You Handle</h3><p>Upload many records at once, or add a company manually. Subsidiary, division, brand and product are optional.</p></div></div>
            <div className="company-tools wizard-company-tools">
              <button type="button" className="submission-tool-button" onClick={downloadSample}><Download size={15}/> Download sample CSV</button>
              <label className="submission-tool-button"><Upload size={15}/> Upload CSV<input type="file" accept=".csv,text/csv" onChange={handleFile} hidden/></label>
              {entries.length>0&&<button type="button" className="submission-tool-button" onClick={()=>downloadCurrent(entries)}><Download size={15}/> Export current list</button>}
            </div>
            <div className="wizard-csv-hint"><FileSpreadsheet size={17}/><span><strong>Use these six columns, in this order:</strong> Company Name, Category, Subsidiary, Division, Brand, Product. Category must match the dropdown options. Leave optional cells blank when details aren't available.</span></div>
            {bulkInfo&&<div className="bulk-loaded"><ClipboardCheck size={15}/><span><strong>{bulkInfo.count} rows loaded</strong> from {bulkInfo.fileName}. Review the list below before continuing.</span></div>}
            <div className="wizard-manual-entry">
              <div className="company-editor-heading"><div><strong>{editingIndex===null?'Add a company manually':'Edit company entry'}</strong><span>Only enter information you know. Products are optional.</span></div>{editingIndex!==null&&<button type="button" onClick={()=>{setEditingIndex(null);setDraft(blankEntry())}}>Cancel edit</button>}</div>
              <div className="wizard-entry-grid">
                <label>Company Name <span className="required">*</span><input value={draft.company_name} onChange={e=>updateDraft('company_name',e.target.value)} placeholder="e.g. Example Pharma Ltd"/></label>
                <label>Category <span className="required">*</span><select value={draft.category} onChange={e=>updateDraft('category',e.target.value)}>{CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></label>
                <label>Subsidiary<input value={draft.subsidiary} onChange={e=>updateDraft('subsidiary',e.target.value)} placeholder="Optional"/></label>
                <label>Division<input value={draft.division} onChange={e=>updateDraft('division',e.target.value)} placeholder="Optional"/></label>
                <label>Brand<input value={draft.brand} onChange={e=>updateDraft('brand',e.target.value)} placeholder="Optional"/></label>
                <label>Product<input value={draft.product} onChange={e=>updateDraft('product',e.target.value)} placeholder="Optional — no need to list all products"/></label>
              </div>
              <button type="button" className="save-company-button" onClick={saveDraft}><CheckCircle2 size={15}/>{editingIndex===null?'Add company row':'Save row changes'}</button>
            </div>
            <div className="wizard-company-list-heading"><div><h4>Company list</h4><p>{entries.length} {entries.length===1?'row':'rows'} ready for review</p></div>{entries.length>0&&<span className="wizard-row-count">{entries.length} rows</span>}</div>
            {entries.length===0?<div className="company-empty"><Building2 size={24}/><strong>No company rows yet</strong><span>Upload your CSV or add the first company above.</span></div>:
              <div className="wizard-table-wrap"><table className="wizard-company-table"><thead><tr><th>#</th>{FIELDS.map(([,label])=><th key={label}>{label}</th>)}<th>Actions</th></tr></thead><tbody>{entries.map((r,i)=><tr key={i}><td>{i+1}</td>{FIELDS.map(([key])=><td key={key}>{r[key]||<span className="wizard-empty-cell">—</span>}</td>)}<td><div className="company-review-actions"><button type="button" onClick={()=>editEntry(i)} aria-label={'Edit row '+(i+1)}><Edit3 size={14}/> Edit</button><button type="button" className="danger" onClick={()=>deleteEntry(i)} aria-label={'Delete row '+(i+1)}><Trash2 size={14}/> Delete</button></div></td></tr>)}</tbody></table></div>}
            {error&&<div className="report-error">{error}</div>}
            <div className="wizard-footer wizard-footer-split"><button type="button" className="submission-secondary" onClick={()=>{setStep(1);setError('')}}><ArrowLeft size={15}/> Back to business details</button><button type="button" className="report-submit" onClick={continueToReview}>Review submission <ChevronRight size={16}/></button></div>
          </section>}
          {step===3&&<div className="final-review wizard-review-step">
            <section className="final-review-section"><div className="final-review-heading"><div><h3>Business details</h3><span>Step 1</span></div><button type="button" onClick={()=>{setStep(1);setError('')}}><Edit3 size={13}/> Edit</button></div>
              <div className="final-review-grid">{[['Distributor name',form.distributor_name],['Legal name',form.legal_name],['Contact person',form.contact_person],['Mobile',form.mobile],['WhatsApp',form.whatsapp],['Email',form.email],['City',form.city],['Address',form.address],['Google Maps',form.maps_url],['Website',form.website],['Additional notes',form.notes]].map(([k,v])=><div key={k}><small>{k}</small><strong>{v||'—'}</strong></div>)}</div>
            </section>
            <section className="final-review-section"><div className="final-review-heading"><div><h3>Companies submitted</h3><span>{entries.length} {entries.length===1?'row':'rows'} · Step 2</span></div><button type="button" onClick={()=>{setStep(2);setError('')}}><Edit3 size={13}/> Edit</button></div>
              <div className="wizard-review-table-wrap"><table className="wizard-company-table"><thead><tr>{FIELDS.map(([,label])=><th key={label}>{label}</th>)}</tr></thead><tbody>{entries.map((r,i)=><tr key={i}>{FIELDS.map(([key])=><td key={key}>{r[key]||<span className="wizard-empty-cell">—</span>}</td>)}</tr>)}</tbody></table></div>
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
