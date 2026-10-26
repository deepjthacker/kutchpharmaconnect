import React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Building2, Edit3, LoaderCircle, Plus, Search, Save, X, Trash2 } from 'lucide-react'
import { supabase } from './lib/supabase'

const PAGE_SIZE = 500

async function loadAll(query){
  const rows=[]
  let start=0
  while(true){
    const {data,error}=await query.range(start,start+PAGE_SIZE-1)
    if(error)return {data:null,error}
    const batch=data||[]
    rows.push(...batch)
    if(batch.length<PAGE_SIZE)break
    start+=PAGE_SIZE
  }
  return {data:rows,error:null}
}

export default function AdminCompanies({ onBack, onBulkUpload }){
  const [companies,setCompanies]=useState([]),[categories,setCategories]=useState([]),[companyCategoryIds,setCompanyCategoryIds]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [categoryLoading,setCategoryLoading]=useState(false)
  const [categoryLoadError,setCategoryLoadError]=useState(false)
  const [query,setQuery]=useState('')
  const [status,setStatus]=useState('active')
  const [selected,setSelected]=useState(null)
  const [busy,setBusy]=useState(false)
  const [form,setForm]=useState({company_name:'',legal_name:'',short_name:'',description:'',status:'active'})

  async function loadCompanies(){
    setLoading(true);setError('')
    const {data,error}=await loadAll(supabase
      .from('companies')
      .select('id,company_name,legal_name,short_name,description,status,company_group_id')
      .order('company_name').order('id'))
    if(error){setError(error.message);setCompanies([]);setLoading(false);return}

    const rows=data||[]
    const [divRes,relRes,catRes]=await Promise.all([
      loadAll(supabase.from('divisions').select('company_id').eq('status','active').order('id')),
      loadAll(supabase.from('distributorships').select('company_id').eq('status','active').order('id')),
      supabase.from('categories').select('id,name').eq('status','active').order('name')
    ])
    if(divRes.error||relRes.error||catRes.error){setError((divRes.error||relRes.error||catRes.error).message);setCompanies([]);setLoading(false);return}

    const divCounts={},relCounts={}
    ;(divRes.data||[]).forEach(x=>{divCounts[x.company_id]=(divCounts[x.company_id]||0)+1})
    ;(relRes.data||[]).forEach(x=>{relCounts[x.company_id]=(relCounts[x.company_id]||0)+1})
    setCategories(catRes.data||[])
    setCompanies(rows.map(x=>({...x,division_count:divCounts[x.id]||0,relationship_count:relCounts[x.id]||0})))
    setLoading(false)
  }

  useEffect(()=>{loadCompanies()},[])

  useEffect(()=>{
    if(!selected){setCompanyCategoryIds([]);setCategoryLoading(false);setCategoryLoadError(false);return}
    let active=true
    setCategoryLoading(true);setCategoryLoadError(false)
    supabase.from('company_categories').select('category_id').eq('company_id',selected.id).then(({data,error})=>{
      if(!active)return
      if(error){setCategoryLoadError(true);setError(error.message)}
      else setCompanyCategoryIds((data||[]).map(x=>x.category_id))
      setCategoryLoading(false)
    })
    return()=>{active=false}
  },[selected])

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase()
    return companies.filter(x=>{
      const statusMatch=status==='all'||x.status===status
      const textMatch=!q||[x.company_name,x.legal_name,x.short_name].filter(Boolean).some(v=>v.toLowerCase().includes(q))
      return statusMatch&&textMatch
    })
  },[companies,query,status])

  function openEdit(company){
    setSelected(company)
    setForm({
      company_name:company.company_name||'',
      legal_name:company.legal_name||'',
      short_name:company.short_name||'',
      description:company.description||'',
      status:company.status||'active'
    })
  }

  function closeEdit(){if(!busy){setSelected(null)}}

  async function removeCompany(){
    if(!selected||busy)return
    const ok=window.confirm('Permanently delete this company and its distributorship relationships, divisions, aliases, and product records? This is for test, duplicate, or incorrect records only. This cannot be undone.')
    if(!ok)return
    setBusy(true);setError('')
    const r=await supabase.rpc('admin_delete_company',{p_company_id:selected.id})
    if(r.error){setError(r.error.message);setBusy(false);return}
    setCompanies(prev=>prev.filter(x=>x.id!==selected.id))
    setSelected(null);setBusy(false)
  }

  async function saveCompany(e){
    e.preventDefault()
    if(!form.company_name.trim()||categoryLoading||categoryLoadError)return
    setBusy(true);setError('')
    const {data,error}=await supabase
      .from('companies')
      .update({
        company_name:form.company_name.trim(),
        legal_name:form.legal_name.trim()||null,
        short_name:form.short_name.trim()||null,
        description:form.description.trim()||null,
        status:form.status
      })
      .eq('id',selected.id)
      .select('id,company_name,legal_name,short_name,description,status,company_group_id')
      .single()

    if(error){setError(error.message);setBusy(false);return}
    const desired=new Set(companyCategoryIds)
    const current=await supabase.from('company_categories').select('category_id').eq('company_id',selected.id)
    if(current.error){setError(current.error.message);setBusy(false);return}
    const currentIds=new Set((current.data||[]).map(x=>x.category_id))
    const add=[...desired].filter(id=>!currentIds.has(id)).map(category_id=>({company_id:selected.id,category_id}))
    const remove=[...currentIds].filter(id=>!desired.has(id))
    if(add.length){const ar=await supabase.from('company_categories').insert(add);if(ar.error){setError(ar.error.message);setBusy(false);return}}
    if(remove.length){const rr=await supabase.from('company_categories').delete().eq('company_id',selected.id).in('category_id',remove);if(rr.error){setError(rr.error.message);setBusy(false);return}}
    setCompanies(prev=>prev.map(x=>x.id===data.id?{...x,...data}:x))
    setSelected(null);setBusy(false)
  }

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div>
          <button className="admin-back" onClick={onBack}><ArrowLeft size={15}/> Dashboard</button>
          <p className="section-kicker">ADMINISTRATION</p>
          <h1>Companies</h1>
          <p>Manage company identities used throughout the directory.</p>
        </div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          <button className="admin-refresh" onClick={onBulkUpload}><Plus size={15}/> Bulk Upload</button>
          <button className="admin-refresh" onClick={loadCompanies} disabled={loading}>
            <LoaderCircle className={loading?'spin':''} size={15}/> Refresh
          </button>
        </div>
      </div>

      {error&&<div className="admin-error">{error}</div>}

      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={16}/>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search company, legal name, short name..." />
        </div>
        <div className="admin-filters">
          {['active','inactive','all'].map(x=><button key={x} className={status===x?'selected':''} onClick={()=>setStatus(x)}>{x==='all'?'All':x==='active'?'Active':'Inactive'}</button>)}
        </div>
      </div>

      <div className="admin-list-head">
        <strong>{filtered.length}</strong> companies shown
      </div>

      {loading ? <div className="admin-state"><LoaderCircle className="spin" size={20}/> Loading companies…</div> :
        filtered.length ? (
          <div className="admin-company-list">
            {filtered.map(company=>(
              <button className="admin-company-card" key={company.id} onClick={()=>openEdit(company)}>
                <span className="admin-company-icon"><Building2 size={18}/></span>
                <span className="admin-company-copy">
                  <strong>{company.company_name}</strong>
                  {company.short_name&&<span>{company.short_name}</span>}
                  <small>{company.division_count} {company.division_count===1?'division':'divisions'} • {company.relationship_count} active {company.relationship_count===1?'relationship':'relationships'}</small>
                </span>
                <span className={`admin-company-status ${company.status}`}>{company.status}</span>
                <Edit3 size={15}/>
              </button>
            ))}
          </div>
        ) : <div className="result-state">No companies match the current filters.</div>}

      {selected&&<div className="report-overlay" onMouseDown={e=>e.target===e.currentTarget&&closeEdit()}>
        <div className="report-modal admin-edit-modal">
          <button className="report-close" onClick={closeEdit} aria-label="Close"><X size={18}/></button>
          <p className="section-kicker">COMPANY RECORD</p>
          <h2>Edit Company</h2>
          <p className="report-help">Update the company identity only. Distributorship verification is managed separately.</p>
          <form onSubmit={saveCompany}>
            <label>Company name <span className="required">*</span>
              <input required value={form.company_name} onChange={e=>setForm({...form,company_name:e.target.value})}/>
            </label>
            <label>Legal name
              <input value={form.legal_name} onChange={e=>setForm({...form,legal_name:e.target.value})}/>
            </label>
            <label>Short name
              <input value={form.short_name} onChange={e=>setForm({...form,short_name:e.target.value})}/>
            </label>
            <label>Description
              <textarea rows="3" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
            </label>
            <label>Status
              <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <fieldset className="admin-category-checks" disabled={categoryLoading||categoryLoadError}>
              <legend>Directory categories</legend>
              {categoryLoading?<p>Loading category assignments…</p>:categoryLoadError?<p>Could not load assignments. Refresh the company record before saving.</p>:<div>{categories.map(category=><label key={category.id}><input type="checkbox" checked={companyCategoryIds.includes(category.id)} onChange={e=>setCompanyCategoryIds(current=>e.target.checked?[...new Set([...current,category.id])]:current.filter(id=>id!==category.id))}/>{category.name}</label>)}</div>}
            </fieldset>
            <button className="report-submit" disabled={busy||categoryLoading||categoryLoadError}>{busy?<><LoaderCircle className="spin" size={16}/> Saving…</>:<><Save size={16}/> Save Changes</>}</button>
          </form>
          <div className="admin-danger-zone">
            <strong>Permanent deletion</strong>
            <p>Use only for test, duplicate, or incorrect company records. If the company is still part of your real directory, set it to Inactive instead.</p>
            <button type="button" className="admin-delete-btn" onClick={removeCompany} disabled={busy}><Trash2 size={15}/> Delete Company Permanently</button>
          </div>
        </div>
      </div>}
    </div>
  )
}
