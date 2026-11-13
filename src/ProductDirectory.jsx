import React, { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Package, Search, LoaderCircle, Building2, Phone, MessageCircle, MapPin } from 'lucide-react'
import { supabase } from './lib/supabase'
import { applyFlexibleSearch } from './lib/searchUtils'

const PRODUCT_PAGE_SIZE = 60
const PRODUCT_FIELDS = 'id,product_name,company_id,division_id,brand_id,generic_name,strength,dosage_form,pack_size'
const PRODUCT_SEARCH_FIELDS = ['product_name','normalized_product_name','generic_name','strength','dosage_form','pack_size']

async function fetchProductPage(term, offset = 0) {
  let query = supabase.from('products')
    .select(PRODUCT_FIELDS, { count: 'exact' })
    .eq('status', 'active')

  if (term) query = applyFlexibleSearch(query, PRODUCT_SEARCH_FIELDS, term)

  const { data: products, error, count } = await query
    .order('product_name')
    .order('id')
    .range(offset, offset + PRODUCT_PAGE_SIZE - 1)

  if (error) return { data: null, error }

  const rows = products || []
  const companyIds = [...new Set(rows.map(row => row.company_id).filter(Boolean))]
  const brandIds = [...new Set(rows.map(row => row.brand_id).filter(Boolean))]
  const divisionIds = [...new Set(rows.map(row => row.division_id).filter(Boolean))]

  const [companiesRes, brandsRes, divisionsRes] = await Promise.all([
    companyIds.length
      ? supabase.from('companies').select('id,company_name').in('id', companyIds).eq('status', 'active')
      : Promise.resolve({ data: [], error: null }),
    brandIds.length
      ? supabase.from('brands').select('id,brand_name').in('id', brandIds).eq('status', 'active')
      : Promise.resolve({ data: [], error: null }),
    divisionIds.length
      ? supabase.from('divisions').select('id,division_name').in('id', divisionIds).eq('status', 'active')
      : Promise.resolve({ data: [], error: null })
  ])

  const lookupError = companiesRes.error || brandsRes.error || divisionsRes.error
  if (lookupError) return { data: null, error: lookupError }

  const companyMap = new Map((companiesRes.data || []).map(row => [row.id, row.company_name]))
  const brandMap = new Map((brandsRes.data || []).map(row => [row.id, row.brand_name]))
  const divisionMap = new Map((divisionsRes.data || []).map(row => [row.id, row.division_name]))
  const items = rows.map(row => ({
    ...row,
    companyName: companyMap.get(row.company_id) || 'Company not assigned',
    brandName: brandMap.get(row.brand_id) || '',
    divisionName: divisionMap.get(row.division_id) || ''
  }))

  const totalCount = count ?? offset + rows.length
  return {
    data: items,
    error: null,
    totalCount,
    hasMore: offset + rows.length < totalCount
  }
}

const normalizePhone = number => {
  const raw = String(number || '').trim()
  if (!raw) return ''
  if (raw.startsWith('+')) return '+' + raw.slice(1).replace(/\D/g, '')
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return '+91' + digits
  if (digits.length === 11 && digits.startsWith('0')) return '+91' + digits.slice(1)
  if (digits.startsWith('91') && digits.length === 12) return '+' + digits
  return digits
}
const phoneLink = number => `tel:${normalizePhone(number)}`
const waLink = (number, message) => `https://wa.me/${normalizePhone(number).replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
const mapsLink = d => d.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([d.distributor_name,d.address,'Kutch','Gujarat'].filter(Boolean).join(', '))}`

