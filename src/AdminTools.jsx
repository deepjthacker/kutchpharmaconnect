import { useRef,useState } from 'react'
import { ArrowLeft,Download,Upload,Database,FileJson,FileSpreadsheet,LoaderCircle,Eye } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from './lib/supabase'

const tables=['companies','distributors','divisions','categories','locations','distributorships','search_aliases','company_categories']

const importHeaders=[
 'distributor_name','distributor_legal_name','contact_person','mobile','whatsapp','email','address','city','district','state','pincode','maps_url','website',
 'company_name','company_legal_name','company_short_name','division_name','division_code','category','location_city','location_district','territory',
 'relationship_status','verification_status','verified_date','verification_note','source','notes'
]

const sampleValues=[
 {distributor_name:'Aakash Medical Agencies',company_name:'Sun Pharmaceutical Industries',category:'Pharmaceutical',relationship_status:'active',verification_status:'unverified',source:'Sample data'},
 {distributor_name:'Jethalal Odhavji Thacker',company_name:'Zydus Lifesciences',category:'Pharmaceutical',relationship_status:'active',verification_status:'verified',verified_date:'2026-10-01',verification_note:'Sample verified relationship',source:'Sample data'},
 {distributor_name:'Example Distributor',company_name:'Example Company',category:'Surgical',location_city:'Bhuj',relationship_status:'active',verification_status:'needs_review',source:'Sample data'}
]
const sampleRows=sampleValues.map(row=>Object.fromEntries(importHeaders.map(h=>[h,row[h]??''])))

function downloadBlob(blob,name){
 const url=URL.createObjectURL(blob)
 const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)
}

function downloadCsv(rows,name){
 const ws=XLSX.utils.json_to_sheet(rows)
 const csv=XLSX.utils.sheet_to_csv(ws)
 downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),name)
}

function downloadXlsx(rows,name,sheet='DATA'){
 const wb=XLSX.utils.book_new()
 const ws=XLSX.utils.json_to_sheet(rows.length?rows:[{}])
 XLSX.utils.book_append_sheet(wb,ws,sheet.slice(0,31))
 XLSX.writeFile(wb,name)
}

