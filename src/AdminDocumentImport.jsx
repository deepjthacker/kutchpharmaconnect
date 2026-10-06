import React,{useEffect,useMemo,useRef,useState} from 'react'
import {ArrowLeft,FileText,Upload,LoaderCircle,CheckCircle2,AlertTriangle,Trash2,Send} from 'lucide-react'
import {supabase} from './lib/supabase'

function norm(v){
  return String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')
}
function cleanName(v){
  return String(v||'').replace(/\s+/g,' ').replace(/^[\s|:;,-]+|[\s|:;,-]+$/g,'').trim()
}
function extractNumberedCompanies(text){
  const cleaned=String(text||'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim()
  const matches=[]
  const re=/(?:^|\s)(\d{1,3})\s+(.+?)(?=\s+\d{1,3}\s+|$)/g
  let m
  while((m=re.exec(cleaned))){
    const n=Number(m[1]), name=cleanName(m[2])
    if(n>=1&&n<=999&&name&&name.length>1)matches.push({number:n,company_name:name})
  }
  const seen=new Set()
  return matches.filter(x=>{
    const key=norm(x.company_name)
    if(!key||seen.has(key))return false
    seen.add(key);return true
  })
}
async function ensurePdfJs(){
  if(window.pdfjsLib)return window.pdfjsLib
  await new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-kpc-pdfjs]')
    if(existing){
      existing.addEventListener('load',resolve,{once:true})
      existing.addEventListener('error',reject,{once:true})
      return
    }
    const s=document.createElement('script')
    s.dataset.kpcPdfjs='1'
    s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload=resolve
    s.onerror=()=>reject(new Error('Could not load the PDF reader. Please check your internet connection and try again.'))
    document.head.appendChild(s)
  })
  if(!window.pdfjsLib)throw new Error('PDF reader did not initialize.')
  window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  return window.pdfjsLib
}
export default function AdminDocumentImport({onBack,onOpenSubmissions}){
  const inputRef=useRef(null)
  const [distributors,setDistributors]=useState([]),[distributorId,setDistributorId]=useState('')
  const [file,setFile]=useState(null),[pages,setPages]=useState([]),[selectedPages,setSelectedPages]=useState([])
  const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
  const [rows,setRows]=useState([]),[step,setStep]=useState(1)
  useEffect(()=>{
    supabase.from('distributors').select('id,distributor_name,mobile,whatsapp,email,city_id,status').eq('status','active').order('distributor_name')
      .then(({data,error})=>{if(error)setError(error.message);else setDistributors(data||[])})
  },[])
  const selectedDistributor=distributors.find(x=>x.id===distributorId)
  const selectedPageSet=new Set(selectedPages)
  const combinedRows=useMemo(()=>{
    const out=[]
    selectedPages.forEach(pageNo=>{
      const p=pages.find(x=>x.page===pageNo)
      ;(p?.companies||[]).forEach(x=>out.push({...x,page:pageNo}))
    })
    const seen=new Set()
    return out.filter(x=>{const k=norm(x.company_name);if(!k||seen.has(k))return false;seen.add(k);return true})
  },[pages,selectedPages])
  async function readPdf(selectedFile){
    setLoading(true);setError('');setMessage('')
    try{
      const pdfjs=await ensurePdfJs()
      const buffer=await selectedFile.arrayBuffer()
      const pdf=await pdfjs.getDocument({data:buffer}).promise
      const result=[]
      for(let i=1;i<=pdf.numPages;i++){
        const page=await pdf.getPage(i)
        const content=await page.getTextContent()
        const text=content.items.map(x=>x.str||'').join(' ')
        result.push({page:i,text,companies:extractNumberedCompanies(text)})
      }
      setPages(result);setSelectedPages(result.map(x=>x.page));setRows([]);setStep(2)
      if(result.every(x=>x.companies.length===0))setError('This PDF appears to be scanned/image-only or its text could not be extracted. Image/OCR support will be added after this PDF workflow is verified.')
    }catch(e){setError(e?.message||'Could not read the PDF.')}
    finally{setLoading(false)}
  }
  function handleFile(e){
    const f=e.target.files?.[0];if(!f)return;e.target.value=''
    if(f.type!=='application/pdf'&&!f.name.toLowerCase().endsWith('.pdf')){
      setError('For this first importer, please choose a PDF. Image/scanned-document OCR will be added after this PDF workflow is verified.');return
    }
    setFile(f);readPdf(f)
  }
  function togglePage(page){setSelectedPages(prev=>prev.includes(page)?prev.filter(x=>x!==page):[...prev,page].sort((a,b)=>a-b))}
  function removeRow(index){setRows(prev=>prev.filter((_,i)=>i!==index))}
  function prepareRows(){setRows(combinedRows);setStep(3)}
  async function createDraft(){
    if(!selectedDistributor||!rows.length||saving)return
    setSaving(true);setError('');setMessage('')
    const {data:userData}=await supabase.auth.getUser()
    const entries=rows.map(x=>({company_name:x.company_name,handled_as:'company',brand:'',division:'',category:'Pharmaceutical',source_page:x.page,source_file:file?.name||''}))
    const {error:insertError}=await supabase.from('distributor_submissions').insert({
      distributor_name:selectedDistributor.distributor_name,legal_name:null,contact_person:null,
      mobile:selectedDistributor.mobile||'0000000000',whatsapp:selectedDistributor.whatsapp||selectedDistributor.mobile||null,
      email:selectedDistributor.email||null,address:null,city:null,district:'Kutch',state:'Gujarat',
      maps_url:null,website:null,companies_handled:rows.map(x=>x.company_name).join('\n'),
      notes:`Imported from PDF document. Source file: ${file?.name||'unknown'}. Review before publishing.`,
      admin_notes:'Created by Admin Document Import. No records have been published yet.',
      reviewed_by:userData?.user?.id||null,company_entries:entries,bulk_source:'pdf',bulk_file_name:file?.name||null,
      bulk_row_count:rows.length,status:'open'
    })
    if(insertError){setError(insertError.message);setSaving(false);return}
    setMessage(`Draft created with ${rows.length} company names. Nothing has been published yet.`);setSaving(false)
  }
  function reset(){setFile(null);setPages([]);setSelectedPages([]);setRows([]);setError('');setMessage('');setStep(1)}
  return <div className="admin-page">
    <div className="admin-head">
      <div><button className="admin-back" onClick={onBack}><ArrowLeft size={15}/> Dashboard</button><p className="section-kicker">BULK IMPORT</p><h1>Distributor Document Import</h1><p>Upload a distributor PDF, extract company names, then send them to the existing review workflow.</p></div>
      <button className="admin-refresh" onClick={reset}>Start New Import</button>
    </div>
    {error&&<div className="admin-error"><AlertTriangle size={16}/>{error}</div>}
    {message&&<div className="report-success" style={{marginBottom:'16px'}}><CheckCircle2 size={22}/><p>{message}</p>{onOpenSubmissions&&<button onClick={onOpenSubmissions}><Send size={15}/> Open Distributor Submissions</button>}</div>}
    <div className="admin-panel" style={{marginBottom:'16px'}}>
      <div className="admin-panel-heading"><div><p className="section-kicker">STEP 1</p><h2>Select distributor & PDF</h2><p>The distributor must already exist in your directory. We create a pending submission; nothing is published.</p></div><FileText size={20}/></div>
      <label>Distributor<select value={distributorId} onChange={e=>setDistributorId(e.target.value)} disabled={saving}><option value="">Select distributor…</option>{distributors.map(d=><option key={d.id} value={d.id}>{d.distributor_name}</option>)}</select></label>
      <input ref={inputRef} type="file" accept=".pdf,application/pdf" onChange={handleFile} hidden/>
      <button className="report-submit" type="button" onClick={()=>inputRef.current?.click()} disabled={!selectedDistributor||loading||saving} style={{marginTop:'12px'}}>{loading?<><LoaderCircle className="spin" size={16}/> Reading PDF…</>:<><Upload size={16}/> Choose PDF</>}</button>
      {file&&<p className="report-help" style={{marginTop:'8px'}}>Loaded: <strong>{file.name}</strong></p>}
    </div>
    {pages.length>0&&<div className="admin-panel" style={{marginBottom:'16px'}}>
      <div className="admin-panel-heading"><div><p className="section-kicker">STEP 2</p><h2>Choose pages</h2><p>We found {pages.length} page{pages.length===1?'':'s'}. Select the pages belonging to this distributor.</p></div><FileText size={20}/></div>
      <div style={{display:'grid',gap:'10px'}}>{pages.map(p=><label key={p.page} style={{display:'flex',alignItems:'center',gap:'10px',padding:'12px',border:'1px solid var(--border,#ddd)',borderRadius:'10px'}}><input type="checkbox" checked={selectedPageSet.has(p.page)} onChange={()=>togglePage(p.page)}/><span style={{flex:1}}><strong>Page {p.page}</strong><small style={{display:'block',opacity:.7}}>{p.companies.length} numbered names detected</small></span></label>)}</div>
      <button className="report-submit" type="button" onClick={prepareRows} disabled={!selectedPages.length} style={{marginTop:'14px'}}>Review {combinedRows.length} detected names</button>
    </div>}
    {step===3&&<div className="admin-panel" style={{marginBottom:'16px'}}>
      <div className="admin-panel-heading"><div><p className="section-kicker">STEP 3</p><h2>Review extracted names</h2><p>{rows.length} names will be sent to Distributor Submissions. Remove obvious document noise here; company matching happens next.</p></div><CheckCircle2 size={20}/></div>
      <div style={{display:'grid',gap:'8px',maxHeight:'520px',overflowY:'auto'}}>{rows.map((r,i)=><div key={`${r.page}-${i}`} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',border:'1px solid var(--border,#ddd)',borderRadius:'9px'}}><span style={{width:'34px',opacity:.6}}>#{i+1}</span><strong style={{flex:1}}>{r.company_name}</strong><small style={{opacity:.6}}>p.{r.page}</small><button className="admin-refresh" type="button" onClick={()=>removeRow(i)} aria-label={`Remove ${r.company_name}`}><Trash2 size={14}/></button></div>)}</div>
      <button className="report-submit" type="button" onClick={createDraft} disabled={!rows.length||saving} style={{marginTop:'14px'}}>{saving?<><LoaderCircle className="spin" size={16}/> Creating draft…</>:<><Send size={16}/> Send to Distributor Review</>}</button>
    </div>}
    <div className="admin-panel"><div className="admin-panel-heading"><div><p className="section-kicker">IMPORTANT</p><h2>What happens next?</h2><p>This importer does not create companies or publish relationships.</p></div><AlertTriangle size={20}/></div>
      <ol style={{paddingLeft:'20px',lineHeight:1.7}}><li>PDF names are extracted.</li><li>You remove obvious wrong rows.</li><li>The list becomes a normal <strong>Distributor Submission</strong>.</li><li>The existing system matches each company against your Company Master.</li><li>You choose <strong>Use Existing / Create New / Remove</strong>.</li><li>Only after your approval are distributor relationships published.</li></ol>
    </div>
  </div>
}