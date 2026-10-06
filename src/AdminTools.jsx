import React from 'react'
import { useRef,useState } from 'react'
import { ArrowLeft,Download,Upload,Database,FileJson,LoaderCircle,Eye } from 'lucide-react'
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
const sampleRows=Array.from({length:40},()=>Object.fromEntries(importHeaders.map(h=>[h,''])))
const sampleExampleRows=sampleValues.map(row=>Object.fromEntries(importHeaders.map(h=>[h,row[h]??''])))

function downloadBlob(blob,name){
 const url=URL.createObjectURL(blob)
 const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)
}

function csvEscape(value){
 const s=String(value??'')
 return /[",\\n\\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s
}
function downloadCsv(rows,name){
 const data=rows||[]
 const headers=data.length?Object.keys(data[0]):[]
 const csv=[headers.map(csvEscape).join(','),...data.map(row=>headers.map(h=>csvEscape(row[h])).join(','))].join('\\r\\n')
 downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),name)
}
function parseCsvLine(line){
 const values=[];let value='';let quoted=false
 for(let i=0;i<line.length;i++){
  const ch=line[i]
  if(ch==='"'){
   if(quoted&&line[i+1]==='"'){value+='"';i++}else quoted=!quoted
  }else if(ch===','&&!quoted){values.push(value);value=''}else value+=ch
 }
 values.push(value);return values
}
function parseCsv(text){
 const lines=String(text||'').replace(/^\\uFEFF/,'').split(/\\r?\\n/).filter(line=>line.trim())
 if(!lines.length)return []
 const headers=parseCsvLine(lines[0]).map(x=>x.trim())
 return lines.slice(1).map(line=>{const values=parseCsvLine(line),row={};headers.forEach((h,i)=>row[h]=values[i]??'');return row})
}

