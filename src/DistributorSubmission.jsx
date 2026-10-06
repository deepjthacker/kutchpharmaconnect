import React,{useState} from 'react'
import {CheckCircle2,Download,FileSpreadsheet,LoaderCircle,Plus,Send,Truck,Upload,X,Edit3,Trash2,ChevronRight,ClipboardCheck,ArrowLeft} from 'lucide-react'
import * as XLSX from 'xlsx'
import {supabase} from './lib/supabase'

const CATEGORIES=['Pharmaceutical','Surgical','OTC','Ayurvedic','Nutraceutical','Medical Devices','Diagnostic','Veterinary']
const blankEntry=()=>({company_name:'',handled_as:'company',brand:'',division:'',category:'Pharmaceutical'})
const initial={distributor_name:'',legal_name:'',contact_person:'',mobile:'',whatsapp:'',email:'',address:'',city:'',district:'Kutch',state:'Gujarat',maps_url:'',website:'',notes:''}

function clean(v){return String(v??'').trim()}
function rowsFromSheet(rows){
  return rows.map(r=>({
    company_name:clean(r['Company Name']??r['company_name']??r['Company']),
    handled_as:clean(r['Type']??r['Handled As']??r['handled_as'])||'company',
    brand:clean(r['Brand']??r['brand']),
    division:clean(r['Division']??r['division']),
    category:clean(r['Category']??r['category'])||'Pharmaceutical'
  })).filter(r=>r.company_name)
}
function downloadSample(){
  const a=document.createElement('a')
  a.href=`${import.meta.env.BASE_URL}distributor-company-upload-sample.csv`
  a.download='KutchPharmaConnect_Distributor_Company_Upload_Sample.csv'
  a.click()
}

