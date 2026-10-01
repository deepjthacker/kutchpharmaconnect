import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, LoaderCircle, Search, Truck } from 'lucide-react'
import { supabase } from './lib/supabase'

export default function BrowseDirectory({ type, onBack, onOpenProfile }) {
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
        const { data, error: companyError } = await supabase
          .from('companies')
          .select('id,company_name,short_name')
          .eq('status', 'active')
          .order('company_name')

        if (companyError) {
          if (!cancelled) { setError(companyError.message); setLoading(false) }
          return
        }

        const ids = (data || []).map(x => x.id)
        const { data: rels, error: relError } = ids.length
          ? await supabase.from('distributorships').select('company_id').eq('status', 'active').in('company_id', ids)
          : { data: [], error: null }

        if (relError) {
          if (!cancelled) { setError(relError.message); setLoading(false) }
          return
        }

        const counts = new Map()
        ;(rels || []).forEach(x => counts.set(x.company_id, (counts.get(x.company_id) || 0) + 1))

        if (!cancelled) setItems((data || []).map(x => ({ ...x, relationshipCount: counts.get(x.id) || 0 })))
      } else {
        const { data, error: distributorError } = await supabase
          .from('distributors')
          .select('id,distributor_name,contact_person,mobile')
          .eq('status', 'active')
          .order('distributor_name')

        if (distributorError) {
          if (!cancelled) { setError(distributorError.message); setLoading(false) }
          return
        }

        const ids = (data || []).map(x => x.id)
        const { data: rels, error: relError } = ids.length
          ? await supabase.from('distributorships').select('distributor_id').eq('status', 'active').in('distributor_id', ids)
          : { data: [], error: null }

        if (relError) {
          if (!cancelled) { setError(relError.message); setLoading(false) }
          return
        }

        const counts = new Map()
        ;(rels || []).forEach(x => counts.set(x.distributor_id, (counts.get(x.distributor_id) || 0) + 1))

        if (!cancelled) setItems((data || []).map(x => ({ ...x, relationshipCount: counts.get(x.id) || 0 })))
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [isCompanies])

  const term = query.trim().toLowerCase()
  const filtered = items.filter(item => {
    const name = isCompanies ? item.company_name : item.distributor_name
    const secondary = isCompanies ? item.short_name : item.contact_person
    return !term || name.toLowerCase().includes(term) || (secondary || '').toLowerCase().includes(term)
  })

  return (
    <section className="browse-section">
      <div className="container browse-container">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>

        <div className="browse-header">
          <div>
            <p className="section-kicker">DIRECTORY</p>
            <h2>{isCompanies ? 'Companies' : 'Distributors'}</h2>
            <p>{isCompanies
              ? 'Browse active companies with current Kutch distributorship relationships.'
              : 'Browse active distributors and the companies they currently handle.'}</p>
          </div>
          {!loading && !error && <div className="browse-count">{filtered.length} {filtered.length === 1 ? 'record' : 'records'}</div>}
        </div>

        <div className="browse-search">
          <Search size={18} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={isCompanies ? 'Search companies...' : 'Search distributors...'}
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
