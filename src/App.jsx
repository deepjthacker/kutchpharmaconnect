import { useEffect, useState } from 'react'
import { Search, Building2, Truck, ArrowRight, ShieldCheck, LoaderCircle, MapPin, Phone, MessageCircle, ArrowLeft, UserRound } from 'lucide-react'
import { supabase } from './lib/supabase'

const categories=['Pharmaceutical','Surgical','OTC','Ayurvedic','Nutraceutical','Medical Devices','Diagnostic','Veterinary']

export default function App(){
  const [q,setQ]=useState(''),[results,setResults]=useState([]),[loading,setLoading]=useState(false),[searched,setSearched]=useState(false),[error,setError]=useState(''),[profile,setProfile]=useState(null),[profileLoading,setProfileLoading]=useState(false)

  useEffect(()=>{const t=setTimeout(()=>q.trim().length>=2?search(q.trim()):(setResults([]),setSearched(false)),250);return()=>clearTimeout(t)},[q])

  async function search(term){
    setLoading(true);setSearched(true);setError('')
    const p='%'+term.replace(/[%_]/g,'')+'%'
    const [co,di,dv,al]=await Promise.all([
      supabase.from('companies').select('id,company_name,short_name').eq('status','active').or(`company_name.ilike.${p},legal_name.ilike.${p},short_name.ilike.${p}`).limit(12),
      supabase.from('distributors').select('id,distributor_name,contact_person,mobile,whatsapp,address,city_id,maps_url').eq('status','active').or(`distributor_name.ilike.${p},legal_name.ilike.${p},contact_person.ilike.${p}`).limit(12),
      supabase.from('divisions').select('id,division_name,company_id').eq('status','active').or(`division_name.ilike.${p},division_code.ilike.${p}`).limit(12),
      supabase.from('search_aliases').select('entity_id,alias').eq('entity_type','company').ilike('alias',p).limit(12)
    ])
    const err=co.error||di.error||dv.error||al.error
    if(err){setError(err.message);setResults([]);setLoading(false);return}

    const aliasIds=[...new Set((al.data||[]).map(x=>x.entity_id))]
    let aliasCompanies=[]
    if(aliasIds.length){
      const r=await supabase.from('companies').select('id,company_name').in('id',aliasIds).eq('status','active')
      if(r.error){setError(r.error.message);setLoading(false);return}
      aliasCompanies=r.data||[]
    }

    const companyRows=[...(co.data||[]),...aliasCompanies]
    const companies=[...new Map(companyRows.map(x=>[x.id,x])).values()]
    const distributorRows=di.data||[]
    const divisionRows=dv.data||[]

    const companyIds=[...new Set(companies.map(x=>x.id))]
    const divisionIds=divisionRows.map(x=>x.id)
    const distributorIds=distributorRows.map(x=>x.id)

    const relatedCompanyIds=[...new Set([...companyIds,...divisionRows.map(x=>x.company_id)])]

    const relQuery=relatedCompanyIds.length
      ? supabase.from('distributorships').select('id,company_id,division_id,distributor_id,territory,status,verification_status,verification_note,category_id').eq('status','active').in('company_id',relatedCompanyIds)
      : Promise.resolve({data:[],error:null})

    const distributorRelQuery=distributorIds.length
      ? supabase.from('distributorships').select('id,company_id,division_id,distributor_id,territory,status,verification_status,verification_note,category_id').eq('status','active').in('distributor_id',distributorIds)
      : Promise.resolve({data:[],error:null})

    const [rr,dr]=await Promise.all([relQuery,distributorRelQuery])
    if(rr.error||dr.error){setError((rr.error||dr.error).message);setResults([]);setLoading(false);return}

    const relationships=[...new Map([...(rr.data||[]),...(dr.data||[])].map(x=>[x.id,x])).values()]
    const allCompanyIds=[...new Set(relationships.map(x=>x.company_id))]
    const allDistributorIds=[...new Set(relationships.map(x=>x.distributor_id))]
    const allDivisionIds=[...new Set(relationships.map(x=>x.division_id).filter(Boolean))]

    const [rc,rd,rv]=await Promise.all([
      allCompanyIds.length?supabase.from('companies').select('id,company_name,short_name').in('id',allCompanyIds):Promise.resolve({data:[],error:null}),
      allDistributorIds.length?supabase.from('distributors').select('id,distributor_name,contact_person,mobile,whatsapp,address,city_id,maps_url').in('id',allDistributorIds):Promise.resolve({data:[],error:null}),
      allDivisionIds.length?supabase.from('divisions').select('id,division_name,company_id').in('id',allDivisionIds):Promise.resolve({data:[],error:null})
    ])
    const lookupErr=rc.error||rd.error||rv.error
    if(lookupErr){setError(lookupErr.message);setResults([]);setLoading(false);return}

    const companyMap=new Map((rc.data||[]).map(x=>[x.id,x]))
    const distributorMap=new Map((rd.data||[]).map(x=>[x.id,x]))
    const divisionMap=new Map((rv.data||[]).map(x=>[x.id,x]))

    const searchedCompanyIds=new Set(companyIds)
    const searchedDistributorIds=new Set(distributorIds)
    const searchedDivisionIds=new Set(divisionIds)

    const cards=[]
    const seen=new Set()

    relationships.forEach(rel=>{
      const company=companyMap.get(rel.company_id)
      const distributor=distributorMap.get(rel.distributor_id)
      const division=rel.division_id?divisionMap.get(rel.division_id):null
      if(!company||!distributor)return

      const companyMatch=searchedCompanyIds.has(rel.company_id)
      const distributorMatch=searchedDistributorIds.has(rel.distributor_id)
      const divisionMatch=searchedDivisionIds.has(rel.division_id)

      if(companyMatch||divisionMatch){
        const key=`company-${rel.id}`
        if(!seen.has(key)){
          seen.add(key)
          cards.push({type:'relationship',icon:'company',title:company.company_name,subtitle:division?division.division_name:null,relation:'Currently handled by',target:distributor,rel})
        }
      }

      if(distributorMatch){
        const key=`distributor-${rel.id}`
        if(!seen.has(key)){
          seen.add(key)
          cards.push({type:'relationship',icon:'distributor',title:distributor.distributor_name,subtitle:division?division.division_name:null,relation:'Currently handles',target:company,rel})
        }
      }
    })

    setResults(cards)
    setLoading(false)
  }

  async function openProfile(type,id){
    setProfileLoading(true);setError('')
    if(type==='company'){
      const [companyRes, relRes]=await Promise.all([
        supabase.from('companies').select('id,company_name,short_name').eq('id',id).maybeSingle(),
        supabase.from('distributorships').select('id,distributor_id,division_id,territory,verification_status,verification_note').eq('company_id',id).eq('status','active')
      ])
      if(companyRes.error||relRes.error){setError((companyRes.error||relRes.error).message);setProfileLoading(false);return}
      const rels=relRes.data||[]
      const distributorIds=[...new Set(rels.map(x=>x.distributor_id))]
      const divisionIds=[...new Set(rels.map(x=>x.division_id).filter(Boolean))]
      const [dRes,vRes]=await Promise.all([
        distributorIds.length?supabase.from('distributors').select('id,distributor_name,contact_person,mobile,whatsapp,email,address,maps_url').in('id',distributorIds):Promise.resolve({data:[],error:null}),
        divisionIds.length?supabase.from('divisions').select('id,division_name').in('id',divisionIds):Promise.resolve({data:[],error:null})
      ])
      if(dRes.error||vRes.error){setError((dRes.error||vRes.error).message);setProfileLoading(false);return}
      const dm=new Map((dRes.data||[]).map(x=>[x.id,x]))
      const vm=new Map((vRes.data||[]).map(x=>[x.id,x]))
      setProfile({type:'company',entity:companyRes.data,relationships:rels.map(x=>({...x,distributor:dm.get(x.distributor_id),division:x.division_id?vm.get(x.division_id):null})).filter(x=>x.distributor)})
    }else{
      const [distRes,relRes]=await Promise.all([
        supabase.from('distributors').select('id,distributor_name,contact_person,mobile,whatsapp,email,address,maps_url').eq('id',id).maybeSingle(),
        supabase.from('distributorships').select('id,company_id,division_id,territory,verification_status,verification_note').eq('distributor_id',id).eq('status','active')
      ])
      if(distRes.error||relRes.error){setError((distRes.error||relRes.error).message);setProfileLoading(false);return}
      const rels=relRes.data||[]
      const companyIds=[...new Set(rels.map(x=>x.company_id))]
      const divisionIds=[...new Set(rels.map(x=>x.division_id).filter(Boolean))]
      const [cRes,vRes]=await Promise.all([
        companyIds.length?supabase.from('companies').select('id,company_name,short_name').in('id',companyIds):Promise.resolve({data:[],error:null}),
        divisionIds.length?supabase.from('divisions').select('id,division_name').in('id',divisionIds):Promise.resolve({data:[],error:null})
      ])
      if(cRes.error||vRes.error){setError((cRes.error||vRes.error).message);setProfileLoading(false);return}
      const cm=new Map((cRes.data||[]).map(x=>[x.id,x]))
      const vm=new Map((vRes.data||[]).map(x=>[x.id,x]))
      setProfile({type:'distributor',entity:distRes.data,relationships:rels.map(x=>({...x,company:cm.get(x.company_id),division:x.division_id?vm.get(x.division_id):null})).filter(x=>x.company)})
    }
    setProfileLoading(false)
  }

  function closeProfile(){
    setProfile(null);setProfileLoading(false)
  }

  function renderProfile(){
    return (
      <section className="profile-section">
        <div className="container profile-container">
          <button className="back-button" onClick={closeProfile}>
            <ArrowLeft size={16}/> Back to search
          </button>

          {profileLoading && (
            <div className="result-state">
              <LoaderCircle className="spin" size={20}/> Loading profile…
            </div>
          )}

          {!profileLoading && error && (
            <div className="result-state">{error}</div>
          )}

          {!profileLoading && !error && profile && (
            <div className="profile-card">
              <div className="profile-heading">
                <div className="profile-icon">
                  {profile.type === 'company' ? <Building2 size={24}/> : <Truck size={24}/>}
                </div>
                <div>
                  <p className="profile-kicker">
                    {profile.type === 'company' ? 'COMPANY' : 'DISTRIBUTOR'}
                  </p>
                  <h2>{profile.entity?.company_name || profile.entity?.distributor_name}</h2>
                  {profile.entity?.short_name && (
                    <span className="profile-short">{profile.entity.short_name}</span>
                  )}
                </div>
              </div>

              {profile.type === 'distributor' && (
                <div className="contact-panel">
                  {profile.entity.contact_person && (
                    <div><UserRound size={15}/><span>{profile.entity.contact_person}</span></div>
                  )}
                  {profile.entity.mobile && (
                    <div>
                      <Phone size={15}/>
                      <a href={`tel:${profile.entity.mobile}`}>{profile.entity.mobile}</a>
                    </div>
                  )}
                  {profile.entity.whatsapp && (
                    <div>
                      <MessageCircle size={15}/>
                      <a href={`https://wa.me/${profile.entity.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                        {profile.entity.whatsapp}
                      </a>
                    </div>
                  )}
                  {profile.entity.email && (
                    <div>
                      <span className="contact-symbol">@</span>
                      <a href={`mailto:${profile.entity.email}`}>{profile.entity.email}</a>
                    </div>
                  )}
                  {profile.entity.address && (
                    <div><MapPin size={15}/><span>{profile.entity.address}</span></div>
                  )}

                  <div className="profile-actions">
                    {profile.entity.mobile && (
                      <a href={`tel:${profile.entity.mobile}`}><Phone size={15}/> Call</a>
                    )}
                    {profile.entity.whatsapp && (
                      <a href={`https://wa.me/${profile.entity.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                        <MessageCircle size={15}/> WhatsApp
                      </a>
                    )}
                    {profile.entity.maps_url && (
                      <a href={profile.entity.maps_url} target="_blank" rel="noreferrer">
                        <MapPin size={15}/> Maps
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="profile-list">
                <div className="profile-list-title">
                  {profile.type === 'company' ? 'Currently handled by' : 'Currently handles'}
                </div>

                {profile.relationships.length > 0 ? (
                  profile.relationships.map(rel => (
                    <div className="profile-rel" key={rel.id}>
                      <div>
                        {profile.type === 'company' ? (
                          <button className="profile-link-button" onClick={() => openProfile('distributor', rel.distributor_id)}>
                            {rel.distributor?.distributor_name}
                          </button>
                        ) : (
                          <button className="profile-link-button" onClick={() => openProfile('company', rel.company_id)}>
                            {rel.company?.company_name}
                          </button>
                        )}
                        {rel.division && <span>{rel.division.division_name}</span>}
                        {profile.type === 'company' && rel.distributor?.mobile && (
                          <div className="profile-rel-phone">
                            <Phone size={13}/>
                            <a href={`tel:${rel.distributor.mobile}`}>{rel.distributor.mobile}</a>
                          </div>
                        )}
                      </div>
                      <div className="profile-rel-right">
                        <small>
                          {rel.territory || 'Kutch'} • {
                            rel.verification_status === 'verified'
                              ? '✓ Verified'
                              : rel.verification_status === 'needs_review'
                                ? 'Under Review'
                                : '! Not Verified'
                          }
                        </small>
                        {profile.type === 'company' && rel.distributor?.mobile && (
                          <a className="profile-rel-call" href={`tel:${rel.distributor.mobile}`}>
                            <Phone size={13}/> Call
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="result-state">No active distributorships found.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    )
  }

  function renderSearch(){
    return (
      <>
        <section className="hero">
          <div className="container hero-inner">
            <div className="eyebrow">
              <ShieldCheck size={16}/> Kutch pharmaceutical directory
            </div>

            <h1>Find Who Handles<br/><span>What in Kutch.</span></h1>

            <p className="hero-copy">
              Search a company or distributor to find the current Kutch distributorship relationship and contact details.
            </p>

            <form
              className="search-box"
              onSubmit={e => {
                e.preventDefault()
                if (q.trim().length >= 2) search(q.trim())
              }}
            >
              <Search size={22}/>
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                type="search"
                placeholder="Search company, distributor, division..."
                aria-label="Search"
              />
              <button>Search</button>
            </form>

            {searched && (
              <div className="search-results">
                {loading && (
                  <div className="result-state">
                    <LoaderCircle className="spin" size={20}/> Searching…
                  </div>
                )}

                {!loading && error && (
                  <div className="result-state">{error}</div>
                )}

                {!loading && !error && results.length > 0 && (
                  <div className="results-list">
                    {results.map(r => {
                      const profileType = r.icon === 'company' ? 'company' : 'distributor'
                      const profileId = r.icon === 'company'
                        ? r.rel.company_id
                        : r.rel.distributor_id

                      return (
                        <div
                          className="result-card"
                          key={r.type + r.rel.id}
                          onClick={() => openProfile(profileType, profileId)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => {
                            if (e.key === 'Enter') openProfile(profileType, profileId)
                          }}
                        >
                          <div className={`result-icon ${r.icon === 'distributor' ? 'distributor-icon' : ''}`}>
                            {r.icon === 'company' ? <Building2 size={19}/> : <Truck size={19}/>}
                          </div>

                          <div className="result-copy">
                            <strong>{r.title}</strong>
                            {r.subtitle && <span className="result-division">{r.subtitle}</span>}
                            <span className="result-relation">{r.relation}</span>
                            <span className="result-target">
                              {r.target.company_name || r.target.distributor_name}
                            </span>
                            <span className="result-meta">
                              {r.rel.territory || 'Kutch'} • {
                                r.rel.verification_status === 'verified'
                                  ? '✓ Verified'
                                  : r.rel.verification_status === 'needs_review'
                                    ? 'Under Review'
                                    : '! Not Verified'
                              }
                            </span>

                            {r.target.mobile && (
                              <div className="result-phone">
                                <Phone size={13}/>
                                <a
                                  href={`tel:${r.target.mobile}`}
                                  onClick={e => e.stopPropagation()}
                                >
                                  {r.target.mobile}
                                </a>
                              </div>
                            )}

                            <div className="result-actions">
                              {r.target.mobile && (
                                <a
                                  href={`tel:${r.target.mobile}`}
                                  onClick={e => e.stopPropagation()}
                                >
                                  <Phone size={14}/> Call
                                </a>
                              )}
                              {r.target.whatsapp && (
                                <a
                                  href={`https://wa.me/${r.target.whatsapp.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <MessageCircle size={14}/> WhatsApp
                                </a>
                              )}
                              {r.target.maps_url && (
                                <a
                                  href={r.target.maps_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <MapPin size={14}/> Maps
                                </a>
                              )}
                            </div>
                          </div>

                          <button
                            className="result-open"
                            aria-label="Open profile"
                            onClick={e => {
                              e.stopPropagation()
                              openProfile(profileType, profileId)
                            }}
                          >
                            <ArrowRight size={18}/>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {!loading && !error && results.length === 0 && (
                  <div className="result-state">
                    No current distributor relationship found for this search.
                  </div>
                )}
              </div>
            )}

            {!searched && (
              <div className="quick-links">
                <button><Building2 size={17}/> Browse Companies <ArrowRight size={15}/></button>
                <button><Truck size={17}/> Browse Distributors <ArrowRight size={15}/></button>
              </div>
            )}
          </div>
        </section>

        <section className="directory-section">
          <div className="container">
            <div className="section-heading">
              <div>
                <p className="section-kicker">DIRECTORY</p>
                <h2>Browse by category</h2>
              </div>
              <p>Find companies and distributors across Kutch.</p>
            </div>

            <div className="category-grid">
              {categories.map(x => (
                <button className="category-card" key={x}>
                  <span>{x}</span>
                  <ArrowRight size={17}/>
                </button>
              ))}
            </div>
          </div>
        </section>
      </>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <a className="brand" href="/">
            <div className="brand-mark">KP</div>
            <div>
              <div className="brand-name">KutchPharmaConnect</div>
              <div className="brand-tagline">Find Who Handles What in Kutch</div>
            </div>
          </a>
        </div>
      </header>

      <main>
        {profile ? renderProfile() : renderSearch()}
      </main>

      <footer>
        <div className="container footer-inner">
          <span>KutchPharmaConnect</span>
          <span>Companies • Distributors • Divisions • Contact Details</span>
        </div>
      </footer>
    </div>
  )
}