export default function AdminTools({onBack}){
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('')
 const [preview,setPreview]=useState(null)
 const [validation,setValidation]=useState(null)
 const fileRef=useRef(null)

 async function getRows(name){
  const r=await supabase.from(name).select('*')
  if(r.error)throw new Error(name+': '+r.error.message)
  return r.data||[]
 }

 async function exportTable(name,format='xlsx'){
  setBusy(name+format);setError('');setMessage('')
  try{
   const rows=await getRows(name)
   const stamp=new Date().toISOString().slice(0,10)
   if(format==='csv')downloadCsv(rows,\`kutchpharmaconnect-\${name}-\${stamp}.csv\`)
   else downloadXlsx(rows,\`kutchpharmaconnect-\${name}-\${stamp}.xlsx\`,name)
   setMessage(\`Exported \${name} as \${format.toUpperCase()}.\`)
  }catch(e){setError(e.message)}
  setBusy('')
 }

 async function exportAll(format='xlsx'){
  setBusy('all'+format);setError('');setMessage('')
  try{
   const wb=format==='xlsx'?XLSX.utils.book_new():null
   const out={exported_at:new Date().toISOString(),tables:{}}
   for(const t of tables){
    const rows=await getRows(t);out.tables[t]=rows
    if(wb){
     const ws=XLSX.utils.json_to_sheet(rows.length?rows:[{}])
     XLSX.utils.book_append_sheet(wb,ws,t.slice(0,31))
    }
   }
   const stamp=new Date().toISOString().slice(0,10)
   if(format==='xlsx')XLSX.writeFile(wb,\`kutchpharmaconnect-backup-\${stamp}.xlsx\`)
   else downloadBlob(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}),\`kutchpharmaconnect-backup-\${stamp}.json\`)
   setMessage(format==='xlsx'?'Full Excel workbook exported with separate sheets.':'Full JSON backup exported.')
  }catch(e){setError(e.message)}
  setBusy('')
 }

 async function validateImport(){
  if(!preview?.rows?.length)return
  setBusy('validate');setError('');setMessage('');setValidation(null)
  try{
   const [companies,distributors,categories,locations,distributorships]=await Promise.all(['companies','distributors','categories','locations','distributorships'].map(getRows))
   const results=validateRows(preview.rows,{companies,distributors,categories,locations,distributorships})
   const blocking=results.filter(x=>x.issues.length).length
   const warnings=results.filter(x=>x.warnings.length).length
   setValidation({results,blocking,warnings,checkedAt:new Date().toISOString()})
   setMessage(blocking?\`Validation complete: \${blocking} row(s) need correction before import.\`:\`Validation complete: \${results.length} row(s) passed, with \${warnings} warning row(s). No database records were changed.\`)
  }catch(e){setError(e.message)}
  setBusy('')
 }

 function downloadImportSample(format){
  const stamp='kutchpharmaconnect-distributorship-import-sample'
  if(format==='csv')downloadCsv(sampleRows,stamp+'.csv')
  else{
   const wb=XLSX.utils.book_new()
   XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(sampleRows,{header:importHeaders}),'DISTRIBUTORSHIPS_IMPORT')
   XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
    ['IMPORT INSTRUCTIONS'],
    ['One row = one distributor ↔ company distributorship relationship.'],
    ['Use verified company/entity names. Leave division blank if unknown or unverified.'],
    ['relationship_status: active/inactive'],
    ['verification_status: unverified/needs_review/verified'],
    ['verified_date: YYYY-MM-DD'],
    ['This sample is illustrative only. Review before importing.']
   ]),'IMPORT_INSTRUCTIONS')
   XLSX.writeFile(wb,stamp+'.xlsx')
  }
 }

 async function validateRows(rows,db){
 const norm=v=>String(v??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'')
 const by=(arr,...fields)=>{const m=new Map();arr.forEach(x=>fields.forEach(f=>{const k=norm(x[f]);if(k)m.set(k,x)}));return m}
 const companies=by(db.companies,'company_name','legal_name','short_name')
 const distributors=by(db.distributors,'distributor_name','legal_name')
 const categories=by(db.categories,'category_name','name')
 const locations=db.locations||[]
 const results=[]
 const seen=new Set()
 rows.forEach((row,i)=>{
  const issues=[],warnings=[]
  const company=companies.get(norm(row.company_name))
  const distributor=distributors.get(norm(row.distributor_name))
  const category=categories.get(norm(row.category))
  if(!norm(row.distributor_name))issues.push('Missing distributor_name')
  else if(!distributor)warnings.push('New distributor')
  if(!norm(row.company_name))issues.push('Missing company_name')
  else if(!company)issues.push('Company not found; identity must be reviewed before import')
  if(!norm(row.category))issues.push('Missing category')
  else if(!category)issues.push('Category not found')
  if(row.relationship_status&&!['active','inactive'].includes(norm(row.relationship_status)))issues.push('Invalid relationship_status')
  if(row.verification_status&&!['unverified','needs_review','verified'].includes(norm(row.verification_status)))issues.push('Invalid verification_status')
  if(row.verified_date&&!/^\d{4}-\d{2}-\d{2}$/.test(String(row.verified_date)))issues.push('verified_date must be YYYY-MM-DD')
  const key=[norm(row.distributor_name),norm(row.company_name),norm(row.division_name)].join('|')
  if(seen.has(key))issues.push('Duplicate row in import file')
  seen.add(key)
  const existing=company&&distributor&&db.distributorships.find(d=>d.company_id===company.id&&d.distributor_id===distributor.id&&(!row.division_name||d.division_id))
  if(existing)warnings.push('Relationship already exists')
  results.push({rowNumber:i+2,company,distributor,category,issues,warnings,row})
 })
 return results
}

async function handleImport(e){
  const f=e.target.files?.[0];e.target.value=''
  if(!f)return
  setBusy('import');setError('');setMessage('');setPreview(null)
  try{
   const ext=f.name.toLowerCase().endsWith('.csv')?'csv':'xlsx'
   if(!f.name.toLowerCase().endsWith('.csv')&&!f.name.toLowerCase().endsWith('.xlsx'))throw new Error('Please select a .csv or .xlsx file.')
   const data=await f.arrayBuffer()
   const wb=XLSX.read(data,{type:'array'})
   const first=wb.Sheets[wb.SheetNames[0]]
   const rows=XLSX.utils.sheet_to_json(first,{defval:''})
   if(!rows.length)throw new Error('The selected file contains no data rows.')
   const headers=Object.keys(rows[0])
   const missing=importHeaders.filter(h=>!headers.includes(h))
   const recognized=Object.keys(rows[0]).filter(h=>importHeaders.includes(h))
   setPreview({file:f.name,format:ext,rows,headers,missing,recognized})
   setValidation(null)
   setMessage(\`Loaded \${rows.length} row(s) from \${f.name}. No database records were changed.\`)
  }catch(e){setError(e.message)}
  setBusy('')
 }

 return <div className="admin-page">
  <div className="admin-head"><div>
   <button className="admin-back" onClick={onBack}><ArrowLeft size={15}/> Dashboard</button>
   <p className="section-kicker">DATA TOOLS</p><h1>Import, Export & Backup</h1>
   <p>Use Excel or CSV for directory data. Imports are previewed before any production write.</p>
  </div></div>
  {error&&<div className="admin-error">{error}</div>}
  {message&&<div className="admin-note admin-message">{message}</div>}

  <div className="admin-tool-grid">
   <section className="admin-panel">
    <p className="section-kicker">BACKUP</p><h2>Full database export</h2>
    <p className="admin-help">Excel creates one sheet per directory table. JSON remains available as a machine-readable backup.</p>
    <div className="admin-inline-actions">
     <button className="admin-tool-button" onClick={()=>exportAll('xlsx')} disabled={!!busy}><FileSpreadsheet size={16}/>{busy==='allxlsx'?<><LoaderCircle className="spin" size={16}/> Exporting…</>:'Download full Excel backup'}</button>
     <button className="admin-tool-button" onClick={()=>exportAll('json')} disabled={!!busy}><FileJson size={16}/>{busy==='alljson'?<><LoaderCircle className="spin" size={16}/> Exporting…</>:'Download full JSON backup'}</button>
    </div>
   </section>

   <section className="admin-panel">
    <p className="section-kicker">EXPORT</p><h2>Individual tables</h2>
    <p className="admin-help">Export companies, distributors, divisions and other directory tables in either Excel or CSV.</p>
    {tables.map(t=><div className="admin-tool-row" key={t}>
     <span>{t}</span>
     <span className="admin-inline-actions">
      <button onClick={()=>exportTable(t,'xlsx')} disabled={!!busy} title="Excel"><FileSpreadsheet size={14}/></button>
      <button onClick={()=>exportTable(t,'csv')} disabled={!!busy} title="CSV"><Download size={14}/></button>
     </span>
    </div>)}
   </section>

   <section className="admin-panel">
    <p className="section-kicker">IMPORT</p><h2>Controlled import</h2>
    <p className="admin-help">Both .xlsx and .csv are supported. The first sheet/file is parsed and shown for review; nothing is written automatically.</p>
    <input ref={fileRef} type="file" accept=".xlsx,.csv" hidden onChange={handleImport}/>
    <button className="admin-tool-button" onClick={()=>fileRef.current?.click()} disabled={!!busy}><Upload size={16}/>{busy==='import'?<><LoaderCircle className="spin" size={16}/> Reading…</>:'Select Excel / CSV file'}</button>
   </section>

   <section className="admin-panel">
    <p className="section-kicker">SAMPLE FILES</p><h2>Distributorship import sample</h2>
    <p className="admin-help">Use these samples as the standard import structure for distributor ↔ company relationships.</p>
    <div className="admin-inline-actions">
     <button className="admin-tool-button" onClick={()=>downloadImportSample('xlsx')}><FileSpreadsheet size={16}/> Sample Excel</button>
     <button className="admin-tool-button" onClick={()=>downloadImportSample('csv')}><Download size={16}/> Sample CSV</button>
    </div>
   </section>
  </div>

  {preview&&<section className="admin-panel" style={{marginTop:16}}>
   <div className="admin-inline-actions" style={{justifyContent:'space-between'}}>
    <div><p className="section-kicker">IMPORT PREVIEW</p><h2>{preview.file}</h2></div>
    <div className="admin-inline-actions"><button className="admin-tool-button" onClick={validateImport} disabled={!!busy}><Eye size={16}/>{busy==='validate'?<><LoaderCircle className="spin" size={16}/> Validating…</>:'Validate import'}</button><button className="admin-tool-button" onClick={()=>{setPreview(null);setValidation(null)}}>Close</button></div>
   </div>
   <p className="admin-help">{preview.rows.length} row(s), {preview.recognized.length} recognized standard column(s). {preview.missing.length?\`Missing expected columns: \${preview.missing.join(', ')}.\`:'All standard import columns are present.'}</p>
   <div style={{overflowX:'auto'}}>
    <table className="admin-table"><thead><tr>{preview.headers.map(h=><th key={h}>{h}</th>)}</tr></thead>
    <tbody>{preview.rows.slice(0,20).map((row,i)=><tr key={i}>{preview.headers.map(h=><td key={h}>{String(row[h]??'')}</td>)}</tr>)}</tbody></table>
   </div>
   {preview.rows.length>20&&<p className="admin-help">Showing first 20 rows only in the preview.</p>}
   {validation&&<div style={{marginTop:14}}>
    <p className="admin-help"><strong>{validation.results.length}</strong> rows checked · <strong>{validation.blocking}</strong> blocking · <strong>{validation.warnings}</strong> warnings</p>
    <div style={{overflowX:'auto'}}><table className="admin-table"><thead><tr><th>Row</th><th>Distributor</th><th>Company</th><th>Result</th><th>Details</th></tr></thead>
    <tbody>{validation.results.map(x=><tr key={x.rowNumber}><td>{x.rowNumber}</td><td>{x.row.distributor_name||'—'}</td><td>{x.row.company_name||'—'}</td><td>{x.issues.length?'BLOCKED':x.warnings.length?'WARNING':'READY'}</td><td>{[...x.issues,...x.warnings].join(' · ')||'Passed validation'}</td></tr>)}</tbody></table></div>
    {validation.blocking===0&&<p className="admin-help" style={{marginTop:10}}>All rows passed structural and identity checks. The actual production write step is intentionally separate and requires an explicit import action.</p>}
   </div>}
  </section>}
 </div>
}