export default function AdminTools({onBack}){
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('')
 const [preview,setPreview]=useState(null)
 const [validation,setValidation]=useState(null)
 const [catalogPreview,setCatalogPreview]=useState(null)
 const [catalogValidation,setCatalogValidation]=useState(null)
 const [catalogBusy,setCatalogBusy]=useState(false)
 const catalogFileRef=useRef(null)
 const fileRef=useRef(null)

 async function getRows(name){
  const r=await supabase.from(name).select('*')
  if(r.error)throw new Error(name+': '+r.error.message)
  return r.data||[]
 }

 async function exportTable(name){
  setBusy(name+'csv');setError('');setMessage('')
  try{
   const rows=await getRows(name)
   const stamp=new Date().toISOString().slice(0,10)
   downloadCsv(rows,`kutchpharmaconnect-${name}-${stamp}.csv`)
   setMessage(`Exported ${name} as CSV.`)
  }catch(e){setError(e.message)}
  setBusy('')
 }

 async function exportAll(){
  setBusy('alljson');setError('');setMessage('')
  try{
   const out={exported_at:new Date().toISOString(),tables:{}}
   for(const t of tables){out.tables[t]=await getRows(t)}
   const stamp=new Date().toISOString().slice(0,10)
   downloadBlob(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}),'kutchpharmaconnect-backup-'+stamp+'.json')
   setMessage('Full JSON backup exported.')
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
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s
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
 function parseCatalogCsv(text){
  const rows=parseCsv(text)
  const allowed=['company_name','company_legal_name','company_short_name','division_name','division_code','brand_name']
  return rows.map(row=>Object.fromEntries(allowed.map(k=>[k,String(row[k]??'').trim()])))
 }

 function validateCatalogRows(rows){
  const norm=v=>String(v??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'')
  return Promise.all([
   getRows('companies'),
   getRows('divisions'),
   getRows('brands')
  ]).then(([companies,divisions,brands])=>{
   const companyMap=new Map()
   companies.forEach(x=>{
    ;['company_name','legal_name','short_name'].forEach(f=>{
     const k=norm(x[f]);if(k&&!companyMap.has(k))companyMap.set(k,x)
    })
   })
   const results=[]
   const seen=new Set()
   rows.forEach((row,i)=>{
    const issues=[],warnings=[]
    if(!row.company_name)issues.push('Missing company_name')
    const company=companyMap.get(norm(row.company_name))
    if(company){
     if(row.company_legal_name&&norm(row.company_legal_name)!==norm(company.legal_name))warnings.push('Legal name differs from existing company')
    }
    const divisionsForCompany=company?divisions.filter(d=>d.company_id===company.id):[]
    const division=row.division_name
      ? divisionsForCompany.find(d=>norm(d.division_name)===norm(row.division_name)||norm(d.division_code)===norm(row.division_name))
      : null
    if(row.division_name&&!division&&company)warnings.push('New division will be created')
    if(row.division_name&&!company)warnings.push('Division will be created after the new company')
    let brand=null
    if(row.brand_name&&company){
     brand=brands.find(b=>b.company_id===company.id&&norm(b.brand_name)===norm(row.brand_name))||null
     if(!brand)warnings.push('New brand will be created')
    }else if(row.brand_name&&!company)warnings.push('Brand will be created after the new company')
    if(!row.company_name&&!row.division_name&&!row.brand_name)issues.push('Row contains no catalog data')
    const key=[norm(row.company_name),norm(row.division_name),norm(row.brand_name)].join('|')
    if(seen.has(key))issues.push('Duplicate row in upload')
    seen.add(key)
    results.push({rowNumber:i+2,row,company,division,brand,issues,warnings})
   })
   return results
  })
 }

 async function handleCatalogImport(e){
  const f=e.target.files?.[0];e.target.value=''
  if(!f)return
  setCatalogBusy(true);setError('');setMessage('');setCatalogPreview(null);setCatalogValidation(null)
  try{
   if(!f.name.toLowerCase().endsWith('.csv'))throw new Error('Please select a .csv file.')
   const rows=parseCatalogCsv(await f.text())
   if(!rows.length)throw new Error('The selected CSV file contains no data rows.')
   const headers=Object.keys(parseCsv(await f.text())[0]||{})
   const accepted=['company','company name','company_name','legal name','company legal name','company_legal_name','short name','company short name','company_short_name','division','division name','division_name','division code','division_code','brand','brand name','brand_name']
   const unexpected=headers.filter(h=>!accepted.includes(String(h||'').trim().toLowerCase().replace(/\\s+/g,' ')))
   setCatalogPreview({file:f.name,rows,headers,unexpected})
   setMessage('Loaded '+rows.length+' company/division/brand row(s). No database records were changed.')
  }catch(e){setError(e.message)}
  setCatalogBusy(false)
 }

 async function validateCatalogImport(){
  if(!catalogPreview?.rows?.length)return
  setCatalogBusy(true);setError('');setMessage('')
  try{
   const results=await validateCatalogRows(catalogPreview.rows)
   const blocking=results.filter(x=>x.issues.length).length
   setCatalogValidation({results,blocking,checkedAt:new Date().toISOString(),approved:false})
   setMessage(blocking?(`Validation complete: ${blocking} row(s) need correction.`):`Validation complete: ${results.length} row(s) ready for review.`)
  }catch(e){setError(e.message)}
  setCatalogBusy(false)
 }

 async function executeCatalogImport(){
  if(!catalogValidation||catalogValidation.blocking>0)return
  setCatalogBusy(true);setError('');setMessage('')
  try{
   const companyCache=new Map()
   const divisionCache=new Map()
   const brandCache=new Map()
   let createdCompanies=0,createdDivisions=0,createdBrands=0
   const norm=v=>String(v??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'')
   for(const item of catalogValidation.results){
    const row=item.row
    let company=item.company
    const companyKey=norm(row.company_name)
    if(!company){
     company=companyCache.get(companyKey)||null
     if(!company){
      const ins=await supabase.from('companies').insert({
       company_name:row.company_name,
       legal_name:row.company_legal_name||null,
       short_name:row.company_short_name||null,
       status:'active'
      }).select('id,company_name,legal_name,short_name').single()
      if(ins.error)throw new Error('Company creation failed for "'+row.company_name+'": '+ins.error.message)
      company=ins.data;companyCache.set(companyKey,company);createdCompanies++
     }
    }
    if(row.division_name){
     const dKey=company.id+'|'+norm(row.division_name)
     let division=item.division||divisionCache.get(dKey)||null
     if(!division){
      const ins=await supabase.from('divisions').insert({
       company_id:company.id,
       division_name:row.division_name,
       division_code:row.division_code||null
      }).select('id,company_id,division_name,division_code').single()
      if(ins.error)throw new Error('Division creation failed for "'+row.division_name+'": '+ins.error.message)
      division=ins.data;divisionCache.set(dKey,division);createdDivisions++
     }
    }
    if(row.brand_name){
     const bKey=company.id+'|'+norm(row.brand_name)
     let brand=item.brand||brandCache.get(bKey)||null
     if(!brand){
      const ins=await supabase.from('brands').insert({
       company_id:company.id,
       division_id:divisionCache.get(company.id+'|'+norm(row.division_name))?.id||item.division?.id||null,
       brand_name:row.brand_name,
       status:'active'
      }).select('id,company_id,division_id,brand_name').single()
      if(ins.error)throw new Error('Brand creation failed for "'+row.brand_name+'": '+ins.error.message)
      brand=ins.data;brandCache.set(bKey,brand);createdBrands++
     }
    }
   }
   setCatalogValidation(v=>({...v,approved:true,importedAt:new Date().toISOString(),importResult:{createdCompanies,createdDivisions,createdBrands}}))
   setMessage(`Catalog import completed: ${createdCompanies} company(ies), ${createdDivisions} division(s), ${createdBrands} brand(s) created.`)
  }catch(e){setError(e.message)}
  setCatalogBusy(false)
 }

 function downloadCatalogSample(){
  const rows=[
   {company_name:'Procter & Gamble',company_legal_name:'',company_short_name:'P&G',division_name:'Health Care',division_code:'HC',brand_name:'Vicks'},
   {company_name:'Procter & Gamble',company_legal_name:'',company_short_name:'P&G',division_name:'Health Care',division_code:'HC',brand_name:'Head & Shoulders'},
   {company_name:'MSD Pharmaceuticals Private Limited',company_legal_name:'',company_short_name:'MSD',division_name:'',division_code:'',brand_name:'Janumet'},
   {company_name:'Aristo Pharmaceuticals Private Limited',company_legal_name:'',company_short_name:'Aristo',division_name:'',division_code:'',brand_name:''}
  ]
  downloadCsv(rows,'kutchpharmaconnect-company-catalog-sample.csv')
 }

 function downloadImportSample(){
  const stamp='kutchpharmaconnect-distributorship-import-sample'
  downloadCsv(sampleRows,stamp+'.csv')
 }

 async function handleImport(e){
  const f=e.target.files?.[0];e.target.value=''
  if(!f)return
  setBusy('import');setError('');setMessage('');setPreview(null)
  try{
   if(!f.name.toLowerCase().endsWith('.csv'))throw new Error('Please select a .csv file.')
   const rows=parseCsv(await f.text())
   if(!rows.length)throw new Error('The selected CSV file contains no data rows.')
   const headers=Object.keys(rows[0])
   const missing=importHeaders.filter(h=>!headers.includes(h))
   const recognized=Object.keys(rows[0]).filter(h=>importHeaders.includes(h))
   setPreview({file:f.name,format:'csv',rows,headers,missing,recognized})
   setMessage('Loaded '+rows.length+' row(s) from '+f.name+'. No database records were changed.')
  }catch(e){setError(e.message)}
  setBusy('')
 }

 return <div className="admin-page">
  <div className="admin-head"><div>
   <button className="admin-back" onClick={onBack}><ArrowLeft size={15}/> Dashboard</button>
   <p className="section-kicker">DATA TOOLS</p><h1>Import, Export & Backup</h1>
   <p>Use CSV for directory data. Imports are previewed before any production write.</p>
  </div></div>
  {error&&<div className="admin-error">{error}</div>}
  {message&&<div className="admin-note admin-message">{message}</div>}

  <div className="admin-tool-grid">
   <section className="admin-panel">
    <p className="section-kicker">BACKUP</p><h2>Full database export</h2>
    <p className="admin-help">CSV exports are available for directory tables. JSON remains available as a machine-readable backup.</p>
    <div className="admin-inline-actions">
     <button className="admin-tool-button" onClick={()=>exportAll('json')} disabled={!!busy}><FileJson size={16}/>{busy==='alljson'?<><LoaderCircle className="spin" size={16}/> Exporting…</>:'Download full JSON backup'}</button>
    </div>
   </section>

   <section className="admin-panel">
    <p className="section-kicker">EXPORT</p><h2>Individual tables</h2>
    <p className="admin-help">Export companies, distributors, divisions and other directory tables as CSV.</p>
    {tables.map(t=><div className="admin-tool-row" key={t}>
     <span>{t}</span>
     <span className="admin-inline-actions"><button onClick={()=>exportTable(t)} disabled={!!busy} title="CSV"><Download size={14}/></button></span>
    </div>)}
   </section>

   <section className="admin-panel">
    <p className="section-kicker">IMPORT</p><h2>Controlled import</h2>
    <p className="admin-help">CSV files are supported. The file is parsed and shown for review; nothing is written automatically.</p>
    <input ref={fileRef} type="file" accept=".csv" hidden onChange={handleImport}/>
    <button className="admin-tool-button" onClick={()=>fileRef.current?.click()} disabled={!!busy}><Upload size={16}/>{busy==='import'?<><LoaderCircle className="spin" size={16}/> Reading…</>:'Select CSV file'}</button>
   </section>

   <section className="admin-panel" style={{gridColumn:'1 / -1'}}>
    <p className="section-kicker">COMPANY DATABASE</p>
    <h2>Upload Companies + Divisions + Brands</h2>
    <p className="admin-help"><strong>This is the simple upload you should use for company master data.</strong> It does not ask for distributors, categories, locations, prices or products.</p>
    <div className="admin-note" style={{margin:'10px 0'}}>
     <strong>Only 3 columns are needed:</strong> Company &nbsp; | &nbsp; Division &nbsp; | &nbsp; Brand
     <br/>Use <strong>one row for each combination</strong>. Repeat the company name when it has multiple divisions or brands.
     <br/>If something does not apply, leave that cell blank.
    </div>
    <div style={{overflowX:'auto',margin:'10px 0 14px'}}>
     <table className="admin-table"><thead><tr><th>Company</th><th>Division</th><th>Brand</th><th>What it means</th></tr></thead>
      <tbody>
       <tr><td>Procter &amp; Gamble</td><td>Health Care</td><td>Vicks</td><td>Brand belongs to this division</td></tr>
       <tr><td>Procter &amp; Gamble</td><td>Health Care</td><td>Head &amp; Shoulders</td><td>Another brand under same division</td></tr>
       <tr><td>MSD Pharmaceuticals</td><td></td><td>Janumet</td><td>Brand directly under company</td></tr>
       <tr><td>Aristo Pharmaceuticals</td><td></td><td></td><td>Company only</td></tr>
      </tbody>
     </table>
    </div>
    <p className="admin-help">Best workflow: <strong>Download Easy Template → fill the 3 columns → save as CSV → Upload Company List → Validate → Confirm &amp; Import.</strong></p>
    <input ref={catalogFileRef} type="file" accept=".csv" hidden onChange={handleCatalogImport}/>
    <div className="admin-inline-actions">
     <button className="admin-tool-button" onClick={downloadCatalogSample} disabled={catalogBusy}><Download size={16}/> Download Easy Template</button>
     <button className="admin-tool-button" onClick={()=>catalogFileRef.current?.click()} disabled={catalogBusy}><Upload size={16}/>{catalogBusy?'Reading…':'Upload Company List (CSV)'}</button>
    </div>
   </section>

   <section className="admin-panel">
    <p className="section-kicker">SAMPLE FILES</p><h2>Distributorship import sample</h2>
    <p className="admin-help">Use these samples as the standard import structure for distributor ↔ company relationships.</p>
    <div className="admin-inline-actions">
     <button className="admin-tool-button" onClick={downloadImportSample}><Download size={16}/> Sample CSV</button>
    </div>
   </section>
  </div>

  {catalogPreview&&<section className="admin-panel" style={{marginTop:16}}>
   <div className="admin-inline-actions" style={{justifyContent:'space-between'}}>
    <div><p className="section-kicker">COMPANY CATALOG PREVIEW</p><h2>{catalogPreview.file}</h2></div>
    <div className="admin-inline-actions"><button className="admin-tool-button" onClick={validateCatalogImport} disabled={catalogBusy}>Validate catalog</button><button className="admin-tool-button" onClick={()=>{setCatalogPreview(null);setCatalogValidation(null)}}>Close</button></div>
   </div>
   <p className="admin-help">{catalogPreview.rows.length} row(s). The upload uses the simple columns <strong>Company, Division, Brand</strong>. Extra legacy company fields are optional and will be ignored unless supplied.</p>
   {catalogPreview.unexpected.length>0&&<div className="admin-error">Unknown columns: {catalogPreview.unexpected.join(', ')}. They will be ignored.</div>}
   <div style={{overflowX:'auto'}}><table className="admin-table"><thead><tr>{catalogPreview.headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{catalogPreview.rows.slice(0,20).map((row,i)=><tr key={i}>{catalogPreview.headers.map(h=><td key={h}>{String(row[h]??'')}</td>)}</tr>)}</tbody></table></div>
   {catalogPreview.rows.length>20&&<p className="admin-help">Showing first 20 rows only.</p>}
   {catalogValidation&&<div style={{marginTop:14}}>
    <p className="admin-help"><strong>{catalogValidation.results.length}</strong> rows checked · <strong>{catalogValidation.blocking}</strong> blocking</p>
    <div style={{overflowX:'auto'}}><table className="admin-table"><thead><tr><th>Row</th><th>Company</th><th>Division</th><th>Brand</th><th>Result</th><th>Details</th></tr></thead><tbody>{catalogValidation.results.map(x=><tr key={x.rowNumber}><td>{x.rowNumber}</td><td>{x.row.company_name||'—'}</td><td>{x.row.division_name||'—'}</td><td>{x.row.brand_name||'—'}</td><td>{x.issues.length?'BLOCKED':x.warnings.length?'WARNING':'READY'}</td><td>{[...x.issues,...x.warnings].join(' · ')||'Passed validation'}</td></tr>)}</tbody></table></div>
    {catalogValidation.blocking===0&&!catalogValidation.approved&&<button className="report-submit" style={{marginTop:12}} onClick={executeCatalogImport} disabled={catalogBusy}>{catalogBusy?'Importing…':'Confirm & Import Company Catalog'}</button>}
    {catalogValidation.approved&&<div className="admin-message" style={{marginTop:12}}>Imported at {new Date(catalogValidation.importedAt).toLocaleString()}. {catalogValidation.importResult.createdCompanies} company(ies), {catalogValidation.importResult.createdDivisions} division(s), {catalogValidation.importResult.createdBrands} brand(s) created.</div>}
   </div>}
  </section>}

  {preview&&<section className="admin-panel" style={{marginTop:16}}>
   <div className="admin-inline-actions" style={{justifyContent:'space-between'}}>
    <div><p className="section-kicker">IMPORT PREVIEW</p><h2>{preview.file}</h2></div>
    <div className="admin-inline-actions"><button className="admin-tool-button" onClick={validateImport} disabled={!!busy}><Eye size={16}/>{busy==='validate'?<><LoaderCircle className="spin" size={16}/> Validating…</>:'Validate import'}</button><button className="admin-tool-button" onClick={()=>{setPreview(null);setValidation(null)}}>Close</button></div>
   </div>
   <p className="admin-help">{preview.rows.length} row(s), {preview.recognized.length} recognized standard column(s). {preview.missing.length?`Missing expected columns: ${preview.missing.join(', ')}.`:'All standard import columns are present.'}</p>
   <div style={{overflowX:'auto'}}>
    <table className="admin-table"><thead><tr>{preview.headers.map(h=><th key={h}>{h}</th>)}</tr></thead>
    <tbody>{preview.rows.slice(0,20).map((row,i)=><tr key={i}>{preview.headers.map(h=><td key={h}>{String(row[h]??'')}</td>)}</tr>)}</tbody></table>
   </div>
   {preview.rows.length>20&&<p className="admin-help">Showing first 20 rows only in the preview.</p>}
   {validation&&<div style={{marginTop:14}}>
    <p className="admin-help"><strong>{validation.results.length}</strong> rows checked · <strong>{validation.blocking}</strong> blocking · <strong>{validation.warnings}</strong> warnings</p>
    <div style={{overflowX:'auto'}}><table className="admin-table"><thead><tr><th>Row</th><th>Distributor</th><th>Company</th><th>Result</th><th>Details</th></tr></thead>
    <tbody>{validation.results.map(x=><tr key={x.rowNumber}><td>{x.rowNumber}</td><td>{x.row.distributor_name||'—'}</td><td>{x.row.company_name||'—'}</td><td>{x.issues.length?'BLOCKED':x.warnings.length?'WARNING':'READY'}</td><td>{[...x.issues,...x.warnings].join(' · ')||'Passed validation'}</td></tr>)}</tbody></table></div>
    {validation.blocking===0&&(()=>{
      const plan=buildImportPlan()
      if(!plan)return null
      return <div style={{marginTop:14}}>
       <div className="admin-note">
        <strong>Production change plan</strong><br/>
        {plan.newRelationships} new relationship(s) will be created · {plan.newDistributors.length} new distributor(s) will be created · {plan.existing.length} existing relationship(s) will be skipped.
        <br/><span className="admin-help">Company identities are never created automatically. Existing relationships are not overwritten by import.</span>
       </div>
       {!validation.approved&&<button className="report-submit" style={{marginTop:12}} onClick={executeImport} disabled={!!busy}>
        {busy==='import-approved'?<><LoaderCircle className="spin" size={16}/> Importing…</>:<>Confirm & Import Approved Data</>}
       </button>}
       {validation.approved&&<div className="admin-message" style={{marginTop:12}}>
        Import completed at {new Date(validation.importedAt).toLocaleString()}.
        <br/>{validation.importResult.createdRelationships} relationship(s) created · {validation.importResult.createdDistributors} distributor(s) created · {validation.importResult.skippedExisting} existing relationship(s) skipped.
       </div>}
      </div>
    })()}
   </div>}
  </section>}
 </div>
}
