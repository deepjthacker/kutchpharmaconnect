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
   const [companies,distributors,categories,locations,distributorships,divisions]=await Promise.all(
    ['companies','distributors','categories','locations','distributorships','divisions'].map(getRows)
   )
   const results=validateRows(preview.rows,{companies,distributors,categories,locations,distributorships,divisions})
   const blocking=results.filter(x=>x.issues.length).length
   const warnings=results.filter(x=>x.warnings.length).length
   const ready=results.filter(x=>!x.issues.length)
   setValidation({results,blocking,warnings,ready,checkedAt:new Date().toISOString(),approved:false})
   setMessage(blocking
    ? `Validation complete: ${blocking} row(s) need correction before import.`
    : `Validation complete: ${results.length} row(s) passed. Review the change plan before production import.`)
  }catch(e){setError(e.message)}
  setBusy('')
 }

 function normalizeImportDate(value){
  if(!value)return null
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString().slice(0,10)
  const s=String(value).trim()
  if(/^\\d{4}-\\d{2}-\\d{2}$/.test(s))return s
  return null
 }

 function validateRows(rows,db){
  const norm=v=>String(v??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'')
  const by=(arr,...fields)=>{
   const m=new Map()
   ;(arr||[]).forEach(x=>fields.forEach(f=>{
    const k=norm(x[f]);if(k&&!m.has(k))m.set(k,x)
   }))
   return m
  }
  const companies=by(db.companies,'company_name','legal_name','short_name')
  const distributors=by(db.distributors,'distributor_name','legal_name')
  const categories=by(db.categories,'category_name','name')
  const locations=db.locations||[]
  const divisions=db.divisions||[]
  const results=[]
  const seen=new Set()

  rows.forEach((row,i)=>{
   const issues=[],warnings=[]
   const company=companies.get(norm(row.company_name))
   const distributor=distributors.get(norm(row.distributor_name))
   const category=categories.get(norm(row.category))

   const companyDivisions=company?divisions.filter(d=>d.company_id===company.id):[]
   const division=row.division_name
    ? companyDivisions.find(d=>norm(d.division_name)===norm(row.division_name)||norm(d.division_code)===norm(row.division_name))
    : null

   const findLocation=(city,district,state)=>{
    const c=norm(city),d=norm(district),s=norm(state)
    return locations.find(x=>
      c&&norm(x.city)===c &&
      (!d||norm(x.district)===d) &&
      (!s||norm(x.state)===s)
    )||null
   }

   const relationshipLocation=findLocation(row.location_city,row.location_district,row.state)
   const distributorLocation=findLocation(row.city,row.district,row.state)

   if(!norm(row.distributor_name))issues.push('Missing distributor_name')
   else if(!distributor)warnings.push('New distributor will be created')

   if(!norm(row.company_name))issues.push('Missing company_name')
   else if(!company)issues.push('Company not found; identity must be reviewed before import')

   if(!norm(row.category))issues.push('Missing category')
   else if(!category)issues.push('Category not found')

   if(row.division_name&&!division)issues.push('Division not found under the matched company')

   if((row.location_city||row.location_district)&&!relationshipLocation){
    issues.push('Relationship location not found; create/verify the location before import')
   }

   const relationshipStatus=norm(row.relationship_status||'active')
   const verificationStatus=norm(row.verification_status||'unverified')
   if(!['active','inactive'].includes(relationshipStatus))issues.push('Invalid relationship_status')
   if(!['unverified','needs_review','verified'].includes(verificationStatus))issues.push('Invalid verification_status')

   const verifiedDate=normalizeImportDate(row.verified_date)
   if(row.verified_date&&!verifiedDate)issues.push('verified_date must be YYYY-MM-DD')
   if(verificationStatus==='verified'&&!verifiedDate)issues.push('Verified relationships require verified_date')
   if(verificationStatus==='verified'&&!String(row.verification_note||'').trim())warnings.push('Verified relationship has no verification_note')

   const key=[norm(row.distributor_name),norm(row.company_name),norm(row.division_name)].join('|')
   if(seen.has(key))issues.push('Duplicate row in import file')
   seen.add(key)

   let existing=null
   if(company&&distributor){
    existing=db.distributorships.find(d=>
      d.company_id===company.id &&
      d.distributor_id===distributor.id &&
      (division?d.division_id===division.id:!d.division_id)
    )
    if(existing)warnings.push('Relationship already exists and will be skipped')
   }

   results.push({
    rowNumber:i+2,row,company,distributor,category,division,
    relationshipLocation,distributorLocation,existing,
    relationshipStatus,verificationStatus,verifiedDate,
    issues,warnings
   })
  })
  return results
 }

 function buildImportPlan(){
  if(!validation||validation.blocking>0)return null
  const ready=validation.ready.filter(x=>!x.existing)
  const existing=validation.ready.filter(x=>x.existing)
  const newDistributors=[]
  const newDistributorKeys=new Set()

  ready.forEach(x=>{
   if(!x.distributor){
    const key=String(x.row.distributor_name||'').trim().toLowerCase()
    if(!newDistributorKeys.has(key)){
     newDistributorKeys.add(key)
     newDistributors.push(x)
    }
   }
  })

  return {
   ready,
   existing,
   newDistributors,
   newRelationships:ready.length
  }
 }

 async function executeImport(){
  const plan=buildImportPlan()
  if(!plan)return
  setBusy('import-approved');setError('');setMessage('')
  try{
   const createdDistributorIds=[]
   const distributorIdByKey=new Map()

   // Create only distributors that are genuinely new. Company identities are never created by import.
   if(plan.newDistributors.length){
    const payload=plan.newDistributors.map(x=>({
     distributor_name:String(x.row.distributor_name).trim(),
     legal_name:String(x.row.distributor_legal_name||'').trim()||null,
     contact_person:String(x.row.contact_person||'').trim()||null,
     mobile:String(x.row.mobile||'').trim()||null,
     whatsapp:String(x.row.whatsapp||'').trim()||null,
     email:String(x.row.email||'').trim()||null,
     address:String(x.row.address||'').trim()||null,
     city_id:x.distributorLocation?.id||null,
     maps_url:String(x.row.maps_url||'').trim()||null,
     website:String(x.row.website||'').trim()||null,
     notes:String(x.row.notes||'').trim()||null,
     status:'active'
    }))
    const r=await supabase.from('distributors').insert(payload).select('id,distributor_name')
    if(r.error)throw new Error('Distributor creation failed: '+r.error.message)
    ;(r.data||[]).forEach(d=>{
     createdDistributorIds.push(d.id)
     distributorIdByKey.set(String(d.distributor_name).trim().toLowerCase(),d.id)
    })
   }

   const relationshipPayload=plan.ready.map(x=>{
    const distributorId=x.distributor?.id||distributorIdByKey.get(String(x.row.distributor_name).trim().toLowerCase())
    if(!distributorId)throw new Error(`Could not resolve distributor for import row ${x.rowNumber}.`)
    return {
     company_id:x.company.id,
     division_id:x.division?.id||null,
     distributor_id:distributorId,
     category_id:x.category.id,
     location_id:x.relationshipLocation?.id||null,
     territory:String(x.row.territory||'').trim()||null,
     status:x.relationshipStatus,
     verification_status:x.verificationStatus,
     verified_date:x.verifiedDate,
     verification_note:String(x.row.verification_note||'').trim()||null,
     verification_notes:String(x.row.verification_note||'').trim()||null,
     source:String(x.row.source||'').trim()||null
    }
   })

   if(relationshipPayload.length){
    const r=await supabase.from('distributorships').insert(relationshipPayload).select('id')
    if(r.error){
     // Best-effort cleanup of distributors created by this import if the relationship batch fails.
     if(createdDistributorIds.length){
      await supabase.from('distributors').delete().in('id',createdDistributorIds)
     }
     throw new Error('Relationship creation failed. No relationship rows were kept. Newly created distributors were rolled back where permitted. '+r.error.message)
    }
   }

   setValidation(v=>({...v,approved:true,importedAt:new Date().toISOString(),importResult:{
    createdDistributors:plan.newDistributors.length,
    createdRelationships:plan.newRelationships,
    skippedExisting:plan.existing.length
   }}))
   setMessage(`Import completed: ${plan.newRelationships} relationship(s) created, ${plan.newDistributors.length} distributor(s) created, ${plan.existing.length} existing relationship(s) skipped.`)
  }catch(e){
   setError(e.message)
  }
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
