import React from 'react'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, LoaderCircle, Search, Truck, MapPin, Phone, MessageCircle, Flag } from 'lucide-react'
import { supabase } from './lib/supabase'
import { fetchByIds } from './lib/queryHelpers'

const browseCache = new Map()

const KPC_WEBSITE=typeof window!=='undefined'?window.location.origin+import.meta.env.BASE_URL:''
const distributorWhatsAppMessage=name=>`Hello, I found ${name} through KutchPharmaConnect. I’m contacting you regarding your current distributorships in Kutch. KutchPharmaConnect: ${KPC_WEBSITE}`
const normalizePhone=number=>{
  const raw=String(number||'').trim()
  if(!raw)return ''
  if(raw.startsWith('+'))return '+'+raw.slice(1).replace(/\D/g,'')
  const digits=raw.replace(/\D/g,'')
  if(digits.length===10)return '+91'+digits
  if(digits.length===11&&digits.startsWith('0'))return '+91'+digits.slice(1)
  if(digits.startsWith('91')&&digits.length===12)return '+'+digits
  return digits
}
const phoneLink=number=>`tel:${normalizePhone(number)}`
const waLink=(number,message)=>`https://wa.me/${normalizePhone(number).replace(/\D/g,'')}?text=${encodeURIComponent(message)}`
const mapsLink=entity=>{
  if(entity?.maps_url)return entity.maps_url
  const query=[entity?.distributor_name,entity?.address,entity?.location?.city,'Kutch','Gujarat'].filter(Boolean).join(', ')
  return query?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`:null
}

// Supabase REST responses are capped at 1,000 rows by default. Page every
// relationship query that contributes to public directory counts and locations.
async function fetchAllPages(makeQuery, pageSize = 1000) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    const page = data || []
    rows.push(...page)
    if (page.length < pageSize) return { data: rows, error: null }
  }
}

export default function BrowseDirectory({ type, category, onBack, onOpenProfile, onReport }) {
  const isCompanies = type === 'companies'
  const isLocations = type === 'locations'
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [categoryFilter, setCategoryFilter] = useState(category || '')
  const [locationFilter, setLocationFilter] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      const cacheKey = `${type}:${category || ''}`
      const cached = browseCache.get(cacheKey)
      if (cached) { setItems(cached); setLoading(false) } else setLoading(true)
      setError('')

      if (isCompanies) {
        let categoryCompanyIds = null
        const [categoryResult, companyResult] = await Promise.all([
          category
            ? supabase.from('categories').select('id,name').ilike('name', category).eq('status', 'active').maybeSingle()
            : Promise.resolve({data:null,error:null}),
          fetchAllPages(() => supabase.from('companies').select('id,company_name,short_name,parent_company_id').eq('status', 'active').order('company_name').order('id'))
        ])
        if (categoryResult.error || companyResult.error) {
          if (!cancelled) { setError((categoryResult.error || companyResult.error).message); setLoading(false) }
          return
        }
        if (category) {
          if (!categoryResult.data) { if (!cancelled) { setError('Category not found.'); setLoading(false) }; return }
          const { data: categoryLinks, error: categoryLinkError } = await fetchAllPages(() => supabase.from('company_categories').select('company_id').eq('category_id', categoryResult.data.id).order('company_id'))
          if (categoryLinkError) { if (!cancelled) { setError(categoryLinkError.message); setLoading(false) }; return }
          categoryCompanyIds = [...new Set((categoryLinks || []).map(x => x.company_id).filter(Boolean))]
        }
        const data = companyResult.data || []
        const productResult = await fetchAllPages(() => supabase.from('products').select('id,company_id').eq('status','active'))
        if (productResult.error) { if (!cancelled) { setError(productResult.error.message); setLoading(false) }; return }
        const productCounts = new Map()
        ;(productResult.data||[]).forEach(product=>productCounts.set(product.company_id,(productCounts.get(product.company_id)||0)+1))
        const companyNameMap = new Map(data.map(company=>[company.id,company.company_name]))
        const parentIds = new Set(data.map(company=>company.parent_company_id).filter(Boolean))

        const companyRows = categoryCompanyIds ? (data || []).filter(x => categoryCompanyIds.includes(x.id)) : (data || [])
        const ids = companyRows.map(x => x.id)
        // Fetch active relationships without sending hundreds of company IDs in one URL.
        // A large `.in('company_id', ids)` filter can exceed request URL limits and return Bad Request.
        const relationshipResult = await fetchAllPages(() => supabase
          .from('distributorships')
          .select('company_id,distributor_id,location_id,category_id,verification_status')
          .eq('status', 'active'))
        const rels = relationshipResult.data
        const relError = relationshipResult.error

        if (relError) {
          if (!cancelled) { setError(relError.message); setLoading(false) }
          return
        }

        const locationIds = [...new Set((rels || []).map(x => x.location_id).filter(Boolean))]
        const categoryIds=[...new Set((rels||[]).map(x=>x.category_id).filter(Boolean))]
        const [locationsResult, catResult] = await Promise.all([
          locationIds.length ? supabase.from('locations').select('id,city,district,state,pincode').in('id', locationIds).eq('status','active') : Promise.resolve({data:[],error:null}),
          categoryIds.length ? supabase.from('categories').select('id,name').in('id',categoryIds).eq('status','active') : Promise.resolve({data:[],error:null})
        ])
        if (locationsResult.error || catResult.error) {
          if (!cancelled) { setError((locationsResult.error || catResult.error).message); setLoading(false) }
          return
        }
        const locations = locationsResult.data || []
        const catRows = catResult.data || []
        const locationMap = new Map(locations.map(x => [x.id, x]))
        const relationshipMap = new Map()
        const categoryMap=new Map((catRows||[]).map(x=>[x.id,x.name]))
        ;(rels || []).forEach(rel => {
          const entry = relationshipMap.get(rel.company_id) || { count: 0, verifiedCount: 0, reviewCount: 0, locations: new Map() }
          entry.count += 1
          if (rel.verification_status === 'verified') entry.verifiedCount += 1
          if (rel.verification_status === 'needs_review') entry.reviewCount += 1
          if (rel.location_id && locationMap.has(rel.location_id)) {
            entry.locations.set(rel.location_id, locationMap.get(rel.location_id))
          }
          relationshipMap.set(rel.company_id, entry)
        })

        if (!cancelled) {
          const nextItems=companyRows.map(x => {
            const info = relationshipMap.get(x.id) || { count: 0, locations: new Map() }
            return { ...x, parentName:x.parent_company_id?companyNameMap.get(x.parent_company_id):null, hasSubsidiaries:parentIds.has(x.id), productCount:productCounts.get(x.id)||0, relationshipCount: info.count, verifiedCount: info.verifiedCount, reviewCount: info.reviewCount, locations: [...info.locations.values()], locationIds:[...info.locations.keys()], categoryNames:[...new Set((rels||[]).filter(r=>r.company_id===x.id).map(r=>categoryMap.get(r.category_id)).filter(Boolean))] }
          }).filter(x => x.relationshipCount > 0 || x.parent_company_id || x.hasSubsidiaries || x.productCount > 0)
          browseCache.set(cacheKey,nextItems)
          setItems(nextItems)
        }
      } else if (isLocations) {
        const { data: locations, error: locationError } = await fetchAllPages(() => supabase.from('locations').select('id,city,district,state,pincode').eq('status','active').order('city').order('id'))
        if (locationError) { if (!cancelled) { setError(locationError.message); setLoading(false) }; return }
        const ids = (locations || []).map(x => x.id)
        const locationRelationshipResult = ids.length
          ? await fetchAllPages(() => supabase.from('distributorships').select('location_id,company_id,distributor_id').eq('status','active').in('location_id', ids))
          : { data: [], error: null }
        const rels = locationRelationshipResult.data
        const relError = locationRelationshipResult.error
        if (relError) { if (!cancelled) { setError(relError.message); setLoading(false) }; return }
        const companyIds=[...new Set((rels||[]).map(x=>x.company_id).filter(Boolean))]
        const distributorIds=[...new Set((rels||[]).map(x=>x.distributor_id).filter(Boolean))]
        const [companies,distributors]=await Promise.all([
          fetchByIds(companyIds,ids=>supabase.from('companies').select('id,company_name').in('id',ids).eq('status','active')),
          fetchByIds(distributorIds,ids=>supabase.from('distributors').select('id,distributor_name').in('id',ids).eq('status','active'))
        ])
        if (companies.error || distributors.error) { if (!cancelled) { setError((companies.error||distributors.error).message); setLoading(false) }; return }
        const cm=new Map((companies.data||[]).map(x=>[x.id,x])), dm=new Map((distributors.data||[]).map(x=>[x.id,x]))
        const grouped=new Map()
        ;(rels||[]).forEach(rel=>{
          const e=grouped.get(rel.location_id)||{companies:new Map(),distributors:new Map()}
          if(cm.has(rel.company_id)) e.companies.set(rel.company_id,cm.get(rel.company_id))
          if(dm.has(rel.distributor_id)) e.distributors.set(rel.distributor_id,dm.get(rel.distributor_id))
          grouped.set(rel.location_id,e)
        })
        if(!cancelled) {
          const nextItems=(locations||[]).map(location=>{
          const e=grouped.get(location.id)||{companies:new Map(),distributors:new Map()}
          return {...location,companies:[...e.companies.values()],distributors:[...e.distributors.values()]}
          }).filter(x=>x.companies.length||x.distributors.length)
          browseCache.set(cacheKey,nextItems)
          setItems(nextItems)
        }
      } else {
        const { data, error: distributorError } = await fetchAllPages(() => supabase
          .from('distributors')
          .select('id,distributor_name,contact_person,mobile,whatsapp,address,city_id,maps_url')
          .eq('status', 'active')
          .order('distributor_name').order('id'))

        if (distributorError) {
          if (!cancelled) { setError(distributorError.message); setLoading(false) }
          return
        }

        const ids = (data || []).map(x => x.id)
        // Supabase returns at most 1,000 rows per request by default. Fetch all
        // active relationships in pages so distributors later in the result set
        // do not incorrectly appear to have zero relationships.
        let rels = []
        let relError = null
        if (ids.length) {
          const pageSize = 1000
          for (let from = 0; ; from += pageSize) {
            const result = await supabase
              .from('distributorships')
              .select('distributor_id,location_id,category_id,verification_status')
              .eq('status', 'active')
              .in('distributor_id', ids)
              .range(from, from + pageSize - 1)
            if (result.error) { relError = result.error; break }
            const page = result.data || []
            rels.push(...page)
            if (page.length < pageSize) break
          }
        }

        if (relError) {
          if (!cancelled) { setError(relError.message); setLoading(false) }
          return
        }

        const locationIds = [...new Set((data || []).map(x => x.city_id).filter(Boolean))]
        const relationshipCategoryRows = {data:rels||[],error:null}
        const categoryIds=[...new Set((relationshipCategoryRows.data||[]).map(x=>x.category_id).filter(Boolean))]
        const categoryRows=categoryIds.length?await supabase.from('categories').select('id,name').in('id',categoryIds).eq('status','active'):{data:[],error:null}
        const { data: locations, error: locationError } = locationIds.length
          ? await supabase.from('locations').select('id,city,district,state,pincode').in('id', locationIds)
          : { data: [], error: null }

        if (locationError) {
          if (!cancelled) { setError(locationError.message); setLoading(false) }
          return
        }

        const locationMap = new Map((locations || []).map(x => [x.id, x]))
        const categoryMap = new Map((categoryRows.data || []).map(x => [x.id, x.name]))
        const counts = new Map()
        const distributorCategoryNames = new Map()
        const distributorLocationIds = new Map()
        ;(rels || []).forEach(x => {
          const entry = counts.get(x.distributor_id) || { count: 0, verifiedCount: 0, reviewCount: 0 }
          if(x.category_id){const set=distributorCategoryNames.get(x.distributor_id)||new Set();const n=categoryMap.get(x.category_id);if(n)set.add(n);distributorCategoryNames.set(x.distributor_id,set)}
          if(x.location_id){const set=distributorLocationIds.get(x.distributor_id)||new Set();set.add(x.location_id);distributorLocationIds.set(x.distributor_id,set)}
          entry.count += 1
          if (x.verification_status === 'verified') entry.verifiedCount += 1
          if (x.verification_status === 'needs_review') entry.reviewCount += 1
          counts.set(x.distributor_id, entry)
        })

        if (!cancelled) {
          const nextItems=(data || []).map(x => ({
            ...x,
            location: locationMap.get(x.city_id),
            relationshipCount: counts.get(x.id)?.count || 0,
            verifiedCount: counts.get(x.id)?.verifiedCount || 0,
            reviewCount: counts.get(x.id)?.reviewCount || 0,
            categoryNames:[...((distributorCategoryNames.get(x.id)||new Set()))],
            locationIds:[...(distributorLocationIds.get(x.id)||new Set())]
          }))
          browseCache.set(cacheKey,nextItems)
          setItems(nextItems)
        }
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [isCompanies, isLocations, category])

  const term = query.trim().toLowerCase()
  const filtered = items.filter(item => {
    if (categoryFilter && !(item.categoryNames || []).includes(categoryFilter)) return false
    if (locationFilter && !(item.locationIds || []).includes(locationFilter)) return false
    const name = isLocations ? [item.city,item.district,item.state,item.pincode].filter(Boolean).join(' ') : isCompanies ? [item.company_name,item.parentName].filter(Boolean).join(' ') : item.distributor_name
    const secondary = isLocations ? '' : isCompanies ? item.short_name : item.contact_person
    const locationText = isLocations ? [item.city,item.district,item.state,item.pincode].filter(Boolean).join(' ') : isCompanies
      ? (item.locations || []).map(x => [x.city, x.district, x.state].filter(Boolean).join(', ')).join(' ')
      : item.location
        ? [item.location.city, item.location.district, item.location.state].filter(Boolean).join(' ')
        : ''
    return !term ||
      name.toLowerCase().includes(term) ||
      (secondary || '').toLowerCase().includes(term) ||
      locationText.toLowerCase().includes(term)
  })

  const formatLocation = location =>
    [location.city, location.district, location.state].filter(Boolean).join(', ')

  return (
    <section className="browse-section">
      <div className="container browse-container">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>

        <div className="browse-header">
          <div>
            <p className="section-kicker">DIRECTORY</p>
            <h1>{isLocations ? 'Kutch Locations' : isCompanies && category ? category : isCompanies ? 'Companies' : 'Distributors'}</h1>
            <p>{isLocations ? 'Browse Kutch locations with active company and distributor relationships.' : isCompanies
              ? (category ? 'Companies listed in this category with current Kutch distributorship relationships.' : 'Browse active companies with current Kutch distributorship relationships.')
              : 'Browse active distributors and the companies they currently handle.'}</p>
          </div>
          {!loading && !error && <div className="browse-count">{filtered.length} {filtered.length === 1 ? 'record' : 'records'}</div>}
        </div>

        <div className="browse-search">
          <Search size={18} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={isLocations ? 'Search locations...' : isCompanies ? (category ? `Search ${category} companies or locations...` : 'Search companies or locations...') : 'Search distributors or locations...'}
            aria-label={isCompanies ? 'Search companies' : 'Search distributors'}
          />
        </div>

        {!loading && !error && !isLocations && <div className="browse-filters">
          <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} aria-label="Filter by category">
            <option value="">All categories</option>
            {['Pharmaceutical','Surgical','OTC','Ayurvedic','Nutraceutical','Medical Devices','Diagnostic','Veterinary'].map(x=><option key={x} value={x}>{x}</option>)}
          </select>
          <select value={locationFilter} onChange={e=>setLocationFilter(e.target.value)} aria-label="Filter by location">
            <option value="">All locations</option>
            {[...new Map(items.flatMap(x=>(x.locations||[x.location]).filter(Boolean).map(l=>[l.id,l]))).values()].sort((a,b)=>(a.city||'').localeCompare(b.city||'')).map(l=><option key={l.id} value={l.id}>{[l.city,l.district].filter(Boolean).join(', ')}</option>)}
          </select>
          {(categoryFilter||locationFilter) && <button type="button" onClick={()=>{setCategoryFilter(category||'');setLocationFilter('')}}>Clear</button>}
        </div>}

        {loading && (
          <div className="result-state"><LoaderCircle className="spin" size={20} /> Loading directory…</div>
        )}

        {!loading && error && <div className="result-state">{error}</div>}

        {!loading && !error && filtered.length > 0 && (
          <div className="browse-grid">
            {filtered.map(item => (
              <div className="browse-card" key={item.id}>
                <div className="browse-card-icon">
                  {isLocations ? <MapPin size={20} /> : isCompanies ? <Building2 size={20} /> : <Truck size={20} />}
                </div>
                <div className="browse-card-copy">
                  <strong>{isLocations ? item.city : isCompanies ? item.company_name : item.distributor_name}</strong>
                  {isLocations ? (
                    <>
                      <span>{[item.district,item.state,item.pincode].filter(Boolean).join(', ')}</span>
                      <div className="browse-location-links">
                        {item.companies.slice(0,4).map(x => <button key={x.id} type="button" onClick={e => {e.stopPropagation();onOpenProfile('company',x.id)}}>{x.company_name}</button>)}
                      </div>
                      <small>{item.companies.length} companies • {item.distributors.length} distributors</small>
                    </>
                  ) : (
                    <>
                      {isCompanies && item.short_name && <span>{item.short_name}</span>}
                      {isCompanies && item.parentName && <span>Subsidiary of {item.parentName}</span>}
                      {isCompanies && item.hasSubsidiaries && <span>Parent company · subsidiaries listed below</span>}
                      {isCompanies && item.productCount > 0 && <small>{item.productCount} catalogue {item.productCount===1?'product':'products'}</small>}
                      {isCompanies && item.locations?.length > 0 && <div className="browse-card-locations">{item.locations.map(location => <span className="browse-location" key={location.id}>{formatLocation(location)}</span>)}</div>}
                      {!isCompanies && item.location && <span>{formatLocation(item.location)}</span>}
                      {!isCompanies && item.contact_person && <span>{item.contact_person}</span>}
                      <small>{item.relationshipCount > 0 ? `${item.relationshipCount} active ${item.relationshipCount === 1 ? 'relationship' : 'relationships'}` : 'No active distributor relationships'}</small>
                      {isCompanies && item.verifiedCount > 0 && <span className="verified-badge verified-badge-small" title="At least one current company–distributor relationship has been independently verified.">✓ Relationship Verified</span>}
                      {isCompanies && item.verifiedCount === 0 && item.reviewCount > 0 && <span className="status-badge status-review">Under Review</span>}
                      {isCompanies && item.relationshipCount > 0 && item.verifiedCount === 0 && item.reviewCount === 0 && <span className="status-badge status-unverified" title="Company relationship data has not been independently confirmed."><span className="status-symbol">!</span> Not Verified</span>}
                      {!isCompanies && (
                        <div className="browse-contact-actions">
                          {item.mobile && <a className="contact-action call-action" href={phoneLink(item.mobile)} onClick={e=>e.stopPropagation()}><Phone size={14}/><span>Call</span></a>}
                          {item.mobile && <a className="contact-action whatsapp-action" href={waLink(item.whatsapp || item.mobile,distributorWhatsAppMessage(item.distributor_name))} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}><MessageCircle size={14}/><span>WhatsApp</span></a>}
                        {mapsLink(item) && <a className="contact-action maps-action" href={mapsLink(item)} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}><MapPin size={14}/><span>Maps</span></a>}
                        </div>
                      )}
                      {!isLocations && <button type="button" className="browse-report-action" onClick={e=>{e.stopPropagation();onReport?.({type:isCompanies?'company':'distributor',id:item.id,name:isCompanies?item.company_name:item.distributor_name,message:`Please review the directory information for ${isCompanies?item.company_name:item.distributor_name}.`})}}><Flag size={12}/> Report / Update Info</button>}
                    </>
                  )}
                </div>
                {!isLocations && <button type="button" className="browse-card-open" aria-label={`Open ${isCompanies ? item.company_name : item.distributor_name} profile`} onClick={()=>onOpenProfile(isCompanies ? 'company' : 'distributor', item.id)}><ArrowRight size={18}/></button>}
              </div>
            ))}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="result-state">No matching {isLocations ? 'locations' : isCompanies ? 'companies' : 'distributors'} found.</div>
        )}
      </div>
    </section>
  )
}
