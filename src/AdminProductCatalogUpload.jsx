import React, { useMemo, useRef, useState } from 'react'
import { ArrowLeft, Upload, Download, LoaderCircle, CheckCircle2, AlertTriangle, FileUp } from 'lucide-react'
import { supabase } from './lib/supabase'

const BATCH_SIZE = 200
const REQUIRED = ['product_name', 'company_name']
const TEMPLATE = [
  ['product_name','company_name','division_name','brand_name','generic_name','strength','dosage_form','pack_size'],
  ['Example Tablet 10mg','Example Pharma Ltd','General','','Example ingredient','10mg','Tablet','10 x 10']
]
const norm = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
const clean = value => String(value ?? '').trim()

function parseCsv(text) {
  const rows=[]; let row=[], cell='', quoted=false
  const input=String(text||'').replace(/^\uFEFF/,'')
  for(let i=0;i<input.length;i++){
    const ch=input[i], next=input[i+1]
    if(ch==='"' && quoted && next==='"'){cell+='"';i++;continue}
    if(ch==='"'){quoted=!quoted;continue}
    if(!quoted && ch===','){row.push(cell.trim());cell='';continue}
    if(!quoted && (ch==='\n'||ch==='\r')){
      if(ch==='\r'&&next==='\n')i++
      row.push(cell.trim());cell=''
      if(row.some(Boolean))rows.push(row)
      row=[];continue
    }
    cell+=ch
  }
  row.push(cell.trim());if(row.some(Boolean))rows.push(row)
  if(!rows.length)return []
  const headers=rows[0].map(x=>x.toLowerCase().trim().replace(/[\s-]+/g,'_'))
  return rows.slice(1).map((values,index)=>{
    const out={_row:index+2}
    headers.forEach((h,i)=>out[h]=values[i]??'')
    return out
  }).filter(r=>Object.keys(r).some(k=>k!=='_row'&&clean(r[k])))
}
function downloadTemplate(){
  const csv=TEMPLATE.map(row=>row.map(v=>/[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v).join(',')).join('\r\n')
  const url=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}))
  const a=document.createElement('a');a.href=url;a.download='KPC_Product_Catalogue_Template.csv';a.click();URL.revokeObjectURL(url)
}
async function fetchAll(table,columns){
  const out=[];let from=0
  while(true){
    const {data,error}=await supabase.from(table).select(columns).range(from,from+999)
    if(error)throw new Error(error.message)
    out.push(...(data||[]));if(!data||data.length<1000)break;from+=1000
  }
  return out
}

