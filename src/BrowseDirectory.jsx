import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, LoaderCircle, Search, Truck } from 'lucide-react'
import { supabase } from './lib/supabase'

export default function BrowseDirectory({ type, category, onBack, onOpenProfile }) {
  const isCompanies = type === 'companies'
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
              .select('company_id,distributor_id,location_id')
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
          const entry = relationshipMap.get(rel.company_id) || { count: 0, locations: new Map() }
          entry.count += 1
          if (rel.location_id && locationMap.has(rel.location_id)) {
            entry.locations.set(rel.location_id, locationMap.get(rel.location_id))
          }
          relationshipMap.set(rel.company_id, entry)
        })

        if (!cancelled) {
          setItems(companyRows.map(x => {
            const info = relationshipMap.get(x.id) || { count: 0, locations: new Map() }
            return { ...x, relationshipCount: info.count, locations: [...info.locations.values()] }
          }))
        }
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
              .select('distributor_id')
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
        ;(rels || []).forEach(x => counts.set(x.distributor_id, (counts.get(x.distributor_id) || 0) + 1))

        if (!cancelled) {
          setItems((data || []).map(x => ({
            ...x,
            location: locationMap.get(x.city_id),
            relationshipCount: counts.get(x.id) || 0
          })))
        }
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [isCompanies, category])

  const term = query.trim().toLowerCase()
  const filtered = items.filter(item => {
    const name = isCompanies ? item.company_name : item.distributor_name
    const secondary = isCompanies ? item.short_name : item.contact_person
    const locationText = isCompanies
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
            <h2>{isCompanies && category ? category : isCompanies ? 'Companies' : 'Distributors'}</h2>
            <p>{isCompanies
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
            placeholder={isCompanies ? (category ? `Search ${category} companies or locations...` : 'Search companies or locations...') : 'Search distributors or locations...'}
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
              <button
                className="browse-card"
                key={item.id}
                onClick={() => onOpenProfile(isCompanies ? 'company' : 'distributor', item.id)}
              >
                <div className="browse-card-icon">
                  {isCompanies ? <Building2 size={20} /> : <Truck size={20} />}
                </div>
                <div className="browse-card-copy">
                  <strong>{isCompanies ? item.company_name : item.distributor_name}</strong>
                  {isCompanies && item.short_name && <span>{item.short_name}</span>}
                  {isCompanies && item.locations?.length > 0 && (
                    <div className="browse-card-locations">
                      {item.locations.map(location => (
                        <span className="browse-location" key={location.id}>
                          {formatLocation(location)}
                        </span>
                      ))}
                    </div>
                  )}
                  {!isCompanies && item.location && <span>{formatLocation(item.location)}</span>}
                  {!isCompanies && item.contact_person && <span>{item.contact_person}</span>}
                  <small>{item.relationshipCount} active {item.relationshipCount === 1 ? 'relationship' : 'relationships'}</small>
                </div>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="result-state">No matching {isCompanies ? 'companies' : 'distributors'} found.</div>
        )}
      </div>
    </section>
  )
}
