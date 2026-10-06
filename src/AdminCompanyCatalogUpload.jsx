import React, { useMemo, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, Download, FileUp, LoaderCircle, Upload, XCircle } from 'lucide-react'
import { supabase } from './lib/supabase'

const TEMPLATE = [
  ['Company Name', 'Division', 'Brand Name'],
  ['Zydus Lifesciences', 'Zydus Healthcare', 'Pantodac'],
  ['Zydus Lifesciences', 'Zydus Generics', 'Atorva'],
  ['Cipla', 'Cipla Pharma', 'Dytor'],
]

function parseDelimited(text) {
  const rows = []
  let row = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1]
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; continue }
    if (ch === '"') { quoted = !quoted; continue }
    if (!quoted && (ch === ',' || ch === '\t')) { row.push(cell.trim()); cell = ''; continue }
    if (!quoted && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i++
      row.push(cell.trim()); cell = ''
      if (row.some(Boolean)) rows.push(row)
      row = []
      continue
    }
    cell += ch
  }
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function toCsv(rows) {
  return rows.map(row => row.map(value => {
    const s = String(value ?? '')
    return /[",\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s
  }).join(',')).join('\n')
}

export default function AdminCompanyCatalogUpload({ onBack }) {
  const inputRef = useRef(null)
  const [rows, setRows] = useState([])
  const [sourceName, setSourceName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const validRows = useMemo(() => rows.filter(r => r.company_name), [rows])

  function loadText(text, name = '') {
    const parsed = parseDelimited(text)
    if (!parsed.length) { setError('No data found.'); return }
    const headers = parsed[0].map(x => x.toLowerCase().replace(/[^a-z0-9]+/g, '_'))
    const companyIndex = headers.findIndex(x => ['company_name','company','companyname'].includes(x))
    const divisionIndex = headers.findIndex(x => ['division','division_name','divisionname'].includes(x))
    const brandIndex = headers.findIndex(x => ['brand','brand_name','brandname'].includes(x))
    if (companyIndex < 0) {
      setError('The file must contain a Company Name column.')
      return
    }
    const mapped = parsed.slice(1).map((r, i) => ({
      _row: i + 2,
      company_name: (r[companyIndex] || '').trim(),
      division_name: divisionIndex >= 0 ? (r[divisionIndex] || '').trim() : '',
      brand_name: brandIndex >= 0 ? (r[brandIndex] || '').trim() : ''
    })).filter(r => r.company_name || r.division_name || r.brand_name)
    setRows(mapped)
    setSourceName(name)
    setError('')
    setResult(null)
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => loadText(String(reader.result || ''), file.name)
    reader.onerror = () => setError('Could not read the file.')
    reader.readAsText(file)
    e.target.value = ''
  }

  function handlePaste(e) {
    const text = e.clipboardData?.getData('text')
    if (text) {
      e.preventDefault()
      loadText(text, 'Pasted data')
    }
  }

  function downloadTemplate() {
    const blob = new Blob([toCsv(TEMPLATE)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'KutchPharmaConnect_Company_Catalog_Template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importRows() {
    if (!validRows.length || busy) return
    setBusy(true); setError(''); setResult(null)
    const { data, error: rpcError } = await supabase.rpc('admin_bulk_upsert_company_catalog', {
      p_rows: validRows.map(r => ({
        company_name: r.company_name,
        division_name: r.division_name || null,
        brand_name: r.brand_name || null
      }))
    })
    if (rpcError) {
      setError(rpcError.message)
      setBusy(false)
      return
    }
    setResult(data)
    setBusy(false)
  }

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div>
          <button className="admin-back" onClick={onBack}><ArrowLeft size={15}/> Companies</button>
          <p className="section-kicker">COMPANY CATALOG</p>
          <h1>Bulk Upload</h1>
          <p>Add companies, divisions and brands from one simple spreadsheet.</p>
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-panel" style={{marginBottom:'16px'}}>
        <div className="admin-panel-heading">
          <div>
            <p className="section-kicker">STEP 1</p>
            <h2>Prepare your file</h2>
            <p>You only need three columns. Do not enter IDs or database fields.</p>
          </div>
          <Download size={20}/>
        </div>
        <div className="admin-link" style={{cursor:'default'}}>
          <FileUp size={17}/>
          <span>
            <strong>Company Name → Division → Brand Name</strong>
            <small>Example: Zydus Lifesciences → Zydus Healthcare → Pantodac</small>
          </span>
        </div>
        <button className="report-submit" type="button" onClick={downloadTemplate} style={{marginTop:'12px'}}>
          <Download size={16}/> Download Simple Template
        </button>
      </div>

      <div className="admin-panel" style={{marginBottom:'16px'}}>
        <div className="admin-panel-heading">
          <div>
            <p className="section-kicker">STEP 2</p>
            <h2>Upload or paste</h2>
            <p>CSV files work directly. You can also copy rows from Excel and paste them below.</p>
          </div>
          <Upload size={20}/>
        </div>
        <input ref={inputRef} type="file" accept=".csv,text/csv,.txt" onChange={handleFile} hidden />
        <div style={{display:'flex',gap:'10px',flexWrap:'wrap',marginTop:'10px'}}>
          <button className="report-submit" type="button" onClick={() => inputRef.current?.click()}>
            <FileUp size={16}/> Choose CSV File
          </button>
          <button className="admin-refresh" type="button" onClick={() => { setRows([]); setSourceName(''); setResult(null); setError('') }}>
            <XCircle size={15}/> Clear
          </button>
        </div>
        <textarea
          onPaste={handlePaste}
          placeholder={'Or paste your Excel rows here...\\n\\nCompany Name\\tDivision\\tBrand Name\\nZydus Lifesciences\\tZydus Healthcare\\tPantodac'}
          rows="7"
          style={{width:'100%',marginTop:'14px'}}
        />
        {sourceName && <p className="report-help" style={{marginTop:'8px'}}>Loaded: {sourceName}</p>}
      </div>

      {rows.length > 0 && (
        <div className="admin-panel" style={{marginBottom:'16px'}}>
          <div className="admin-panel-heading">
            <div>
              <p className="section-kicker">STEP 3</p>
              <h2>Check before importing</h2>
              <p>{validRows.length} usable rows. Existing companies, divisions and brands will be reused instead of duplicated.</p>
            </div>
            <CheckCircle2 size={20}/>
          </div>
          <div style={{overflowX:'auto',marginTop:'12px'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr><th style={{textAlign:'left',padding:'8px'}}>Row</th><th style={{textAlign:'left',padding:'8px'}}>Company</th><th style={{textAlign:'left',padding:'8px'}}>Division</th><th style={{textAlign:'left',padding:'8px'}}>Brand</th></tr></thead>
              <tbody>
                {rows.slice(0, 100).map(r => (
                  <tr key={r._row}>
                    <td style={{padding:'8px'}}>{r._row}</td>
                    <td style={{padding:'8px'}}>{r.company_name || <span style={{opacity:.55}}>Missing</span>}</td>
                    <td style={{padding:'8px'}}>{r.division_name || '—'}</td>
                    <td style={{padding:'8px'}}>{r.brand_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 100 && <p className="report-help">Showing first 100 rows. All {rows.length} rows will be imported.</p>}
          <button className="report-submit" type="button" onClick={importRows} disabled={!validRows.length || busy} style={{marginTop:'14px'}}>
            {busy ? <><LoaderCircle className="spin" size={16}/> Importing…</> : <><Upload size={16}/> Import {validRows.length} Rows</>}
          </button>
        </div>
      )}

      {result && (
        <div className="admin-panel">
          <div className="report-success">
            <CheckCircle2 size={42}/>
            <h2>Import completed</h2>
            <p>
              Companies created: <strong>{result.created_companies}</strong> ·
              Divisions created: <strong>{result.created_divisions}</strong> ·
              Brands created: <strong>{result.created_brands}</strong>
            </p>
            <p>
              Existing records reused: {result.existing_companies + result.existing_divisions + result.existing_brands}.
              {result.skipped ? ` Skipped rows: ${result.skipped}.` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