export default function AdminProductCatalogUpload({onBack}){
  const fileRef=useRef(null)
  const [fileName,setFileName]=useState('')
  const [rows,setRows]=useState([])
  const [prepared,setPrepared]=useState(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [status,setStatus]=useState('')
  const [progress,setProgress]=useState({done:0,total:0})
  const [summary,setSummary]=useState(null)

  const preview=useMemo(()=>rows.slice(0,12),[rows])
  async function readFile(file){
    setError('');setStatus('');setSummary(null);setPrepared(null)
    try{
      if(!file.name.toLowerCase().endsWith('.csv')&&!file.name.toLowerCase().endsWith('.txt'))throw new Error('Please use CSV format. Save your Excel workbook as CSV first.')
      const parsed=parseCsv(await file.text())
      if(!parsed.length)throw new Error('No product rows found in this file.')
      const headers=Object.keys(parsed[0]).filter(x=>x!=='_row')
      const missing=REQUIRED.filter(x=>!headers.includes(x))
      if(missing.length)throw new Error('Missing required columns: '+missing.join(', ')+'. Required: product_name, company_name.')
      setRows(parsed);setFileName(file.name)
      setStatus(parsed.length.toLocaleString()+' rows loaded. No database records have been changed.')
    }catch(e){setError(e.message)}
  }
  async function prepare(){
    setBusy(true);setError('');setStatus('Matching companies, divisions and existing products…');setPrepared(null);setSummary(null)
    try{
      const [companies,divisions,products]=await Promise.all([
        fetchAll('companies','id,company_name,legal_name,short_name,status'),
        fetchAll('divisions','id,company_id,division_name,status'),
        fetchAll('products','id,product_name,normalized_product_name,company_id,division_id,status')
      ])
      const companyMap=new Map()
      companies.filter(x=>x.status==='active').forEach(x=>[x.company_name,x.legal_name,x.short_name].forEach(v=>{if(norm(v))companyMap.set(norm(v),x)}))
      const divisionMap=new Map()
      divisions.filter(x=>x.status==='active').forEach(x=>divisionMap.set(x.company_id+'|'+norm(x.division_name),x))
      const existing=new Set(products.filter(x=>x.status==='active').map(x=>x.company_id+'|'+(x.normalized_product_name||norm(x.product_name))))
      const seen=new Set()
      const checked=rows.map(r=>{
        const company=companyMap.get(norm(r.company_name))
        const division=company&&clean(r.division_name)?divisionMap.get(company.id+'|'+norm(r.division_name)):null
        const product=clean(r.product_name)
        const key=company?company.id+'|'+norm(product):''
        const duplicate=!!(key&&(existing.has(key)||seen.has(key)))
        if(key)seen.add(key)
        const issues=[]
        if(!product)issues.push('Product name missing')
        if(!company)issues.push('Company not matched')
        if(clean(r.division_name)&&company&&!division)issues.push('Division not found under matched company')
        if(duplicate)issues.push('Duplicate product for this company')
        return {...r,_company:company||null,_division:division||null,_issues:issues,_duplicate:duplicate}
      })
      const ready=checked.filter(x=>x._company&&!x._issues.length)
      setPrepared({checked,ready,blocked:checked.length-ready.length,duplicates:checked.filter(x=>x._duplicate).length,unmatched:checked.filter(x=>!x._company).length})
      setStatus('Validation complete. Review the summary before importing.')
    }catch(e){setError(e.message);setStatus('')}
    setBusy(false)
  }
  async function importReady(){
    if(!prepared?.ready.length||busy)return
    setBusy(true);setError('');setStatus('Importing products in batches…')
    const batches=[]
    for(let i=0;i<prepared.ready.length;i+=BATCH_SIZE)batches.push(prepared.ready.slice(i,i+BATCH_SIZE))
    setProgress({done:0,total:batches.length})
    let inserted=0
    try{
      for(let i=0;i<batches.length;i++){
        const payload=batches[i].map(r=>({
          product_name:clean(r.product_name),
          normalized_product_name:norm(r.product_name),
          company_id:r._company.id,
          division_id:r._division?.id||null,
          brand_id:null,
          generic_name:clean(r.generic_name)||null,
          strength:clean(r.strength)||null,
          dosage_form:clean(r.dosage_form)||null,
          pack_size:clean(r.pack_size)||null,
          status:'active'
        }))
        const {error:insertError}=await supabase.from('products').insert(payload)
        if(insertError)throw new Error('Batch '+(i+1)+' of '+batches.length+' failed: '+insertError.message+'; '+inserted+' rows were inserted in earlier batches.')
        inserted+=payload.length;setProgress({done:i+1,total:batches.length})
      }
      setSummary({inserted,blocked:prepared.blocked,duplicates:prepared.duplicates})
      setStatus('Import finished. '+inserted.toLocaleString()+' products inserted. Verify the live catalogue before treating this as complete.')
    }catch(e){setError(e.message)}
    setBusy(false)
  }

  return <div className="admin-page">
    <div className="admin-head"><div>
      <button className="admin-back" onClick={onBack}><ArrowLeft size={15}/> Data Workspace</button>
      <p className="section-kicker">PRODUCT MASTER</p><h1>Bulk Product Upload</h1>
      <p>Upload large product lists and link each product to an existing company and division.</p>
    </div></div>
    {error&&<div className="admin-error"><AlertTriangle size={16}/> {error}</div>}
    {status&&<div className="admin-note" style={{marginBottom:14}}>{status}</div>}
    <section className="admin-panel" style={{marginBottom:14}}>
      <div className="admin-panel-heading"><div><p className="section-kicker">STEP 1 · FILE</p><h2>Prepare product CSV</h2><p>One product per row. Company and product name are required. Division and other product details are optional.</p></div><FileUp size={20}/></div>
      <div className="admin-note"><strong>Columns:</strong> product_name · company_name · division_name · brand_name · generic_name · strength · dosage_form · pack_size</div>
      <div className="admin-inline-actions" style={{marginTop:12}}>
        <button className="admin-tool-button" onClick={downloadTemplate}><Download size={16}/> Download product template</button>
        <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" hidden onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)readFile(f)}}/>
        <button className="admin-tool-button" onClick={()=>fileRef.current?.click()} disabled={busy}><Upload size={16}/> Choose CSV file</button>
      </div>
      {fileName&&<p className="admin-help" style={{marginTop:10}}>Loaded: <strong>{fileName}</strong> · {rows.length.toLocaleString()} rows</p>}
    </section>
    {rows.length>0&&<section className="admin-panel" style={{marginBottom:14}}>
      <div className="admin-panel-heading"><div><p className="section-kicker">STEP 2 · VALIDATE</p><h2>Check product matches</h2><p>Existing company and division names are matched before any product is written.</p></div><CheckCircle2 size={20}/></div>
      <div style={{overflowX:'auto'}}><table className="admin-table"><thead><tr><th>Product</th><th>Company</th><th>Division</th><th>Result</th></tr></thead><tbody>
        {preview.map(r=><tr key={r._row}><td>{r.product_name||'—'}</td><td>{r.company_name||'—'}</td><td>{r.division_name||'—'}</td><td>{prepared?(r._issues.length?r._issues.join('; '):'Ready'):'Not checked'}</td></tr>)}
      </tbody></table></div>
      {rows.length>12&&<p className="admin-help">Showing 12 of {rows.length.toLocaleString()} rows. All rows are validated, not only those shown.</p>}
      <button className="admin-tool-button" style={{marginTop:12}} onClick={prepare} disabled={busy}><CheckCircle2 size={16}/>{busy?'Checking…':'Validate all rows'}</button>
      {prepared&&<div className="admin-note" style={{marginTop:14}}>
        <strong>Validation summary</strong><br/>
        {prepared.checked.length.toLocaleString()} total · {prepared.ready.length.toLocaleString()} ready · {prepared.blocked.toLocaleString()} blocked · {prepared.duplicates.toLocaleString()} duplicates · {prepared.unmatched.toLocaleString()} unmatched companies
        <p className="admin-help">Blocked rows are not imported. Existing products are skipped. Products with blank division remain linked to the company only.</p>
        <button className="report-submit" style={{marginTop:10}} onClick={importReady} disabled={busy||!prepared.ready.length}><Upload size={16}/> {busy?'Importing…':'Import '+prepared.ready.length.toLocaleString()+' valid products'}</button>
        {busy&&progress.total>0&&<p className="admin-help">Batch {progress.done} of {progress.total} completed · {BATCH_SIZE} rows maximum per batch</p>}
      </div>}
      {summary&&<div className="report-success" style={{marginTop:14}}><CheckCircle2 size={32}/><h2>Upload completed</h2><p>{summary.inserted.toLocaleString()} products inserted. {summary.blocked} rows blocked by validation.</p></div>}
    </section>}
  </div>
}
