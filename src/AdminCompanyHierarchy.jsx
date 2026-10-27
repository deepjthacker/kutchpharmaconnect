import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Building2, GitBranch, LoaderCircle, Package, Search, Save, Tags, Truck } from 'lucide-react'
import { supabase } from './lib/supabase'
import './AdminCompanyHierarchy.css'

const PAGE_SIZE = 500

async function loadAll(query) {
  const rows = []
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await query.range(start, start + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    const page = data || []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return { data: rows, error: null }
  }
}

export default function AdminCompanyHierarchy({ onBack }) {
  const [companies, setCompanies] = useState([])
  const [divisions, setDivisions] = useState([])
  const [brands, setBrands] = useState([])
  const [products, setProducts] = useState([])
  const [distributors, setDistributors] = useState([])
  const [productLinks, setProductLinks] = useState([])
  const [linkDraft, setLinkDraft] = useState({ product_id: '', distributor_id: '', territory: '' })
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [editingId, setEditingId] = useState('')
  const [parentDraft, setParentDraft] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [productDraft, setProductDraft] = useState({ product_name: '', company_id: '', brand_id: '', generic_name: '', strength: '', dosage_form: '', pack_size: '' })

  async function load() {
    setLoading(true)
    setError('')
    const [companyResult, divisionResult, brandResult, productResult, distributorResult, productLinkResult] = await Promise.all([
      loadAll(supabase.from('companies').select('id,company_name,short_name,parent_company_id,status').eq('status', 'active').order('company_name').order('id')),
      loadAll(supabase.from('divisions').select('id,company_id,division_name').eq('status', 'active').order('division_name')),
      loadAll(supabase.from('brands').select('id,company_id,division_id,brand_name').eq('status', 'active').order('brand_name')),
      loadAll(supabase.from('products').select('id,company_id,division_id,brand_id,product_name').eq('status', 'active').order('product_name')),
      loadAll(supabase.from('distributors').select('id,distributor_name').eq('status', 'active').order('distributor_name')),
      loadAll(supabase.from('product_distributors').select('id,product_id,distributor_id,territory,verification_status').eq('status', 'active').order('product_id'))
    ])
    const failed = [companyResult, divisionResult, brandResult, productResult, distributorResult, productLinkResult].find(result => result.error)
    if (failed) {
      setError(failed.error.message)
    } else {
      setCompanies(companyResult.data || [])
      setDivisions(divisionResult.data || [])
      setBrands(brandResult.data || [])
      setProducts(productResult.data || [])
      setDistributors(distributorResult.data || [])
      setProductLinks(productLinkResult.data || [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const companyMap = useMemo(() => new Map(companies.map(company => [company.id, company])), [companies])
  const childrenByParent = useMemo(() => {
    const map = new Map()
    companies.forEach(company => {
      if (!company.parent_company_id) return
      const siblings = map.get(company.parent_company_id) || []
      siblings.push(company)
      map.set(company.parent_company_id, siblings)
    })
    return map
  }, [companies])
  const brandsByCompany = useMemo(() => {
    const map = new Map()
    brands.forEach(brand => {
      const list = map.get(brand.company_id) || []
      list.push(brand)
      map.set(brand.company_id, list)
    })
    return map
  }, [brands])
  const productsByCompany = useMemo(() => {
    const map = new Map()
    products.forEach(product => {
      const list = map.get(product.company_id) || []
      list.push(product)
      map.set(product.company_id, list)
    })
    return map
  }, [products])
  const divisionsByCompany = useMemo(() => {
    const map = new Map()
    divisions.forEach(division => {
      const list = map.get(division.company_id) || []
      list.push(division)
      map.set(division.company_id, list)
    })
    return map
  }, [divisions])

  const linkedCount = companies.filter(company => company.parent_company_id).length
  const unbrandedCount = products.filter(product => !product.brand_id).length

  function descendantsOf(companyId, seen = new Set()) {
    if (seen.has(companyId)) return seen
    seen.add(companyId)
    ;(childrenByParent.get(companyId) || []).forEach(child => descendantsOf(child.id, seen))
    return seen
  }

  const visibleCompanies = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('en-IN')
    if (!term) return companies.filter(company => company.parent_company_id || (childrenByParent.get(company.id) || []).length || (brandsByCompany.get(company.id) || []).length || (productsByCompany.get(company.id) || []).length || (divisionsByCompany.get(company.id) || []).length)
    const matches = companies.filter(company => {
      const text = [
        company.company_name,
        company.short_name,
        ...(brandsByCompany.get(company.id) || []).map(brand => brand.brand_name),
        ...(productsByCompany.get(company.id) || []).map(product => product.product_name)
      ].filter(Boolean).join(' ').toLocaleLowerCase('en-IN')
      return text.includes(term)
    })
    const ids = new Set()
    const addFamily = id => {
      const company = companyMap.get(id)
      if (!company || ids.has(id)) return
      ids.add(id)
      if (company.parent_company_id) addFamily(company.parent_company_id)
      ;(childrenByParent.get(id) || []).forEach(child => addFamily(child.id))
    }
    matches.forEach(company => addFamily(company.id))
    return companies.filter(company => ids.has(company.id))
  }, [query, companies, companyMap, childrenByParent, brandsByCompany, productsByCompany])

  async function addProductDistributor(event) {
    event.preventDefault()
    if (!linkDraft.product_id || !linkDraft.distributor_id) {
      setError('Select a product and distributor.')
      return
    }
    const existing = productLinks.find(link => link.product_id === linkDraft.product_id && link.distributor_id === linkDraft.distributor_id)
    if (existing) {
      setError('This product already has an active listing for that distributor.')
      return
    }
    setBusy('product-link')
    setError('')
    setNotice('')
    const { error: saveError } = await supabase.from('product_distributors').insert({
      product_id: linkDraft.product_id,
      distributor_id: linkDraft.distributor_id,
      territory: linkDraft.territory.trim() || null,
      status: 'active',
      verification_status: 'unverified',
      verification_note: 'Product-specific distributor listing. Confirm current availability directly.'
    })
    if (saveError) setError(saveError.message)
    else {
      setLinkDraft({ product_id: '', distributor_id: '', territory: '' })
      setNotice('Product–distributor listing added. It is shown as unverified; current stock is not confirmed.')
      await load()
    }
    setBusy('')
  }

  async function deactivateProductLink(link) {
    if (!link || busy) return
    setBusy(link.id)
    setError('')
    setNotice('')
    const { error: saveError } = await supabase.from('product_distributors').update({ status: 'inactive' }).eq('id', link.id)
    if (saveError) setError(saveError.message)
    else {
      setProductLinks(current => current.filter(item => item.id !== link.id))
      setNotice('Product–distributor listing deactivated.')
    }
    setBusy('')
  }

  async function addProduct(event) {
    event.preventDefault()
    if (!productDraft.product_name.trim() || !productDraft.company_id) {
      setError('Enter a product name and select its company.')
      return
    }
    setBusy('product')
    setError('')
    setNotice('')
    const productName = productDraft.product_name.trim()
    const payload = {
      product_name: productName,
      normalized_product_name: productName.toLocaleLowerCase('en-IN').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(),
      company_id: productDraft.company_id,
      brand_id: productDraft.brand_id || null,
      generic_name: productDraft.generic_name.trim() || null,
      strength: productDraft.strength.trim() || null,
      dosage_form: productDraft.dosage_form.trim() || null,
      pack_size: productDraft.pack_size.trim() || null,
      status: 'active'
    }
    const { error: saveError } = await supabase.from('products').insert(payload)
    if (saveError) setError(saveError.message)
    else {
      setProductDraft({ product_name: '', company_id: '', brand_id: '', generic_name: '', strength: '', dosage_form: '', pack_size: '' })
      setNotice('Product added to the catalogue. Add a direct product–distributor link after confirming it.')
      await load()
    }
    setBusy('')
  }

  async function saveParent(company) {
    if (!company || busy) return
    if (parentDraft === company.id) {
      setError('A company cannot be its own parent.')
      return
    }
    const blocked = descendantsOf(company.id)
    if (parentDraft && blocked.has(parentDraft)) {
      setError('That parent would create a circular company hierarchy.')
      return
    }
    setBusy(company.id)
    setError('')
    setNotice('')
    const { data, error: saveError } = await supabase
      .from('companies')
      .update({ parent_company_id: parentDraft || null })
      .eq('id', company.id)
      .select('id,parent_company_id')
      .single()
    if (saveError) {
      setError(saveError.message)
    } else {
      setCompanies(current => current.map(item => item.id === data.id ? { ...item, parent_company_id: data.parent_company_id } : item))
      setEditingId('')
      setNotice('Company relationship saved.')
    }
    setBusy('')
  }

  function renderCompany(company, depth = 0, ancestry = new Set()) {
    if (ancestry.has(company.id)) return null
    const nextAncestry = new Set(ancestry)
    nextAncestry.add(company.id)
    const children = (childrenByParent.get(company.id) || []).filter(child => visibleCompanies.some(item => item.id === child.id))
    const companyBrands = brandsByCompany.get(company.id) || []
    const companyProducts = productsByCompany.get(company.id) || []
    const companyDivisions = divisionsByCompany.get(company.id) || []
    const parent = companyMap.get(company.parent_company_id)
    const editing = editingId === company.id

    return (
      <div className="admin-hierarchy-node" key={company.id} style={{ marginLeft: depth ? 22 : 0 }}>
        <article className="admin-hierarchy-card">
          <div className="admin-hierarchy-heading">
            <span className="admin-company-icon"><Building2 size={18} /></span>
            <span className="admin-hierarchy-name">
              <strong>{company.company_name}</strong>
              <small>{parent ? <>Subsidiary of <b>{parent.company_name}</b></> : children.length ? 'Parent company' : 'Company'}</small>
            </span>
            <span className="admin-hierarchy-counts">{companyDivisions.length} divisions · {companyBrands.length} brands · {companyProducts.length} products</span>
            <button className="admin-refresh" type="button" onClick={() => { setEditingId(editing ? '' : company.id); setParentDraft(company.parent_company_id || ''); setError(''); setNotice('') }}>
              <GitBranch size={15} /> {editing ? 'Cancel' : 'Edit parent'}
            </button>
          </div>
          {editing && <div className="admin-hierarchy-editor">
            <label>Parent legal entity
              <select value={parentDraft} onChange={event => setParentDraft(event.target.value)}>
                <option value="">No parent / independent company</option>
                {companies.filter(option => option.id !== company.id && !descendantsOf(company.id).has(option.id)).map(option => <option key={option.id} value={option.id}>{option.company_name}</option>)}
              </select>
            </label>
            <button className="report-submit" type="button" disabled={busy === company.id} onClick={() => saveParent(company)}>
              {busy === company.id ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />} Save relationship
            </button>
          </div>}
          {(companyDivisions.length > 0 || companyBrands.length > 0 || companyProducts.length > 0) && <div className="admin-hierarchy-data">
            {companyDivisions.length > 0 && <div className="admin-hierarchy-tags"><strong>Divisions</strong>{companyDivisions.map(division => <span key={division.id}>{division.division_name}</span>)}</div>}
            {companyBrands.map(brand => {
              const brandProducts = companyProducts.filter(product => product.brand_id === brand.id)
              return <details className="admin-hierarchy-detail" key={brand.id}>
                <summary><span><Tags size={14} /> {brand.brand_name}</span><small>{brandProducts.length} products</small></summary>
                {brandProducts.length > 0 && <ul>{brandProducts.map(product => <li key={product.id}>{product.product_name}</li>)}</ul>}
              </details>
            })}
            {companyProducts.some(product => !product.brand_id) && <details className="admin-hierarchy-detail">
              <summary><span><Package size={14} /> Products needing brand assignment</span><small>{companyProducts.filter(product => !product.brand_id).length} products</small></summary>
              <ul>{companyProducts.filter(product => !product.brand_id).map(product => <li key={product.id}>{product.product_name}</li>)}</ul>
            </details>}
          </div>}
        </article>
        {children.map(child => renderCompany(child, depth + 1, nextAncestry))}
      </div>
    )
  }

  const roots = visibleCompanies.filter(company => !company.parent_company_id || !visibleCompanies.some(parent => parent.id === company.parent_company_id))

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div>
          <button className="admin-back" onClick={onBack}><ArrowLeft size={15} /> Dashboard</button>
          <p className="section-kicker">DIRECTORY STRUCTURE</p>
          <h1>Company hierarchy</h1>
          <p>Keep parent companies and subsidiaries as separate records, then link divisions, brands and products to the right entity.</p>
        </div>
          <button className="admin-refresh" onClick={load} disabled={loading}><LoaderCircle className={loading ? 'spin' : ''} size={15} /> Refresh</button>
      </div>
      <div className="admin-note" style={{ marginBottom: 16 }}>
        <strong>Names and ownership come from the company catalogue.</strong> Review imported records before relying on them. Missing brand names remain unassigned, and the source workbook did not provide any division names.
      </div>
      {error && <div className="admin-error">{error}</div>}
      {notice && <div className="admin-info-box"><strong>Saved</strong><span>{notice}</span></div>}
      <section className="admin-panel" style={{ marginBottom: 18 }}>
        <div className="admin-panel-heading"><div><p className="section-kicker">PRODUCT CATALOGUE</p><h2>Add a product</h2><p>Record the owning company and any verified brand or product details. Distributor links are managed separately.</p></div><Package size={20}/></div>
        <form className="admin-hierarchy-editor" onSubmit={addProduct}>
          <label>Product name<input required value={productDraft.product_name} onChange={event=>setProductDraft(current=>({...current,product_name:event.target.value}))} /></label>
          <label>Owning company<select required value={productDraft.company_id} onChange={event=>setProductDraft(current=>({...current,company_id:event.target.value,brand_id:''}))}><option value="">Select company</option>{companies.map(company=><option key={company.id} value={company.id}>{company.company_name}</option>)}</select></label>
          <label>Brand<select value={productDraft.brand_id} onChange={event=>setProductDraft(current=>({...current,brand_id:event.target.value}))}><option value="">Unassigned / not provided</option>{brands.filter(brand=>brand.company_id===productDraft.company_id).map(brand=><option key={brand.id} value={brand.id}>{brand.brand_name}</option>)}</select></label>
          <label>Generic name<input value={productDraft.generic_name} onChange={event=>setProductDraft(current=>({...current,generic_name:event.target.value}))} /></label>
          <label>Strength<input value={productDraft.strength} onChange={event=>setProductDraft(current=>({...current,strength:event.target.value}))} /></label>
          <label>Dosage form<input value={productDraft.dosage_form} onChange={event=>setProductDraft(current=>({...current,dosage_form:event.target.value}))} /></label>
          <label>Pack size<input value={productDraft.pack_size} onChange={event=>setProductDraft(current=>({...current,pack_size:event.target.value}))} /></label>
          <button className="report-submit" type="submit" disabled={busy==='product'}>{busy==='product'?<LoaderCircle className="spin" size={15}/>:<Save size={15}/>} Add product</button>
        </form>
      </section>
      <section className="admin-panel" style={{ marginBottom: 18 }}>
        <div className="admin-panel-heading"><div><p className="section-kicker">DISTRIBUTOR COVERAGE</p><h2>Link a product to a distributor</h2><p>This creates a product-specific listing. Availability is always unverified until confirmed.</p></div><Truck size={20}/></div>
        <form className="admin-hierarchy-editor" onSubmit={addProductDistributor}>
          <label>Product<select required value={linkDraft.product_id} onChange={event=>setLinkDraft(current=>({...current,product_id:event.target.value}))}><option value="">Select product</option>{products.map(product=><option key={product.id} value={product.id}>{product.product_name} — {companyMap.get(product.company_id)?.company_name||'Company not assigned'}</option>)}</select></label>
          <label>Distributor<select required value={linkDraft.distributor_id} onChange={event=>setLinkDraft(current=>({...current,distributor_id:event.target.value}))}><option value="">Select distributor</option>{distributors.map(distributor=><option key={distributor.id} value={distributor.id}>{distributor.distributor_name}</option>)}</select></label>
          <label>Territory (optional)<input value={linkDraft.territory} onChange={event=>setLinkDraft(current=>({...current,territory:event.target.value}))} placeholder="e.g. Bhuj / Kutch" /></label>
          <button className="report-submit" type="submit" disabled={busy==='product-link'}>{busy==='product-link'?<LoaderCircle className="spin" size={15}/>:<Save size={15}/>} Save product listing</button>
        </form>
        {productLinks.length>0 && <div className="admin-hierarchy-data"><strong>Active product-specific listings</strong>{productLinks.map(link=><div className="admin-hierarchy-tags" key={link.id}><span>{products.find(product=>product.id===link.product_id)?.product_name||'Product'} → {distributors.find(distributor=>distributor.id===link.distributor_id)?.distributor_name||'Distributor'}{link.territory?' · '+link.territory:''}</span><button className="admin-refresh" type="button" disabled={busy===link.id} onClick={()=>deactivateProductLink(link)}>Deactivate</button></div>)}</div>}
      </section>
      <section className="admin-control-summary">
        <div><strong>{companies.length}</strong><span>Active companies</span><small>separate company records</small></div>
        <div><strong>{linkedCount}</strong><span>Subsidiaries linked</span><small>with a parent company</small></div>
        <div><strong>{brands.length}</strong><span>Brands</span><small>assigned to companies</small></div>
        <div><strong>{products.length}</strong><span>Products</span><small>{unbrandedCount} need brand assignment</small></div>
      </section>
      <div className="admin-toolbar">
        <div className="admin-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search company, brand or product..." /></div>
      </div>
      {loading ? <div className="admin-state"><LoaderCircle className="spin" size={20} /> Loading company hierarchy…</div> :
        roots.length ? <div className="admin-hierarchy-list">{roots.map(company => renderCompany(company))}</div> :
          <div className="result-state">{query ? 'No matching company, brand or product found.' : 'No linked company families yet. Search for a company to assign a parent.'}</div>}
    </div>
  )
}
