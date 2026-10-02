import { useEffect, useState } from 'react'
import { Search, Building2, Truck, ArrowRight, ShieldCheck, LoaderCircle, MapPin, Phone, MessageCircle, ArrowLeft, UserRound, Flag, X, CheckCircle2 } from 'lucide-react'
import { supabase } from './lib/supabase'
import BrowseDirectory from './BrowseDirectory'
import AdminDashboard from './AdminDashboard'

const categories=['Pharmaceutical','Surgical','OTC','Ayurvedic','Nutraceutical','Medical Devices','Diagnostic','Veterinary']

export default function App(){
  const [admin,setAdmin]=useState(false),[session,setSession]=useState(null),[authLoading,setAuthLoading]=useState(true),[authOpen,setAuthOpen]=useState(false),[authEmail,setAuthEmail]=useState(''),[authPassword,setAuthPassword]=useState(''),[authError,setAuthError]=useState(''),[authBusy,setAuthBusy]=useState(false),[q,setQ]=useState(''),[results,setResults]=useState([]),[loading,setLoading]=useState(false),[searched,setSearched]=useState(false),[error,setError]=useState(''),[profile,setProfile]=useState(null),[profileLoading,setProfileLoading]=useState(false),[browse,setBrowse]=useState(null),[browseCategory,setBrowseCategory]=useState(null),[suggestions,setSuggestions]=useState([]),[suggestionLoading,setSuggestionLoading]=useState(false),[showSuggestions,setShowSuggestions]=useState(false),[reportOpen,setReportOpen]=useState(false),[reportSubmitting,setReportSubmitting]=useState(false),[reportSent,setReportSent]=useState(false),[reportError,setReportError]=useState(''),[report,setReport]=useState({type:'incorrect_relationship',message:'',contact:''})

  useEffect(()=>{
    let mounted=true
    supabase.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);setAuthLoading(false)}})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);setAuthLoading(false)})
    return()=>{mounted=false;subscription.unsubscribe()}
  },[])

  async function signInAdmin(e){
    e.preventDefault();setAuthBusy(true);setAuthError('')
    const {data,error}=await supabase.auth.signInWithPassword({email:authEmail,password:authPassword})
    if(error){setAuthError(error.message);setAuthBusy(false);return}
    const {data:adminRow,error:adminError}=await supabase.from('admin_users').select('id').eq('user_id',data.user.id).eq('active',true).maybeSingle()
    if(adminError||!adminRow){await supabase.auth.signOut();setAuthError('This account is not authorized as a KutchPharmaConnect admin.');setAuthBusy(false);return}
    setAuthOpen(false);setAdmin(true);setAuthBusy(false)
  }

  async function signOutAdmin(){
    await supabase.auth.signOut();setAdmin(false)
  }

  useEffect(()=>{
    const t=setTimeout(()=>{
      const term=q.trim()
      if(term.length<2){
        setResults([])
        setSearched(false)
        setSuggestions([])
        setShowSuggestions(false)
        return
      }
      loadSuggestions(term)
      search(term)
    },250)
    return()=>clearTimeout(t)
  },[q])

  async function loadSuggestions(term){
    setSuggestionLoading(true)
    const p='%'+term.replace(/[%_]/g,'')+'%'
    const [co,di,dv,al]=await Promise.all([
      supabase.from('companies').select('id,company_name,short_name').eq('status','active').or('company_name.ilike.'+p+',legal_name.ilike.'+p+',short_name.ilike.'+p).limit(5),
      supabase.from('distributors').select('id,distributor_name,contact_person').eq('status','active').or('distributor_name.ilike.'+p+',legal_name.ilike.'+p+',contact_person.ilike.'+p).limit(5),
      supabase.from('divisions').select('id,division_name,company_id').eq('status','active').or('division_name.ilike.'+p+',division_code.ilike.'+p).limit(5),
      supabase.from('search_aliases').select('entity_type,entity_id,alias').ilike('alias',p).limit(8)
    ])
    if(co.error||di.error||dv.error||al.error){setSuggestions([]);setSuggestionLoading(false);return}

    const companyAliasIds=[...new Set((al.data||[]).filter(x=>x.entity_type==='company').map(x=>x.entity_id))]
    const distributorAliasIds=[...new Set((al.data||[]).filter(x=>x.entity_type==='distributor').map(x=>x.entity_id))]
    const [ac,ad]=await Promise.all([
      companyAliasIds.length?supabase.from('companies').select('id,company_name,short_name').in('id',companyAliasIds).eq('status','active'):Promise.resolve({data:[],error:null}),
      distributorAliasIds.length?supabase.from('distributors').select('id,distributor_name,contact_person').in('id',distributorAliasIds).eq('status','active'):Promise.resolve({data:[],error:null})
    ])

    const next=[]
    const seen=new Set()
    ;[...(co.data||[]),...(ac.data||[])].forEach(x=>{
      if(!seen.has('company-'+x.id)){seen.add('company-'+x.id);next.push({type:'company',id:x.id,label:x.company_name,meta:x.short_name||'Company'})}
    })
    ;[...(di.data||[]),...(ad.data||[])].forEach(x=>{
      if(!seen.has('distributor-'+x.id)){seen.add('distributor-'+x.id);next.push({type:'distributor',id:x.id,label:x.distributor_name,meta:x.contact_person?'Distributor • '+x.contact_person:'Distributor'})}
    })
    ;(dv.data||[]).forEach(x=>{
      if(!seen.has('division-'+x.id)){seen.add('division-'+x.id);next.push({type:'division',id:x.id,companyId:x.company_id,label:x.division_name,meta:'Division'})}
    })
    setSuggestions(next.slice(0,10))
    setSuggestionLoading(false)
  }

  async function submitReport(e){
    e.preventDefault()
    if(!report.message.trim()) return
    setReportSubmitting(true);setReportError('')
    const payload={
      entity_type: profile?.type || null,
      entity_id: profile?.entity?.id || null,
      issue_type: report.type,
      description: report.message.trim()
    }
    const { error } = await supabase.from('correction_reports').insert(payload)
    if(error){setReportError(error.message);setReportSubmitting(false);return}
    setReportSent(true);setReportSubmitting(false)
  }

  function openReport(){
    setReport({type:'incorrect_relationship',message:'',contact:''})
    setReportError('');setReportSent(false);setReportOpen(true)
  }

  function chooseSuggestion(item){
    setShowSuggestions(false)
    if(item.type==='company'||item.type==='distributor'){
      openProfile(item.type,item.id)
      return
    }
    setQ(item.label)
  }


  async function search(term){
    setLoading(true);setSearched(true);setError('')

    const cleanTerm=term.trim().replace(/[%_]/g,'')
    const p='%'+cleanTerm+'%'

    const [co,di,dv,al,loc] = await Promise.all([
      supabase.from('companies').select('id,company_name,short_name').eq('status','active').or('company_name.ilike.'+p+',legal_name.ilike.'+p+',short_name.ilike.'+p).limit(12),
      supabase.from('distributors').select('id,distributor_name,contact_person,mobile,whatsapp,address,city_id,maps_url').eq('status','active').or('distributor_name.ilike.'+p+',legal_name.ilike.'+p+',contact_person.ilike.'+p).limit(12),
      supabase.from('divisions').select('id,division_name,company_id').eq('status','active').or('division_name.ilike.'+p+',division_code.ilike.'+p).limit(12),
      supabase.from('search_aliases').select('entity_type,entity_id,alias').ilike('alias',p).limit(24),
      supabase.from('locations').select('id,city,district,state,pincode').or('city.ilike.'+p+',district.ilike.'+p+',state.ilike.'+p+',pincode.ilike.'+p).limit(12)
    ])

    const err=co.error||di.error||dv.error||al.error||loc.error
    if(err){setError(err.message);setResults([]);setLoading(false);return}

    const aliasCompanyIds=[...new Set((al.data||[]).filter(x=>x.entity_type==='company').map(x=>x.entity_id))]
    const aliasDistributorIds=[...new Set((al.data||[]).filter(x=>x.entity_type==='distributor').map(x=>x.entity_id))]
    const locationIds=(loc.data||[]).map(x=>x.id)

    const [aliasCompaniesRes,aliasDistributorsRes,locationRelsRes] = await Promise.all([
      aliasCompanyIds.length
        ? supabase.from('companies').select('id,company_name,short_name').in('id',aliasCompanyIds).eq('status','active')
        : Promise.resolve({data:[],error:null}),
      aliasDistributorIds.length
        ? supabase.from('distributors').select('id,distributor_name,contact_person,mobile,whatsapp,address,city_id,maps_url').in('id',aliasDistributorIds).eq('status','active')
        : Promise.resolve({data:[],error:null}),
      locationIds.length
        ? supabase.from('distributorships').select('id,company_id,division_id,distributor_id,territory,status,verification_status,verification_note,category_id,location_id').eq('status','active').in('location_id',locationIds)
        : Promise.resolve({data:[],error:null})
    ])

    const aliasError=aliasCompaniesRes.error||aliasDistributorsRes.error||locationRelsRes.error
    if(aliasError){setError(aliasError.message);setResults([]);setLoading(false);return}

    const companies=[...new Map([...(co.data||[]),...(aliasCompaniesRes.data||[])].map(x=>[x.id,x])).values()]
    const distributors=[...new Map([...(di.data||[]),...(aliasDistributorsRes.data||[])].map(x=>[x.id,x])).values()]
    const divisionRows=dv.data||[]

    const companyIds=[...new Set(companies.map(x=>x.id))]
    const divisionIds=divisionRows.map(x=>x.id)
    const distributorIds=[...new Set(distributors.map(x=>x.id))]
    const relatedCompanyIds=[...new Set([...companyIds,...divisionRows.map(x=>x.company_id)])]

    const relQuery=relatedCompanyIds.length
      ? supabase.from('distributorships').select('id,company_id,division_id,distributor_id,territory,status,verification_status,verification_note,category_id,location_id').eq('status','active').in('company_id',relatedCompanyIds)
      : Promise.resolve({data:[],error:null})

    const distributorRelQuery=distributorIds.length
      ? supabase.from('distributorships').select('id,company_id,division_id,distributor_id,territory,status,verification_status,verification_note,category_id,location_id').eq('status','active').in('distributor_id',distributorIds)
      : Promise.resolve({data:[],error:null})

    const [rr,dr]=await Promise.all([relQuery,distributorRelQuery])
    if(rr.error||dr.error){setError((rr.error||dr.error).message);setResults([]);setLoading(false);return}

    const relationships=[...new Map([...(rr.data||[]),...(dr.data||[]),...(locationRelsRes.data||[])].map(x=>[x.id,x])).values()]
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
    const searchedLocationIds=new Set(locationIds)

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
      const locationMatch=searchedLocationIds.has(rel.location_id)

      if(companyMatch||divisionMatch||locationMatch){
        const key='company-'+rel.id
        if(!seen.has(key)){
          seen.add(key)
          cards.push({type:'relationship',icon:'company',title:company.company_name,subtitle:division?division.division_name:null,relation:'Currently handled by',target:distributor,rel})
        }
      }

      if(distributorMatch||locationMatch){
        const key='distributor-'+rel.id
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
        supabase.from('distributorships').select('id,distributor_id,division_id,location_id,territory,verification_status,verification_note').eq('company_id',id).eq('status','active')
      ])
      if(companyRes.error||relRes.error){setError((companyRes.error||relRes.error).message);setProfileLoading(false);return}
      const rels=relRes.data||[]
      const distributorIds=[...new Set(rels.map(x=>x.distributor_id))]
      const divisionIds=[...new Set(rels.map(x=>x.division_id).filter(Boolean))]
      const locationIds=[...new Set(rels.map(x=>x.location_id).filter(Boolean))]
      const [dRes,vRes,lRes]=await Promise.all([
        distributorIds.length?supabase.from('distributors').select('id,distributor_name,contact_person,mobile,whatsapp,email,address,maps_url').in('id',distributorIds):Promise.resolve({data:[],error:null}),
        divisionIds.length?supabase.from('divisions').select('id,division_name').in('id',divisionIds):Promise.resolve({data:[],error:null}),
        locationIds.length?supabase.from('locations').select('id,city,district,state,pincode').in('id',locationIds):Promise.resolve({data:[],error:null})
      ])
      if(dRes.error||vRes.error||lRes.error){setError((dRes.error||vRes.error).message);setProfileLoading(false);return}
      const dm=new Map((dRes.data||[]).map(x=>[x.id,x]))
      const vm=new Map((vRes.data||[]).map(x=>[x.id,x]))
      const lm=new Map((lRes.data||[]).map(x=>[x.id,x]))
      setProfile({type:'company',entity:companyRes.data,relationships:rels.map(x=>({...x,distributor:dm.get(x.distributor_id),division:x.division_id?vm.get(x.division_id):null,location:x.location_id?lm.get(x.location_id):null})).filter(x=>x.distributor)})
    }else{
      const [distRes,relRes]=await Promise.all([
        supabase.from('distributors').select('id,distributor_name,contact_person,mobile,whatsapp,email,address,maps_url,city_id').eq('id',id).maybeSingle(),
        supabase.from('distributorships').select('id,company_id,division_id,location_id,territory,verification_status,verification_note').eq('distributor_id',id).eq('status','active')
      ])
      if(distRes.error||relRes.error){setError((distRes.error||relRes.error).message);setProfileLoading(false);return}
      const rels=relRes.data||[]
      const companyIds=[...new Set(rels.map(x=>x.company_id))]
      const divisionIds=[...new Set(rels.map(x=>x.division_id).filter(Boolean))]
      const locationIds=[...new Set(rels.map(x=>x.location_id).filter(Boolean))]
      const [cRes,vRes,lRes]=await Promise.all([
        companyIds.length?supabase.from('companies').select('id,company_name,short_name').in('id',companyIds):Promise.resolve({data:[],error:null}),
        divisionIds.length?supabase.from('divisions').select('id,division_name').in('id',divisionIds):Promise.resolve({data:[],error:null}),
        locationIds.length?supabase.from('locations').select('id,city,district,state,pincode').in('id',locationIds):Promise.resolve({data:[],error:null})
      ])
      if(cRes.error||vRes.error||lRes.error){setError((cRes.error||vRes.error).message);setProfileLoading(false);return}
      const cm=new Map((cRes.data||[]).map(x=>[x.id,x]))
      const vm=new Map((vRes.data||[]).map(x=>[x.id,x]))
      const lm=new Map((lRes.data||[]).map(x=>[x.id,x]))
      setProfile({type:'distributor',entity:distRes.data,relationships:rels.map(x=>({...x,company:cm.get(x.company_id),division:x.division_id?vm.get(x.division_id):null,location:x.location_id?lm.get(x.location_id):null})).filter(x=>x.company)})
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
                    <>
                      <span className="profile-short">{profile.entity.short_name}</span>
                      <span className="profile-summary">{profile.relationships.length} active Kutch {profile.relationships.length===1?'relationship':'relationships'}</span>
                    </>
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
                          {rel.location ? [rel.location.city,rel.location.district,rel.location.state].filter(Boolean).join(', ') : (rel.territory || 'Kutch')} • {
                            rel.verification_status === 'verified'
                              ? '✓ Verified'
                              : rel.verification_status === 'needs_review'
                                ? 'Under Review'
                                : '! Not Verified'
                          }
                        </small>
                        {profile.type === 'company' && (
                          <div className="profile-rel-actions">
                            {rel.distributor?.mobile && <a className="profile-rel-action" href={`tel:${rel.distributor.mobile}`}><Phone size={13}/> Call</a>}
                            {rel.distributor?.whatsapp && <a className="profile-rel-action" href={`https://wa.me/${rel.distributor.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"><MessageCircle size={13}/> WhatsApp</a>}
                            {rel.distributor?.maps_url && <a className="profile-rel-action" href={rel.distributor.maps_url} target="_blank" rel="noreferrer"><MapPin size={13}/> Maps</a>}
                          </div>
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
                onChange={e => {setQ(e.target.value);setShowSuggestions(true)}}
                onFocus={()=>q.trim().length>=2&&setShowSuggestions(true)}
                onKeyDown={e=>{if(e.key==='Escape')setShowSuggestions(false)}}
                type="search"
                placeholder="Search company, distributor, division..."
                aria-label="Search"
              />
              <button>Search</button>
            </form>

            {showSuggestions && q.trim().length>=2 && (
              <div className="search-suggestions">
                <div className="suggestion-heading">
                  <span>QUICK RESULTS</span>
                  {suggestionLoading && <LoaderCircle className="spin" size={13}/>}
                </div>
                {!suggestionLoading && suggestions.length>0 ? (
                  <div className="suggestion-list">
                    {suggestions.map(item=>(
                      <button className="suggestion-item" key={item.type+'-'+item.id} onMouseDown={e=>e.preventDefault()} onClick={()=>chooseSuggestion(item)}>
                        <span className={`suggestion-icon ${item.type==='distributor'?'suggestion-distributor':''}`}>
                          {item.type==='company'?<Building2 size={15}/>:item.type==='distributor'?<Truck size={15}/>:<ArrowRight size={15}/>}
                        </span>
                        <span className="suggestion-copy">
                          <strong>{item.label}</strong>
                          <small>{item.meta}</small>
                        </span>
                        <ArrowRight size={14}/>
                      </button>
                    ))}
                  </div>
                ) : !suggestionLoading ? (
                  <div className="suggestion-empty">No direct matches yet. Press Search to run the full directory search.</div>
                ) : null}
              </div>
            )}

            {searched && (
              <div className="search-results" onMouseDown={()=>setShowSuggestions(false)}>
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
                <button onClick={()=>{setBrowse('companies');setBrowseCategory(null)}}><Building2 size={17}/> Browse Companies <ArrowRight size={15}/></button>
                <button onClick={()=>{setBrowse('distributors');setBrowseCategory(null)}}><Truck size={17}/> Browse Distributors <ArrowRight size={15}/></button>
                <button onClick={()=>{setBrowse('locations');setBrowseCategory(null)}}><MapPin size={17}/> Browse Locations <ArrowRight size={15}/></button>
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
                <button className="category-card" key={x} onClick={()=>{setBrowse('companies');setBrowseCategory(x);setProfile(null);setSearched(false);setShowSuggestions(false)}}>
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
          <nav className="header-nav">
            <button onClick={()=>{setBrowse('companies');setBrowseCategory(null)}}>Companies</button>
            <button onClick={()=>{setBrowse('distributors');setBrowseCategory(null)}}>Distributors</button>
            <button onClick={()=>{setBrowse('locations');setBrowseCategory(null)}}>Locations</button>
            <button onClick={()=>{setProfile(null);setBrowse(null);if(session)setAdmin(true);else setAuthOpen(true)}} className="admin-nav-button">{session?'Admin Dashboard':'Admin Login'}</button>
          </nav>
        </div>
      </header>

      <main>
        {admin ? (authLoading ? <div className="admin-state"><LoaderCircle className="spin" size={20}/> Checking admin access…</div> : session ? <AdminDashboard /> : <div className="admin-state"><ShieldCheck size={22}/> Admin authentication required.</div>) : profile ? renderProfile() : browse ? <BrowseDirectory type={browse} category={browseCategory} onBack={()=>{setBrowse(null);setBrowseCategory(null)}} onOpenProfile={(type,id)=>{setBrowse(null);setBrowseCategory(null);openProfile(type,id)}} /> : renderSearch()}
      </main>

      <button className="report-floating" onClick={openReport}><Flag size={15}/> Report Incorrect Information</button>

      {reportOpen && <div className="report-overlay" onMouseDown={e=>e.target===e.currentTarget&&setReportOpen(false)}>
        <div className="report-modal">
          <button className="report-close" onClick={()=>setReportOpen(false)} aria-label="Close"><X size={18}/></button>
          {!reportSent ? <>
            <p className="section-kicker">DIRECTORY FEEDBACK</p>
            <h2>Report Incorrect Information</h2>
            <p className="report-help">Help us keep KutchPharmaConnect accurate. Report an outdated relationship, incorrect contact detail, company name, or other directory issue.</p>
            {profile && <div className="report-target"><strong>{profile.entity?.company_name || profile.entity?.distributor_name}</strong><span>Profile currently open</span></div>}
            <form onSubmit={submitReport}>
              <label>What is incorrect?
                <select value={report.type} onChange={e=>setReport({...report,type:e.target.value})}>
                  <option value="incorrect_relationship">Company / distributor relationship</option>
                  <option value="incorrect_contact">Contact details</option>
                  <option value="incorrect_company_name">Company or distributor name</option>
                  <option value="other">Other directory information</option>
                </select>
              </label>
              <label>Details <span className="required">*</span>
                <textarea required value={report.message} onChange={e=>setReport({...report,message:e.target.value})} placeholder="Tell us what should be corrected..." rows="5" />
              </label>
              <label>Contact (optional)
                <input value={report.contact} onChange={e=>setReport({...report,contact:e.target.value})} placeholder="Phone or email" />
              </label>
              {reportError && <div className="report-error">{reportError}</div>}
              <button className="report-submit" disabled={reportSubmitting}>{reportSubmitting ? <><LoaderCircle className="spin" size={16}/> Sending…</> : <><Flag size={16}/> Submit Report</>}</button>
            </form>
          </> : <div className="report-success"><CheckCircle2 size={42}/><h2>Report submitted</h2><p>Thank you. Your correction will be reviewed before directory data is changed.</p><button onClick={()=>setReportOpen(false)}>Close</button></div>}
        </div>
      </div>}

      {authOpen && <div className="report-overlay"><div className="report-modal">
        <button className="report-close" onClick={()=>setAuthOpen(false)} aria-label="Close"><X size={18}/></button>
        <p className="section-kicker">ADMIN ACCESS</p><h2>Admin Login</h2><p className="report-help">Sign in with the authorized KutchPharmaConnect admin account.</p>
        <form onSubmit={signInAdmin}>
          <label>Email<input required type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="Admin email" /></label>
          <label>Password<input required type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="Password" /></label>
          {authError&&<div className="report-error">{authError}</div>}
          <button className="report-submit" disabled={authBusy}>{authBusy?<><LoaderCircle className="spin" size={16}/> Signing in…</>:<><ShieldCheck size={16}/> Sign In</>}</button>
        </form>
      </div></div>}
      {admin && session && <button className="admin-signout" onClick={signOutAdmin}>Sign out</button>}

      <footer>
        <div className="container footer-inner">
          <span>KutchPharmaConnect</span>
          <span>Companies • Distributors • Divisions • Contact Details</span>
        </div>
      </footer>
    </div>
  )
}
