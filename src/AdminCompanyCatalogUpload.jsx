import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, Download, FileUp, LoaderCircle, Upload, XCircle, Trash2 } from 'lucide-react'
import { supabase } from './lib/supabase'
import { findCompanyCandidates } from './lib/companyMatching'

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
  const [previewPage, setPreviewPage] = useState(1)
  const [companyRecords, setCompanyRecords] = useState([])
  const [companyAliases, setCompanyAliases] = useState([])
  const [matchingLoadError, setMatchingLoadError] = useState('')
  const [matchingDataReady, setMatchingDataReady] = useState(false)
  const pageSize = 50
  const pageStart = (previewPage - 1) * pageSize
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const visibleRows = rows.slice(pageStart, pageStart + pageSize)

  const validRows = useMemo(() => rows.filter(r => String(r.company_name || '').trim()), [rows])
  useEffect(() => {
    let active = true
    async function loadCompanyMatchData() {
      const [companiesResult, aliasesResult] = await Promise.all([
        supabase.from('companies').select('id,company_name,legal_name,short_name,status').order('company_name'),
        supabase.from('search_aliases').select('entity_id,entity_type,alias,normalized_alias').eq('entity_type','company')
      ])
      if (!active) return
      if (companiesResult.error) setMatchingLoadError('Could not load the company master for duplicate checking: ' + companiesResult.error.message)
      else setCompanyRecords(companiesResult.data || [])
      if (aliasesResult.error) {
        // Company names remain searchable if aliases are unavailable.
        setCompanyAliases([])
      } else setCompanyAliases(aliasesResult.data || [])
      setMatchingDataReady(!companiesResult.error)
    }
    loadCompanyMatchData()
    return () => { active = false }
  }, [])
  const rowMatches = useMemo(() => rows.map(row => findCompanyCandidates(row.company_name, companyRecords, companyAliases, 0.56)), [rows, companyRecords, companyAliases])
  const unresolvedMatches = validRows.filter(row => {
    const index = rows.indexOf(row)
    return (rowMatches[index] || []).length > 0 && !row._matchDecision
  })

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
    setPreviewPage(1)
    setSourceName(name)
    setError('')
    setResult(null)
  }

  function updateRow(index, field, value) {
    setRows(current => current.map((row, i) => i === index ? { ...row, [field]: value } : row))
    setResult(null)
  }

  function removeRow(index) {
    setRows(current => current.filter((_, i) => i !== index))
    setPreviewPage(currentPage => Math.min(currentPage, Math.max(1, Math.ceil((rows.length - 1) / pageSize))))
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
    if (!matchingDataReady) { setError('Company matching is not ready yet. Wait for the company master to load before importing.'); return }
    if (unresolvedMatches.length) { setError('Review the suggested existing-company matches first. Choose Use Existing or Keep as New for every flagged row.'); return }
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
          <button className="admin-back" onClick={onBack}><ArrowLeft size={15}/> Data Workspace</button>
          <p className="section-kicker">COMPANY CATALOG</p>
          <h1>Bulk Upload</h1>
          <p>Add companies, divisions and brands from one simple spreadsheet.</p>
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}
      {matchingLoadError && <div className="admin-error">{matchingLoadError}</div>}

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
          <button className="admin-refresh" type="button" onClick={() => { setRows([]); setPreviewPage(1); setSourceName(''); setResult(null); setError('') }}>
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
              <p>{validRows.length} usable rows. Review any possible company matches before importing. Existing companies, divisions and brands will be reused when their names match.</p>
            </div>
            <CheckCircle2 size={20}/>
          </div>
          <div className="admin-catalog-rows">
            {visibleRows.map((r, index) => {
              const rowIndex = pageStart + index
              return (
                <div className="admin-catalog-row" key={r._row ?? rowIndex}>
                  <div className="admin-catalog-row-head">
                    <span>Row {r._row ?? rowIndex + 1}</span>
                    <button type="button" className="admin-catalog-remove" onClick={() => removeRow(rowIndex)} aria-label={`Remove row ${r._row ?? rowIndex + 1}`}>
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                  <label>Company Name
                    <input value={r.company_name} onChange={e => updateRow(rowIndex, 'company_name', e.target.value)} placeholder="Company name" />
                  </label>
                  <label>Division <span className="admin-catalog-optional">optional</span>
                    <input value={r.division_name} onChange={e => updateRow(rowIndex, 'division_name', e.target.value)} placeholder="Division name" />
                  </label>
                  {((rowMatches[rowIndex] || []).length > 0) && (
                    <div className="admin-note" style={{marginTop:'10px'}}>
                      <strong>Possible existing company match</strong>
                      <p style={{margin:'6px 0'}}>Choose an existing record if this is the same company, or explicitly keep the submitted name as a new company.</p>
                      {(rowMatches[rowIndex] || []).map(({company,score,exact}) => (
                        <div key={company.id} style={{display:'flex',gap:'8px',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',padding:'7px 0'}}>
                          <span><strong>{company.company_name}</strong><small style={{display:'block'}}>{exact ? 'Normalized name match' : 'Possible name match'} · {Math.round(score*100)}% similarity</small></span>
                          <button type="button" className="admin-refresh" onClick={() => {
                            setRows(current => current.map((item,i) => i===rowIndex ? {...item,company_name:company.company_name,_matchDecision:'existing',_matchedCompanyId:company.id} : item))
                            setError('')
                          }}>Use Existing</button>
                        </div>
                      ))}
                      <button type="button" className="admin-refresh" onClick={() => {
                        setRows(current => current.map((item,i) => i===rowIndex ? {...item,_matchDecision:'new',_matchedCompanyId:''} : item))
                        setError('')
                      }}>Keep as New Company</button>
                      {r._matchDecision === 'existing' && <p style={{marginTop:'6px'}}>Using existing company: {r.company_name}</p>}
                      {r._matchDecision === 'new' && <p style={{marginTop:'6px'}}>Marked to create a separate company. Confirm the names are genuinely different.</p>}
                    </div>
                  )}
                  <label>Brand Name <span className="admin-catalog-optional">optional</span>
                    <input value={r.brand_name} onChange={e => updateRow(rowIndex, 'brand_name', e.target.value)} placeholder="Brand name" />
                  </label>
                </div>
              )
            })}
          </div>
          {rows.length > pageSize && <div className="admin-catalog-pagination">
            <button type="button" onClick={() => setPreviewPage(p => Math.max(1, p - 1))} disabled={previewPage <= 1}>Previous</button>
            <span>Page {previewPage} of {pageCount} · Rows {pageStart + 1}–{Math.min(pageStart + pageSize, rows.length)} of {rows.length}</span>
            <button type="button" onClick={() => setPreviewPage(p => Math.min(pageCount, p + 1))} disabled={previewPage >= pageCount}>Next</button>
          </div>}
          {rows.length !== validRows.length && <p className="report-help">{rows.length - validRows.length} row(s) have no company name and will be skipped. Add a company name or remove those rows.</p>}
          <button className="report-submit" type="button" onClick={importRows} disabled={!validRows.length || busy || !!result || !matchingDataReady || unresolvedMatches.length > 0} style={{marginTop:'14px'}}>
            {busy ? <><LoaderCircle className="spin" size={16}/> Importing…</> : !matchingDataReady ? <><LoaderCircle className="spin" size={16}/> Checking companies…</> : unresolvedMatches.length ? <><Upload size={16}/> Review {unresolvedMatches.length} Match(es) First</> : result ? <><CheckCircle2 size={16}/> Import completed</> : <><Upload size={16}/> Import {validRows.length} Rows</>}
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
