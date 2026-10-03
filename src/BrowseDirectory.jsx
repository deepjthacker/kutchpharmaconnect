import React from 'react'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, LoaderCircle, Search, Truck, MapPin, Phone, MessageCircle } from 'lucide-react'
import { supabase } from './lib/supabase'

const KPC_WEBSITE=typeof window!=='undefined'?window.location.origin+'/':''
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

export default function BrowseDirectory({ type, category, onBack, onOpenProfile }) {
  const isCompanies = type === 'companies'
  const isLocations = type === 'locations'
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      if (isCompanies) {
        let categoryCompanyIds = null
        if (category) {
          const { data: categoryRow, error: categoryError } = await supabase.from('categories').select('id,category_name').ilike('category_name', category).eq('status', 'active').maybeSingle()
          if (categoryError) { if (!cancelled) { setError(categoryError.message); setLoading(false) }; return }
          if (!categoryRow) { if (!cancelled) { setError('Category not found.'); setLoading(false) }; return }
          const { data: categoryLinks, error: categoryLinkError } = await supabase.from('company_categories').select('company_id').eq('category_id', categoryRow.id)
          if (categoryLinkError) { if (!cancelled) { setError(categoryLinkError.message); setLoading(false) }; return }
          categoryCompanyIds = [...new Set((categoryLinks || []).map(x => x.company_id).filter(Boolean))]
        }

        const { data, error: companyError } = await supabase
          .from('companies')
          .select('id,company_name,short_name')
          .eq('status', 'active')
          .order('company_name')

        if (companyError) {
          if (!cancelled) { setError(companyError.message); setLoading(false) }
          return
        }

        const companyRows = categoryCompanyIds ? (data || []).filter(x => categoryCompanyIds.includes(x.id)) : (data || [])
        const ids = companyRows.map(x => x.id)
        const { data: rels, error: relError } = ids.length
          ? await supabase
              .from('distributorships')
              .select('company_id,distributor_id,location_id,verification_status')
              .eq('status', 'active')
              .in('company_id', ids)
          : { data: [], error: null }

        if (relError) {
          if (!cancelled) { setError(relError.message); setLoading(false) }
          return
        }

        const locationIds = [...new Set((rels || []).map(x => x.location_id).filter(Boolean))]
        const { data: locations, error: locationError } = locationIds.length
          ? await supabase.from('locations').select('id,city,district,state,pincode').in('id', locationIds)
          : { data: [], error: null }

        if (locationError) {
          if (!cancelled) { setError(locationError.message); setLoading(false) }
          return
        }

        const locationMap = new Map((locations || []).map(x => [x.id, x]))
        const relationshipMap = new Map()
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
          setItems(companyRows.map(x => {
            const info = relationshipMap.get(x.id) || { count: 0, locations: new Map() }
            return { ...x, relationshipCount: info.count, verifiedCount: info.verifiedCount, reviewCount: info.reviewCount, locations: [...info.locations.values()] }
          }).filter(x => x.relationshipCount > 0))
        }
      } else if (isLocations) {
        const { data: locations, error: locationError } = await supabase.from('locations').select('id,city,district,state,pincode').order('city')
        if (locationError) { if (!cancelled) { setError(locationError.message); setLoading(false) }; return }
        const ids = (locations || []).map(x => x.id)
        const { data: rels, error: relError } = ids.length
          ? await supabase.from('distributorships').select('location_id,company_id,distributor_id').eq('status','active').in('location_id', ids)
          : { data: [], error: null }
        if (relError) { if (!cancelled) { setError(relError.message); setLoading(false) }; return }
        const companyIds=[...new Set((rels||[]).map(x=>x.company_id).filter(Boolean))]
        const distributorIds=[...new Set((rels||[]).map(x=>x.distributor_id).filter(Boolean))]
        const [companies,distributors]=await Promise.all([
          companyIds.length ? supabase.from('companies').select('id,company_name').in('id',companyIds).eq('status','active') : Promise.resolve({data:[],error:null}),
          distributorIds.length ? supabase.from('distributors').select('id,distributor_name').in('id',distributorIds).eq('status','active') : Promise.resolve({data:[],error:null})
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
        if(!cancelled) setItems((locations||[]).map(location=>{
          const e=grouped.get(location.id)||{companies:new Map(),distributors:new Map()}
          return {...location,companies:[...e.companies.values()],distributors:[...e.distributors.values()]}
        }).filter(x=>x.companies.length||x.distributors.length))
      } else {
        const { data, error: distributorError } = await supabase
          .from('distributors')
          .select('id,distributor_name,contact_person,mobile,city_id')
          .eq('status', 'active')
          .order('distributor_name')

        if (distributorError) {
          if (!cancelled) { setError(distributorError.message); setLoading(false) }
          return
        }

        const ids = (data || []).map(x => x.id)
        const { data: rels, error: relError } = ids.length
          ? await supabase
              .from('distributorships')
              .select('distributor_id,verification_status')
              .eq('status', 'active')
              .in('distributor_id', ids)
          : { data: [], error: null }

        if (relError) {
          if (!cancelled) { setError(relError.message); setLoading(false) }
          return
        }

        const locationIds = [...new Set((data || []).map(x => x.city_id).filter(Boolean))]
        const { data: locations, error: locationError } = locationIds.length
          ? await supabase.from('locations').select('id,city,district,state,pincode').in('id', locationIds)
          : { data: [], error: null }

        if (locationError) {
          if (!cancelled) { setError(locationError.message); setLoading(false) }
          return
        }

        const locationMap = new Map((locations || []).map(x => [x.id, x]))
        const counts = new Map()
        ;(rels || []).forEach(x => {
          const entry = counts.get(x.distributor_id) || { count: 0, verifiedCount: 0, reviewCount: 0 }
          entry.count += 1
          if (x.verification_status === 'verified') entry.verifiedCount += 1
          if (x.verification_status === 'needs_review') entry.reviewCount += 1
          counts.set(x.distributor_id, entry)
        })

        if (!cancelled) {
          setItems((data || []).map(x => ({
            ...x,
            location: locationMap.get(x.city_id),
            relationshipCount: counts.get(x.id)?.count || 0,
            verifiedCount: counts.get(x.id)?.verifiedCount || 0,
            reviewCount: counts.get(x.id)?.reviewCount || 0
          })))
        }
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [isCompanies, isLocations, category])

  const term = query.trim().toLowerCase()
  const filtered = items.filter(item => {
    const name = isLocations ? [item.city,item.district,item.state,item.pincode].filter(Boolean).join(' ') : isCompanies ? item.company_name : item.distributor_name
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
            <h2>{isLocations ? 'Kutch Locations' : isCompanies && category ? category : isCompanies ? 'Companies' : 'Distributors'}</h2>
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

        {loading && (
          <div className="result-state"><LoaderCircle className="spin" size={20} /> Loading directory…</div>
        )}

        {!loading && error && <div className="result-state">{error}</div>}

        {!loading && !error && filtered.length > 0 && (
          <div className="browse-grid">
            {filtered.map(item => (
              <div
                className="browse-card"
                key={item.id}
                role={isLocations ? undefined : 'button'}
                tabIndex={isLocations ? undefined : 0}
                onClick={() => !isLocations && onOpenProfile(isCompanies ? 'company' : 'distributor', item.id)}
                onKeyDown={e => {
                  if(!isLocations && (e.key === 'Enter' || e.key === ' ')){
                    e.preventDefault()
                    onOpenProfile(isCompanies ? 'company' : 'distributor', item.id)
                  }
                }}
              >
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
                      {isCompanies && item.locations?.length > 0 && <div className="browse-card-locations">{item.locations.map(location => <span className="browse-location" key={location.id}>{formatLocation(location)}</span>)}</div>}
                      {!isCompanies && item.location && <span>{formatLocation(item.location)}</span>}
                      {!isCompanies && item.contact_person && <span>{item.contact_person}</span>}
                      <small>{item.relationshipCount} active {item.relationshipCount === 1 ? 'relationship' : 'relationships'}</small>
                      {item.verifiedCount > 0 && <span className="verified-badge verified-badge-small" title="At least one current Kutch distributorship relationship has been independently verified.">✓ Verified</span>}
                      {item.verifiedCount === 0 && item.reviewCount > 0 && <span className="status-badge status-review">Under Review</span>}
                      {item.verifiedCount === 0 && item.reviewCount === 0 && <span className="status-badge status-unverified" title="Current relationships are listed from supplied directory data but have not been independently confirmed."><span className="status-symbol">!</span> Not Verified</span>}
                      {!isCompanies && (
                        <div className="browse-contact-actions">
                          {item.mobile && <a href={phoneLink(item.mobile)} onClick={e=>e.stopPropagation()}><Phone size={13}/> Call</a>}
                          {item.mobile && <a href={waLink(item.mobile,distributorWhatsAppMessage(item.distributor_name))} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}><MessageCircle size={13}/> WhatsApp</a>}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {!isLocations && <ArrowRight size={18} />}
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