export default function DistributorSubmission(){
  const [open,setOpen]=useState(false)
  const [form,setForm]=useState(initial)
  const [entries,setEntries]=useState([])
  const [draft,setDraft]=useState(blankEntry())
  const [editingIndex,setEditingIndex]=useState(null)
  const [addMode,setAddMode]=useState(true)
  const [reviewing,setReviewing]=useState(false)
  const [busy,setBusy]=useState(false)
  const [sent,setSent]=useState(false)
  const [error,setError]=useState('')
  const [bulkInfo,setBulkInfo]=useState(null)

  function reset(){
    setForm(initial);setEntries([]);setDraft(blankEntry());setEditingIndex(null);setAddMode(true);setReviewing(false);setSent(false);setError('');setBusy(false);setBulkInfo(null)
  }
  function close(){setOpen(false);reset()}
  function update(key,value){setForm(x=>({...x,[key]:value}))}
  function updateDraft(key,value){setDraft(x=>({...x,[key]:value}))}

  function saveDraft(){
    const company=clean(draft.company_name)
    if(!company){setError('Enter the company name before adding it.');return}
    if(draft.handled_as==='brand'&&!clean(draft.brand)){setError('Enter the brand name when the row is marked as Brand.');return}
    const next={company_name:company,handled_as:clean(draft.handled_as)||'company',brand:clean(draft.brand),division:clean(draft.division),category:clean(draft.category)||'Pharmaceutical'}
    if(editingIndex===null)setEntries(x=>[...x,next])
    else setEntries(x=>x.map((r,i)=>i===editingIndex?next:r))
    setDraft(blankEntry());setEditingIndex(null);setAddMode(false);setError('')
  }
  function editEntry(i){setDraft({...entries[i]});setEditingIndex(i);setAddMode(true);setError('')}
  function deleteEntry(i){
    setEntries(x=>x.filter((_,n)=>n!==i))
    if(editingIndex===i){setEditingIndex(null);setDraft(blankEntry())}
    setError('')
  }

  function applyBulk(rows,source,fileName){
    if(!rows.length){setError('No usable company rows were found in the uploaded file.');return}
    setEntries(rows);setDraft(blankEntry());setEditingIndex(null);setAddMode(false);setBulkInfo({source,fileName,count:rows.length});setError('')
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
    }catch(err){setError('Could not read this file. Please use the KutchPharmaConnect sample CSV/XLSX format.')}
  }

  function pasteBulk(){
    const text=window.prompt('Paste one row per line using: Company | Type | Brand | Division | Category')
    if(text===null)return
    const rows=text.split(/\r?\n/).map(line=>{
      const parts=line.split('|').map(clean)
      return {company_name:parts[0]||'',handled_as:parts[1]||'company',brand:parts[2]||'',division:parts[3]||'',category:parts[4]||'Pharmaceutical'}
    }).filter(r=>r.company_name)
    applyBulk(rows,'paste','Pasted company list')
  }

  function validateBeforeReview(){
    const required=[['Distributor name',form.distributor_name],['Mobile',form.mobile]]
    const missing=required.filter(([,v])=>!clean(v)).map(([k])=>k)
    if(missing.length){setError('Please complete: '+missing.join(', ')+'.');return false}
    if(!entries.length){setError('Please add at least one company you handle.');return false}
    if(entries.some(r=>r.handled_as==='brand'&&!r.brand)){setError('Every Brand row must include the brand name.');return false}
    setError('');setReviewing(true);return true
  }

  async function submit(){
    setBusy(true);setError('')
    const cleaned=entries.map(r=>({company_name:clean(r.company_name),handled_as:clean(r.handled_as)||'company',brand:clean(r.brand),division:clean(r.division),category:clean(r.category)||'Pharmaceutical'})).filter(r=>r.company_name)
    const companies_handled=cleaned.map(r=>[r.company_name,r.division].filter(Boolean).join(' — ')).join('\n')
    const payload={...form,distributor_name:clean(form.distributor_name),mobile:clean(form.mobile),whatsapp:clean(form.whatsapp),companies_handled,email:clean(form.email)||null,company_entries:cleaned,bulk_source:bulkInfo?.source||'manual',bulk_file_name:bulkInfo?.fileName||null,bulk_row_count:cleaned.length}
    const {error}=await supabase.from('distributor_submissions').insert(payload)
    if(error){setError(error.message);setBusy(false);return}
    setSent(true);setBusy(false)
  }

  return <>
    <button className="distributor-submit-cta" onClick={()=>{setOpen(true);setSent(false);setError('')}}><Truck size={17}/><span><strong>Are you a distributor?</strong><small>Add your company & distributorship details</small></span></button>

    {open&&<div className="report-overlay" onMouseDown={e=>e.target===e.currentTarget&&close()}>
      <div className="report-modal distributor-submit-modal distributor-form-modal">
        <button className="report-close" onClick={close} aria-label="Close"><X size={18}/></button>

        {!sent&&!reviewing&&<>
          <div className="submission-top">
            <div>
              <p className="section-kicker">DISTRIBUTOR SUBMISSION</p>
              <h2>List Your Distributorship</h2>
              <p className="report-help">Use one company record for each legal/business company. If you are referring to a brand or an actual division, tell us which one — we will keep it under the parent company.</p>
            </div>
            <div className="submission-step-indicator"><span className="active">1</span><i></i><span>2</span></div>
          </div>

          <form onSubmit={e=>{e.preventDefault();validateBeforeReview()}}>
            <section className="submission-section">
              <div className="submission-section-heading"><span className="submission-section-number">1</span><div><h3>Distributor details</h3><p>Basic information retailers can use to contact you.</p></div></div>
              <div className="submission-form-grid">
                <label>Distributor name <span className="required">*</span><input required value={form.distributor_name} onChange={e=>update('distributor_name',e.target.value)} placeholder="Business / distributor name"/></label>
                <label>Legal name<input value={form.legal_name} onChange={e=>update('legal_name',e.target.value)} placeholder="Legal entity name"/></label>
                <label>Contact person<input value={form.contact_person} onChange={e=>update('contact_person',e.target.value)} placeholder="Name"/></label>
                <label>Mobile <span className="required">*</span><input required value={form.mobile} onChange={e=>update('mobile',e.target.value)} placeholder="+91 98765 43210"/></label>
                <label>WhatsApp<input value={form.whatsapp} onChange={e=>update('whatsapp',e.target.value)} placeholder="+91 98765 43210"/></label>
                <label>Email<input type="email" value={form.email} onChange={e=>update('email',e.target.value)} placeholder="business@example.com"/></label>
                <label>City<input value={form.city} onChange={e=>update('city',e.target.value)} placeholder="Bhuj, Gandhidham, Mundra..."/></label>
                <label>Google Maps link <span className="optional-label">optional</span><input value={form.maps_url} onChange={e=>update('maps_url',e.target.value)} placeholder="Paste your Google Maps link if available"/></label>
                <label className="submission-wide">Business address<input value={form.address} onChange={e=>update('address',e.target.value)} placeholder="Business address"/></label>
              </div>
            </section>

            <section className="submission-section">
              <div className="submission-section-heading"><span className="submission-section-number">2</span><div><h3>Companies you handle</h3><p>Add the company name and, if applicable, its division. Products or brands are not required at this stage.</p></div></div>

              <div className="company-tools">
                <button type="button" className="submission-tool-button" onClick={downloadSample}><Download size={15}/> Sample CSV</button>
                <button type="button" className="submission-tool-button" onClick={pasteBulk}><Upload size={15}/> Paste company list</button>
                <label className="submission-tool-button"><FileSpreadsheet size={15}/> Upload Excel / CSV<input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} hidden/></label>
              </div>

              {bulkInfo&&<div className="bulk-loaded"><ClipboardCheck size={15}/><span><strong>{bulkInfo.count} companies loaded</strong> from {bulkInfo.fileName}. You can edit or delete any row before submitting.</span></div>}

              {entries.length>0&&<div className="company-review-list">
                {entries.map((r,i)=><div className="company-review-card" key={i}>
                  <div className="company-review-index">{String(i+1).padStart(2,'0')}</div>
                  <div className="company-review-main">
                    <strong>{r.company_name}</strong>
                    <div><span>{r.handled_as==='brand'&&r.brand?'Brand: '+r.brand:r.handled_as==='division'&&r.division?'Division: '+r.division:r.handled_as==='unclear'?'Needs admin review':'Company generally'}</span><em>{r.category}</em></div>
                  </div>
                  <div className="company-review-actions">
                    <button type="button" onClick={()=>editEntry(i)} aria-label={'Edit '+r.company_name}><Edit3 size={14}/> Edit</button>
                    <button type="button" className="danger" onClick={()=>deleteEntry(i)} aria-label={'Delete '+r.company_name}><Trash2 size={14}/> Delete</button>
                  </div>
                </div>)}
              </div>}

              <label className="add-company-toggle">
                <input type="checkbox" checked={addMode} onChange={e=>{setAddMode(e.target.checked);if(!e.target.checked){setEditingIndex(null);setDraft(blankEntry())}}}/>
                <span className="fake-check">{addMode?'✓':'+'}</span>
                <span><strong>{editingIndex===null?'Add another company':'Edit company'}</strong><small>{editingIndex===null?'Tick this box to enter another company manually.':'Update the company details and save your change.'}</small></span>
              </label>

              {addMode&&<div className="company-editor-card">
                <div className="company-editor-heading"><div><strong>{editingIndex===null?'New company':'Edit company'}</strong><span>{editingIndex===null?'Enter the company exactly as you know it. We will check the name during admin review.':'Make your correction below.'}</span></div>{editingIndex!==null&&<button type="button" onClick={()=>{setEditingIndex(null);setDraft(blankEntry());setAddMode(false)}}>Cancel edit</button>}</div>
                <div className="company-editor-grid">
                  <label>Company / Organization <span className="required">*</span><input autoFocus value={draft.company_name} onChange={e=>updateDraft('company_name',e.target.value)} placeholder="e.g. Cipla"/></label>
                  <label>What does the line refer to?<select value={draft.handled_as||'company'} onChange={e=>updateDraft('handled_as',e.target.value)}><option value="company">Company</option><option value="brand">Brand</option><option value="division">Division</option><option value="unclear">Unclear / needs admin review</option></select></label>
                  {draft.handled_as==='brand'&&<label>Brand<input value={draft.brand||''} onChange={e=>updateDraft('brand',e.target.value)} placeholder="e.g. Vicks"/></label>}
                  {draft.handled_as==='division'&&<label>Division<input value={draft.division||''} onChange={e=>updateDraft('division',e.target.value)} placeholder="Actual company division"/></label>}
                  {draft.handled_as!=='brand'&&draft.handled_as!=='division'&&<label>Brand <span className="optional-label">optional</span><input value={draft.brand||''} onChange={e=>updateDraft('brand',e.target.value)} placeholder="If known"/></label>}
                  <label>Category<select value={draft.category} onChange={e=>updateDraft('category',e.target.value)}>{CATEGORIES.map(x=><option key={x}>{x}</option>)}</select></label>
                </div>
                <button type="button" className="save-company-button" onClick={saveDraft}><CheckCircle2 size={15}/>{editingIndex===null?'Save company':'Save changes'}</button>
              </div>}

              {entries.length===0&&!addMode&&<div className="company-empty"><Building2IconFallback/><strong>No companies added yet</strong><span>Tick “Add another company” above to enter your first company.</span></div>}
            </section>

            <section className="submission-section">
              <div className="submission-section-heading"><span className="submission-section-number">3</span><div><h3>Additional information</h3><p>Optional details that help us review your submission.</p></div></div>
              <div className="submission-form-grid">
                <label className="submission-wide">Website<input value={form.website} onChange={e=>update('website',e.target.value)} placeholder="https://..."/></label>
                <label className="submission-wide">Additional notes<textarea rows="3" value={form.notes} onChange={e=>update('notes',e.target.value)} placeholder="Territory, special divisions, or anything else we should know"/></label>
              </div>
            </section>

            {error&&<div className="report-error">{error}</div>}
            <div className="submission-footer-action"><div><strong>Ready to check your details?</strong><span>We will review the company names before publication.</span></div><button className="report-submit" type="submit"><ClipboardCheck size={16}/> Review submission <ChevronRight size={16}/></button></div>
          </form>
        </>}

        {!sent&&reviewing&&<>
          <div className="submission-top">
            <div><p className="section-kicker">FINAL REVIEW</p><h2>Check Your Submission</h2><p className="report-help">Please confirm that the information below is correct. You can edit anything before sending.</p></div>
            <div className="submission-step-indicator"><span className="complete">✓</span><i></i><span className="active">2</span></div>
          </div>

          <div className="final-review">
            <section className="final-review-section">
              <div className="final-review-heading"><h3>Distributor details</h3><button type="button" onClick={()=>setReviewing(false)}><Edit3 size={13}/> Edit</button></div>
              <div className="final-review-grid">
                {[['Distributor name',form.distributor_name],['Legal name',form.legal_name],['Contact person',form.contact_person],['Mobile',form.mobile],['WhatsApp',form.whatsapp],['Email',form.email],['City',form.city],['Address',form.address],['Website',form.website]].map(([k,v])=><div key={k}><small>{k}</small><strong>{v||'—'}</strong></div>)}
              </div>
            </section>

            <section className="final-review-section">
              <div className="final-review-heading"><div><h3>Companies submitted</h3><span>{entries.length} {entries.length===1?'company':'companies'}</span></div><button type="button" onClick={()=>{setReviewing(false);setAddMode(false)}}><Edit3 size={13}/> Edit</button></div>
              <div className="final-review-company-list">{entries.map((r,i)=><div key={i}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{r.company_name}</strong><small>{r.handled_as==='brand'&&r.brand?'Brand: '+r.brand:r.handled_as==='division'&&r.division?'Division: '+r.division:r.handled_as==='unclear'?'Needs admin review':'Company generally'} · {r.category}</small></div></div>)}</div>
            </section>

            {error&&<div className="report-error">{error}</div>}
            <div className="final-review-actions"><button type="button" className="submission-secondary" onClick={()=>setReviewing(false)}><ArrowLeft size={15}/> Back to edit</button><button type="button" className="report-submit" onClick={submit} disabled={busy}>{busy?<><LoaderCircle className="spin" size={16}/> Sending…</>:<><Send size={16}/> Submit for review</>}</button></div>
          </div>
        </>}

        {sent&&<div className="report-success"><CheckCircle2 size={42}/><h2>Submission received</h2><p>Thank you. Your details have been sent to the KutchPharmaConnect admin team. We will check the company names and distributorship information before publication.</p><button onClick={close}>Close</button></div>}
      </div>
    </div>}
  </>
}

function Building2IconFallback(){
  return <div className="company-empty-icon"><Truck size={22}/></div>
}