export default function ProductDirectory({ productId, onBack, onOpenProduct, onOpenCompany, onOpenDistributor, onOpenCatalogEntity }) {
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const listRequestRef = useRef(0)
  const [product, setProduct] = useState(null)
  const [company, setCompany] = useState(null)
  const [brand, setBrand] = useState(null)
  const [division, setDivision] = useState(null)
  const [distributors, setDistributors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // The catalogue is fetched in small pages. Search runs on the database so
  // products beyond the first page remain discoverable without downloading all rows.
  useEffect(() => {
    if (productId) return
    let cancelled = false
    const requestId = ++listRequestRef.current
    const term = query.trim()

    const timer = setTimeout(async () => {
      setLoading(true)
      setLoadingMore(false)
      setError('')
      const result = await fetchProductPage(term, 0)
      if (cancelled || requestId !== listRequestRef.current) return
      if (result.error) {
        setError(result.error.message)
        setItems([])
        setTotalCount(0)
        setHasMore(false)
      } else {
        setItems(result.data)
        setTotalCount(result.totalCount)
        setHasMore(result.hasMore)
      }
      setLoading(false)
    }, term ? 280 : 0)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [productId, query])

  async function loadMoreProducts() {
    const requestId = listRequestRef.current
    if (loadingMore || loading || !hasMore) return
    setLoadingMore(true)
    const result = await fetchProductPage(query.trim(), items.length)
    if (requestId !== listRequestRef.current) return
    if (result.error) {
      setError(result.error.message)
    } else {
      setItems(current => [...current, ...result.data])
      setTotalCount(result.totalCount)
      setHasMore(result.hasMore)
    }
    setLoadingMore(false)
  }

  useEffect(() => {
    if (!productId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      const { data: p, error: pe } = await supabase.from('products')
        .select(PRODUCT_FIELDS)
        .eq('id', productId)
        .eq('status', 'active')
        .maybeSingle()
      if (pe || !p) {
        if (!cancelled) {
          setError(pe?.message || 'This product could not be found.')
          setLoading(false)
        }
        return
      }

      const [co, br, direct, companyRels, divisionRes] = await Promise.all([
        p.company_id
          ? supabase.from('companies').select('id,company_name,short_name').eq('id', p.company_id).eq('status', 'active').maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        p.brand_id
          ? supabase.from('brands').select('id,brand_name').eq('id', p.brand_id).eq('status', 'active').maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase.from('product_distributors').select('id,product_id,distributor_id,location_id,territory,verification_status').eq('product_id', p.id).eq('status', 'active'),
        p.company_id
          ? supabase.from('distributorships').select('id,distributor_id,division_id,brand_id,location_id,territory,verification_status').eq('company_id', p.company_id).eq('status', 'active')
          : Promise.resolve({ data: [], error: null }),
        p.division_id
          ? supabase.from('divisions').select('id,division_name,company_id').eq('id', p.division_id).eq('status', 'active').maybeSingle()
          : Promise.resolve({ data: null, error: null })
      ])
      if (co.error || br.error || direct.error || companyRels.error || divisionRes.error) {
        if (!cancelled) {
          setError((co.error || br.error || direct.error || companyRels.error || divisionRes.error).message)
          setLoading(false)
        }
        return
      }

      const directRows = (direct.data || []).map(row => ({ ...row, scope: 'product', priority: 4 }))
      const scopedRows = (companyRels.data || []).filter(row =>
        (p.brand_id && row.brand_id === p.brand_id) ||
        (p.division_id && !row.brand_id && row.division_id === p.division_id) ||
        (!row.brand_id && !row.division_id)
      ).map(row => ({
        ...row,
        scope: row.brand_id ? 'brand' : row.division_id ? 'division' : 'company',
        priority: row.brand_id ? 3 : row.division_id ? 2 : 1
      }))
      const relationshipMap = new Map()
      ;[...directRows, ...scopedRows].forEach(row => {
        const previous = relationshipMap.get(row.distributor_id)
        if (!previous || row.priority > previous.priority) relationshipMap.set(row.distributor_id, row)
      })
      const distributorLinks = [...relationshipMap.values()]
      const ids = distributorLinks.map(row => row.distributor_id).filter(Boolean)
      const dRes = ids.length
        ? await supabase.from('distributors').select('id,distributor_name,mobile,whatsapp,address,maps_url').in('id', ids).eq('status', 'active').order('distributor_name')
        : { data: [], error: null }
      if (dRes.error) {
        if (!cancelled) {
          setError(dRes.error.message)
          setLoading(false)
        }
        return
      }
      const linkMap = new Map(distributorLinks.map(row => [row.distributor_id, row]))
      const distributorRows = (dRes.data || []).map(distributor => ({
        ...distributor,
        scope: linkMap.get(distributor.id)?.scope || 'company'
      }))
      if (!cancelled) {
        setProduct({ ...p, divisionName: divisionRes.data?.division_name || '' })
        setCompany(co.data)
        setBrand(br.data)
        setDivision(divisionRes.data || null)
        setDistributors(distributorRows)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [productId])

  const filtered = items
  const specs = [product?.generic_name, product?.strength, product?.dosage_form, product?.pack_size].filter(Boolean).join(' · ')

  return <section className="browse-section product-directory-section"><div className="container browse-container">
    <button className="back-button" onClick={onBack}><ArrowLeft size={16}/> {productId ? 'Back to Products' : 'Back'}</button>
    {productId ? <>
      {loading && <div className="result-state"><LoaderCircle className="spin" size={20}/> Loading product…</div>}
      {!loading && error && <div className="result-state">{error}</div>}
      {!loading && product && <div className="product-detail-layout">
        <div className="product-detail-main">
          <p className="section-kicker">PRODUCT DETAILS</p>
          <div className="product-detail-title-row"><span className="product-detail-icon"><Package size={24}/></span><div><h1>{product.product_name}</h1>{brand?.brand_name && <p>Brand: <button type="button" className="product-entity-link" onClick={() => onOpenCatalogEntity?.('brand', brand.id)}>{brand.brand_name}</button></p>}{division?.division_name && <p>Division: <button type="button" className="product-entity-link" onClick={() => onOpenCatalogEntity?.('division', division.id)}>{division.division_name}</button></p>}</div></div>
          {specs && <p className="product-detail-specs">{specs}</p>}
          <div className="product-detail-company"><Building2 size={18}/><div><span>Company</span><strong>{company?.company_name || 'Company not assigned'}</strong></div>{company && <button type="button" onClick={() => onOpenCompany(company.id)} aria-label="Open company profile"><ArrowRight size={17}/></button>}</div>
          <div className="product-detail-distributors"><div className="product-detail-section-heading"><div><h2>Distributors in Kutch</h2></div><span>{distributors.length}</span></div>
          {!distributors.length ? <div className="result-state">No active distributor links are listed for this product or company yet.</div> : distributors.map(d => <article className="product-distributor-card" key={d.id} onClick={() => onOpenDistributor(d.id)}><div className="product-distributor-copy"><strong>{d.distributor_name}</strong>{d.address && <span>{d.address}</span>}{d.scope !== 'product' && <small>Product information not available</small>}</div><div className="browse-contact-actions" onClick={e => e.stopPropagation()}>{d.mobile && <a className="contact-action call-action" href={phoneLink(d.mobile)}><Phone size={14}/><span>Call</span></a>}{(d.whatsapp || d.mobile) && <a className="contact-action whatsapp-action" href={waLink(d.whatsapp || d.mobile, `Hello ${d.distributor_name}, do you currently handle ${company?.company_name || product.product_name} and have stock available in Kutch? I found your contact through KutchPharmaConnect.`)} target="_blank" rel="noreferrer"><MessageCircle size={14}/><span>WhatsApp</span></a>}<a className="contact-action maps-action" href={mapsLink(d)} target="_blank" rel="noreferrer"><MapPin size={14}/><span>Maps</span></a></div></article>)}
          </div>
        </div>
      </div>}
    </> : <>
      <div className="browse-header"><div><p className="section-kicker">PRODUCT CATALOGUE</p><h1>Products</h1><p>Search products by name, brand, company, generic name, or strength.</p></div>{!loading && !error && <div className="browse-count">{items.length.toLocaleString()} of {totalCount.toLocaleString()} products</div>}</div>
      <div className="browse-search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search products, brands, companies…" aria-label="Search products"/></div>
      {loading && <div className="result-state"><LoaderCircle className="spin" size={20}/> Loading products…</div>}
      {!loading && error && <div className="result-state">{error}</div>}
      {!loading && !error && <div className="browse-grid product-directory-grid">{filtered.map(p => <article className="product-directory-card" key={p.id}><span className="product-directory-icon"><Package size={19}/></span><span className="product-directory-copy"><button type="button" className="product-directory-name" onClick={() => onOpenProduct(p.id)}>{p.product_name}<ArrowRight size={14}/></button>{p.brandName && <span>Brand: <button type="button" className="product-entity-link" onClick={() => onOpenCatalogEntity?.('brand', p.brand_id)}>{p.brandName}</button></span>}{p.divisionName && <span>Division: <button type="button" className="product-entity-link" onClick={() => onOpenCatalogEntity?.('division', p.division_id)}>{p.divisionName}</button></span>}<small>Company: <button type="button" className="product-entity-link" onClick={() => onOpenCompany(p.company_id)}>{p.companyName}</button></small>{[p.generic_name, p.strength, p.dosage_form].filter(Boolean).length > 0 && <small>{[p.generic_name, p.strength, p.dosage_form].filter(Boolean).join(' · ')}</small>}</span></article>)}</div>}
      {!loading && !error && !filtered.length && <div className="result-state">No matching products found.</div>}
      {!loading && !error && hasMore && <div className="product-load-more-wrap"><button type="button" className="product-load-more" onClick={loadMoreProducts} disabled={loadingMore}>{loadingMore ? <><LoaderCircle className="spin" size={16}/> Loading…</> : `Load more products (${items.length.toLocaleString()} of ${totalCount.toLocaleString()})`}</button></div>}
    </>}
  </div></section>
}
