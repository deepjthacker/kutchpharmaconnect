import React, { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Search, Building2, Truck, Package, ArrowRight, ShieldCheck, LoaderCircle, MapPin, Phone, MessageCircle, ArrowLeft, UserRound, Flag, X, CheckCircle2, Sun, Moon } from 'lucide-react'
import { supabase } from './lib/supabase'
import { fetchAllPages, fetchByIds } from './lib/queryHelpers'
const BrowseDirectory = lazy(() => import('./BrowseDirectory'))
const ProductDirectory = lazy(() => import('./ProductDirectory'))
const AdminDashboard = lazy(() => import('./AdminDashboard'))
import DistributorSubmissionLauncher from './DistributorSubmissionLauncher'
import ErrorBoundary from './ErrorBoundary'
import ProfileShareActions from './ProfileShareActions'
import SiteFeedback from './SiteFeedback'
const PolicyPages = lazy(() => import('./PolicyPages'))

const ADMIN_PHONE=import.meta.env.VITE_ADMIN_PHONE||'+91 89800 43357'
const KPC_WEBSITE=typeof window!=='undefined'?window.location.origin+import.meta.env.BASE_URL:''
const adminWhatsAppMessage='Hello, I need help with KutchPharmaConnect.'
const distributorWhatsAppMessage=name=>`Hello, I found ${name} through KutchPharmaConnect. I’m contacting you regarding your current distributorships in Kutch. KutchPharmaConnect: ${KPC_WEBSITE}`
const stockWhatsAppMessage=(distributor,company)=>`Hello ${distributor}, do you currently have stock of ${company} available for Mundra/Kutch? I found your contact through KutchPharmaConnect. Thank you.`
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
  const query=[entity?.distributor_name,entity?.address,'Kutch','Gujarat'].filter(Boolean).join(', ')
  return query?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`:null
}
const mapsLabel=entity=>entity?.maps_url?'Directions':'Find on Maps'
const trackEvent=(name,params={})=>{
  if(typeof window!=='undefined'&&typeof window.gtag==='function'){
    window.gtag('event',name,params)
  }
}

export default function App(){
  const searchRequestRef=useRef(0)
  const suggestionRequestRef=useRef(0)
  const lastSearchTermRef=useRef('')
  const [recentSearches,setRecentSearches]=useState(()=>{try{return JSON.parse(localStorage.getItem('kpc-recent-searches')||'[]').filter(x=>x&&['company','distributor'].includes(x.type)&&x.id&&x.name).slice(0,5)}catch{return []}})
  const [reportTarget,setReportTarget]=useState(null),[policyPage,setPolicyPage]=useState(null)
  const navigationHistoryRef=useRef(false)
  const [admin,setAdmin]=useState(false),[session,setSession]=useState(null),[theme,setTheme]=useState(()=>{try{return localStorage.getItem('kpc-theme')||'light'}catch{return 'light'}}),[authLoading,setAuthLoading]=useState(true),[authOpen,setAuthOpen]=useState(false),[authEmail,setAuthEmail]=useState(''),[authPassword,setAuthPassword]=useState(''),[authError,setAuthError]=useState(''),[authBusy,setAuthBusy]=useState(false),[resetOpen,setResetOpen]=useState(false),[resetEmail,setResetEmail]=useState(''),[resetSent,setResetSent]=useState(false),[resetError,setResetError]=useState(''),[newPassword,setNewPassword]=useState(''),[newPasswordConfirm,setNewPasswordConfirm]=useState(''),[passwordResetOpen,setPasswordResetOpen]=useState(false),[q,setQ]=useState(''),[results,setResults]=useState([]),[searchFilter,setSearchFilter]=useState('all'),[expandedProductDistributors,setExpandedProductDistributors]=useState({}),[loading,setLoading]=useState(false),[searched,setSearched]=useState(false),[error,setError]=useState(''),[profile,setProfile]=useState(null),[profileLoading,setProfileLoading]=useState(false),[browse,setBrowse]=useState(null),[browseCategory,setBrowseCategory]=useState(null),[suggestions,setSuggestions]=useState([]),[suggestionLoading,setSuggestionLoading]=useState(false),[showSuggestions,setShowSuggestions]=useState(false),[reportOpen,setReportOpen]=useState(false),[relationshipSearch,setRelationshipSearch]=useState(''),[reportSubmitting,setReportSubmitting]=useState(false),[reportSent,setReportSent]=useState(false),[reportError,setReportError]=useState(''),[report,setReport]=useState({type:'incorrect_relationship',message:'',reporter_name:'',reporter_mobile:'',reporter_email:''})

  useEffect(()=>{
    const closeOnEscape=e=>{
      if(e.key!=='Escape')return
      if(reportOpen)setReportOpen(false)
      else if(passwordResetOpen)setPasswordResetOpen(false)
      else if(resetOpen)setResetOpen(false)
      else if(authOpen)setAuthOpen(false)
    }
    document.addEventListener('keydown',closeOnEscape)
    return()=>document.removeEventListener('keydown',closeOnEscape)
  },[reportOpen,authOpen,resetOpen,passwordResetOpen])

  const routeFromLocation=()=>{
    const url=new URL(window.location.href)
    const view=url.searchParams.get('view')
    // Specific entity routes must take precedence over generic directory views.
    const distributorSlug=url.searchParams.get('d')
    if(distributorSlug)return {kpc:'distributorSlug',slug:distributorSlug}
    if(['privacy','terms','disclaimer','about','contact','corrections'].includes(view))return {kpc:'policy',type:view}
    if(view==='companies'||view==='distributors'||view==='locations'||view==='products'){
      return {kpc:'browse',type:view,category:url.searchParams.get('category')||null}
    }
    if(view==='profile'){
      return {kpc:'profile',type:url.searchParams.get('type'),id:url.searchParams.get('id')}
    }
    if(view==='admin')return {kpc:'admin'}
    return {kpc:'home',q:url.searchParams.get('q')||''}
  }

  useEffect(()=>{
    const hadKpcState=Boolean(window.history.state?.kpc)
    const initial=hadKpcState?window.history.state:routeFromLocation()
    const initialUrl=new URL(window.location.href)
    if(!hadKpcState&&['browse','profile','distributorSlug'].includes(initial.kpc)){
      const routeUrl=new URL(window.location.href)
      const homeUrl=new URL(window.location.href)
      ;['view','type','id','category','d'].forEach(key=>homeUrl.searchParams.delete(key))
      homeUrl.searchParams.delete('q')
      window.history.replaceState({kpc:'home',q:'',__kpcInternal:false},'',homeUrl.pathname+homeUrl.search+homeUrl.hash)
      window.history.pushState({...initial,__kpcInternal:true},'',routeUrl.pathname+routeUrl.search+routeUrl.hash)
    }else{
      window.history.replaceState({...initial,__kpcInternal:window.history.state?.__kpcInternal===true},'',window.location.href)
    }
    if(initial.kpc==='browse'){
      setBrowse(initial.type||'companies');setBrowseCategory(initial.category||null)
    }else if(initial.kpc==='profile'&&initial.type&&initial.id){
      openProfile(initial.type,initial.id,{history:false})
    }else if(initial.kpc==='distributorSlug'&&initial.slug){
      resolveDistributorSlug(initial.slug)
    }else if(initial.kpc==='admin'){
      setAdmin(true)
    }else if(initial.kpc==='policy'){
      setPolicyPage(initial.type)
    }else if(initial.q){
      setQ(initial.q);setSearched(true)
    }
    const onPopState=e=>{
      const route=e.state?.kpc?e.state:routeFromLocation()
      navigationHistoryRef.current=true
      setProfile(null);setProfileLoading(false);setBrowse(null);setBrowseCategory(null);setAdmin(false);setPolicyPage(null);setShowSuggestions(false)
      if(route.kpc==='admin')setAdmin(true)
      else if(route.kpc==='policy')setPolicyPage(route.type)
      else if(route.kpc==='browse'){
        setBrowse(route.type||'companies');setBrowseCategory(route.category||null)
      }else if(route.kpc==='profile'&&route.type&&route.id){
        openProfile(route.type,route.id,{history:false})
      }else if(route.kpc==='distributorSlug'&&route.slug){
        resolveDistributorSlug(route.slug)
      }else{
        setQ(route.q||'')
        setSearched(Boolean(route.q))
      }
      navigationHistoryRef.current=false
    }
    window.addEventListener('popstate',onPopState)
    return()=>window.removeEventListener('popstate',onPopState)
  },[])

  const pushRoute=(route,state={})=>{
    if(navigationHistoryRef.current)return
    const url=new URL(window.location.href)
    url.searchParams.delete('view');url.searchParams.delete('type');url.searchParams.delete('id');url.searchParams.delete('category')
    if(route==='browse'){
      url.searchParams.set('view',state.type||'companies')
      if(state.category)url.searchParams.set('category',state.category)
    }else if(route==='profile'){
      url.searchParams.set('view','profile')
      url.searchParams.set('type',state.type)
      url.searchParams.set('id',state.id)
    }else if(route==='admin'){
      url.searchParams.set('view','admin')
    }else if(route==='search'&&state.q){
      url.searchParams.set('q',state.q)
    }else{
      url.searchParams.delete('q')
    }
    window.history.pushState({kpc:route,...state,__kpcInternal:true},'',url.pathname+url.search+url.hash)
  }

  useEffect(()=>{
    document.documentElement.dataset.theme=theme
    try{localStorage.setItem('kpc-theme',theme)}catch{}
  },[theme])

  useEffect(()=>{
    let mounted=true
    async function syncSession(nextSession){
      if(!mounted)return
      setSession(nextSession)
      if(!nextSession){
        setAdmin(false)
        setAuthLoading(false)
        return
      }
      const {data:adminRow,error:adminError}=await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id',nextSession.user.id)
        .eq('active',true)
        .maybeSingle()
      if(mounted){
        setAdmin(!adminError&&!!adminRow)
        setAuthLoading(false)
      }
    }
    supabase.auth.getSession().then(({data})=>syncSession(data.session))
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,next)=>{
      syncSession(next)
      if(event==='PASSWORD_RECOVERY'){
        setPasswordResetOpen(true);setAuthOpen(false);setResetOpen(false)
      }
    })
    return()=>{mounted=false;subscription.unsubscribe()}
  },[])

  async function signInAdmin(e){
    e.preventDefault();setAuthBusy(true);setAuthError('')
    const email=authEmail.trim()
    const {data,error}=await supabase.auth.signInWithPassword({email,password:authPassword})
    if(error){setAuthError(error.message);setAuthBusy(false);return}
    const {data:adminRow,error:adminError}=await supabase.from('admin_users').select('user_id').eq('user_id',data.user.id).eq('active',true).maybeSingle()
    if(adminError||!adminRow){await supabase.auth.signOut();setAuthError('This account is not authorized as a KutchPharmaConnect admin.');setAuthBusy(false);return}
    setAuthOpen(false);setAdmin(true);setAuthBusy(false)
  }

  async function signOutAdmin(){
    await supabase.auth.signOut();setAdmin(false)
  }

  async function requestPasswordReset(e){
    e.preventDefault();setResetError('');setResetSent(false);setAuthBusy(true)
    const email=resetEmail.trim()
    if(!email){setResetError('Enter your admin email address.');setAuthBusy(false);return}
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+import.meta.env.BASE_URL})
    if(error){setResetError(error.message);setAuthBusy(false);return}
    setResetSent(true);setAuthBusy(false)
  }

  async function updateAdminPassword(e){
    e.preventDefault();setResetError('')
    if(newPassword.length<8){setResetError('Password must be at least 8 characters.');return}
    if(newPassword!==newPasswordConfirm){setResetError('The passwords do not match.');return}
    setAuthBusy(true)
    const {error}=await supabase.auth.updateUser({password:newPassword})
    if(error){setResetError(error.message);setAuthBusy(false);return}
    await supabase.auth.signOut()
    setPasswordResetOpen(false);setNewPassword('');setNewPasswordConfirm('');setAuthEmail('');setAuthPassword('');setAuthError('Password updated. Please sign in with your new password.');setAuthOpen(true);setAuthBusy(false)
  }


  useEffect(()=>{
    const t=setTimeout(()=>{
      const term=q.trim()
      if(term.length<2){
        lastSearchTermRef.current=''
        searchRequestRef.current++
        suggestionRequestRef.current++
        setResults([])
        setSearched(false)
        setSuggestions([])
        setShowSuggestions(false)
        return
      }
      if(term===lastSearchTermRef.current)return
      lastSearchTermRef.current=term
      loadSuggestions(term)
      search(term)
    },350)
    return()=>clearTimeout(t)
  },[q])

  async function loadSuggestions(term){
    const requestId=++suggestionRequestRef.current
    setSuggestionLoading(true)
    const p='%'+term.replace(/[%_]/g,'')+'%'
    const [co,di,dv,br,al,pr]=await Promise.all([
      supabase.from('companies').select('id,company_name,short_name,image_url').eq('status','active').or('company_name.ilike.'+p+',legal_name.ilike.'+p+',short_name.ilike.'+p).limit(5),
      supabase.from('distributors').select('id,distributor_name,contact_person').eq('status','active').or('distributor_name.ilike.'+p+',legal_name.ilike.'+p+',contact_person.ilike.'+p).limit(5),
      supabase.from('divisions').select('id,division_name,company_id').eq('status','active').or('division_name.ilike.'+p+',division_code.ilike.'+p).limit(5),
      supabase.from('brands').select('id,brand_name,company_id').eq('status','active').ilike('brand_name',p).limit(5),
      supabase.from('search_aliases').select('entity_type,entity_id,alias').ilike('alias',p).limit(8),
      supabase.from('products').select('id,product_name,company_id').eq('status','active').or('product_name.ilike.'+p+',normalized_product_name.ilike.'+p+',generic_name.ilike.'+p).limit(5)
    ])
    if(requestId!==suggestionRequestRef.current)return
    if(co.error||di.error||dv.error||br.error||al.error||pr.error){setSuggestions([]);setSuggestionLoading(false);return}

    const companyAliasIds=[...new Set((al.data||[]).filter(x=>x.entity_type==='company').map(x=>x.entity_id))]
    const distributorAliasIds=[...new Set((al.data||[]).filter(x=>x.entity_type==='distributor').map(x=>x.entity_id))]
    const [ac,ad,divisionCompanies]=await Promise.all([
      companyAliasIds.length?supabase.from('companies').select('id,company_name,short_name').in('id',companyAliasIds).eq('status','active'):Promise.resolve({data:[],error:null}),
      distributorAliasIds.length?supabase.from('distributors').select('id,distributor_name,contact_person').in('id',distributorAliasIds).eq('status','active'):Promise.resolve({data:[],error:null}),
      (dv.data||[]).length?supabase.from('companies').select('id,company_name').in('id',[...new Set((dv.data||[]).map(x=>x.company_id).filter(Boolean))]).eq('status','active'):Promise.resolve({data:[],error:null})
    ])

    if(requestId!==suggestionRequestRef.current)return

    const next=[]
    const seen=new Set()
    ;[...(co.data||[]),...(ac.data||[])].forEach(x=>{
      if(!seen.has('company-'+x.id)){seen.add('company-'+x.id);next.push({type:'company',id:x.id,label:x.company_name,meta:x.short_name||'Company'})}
    })
    ;[...(di.data||[]),...(ad.data||[])].forEach(x=>{
      if(!seen.has('distributor-'+x.id)){seen.add('distributor-'+x.id);next.push({type:'distributor',id:x.id,label:x.distributor_name,meta:x.contact_person?'Distributor • '+x.contact_person:'Distributor'})}
    })
    const divisionCompanyMap=new Map((divisionCompanies.data||[]).map(x=>[x.id,x.company_name]))
    ;(dv.data||[]).forEach(x=>{
      if(!seen.has('division-'+x.id)){seen.add('division-'+x.id);next.push({type:'division',id:x.id,companyId:x.company_id,label:x.division_name,meta:divisionCompanyMap.get(x.company_id)?'Division · '+divisionCompanyMap.get(x.company_id):'Division'})}
    })
    ;(br.data||[]).forEach(x=>{
      if(!seen.has('brand-'+x.id)){seen.add('brand-'+x.id);next.push({type:'brand',id:x.id,companyId:x.company_id,label:x.brand_name,meta:'Brand'})}
    })
    ;(pr.data||[]).forEach(x=>{
      if(!seen.has('product-'+x.id)){seen.add('product-'+x.id);next.push({type:'product',id:x.id,label:x.product_name,meta:'Product'})}
    })
    setSuggestions(next.slice(0,10))
    setSuggestionLoading(false)
  }

  async function submitReport(e){
    e.preventDefault()
    if(!report.message.trim()) return
    setReportSubmitting(true);setReportError('')
    const target=reportTarget
    const payload={
      entity_type: target?.type || profile?.type || 'directory',
      entity_id: target?.id || profile?.entity?.id || null,
      issue_type: report.type,
      description: report.message.trim(),
      reporter_name: report.reporter_name.trim() || null,
      reporter_mobile: report.reporter_mobile.trim() || null,
      reporter_email: report.reporter_email.trim() || null
    }
    const { error } = await supabase.from('correction_reports').insert(payload)
    if(error){setReportError(error.message);setReportSubmitting(false);return}
    trackEvent('correction_submit',{entity_type:payload.entity_type,issue_type:payload.issue_type})
    setReportSent(true);setReportSubmitting(false)
  }

  function openReport(target=null){
    setReportTarget(target)
    setReport({type:'incorrect_relationship',message:target?.message||'',reporter_name:'',reporter_mobile:'',reporter_email:''})
    setReportError('');setReportSent(false);setReportOpen(true)
  }

  function rememberRecent(type,id,name){
    if(!id||!name||!['company','distributor'].includes(type))return
    setRecentSearches(current=>{
      const next=[{type,id,name,at:Date.now()},...current.filter(x=>!(x.type===type&&x.id===id))].slice(0,5)
      try{localStorage.setItem('kpc-recent-searches',JSON.stringify(next))}catch{}
      return next
    })
  }

  function clearRecentSearches(){
    setRecentSearches([])
    try{localStorage.removeItem('kpc-recent-searches')}catch{}
  }

  function backFromBrowse(){
    const state=window.history.state
    if(state?.kpc==='browse'&&state.__kpcInternal===true)window.history.back()
    else {setProfile(null);setBrowse(null);setBrowseCategory(null);setAdmin(false);setQ('');setSearched(false);setResults([]);setError('');window.history.replaceState({kpc:'home',q:'',__kpcInternal:false},'',window.location.pathname+window.location.hash)}
  }

  function chooseSuggestion(item){
    setShowSuggestions(false)
    if(['company','distributor','division','brand'].includes(item.type)){
      openProfile(item.type,item.id)
      return
    }
    setQ(item.label)
  }


  async function search(term){
    const requestId=++searchRequestRef.current
    try {
    setLoading(true);setSearched(true);setError('')
    const searchUrl=new URL(window.location.href)
    searchUrl.searchParams.delete('view');searchUrl.searchParams.delete('type');searchUrl.searchParams.delete('id');searchUrl.searchParams.delete('category')
    if(term.trim())searchUrl.searchParams.set('q',term.trim())
    else searchUrl.searchParams.delete('q')
    window.history.replaceState({kpc:'home',q:term.trim()},'',searchUrl.pathname+searchUrl.search+searchUrl.hash)
    trackEvent('search',{search_term:term.trim()})

    const cleanTerm=term.trim().replace(/[%_]/g,'')
    const p='%'+cleanTerm+'%'

    const [co,di,dv,br,al,loc] = await Promise.all([
      supabase.from('companies').select('id,company_name,short_name,parent_company_id,image_url').eq('status','active').or('company_name.ilike.'+p+',legal_name.ilike.'+p+',short_name.ilike.'+p).limit(12),
      supabase.from('distributors').select('id,distributor_name,contact_person,mobile,whatsapp,address,city_id,maps_url').eq('status','active').or('distributor_name.ilike.'+p+',legal_name.ilike.'+p+',contact_person.ilike.'+p).limit(12),
      supabase.from('divisions').select('id,division_name,company_id').eq('status','active').or('division_name.ilike.'+p+',division_code.ilike.'+p).limit(12),
      supabase.from('brands').select('id,brand_name,company_id').eq('status','active').ilike('brand_name',p).limit(12),
      supabase.from('search_aliases').select('entity_type,entity_id,alias').ilike('alias',p).limit(24),
      supabase.from('locations').select('id,city,district,state,pincode').or('city.ilike.'+p+',district.ilike.'+p+',state.ilike.'+p+',pincode.ilike.'+p).limit(12)
    ])

    const err=co.error||di.error||dv.error||br.error||al.error||loc.error
    if(requestId!==searchRequestRef.current)return
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
    if(requestId!==searchRequestRef.current)return
    if(aliasError){setError(aliasError.message);setResults([]);setLoading(false);return}

    const companies=[...new Map([...(co.data||[]),...(aliasCompaniesRes.data||[])].map(x=>[x.id,x])).values()]
    const distributors=[...new Map([...(di.data||[]),...(aliasDistributorsRes.data||[])].map(x=>[x.id,x])).values()]
    const divisionRows=dv.data||[]

    const companyIds=[...new Set(companies.map(x=>x.id))]
    const divisionIds=divisionRows.map(x=>x.id)
    const distributorIds=[...new Set(distributors.map(x=>x.id))]
    const brandRows=br.data||[]
    const brandIds=brandRows.map(x=>x.id)
    const relatedCompanyIds=[...new Set([...companyIds,...divisionRows.map(x=>x.company_id),...brandRows.map(x=>x.company_id)])]

    const relQuery=relatedCompanyIds.length
      ? supabase.from('distributorships').select('id,company_id,division_id,brand_id,distributor_id,territory,status,verification_status,verification_note,category_id,location_id').eq('status','active').in('company_id',relatedCompanyIds)
      : Promise.resolve({data:[],error:null})

    const distributorRelQuery=distributorIds.length
      ? supabase.from('distributorships').select('id,company_id,division_id,brand_id,distributor_id,territory,status,verification_status,verification_note,category_id,location_id').eq('status','active').in('distributor_id',distributorIds)
      : Promise.resolve({data:[],error:null})

    const [rr,dr]=await Promise.all([relQuery,distributorRelQuery])
    if(requestId!==searchRequestRef.current)return
    if(rr.error||dr.error){setError((rr.error||dr.error).message);setResults([]);setLoading(false);return}

    const relationships=[...new Map([...(rr.data||[]),...(dr.data||[]),...(locationRelsRes.data||[])].map(x=>[x.id,x])).values()]
    const allCompanyIds=[...new Set(relationships.map(x=>x.company_id))]
    const allDistributorIds=[...new Set(relationships.map(x=>x.distributor_id))]
    const allDivisionIds=[...new Set(relationships.map(x=>x.division_id).filter(Boolean))]
    const allBrandIds=[...new Set(relationships.map(x=>x.brand_id).filter(Boolean))]

    const [rc,rd,rv,rb]=await Promise.all([
      fetchByIds(allCompanyIds,ids=>supabase.from('companies').select('id,company_name,short_name,image_url').in('id',ids).eq('status','active')),
      fetchByIds(allDistributorIds,ids=>supabase.from('distributors').select('id,distributor_name,contact_person,mobile,whatsapp,address,city_id,maps_url').in('id',ids)),
      fetchByIds(allDivisionIds,ids=>supabase.from('divisions').select('id,division_name,company_id').in('id',ids)),
      fetchByIds(allBrandIds,ids=>supabase.from('brands').select('id,brand_name,company_id,division_id').in('id',ids).eq('status','active'))
    ])
    const lookupErr=rc.error||rd.error||rv.error||rb.error
    if(requestId!==searchRequestRef.current)return
    if(lookupErr){setError(lookupErr.message);setResults([]);setLoading(false);return}

    const companyMap=new Map((rc.data||[]).map(x=>[x.id,x]))
    const distributorMap=new Map((rd.data||[]).map(x=>[x.id,x]))
    const divisionMap=new Map((rv.data||[]).map(x=>[x.id,x]))
    const brandMap=new Map((rb.data||[]).map(x=>[x.id,x]))

    const searchedCompanyIds=new Set(companyIds)
    const searchedDistributorIds=new Set(distributorIds)
    const searchedDivisionIds=new Set(divisionIds)
    const searchedBrandIds=new Set(brandIds)
    const searchedBrandOwnerCompanyIds=new Set(brandRows.map(brand=>brand.company_id).filter(Boolean))
    const searchedLocationIds=new Set(locationIds)

    const cards=[]
    const seen=new Set()

    // Show division catalogue matches with their owning company, even without a distributor listing.
    if(divisionRows.length){
      const divisionCompanyIds=[...new Set(divisionRows.map(row=>row.company_id).filter(Boolean))]
      const divisionCompanyRes=divisionCompanyIds.length?await supabase.from('companies').select('id,company_name,short_name,image_url').in('id',divisionCompanyIds).eq('status','active'):{data:[],error:null}
      if(divisionCompanyRes.error){setError(divisionCompanyRes.error.message);setResults([]);setLoading(false);return}
      const divisionCompanyMap=new Map((divisionCompanyRes.data||[]).map(company=>[company.id,company]))
      divisionRows.forEach(division=>{
        const owner=divisionCompanyMap.get(division.company_id)
        if(owner){const key='division-'+division.id;if(!seen.has(key)){seen.add(key);cards.push({type:'division',id:division.id,title:division.division_name,companyId:owner.id,companyName:owner.company_name,imageUrl:owner.image_url||null})}}
      })
    }

    relationships.forEach(rel=>{
      const company=companyMap.get(rel.company_id)
      const distributor=distributorMap.get(rel.distributor_id)
      const division=rel.division_id?divisionMap.get(rel.division_id):null
      const brand=rel.brand_id?brandMap.get(rel.brand_id):null
      if(!company||!distributor)return

      const companyMatch=searchedCompanyIds.has(rel.company_id)
      const distributorMatch=searchedDistributorIds.has(rel.distributor_id)
      const divisionMatch=searchedDivisionIds.has(rel.division_id)
      const brandMatch=searchedBrandIds.has(rel.brand_id)
      const brandOwnerMatch=searchedBrandOwnerCompanyIds.has(rel.company_id)
      const locationMatch=searchedLocationIds.has(rel.location_id)

      if(companyMatch||divisionMatch||brandMatch||brandOwnerMatch||locationMatch){
        const key='company-'+rel.id
        if(!seen.has(key)){
          seen.add(key)
          cards.push({type:'relationship',icon:'company',title:company.company_name,imageUrl:company.image_url||null,subtitle:brand?'Brand: '+brand.brand_name:(division?'Division: '+division.division_name:null),relation:'Currently handled by',target:distributor,contact:distributor,rel})
        }
      }

      if(distributorMatch||locationMatch){
        const key='distributor-'+rel.id
        if(!seen.has(key)){
          seen.add(key)
          cards.push({type:'relationship',icon:'distributor',title:distributor.distributor_name,subtitle:brand?'Brand: '+brand.brand_name:(division?'Division: '+division.division_name:null),relation:'Currently handles',target:company,contact:distributor,rel})
        }
      }
    })

    // Show matching legal entities even when they have no direct distributor listing.
    const matchedCompanies=[...new Map([...(co.data||[]),...(aliasCompaniesRes.data||[])].map(company=>[company.id,company])).values()]
    const matchedCompanyIds=matchedCompanies.map(company=>company.id)
    const matchedRows=matchedCompanyIds.length
      ? await supabase.from('companies').select('id,company_name,short_name,parent_company_id,image_url').in('id',matchedCompanyIds).eq('status','active')
      : {data:[],error:null}
    const parentIds=[...new Set((matchedRows.data||[]).map(company=>company.parent_company_id).filter(Boolean))]
    const familySeedIds=[...new Set([...matchedCompanyIds,...parentIds])]
    const familyRows=familySeedIds.length
      ? await supabase.from('companies').select('id,company_name,short_name,parent_company_id,image_url').or('id.in.('+familySeedIds.join(',')+'),parent_company_id.in.('+familySeedIds.join(',')+')').eq('status','active')
      : {data:[],error:null}
    if(requestId!==searchRequestRef.current)return
    const familyCompanies=familyRows.data||[]
    const familyMap=new Map(familyCompanies.map(company=>[company.id,company]))
    const familyParents=[...new Set(familyCompanies.map(company=>company.parent_company_id).filter(Boolean))]
    const missingParentIds=familyParents.filter(id=>!familyMap.has(id))
    if(missingParentIds.length){
      const parentRes=await supabase.from('companies').select('id,company_name,short_name,parent_company_id').in('id',missingParentIds).eq('status','active')
      ;(parentRes.data||[]).forEach(company=>familyMap.set(company.id,company))
    }
    const familyDisplayIds=new Set([...matchedCompanyIds,...familyCompanies.map(company=>company.id),...familyParents])
    familyDisplayIds.forEach(id=>{
      const company=familyMap.get(id)||matchedCompanies.find(item=>item.id===id)
      if(!company)return
      const parent=company.parent_company_id?familyMap.get(company.parent_company_id):null
      const children=familyCompanies.filter(item=>item.parent_company_id===company.id)
      const key='family-'+company.id
      if(!seen.has(key)){
        seen.add(key)
        cards.push({type:'company',id:company.id,title:company.company_name,imageUrl:company.image_url||null,parentName:parent?.company_name||null,children:children.map(item=>item.company_name)})
      }
    })

    // Product matches are searchable independently from distributorship records.
    const productRes=await supabase.from('products').select('id,product_name,normalized_product_name,company_id,division_id,brand_id,generic_name,strength,dosage_form,pack_size').eq('status','active').or('product_name.ilike.'+p+',normalized_product_name.ilike.'+p+',generic_name.ilike.'+p+(searchedBrandIds.size?',brand_id.in.('+[...searchedBrandIds].join(',')+')':'')).limit(20)
    if(productRes.error){setError(productRes.error.message);setResults([]);setLoading(false);return}
    const productRows=productRes.data||[]
    const productCompanyIds=[...new Set(productRows.map(product=>product.company_id).filter(Boolean))]
    const productBrandIds=[...new Set(productRows.map(product=>product.brand_id).filter(Boolean))]
    const productDivisionIds=[...new Set(productRows.map(product=>product.division_id).filter(Boolean))]
    const productIds=productRows.map(product=>product.id)
    const [productCompaniesRes,productBrandsRes,productDivisionsRes,directLinksRes,companyLinksRes]=await Promise.all([
      productCompanyIds.length?supabase.from('companies').select('id,company_name,parent_company_id').in('id',productCompanyIds).eq('status','active'):Promise.resolve({data:[],error:null}),
      productBrandIds.length?supabase.from('brands').select('id,brand_name').in('id',productBrandIds).eq('status','active'):Promise.resolve({data:[],error:null}),
      productDivisionIds.length?supabase.from('divisions').select('id,division_name,company_id').in('id',productDivisionIds).eq('status','active'):Promise.resolve({data:[],error:null}),
      productIds.length?supabase.from('product_distributors').select('product_id,distributor_id').in('product_id',productIds).eq('status','active'):Promise.resolve({data:[],error:null}),
      productCompanyIds.length?supabase.from('distributorships').select('company_id,distributor_id,territory').in('company_id',productCompanyIds).eq('status','active'):Promise.resolve({data:[],error:null})
    ])
    if(productCompaniesRes.error||productBrandsRes.error||productDivisionsRes.error||directLinksRes.error||companyLinksRes.error){setError((productCompaniesRes.error||productBrandsRes.error||productDivisionsRes.error||directLinksRes.error||companyLinksRes.error).message);setResults([]);setLoading(false);return}
    const productDistributorIds=[...new Set([...(directLinksRes.data||[]).map(link=>link.distributor_id),...(companyLinksRes.data||[]).map(link=>link.distributor_id)])]
    const productDistributorRes=productDistributorIds.length?await supabase.from('distributors').select('id,distributor_name,mobile,whatsapp,address,maps_url,image_url').in('id',productDistributorIds).eq('status','active'):{data:[],error:null}
    const productCompanyMap=new Map((productCompaniesRes.data||[]).map(company=>[company.id,company]))
    const productParentIds=[...new Set((productCompaniesRes.data||[]).map(company=>company.parent_company_id).filter(Boolean))].filter(id=>!productCompanyMap.has(id))
    if(productParentIds.length){
      const productParentRes=await supabase.from('companies').select('id,company_name,parent_company_id').in('id',productParentIds).eq('status','active')
      ;(productParentRes.data||[]).forEach(company=>productCompanyMap.set(company.id,company))
    }
    const productBrandMap=new Map((productBrandsRes.data||[]).map(brand=>[brand.id,brand]))
    const productDistributorMap=new Map((productDistributorRes.data||[]).map(distributor=>[distributor.id,distributor]))
    productRows.forEach(product=>{
      const company=productCompanyMap.get(product.company_id)
      const direct=(directLinksRes.data||[]).filter(link=>link.product_id===product.id).map(link=>productDistributorMap.get(link.distributor_id)).filter(Boolean)
      const companyListed=(companyLinksRes.data||[]).filter(link=>link.company_id===product.company_id).map(link=>productDistributorMap.get(link.distributor_id)).filter(Boolean)
      const distributors=[...new Map((direct.length?direct:companyListed).map(distributor=>[distributor.id,distributor])).values()]
      cards.push({type:'product',id:product.id,title:product.product_name,companyId:company?.id||null,companyName:company?.company_name||'Company not assigned',parentName:company?.parent_company_id?productCompanyMap.get(company.parent_company_id)?.company_name:null,divisionName:product.division_id?productDivisionMap.get(product.division_id)?.division_name:null,brandName:product.brand_id?productBrandMap.get(product.brand_id)?.brand_name:null,specs:[product.generic_name,product.strength,product.dosage_form,product.pack_size].filter(Boolean).join(' · '),distributors,directDistributorLinks:direct.length>0})
    })

    if(requestId!==searchRequestRef.current)return
    setResults(cards)
    setLoading(false)
    } catch (searchError) {
      if(requestId!==searchRequestRef.current)return
      setError(searchError?.message||'Search could not be completed. Please try again.')
      setResults([])
      setLoading(false)
    }
  }

  async function resolveDistributorSlug(slug){
    setProfile(null);setProfileLoading(true);setError('')
    const {data,error}=await supabase.from('distributors').select('id,distributor_name').eq('status','active')
    if(error){setError(error.message);setProfileLoading(false);return}
    const normalize=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
    const match=(data||[]).find(item=>normalize(item.distributor_name)===slug)
    if(!match){setError('Distributor link not found. Please open the distributor from the directory.');setProfileLoading(false);return}
    const url=new URL(window.location.href)
    url.searchParams.delete('d')
    url.searchParams.set('view','profile');url.searchParams.set('type','distributor');url.searchParams.set('id',match.id)
    window.history.replaceState({kpc:'profile',type:'distributor',id:match.id},'',url.pathname+url.search+url.hash)
    await openProfile('distributor',match.id,{history:false})
  }

  async function openCatalogProfile(type,id,options={}){
    setRelationshipSearch('')
    if(options.history!==false)pushRoute('profile',{type,id})
    setProfileLoading(true);setError('')
    try{
      const isDivision=type==='division'
      const entityRes=isDivision
        ? await supabase.from('divisions').select('id,division_name,company_id').eq('id',id).eq('status','active').maybeSingle()
        : await supabase.from('brands').select('id,brand_name,company_id,division_id').eq('id',id).eq('status','active').maybeSingle()
      if(entityRes.error||!entityRes.data)throw entityRes.error||new Error('This '+type+' could not be found.')
      const entity=entityRes.data
      const [companyRes,relRes,productRes,divisionRes,brandRes]=await Promise.all([
        supabase.from('companies').select('id,company_name,short_name,parent_company_id,image_url').eq('id',entity.company_id).eq('status','active').maybeSingle(),
        fetchAllPages(()=>supabase.from('distributorships').select('id,company_id,distributor_id,division_id,brand_id,location_id,territory,verification_status,verification_note').eq('company_id',entity.company_id).eq('status','active').order('id')),
        isDivision
          ? fetchAllPages(()=>supabase.from('products').select('id,product_name,company_id,division_id,brand_id,generic_name,strength,dosage_form,pack_size').eq('division_id',id).eq('status','active').order('product_name'))
          : fetchAllPages(()=>supabase.from('products').select('id,product_name,company_id,division_id,brand_id,generic_name,strength,dosage_form,pack_size').eq('brand_id',id).eq('status','active').order('product_name')),
        isDivision ? Promise.resolve({data:[],error:null}) : (entity.division_id ? supabase.from('divisions').select('id,division_name').eq('id',entity.division_id).maybeSingle() : Promise.resolve({data:null,error:null})),
        isDivision ? supabase.from('brands').select('id,brand_name,company_id,division_id').eq('division_id',id).eq('status','active').order('brand_name') : Promise.resolve({data:[],error:null})
      ])
      const failure=companyRes.error||relRes.error||productRes.error||divisionRes.error||brandRes.error
      if(failure)throw failure
      if(!companyRes.data)throw new Error('The parent company for this '+type+' is unavailable.')
      const allRels=(relRes.data||[]).filter(rel=>isDivision?rel.division_id===id:rel.brand_id===id)
      const distributorIds=[...new Set(allRels.map(rel=>rel.distributor_id))]
      const locationIds=[...new Set(allRels.map(rel=>rel.location_id).filter(Boolean))]
      const [dRes,lRes]=await Promise.all([
        fetchByIds(distributorIds,ids=>supabase.from('distributors').select('id,distributor_name,contact_person,mobile,whatsapp,email,address,maps_url,image_url').in('id',ids).eq('status','active')),
        fetchByIds(locationIds,ids=>supabase.from('locations').select('id,city,district,state,pincode').in('id',ids).eq('status','active'))
      ])
      if(dRes.error||lRes.error)throw dRes.error||lRes.error
      const dm=new Map((dRes.data||[]).map(x=>[x.id,x]))
      const lm=new Map((lRes.data||[]).map(x=>[x.id,x]))
      const divisionMap=new Map()
      if(!isDivision&&divisionRes.data)divisionMap.set(divisionRes.data.id,divisionRes.data)
      const brandRows=isDivision?(brandRes.data||[]):[]
      const [brandProductRes,divisionProductRes]=await Promise.all([
        (productRes.data||[]).length?supabase.from('brands').select('id,brand_name').in('id',[...new Set(productRes.data.map(x=>x.brand_id).filter(Boolean))]):Promise.resolve({data:[],error:null}),
        isDivision?Promise.resolve({data:[],error:null}):Promise.resolve({data:[],error:null})
      ])
      if(brandProductRes.error)throw brandProductRes.error
      const productBrandMap=new Map((brandProductRes.data||[]).map(x=>[x.id,x.brand_name]))
      setProfile({type,entity:{...entity,parentCompany:companyRes.data,division:divisionRes.data||null,brands:brandRows,catalog:(productRes.data||[]).map(product=>({...product,brand_name:product.brand_id?productBrandMap.get(product.brand_id):null})).filter(product=>isDivision?product.division_id===id:product.brand_id===id)},relationships:allRels.map(rel=>({...rel,company:companyRes.data,division:rel.division_id?divisionMap.get(rel.division_id):null,distributor:dm.get(rel.distributor_id),location:rel.location_id?lm.get(rel.location_id):null})).filter(rel=>rel.distributor)})
      trackEvent(type+'_view',{entity_type:type})
    }catch(err){setError(err?.message||'Unable to load '+type+' profile.')}
    setProfileLoading(false)
  }

  async function openProfile(type,id,options={}){
    if(type==='division'||type==='brand')return openCatalogProfile(type,id,options)
    setRelationshipSearch('')
    if(options.history!==false)pushRoute('profile',{type,id})
    setProfileLoading(true);setError('')
    trackEvent(type==='company'?'company_view':'distributor_view',{entity_type:type})
    if(type==='company'){
      const [companyRes, relRes, divisionsRes]=await Promise.all([
        supabase.from('companies').select('id,company_name,short_name,parent_company_id,image_url').eq('id',id).eq('status','active').maybeSingle(),
        fetchAllPages(()=>supabase.from('distributorships').select('id,distributor_id,division_id,brand_id,location_id,territory,verification_status,verification_note').eq('company_id',id).eq('status','active').order('id')),
        supabase.from('divisions').select('id,division_name,company_id').eq('company_id',id).eq('status','active').order('division_name')
      ])
      if(companyRes.error||relRes.error||divisionsRes.error){setError((companyRes.error||relRes.error||divisionsRes.error).message);setProfileLoading(false);return}
      const rels=relRes.data||[]
      const parentCompanyId=companyRes.data?.parent_company_id
      const familyRes=await supabase.from('companies').select('id,company_name,short_name,parent_company_id,image_url').or('id.eq.'+id+',parent_company_id.eq.'+id+(parentCompanyId?',id.eq.'+parentCompanyId:'' )).eq('status','active')
      const familyRows=familyRes.data||[]
      const subsidiaryRows=familyRows.filter(company=>company.parent_company_id===id)
      const subsidiaryIds=subsidiaryRows.map(company=>company.id)
      const subsidiaryRelsRes=subsidiaryIds.length?await fetchAllPages(()=>supabase.from('distributorships').select('id,company_id,distributor_id,verification_status,territory').in('company_id',subsidiaryIds).eq('status','active').order('id')):{data:[],error:null}
      const subsidiaryDistributorIds=[...new Set((subsidiaryRelsRes.data||[]).map(rel=>rel.distributor_id))]
      const subsidiaryDistributorsRes=subsidiaryDistributorIds.length?await fetchByIds(subsidiaryDistributorIds,ids=>supabase.from('distributors').select('id,distributor_name,mobile,whatsapp,address,maps_url').in('id',ids).eq('status','active')):{data:[],error:null}
      const subsidiaryDistributorMap=new Map((subsidiaryDistributorsRes.data||[]).map(distributor=>[distributor.id,distributor]))
      const subsidiarySummaryMap=new Map(subsidiaryRows.map(company=>[company.id,{...company,distributorCount:0,distributorNames:[]}]))
      for(const rel of (subsidiaryRelsRes.data||[])){
        const subsidiary=subsidiarySummaryMap.get(rel.company_id)
        const distributor=subsidiaryDistributorMap.get(rel.distributor_id)
        if(subsidiary&&distributor&&!subsidiary.distributorNames.includes(distributor.distributor_name)){
          subsidiary.distributorNames.push(distributor.distributor_name)
          subsidiary.distributorCount=subsidiary.distributorNames.length
        }
      }
      const profileCompanyIds=[id]
      const catalogRes=profileCompanyIds.length?await fetchAllPages(()=>supabase.from('products').select('id,product_name,company_id,brand_id,generic_name,strength,dosage_form,pack_size').in('company_id',profileCompanyIds).eq('status','active').order('product_name')):{data:[],error:null}
      const profileProductBrandIds=[...new Set((catalogRes.data||[]).map(product=>product.brand_id).filter(Boolean))]
      const profileBrandsRes=profileProductBrandIds.length?await supabase.from('brands').select('id,brand_name').in('id',profileProductBrandIds).eq('status','active'):{data:[],error:null}
      const profileBrandMap=new Map((profileBrandsRes.data||[]).map(brand=>[brand.id,brand.brand_name]))
      const profileCompanyMap=new Map(familyRows.map(company=>[company.id,company]))
      if(parentCompanyId&&!profileCompanyMap.has(parentCompanyId)){
        const parentRes=await supabase.from('companies').select('id,company_name,short_name,parent_company_id').eq('id',parentCompanyId).eq('status','active').maybeSingle()
        if(parentRes.data)profileCompanyMap.set(parentRes.data.id,parentRes.data)
      }
      if(familyRes.error||subsidiaryRelsRes.error||subsidiaryDistributorsRes.error||catalogRes.error||profileBrandsRes.error){setError((familyRes.error||subsidiaryRelsRes.error||subsidiaryDistributorsRes.error||catalogRes.error||profileBrandsRes.error).message);setProfileLoading(false);return}
      if(companyRes.data)rememberRecent('company',id,companyRes.data.company_name)
      const distributorIds=[...new Set(rels.map(x=>x.distributor_id))]
      const divisionIds=[...new Set(rels.map(x=>x.division_id).filter(Boolean))]
      const brandIds=[...new Set(rels.map(x=>x.brand_id).filter(Boolean))]
      const locationIds=[...new Set(rels.map(x=>x.location_id).filter(Boolean))]
      const [dRes,vRes,bRes,lRes]=await Promise.all([
        fetchByIds(distributorIds,ids=>supabase.from('distributors').select('id,distributor_name,contact_person,mobile,whatsapp,email,address,maps_url,image_url').in('id',ids).eq('status','active')),
        fetchByIds(divisionIds,ids=>supabase.from('divisions').select('id,division_name').in('id',ids).eq('status','active')),
        fetchByIds(brandIds,ids=>supabase.from('brands').select('id,brand_name').in('id',ids).eq('status','active')),
        fetchByIds(locationIds,ids=>supabase.from('locations').select('id,city,district,state,pincode').in('id',ids).eq('status','active'))
      ])
      if(dRes.error||vRes.error||bRes.error||lRes.error){setError((dRes.error||vRes.error||bRes.error||lRes.error).message||'Unable to load company profile data.');setProfileLoading(false);return}
      const dm=new Map((dRes.data||[]).map(x=>[x.id,x]))
      const vm=new Map((vRes.data||[]).map(x=>[x.id,x]))
      const bm=new Map((bRes.data||[]).map(x=>[x.id,x]))
      const lm=new Map((lRes.data||[]).map(x=>[x.id,x]))
      setProfile({type:'company',entity:{...companyRes.data,parentCompany:companyRes.data?.parent_company_id?profileCompanyMap.get(companyRes.data.parent_company_id):null,divisions:divisionsRes.data||[],subsidiaries:[...subsidiarySummaryMap.values()],catalog:(catalogRes.data||[]).map(product=>({...product,brand_name:product.brand_id?profileBrandMap.get(product.brand_id):null,company_name:profileCompanyMap.get(product.company_id)?.company_name||companyRes.data?.company_name}))},relationships:rels.map(x=>({...x,distributor:dm.get(x.distributor_id),division:x.division_id?vm.get(x.division_id):null,location:x.location_id?lm.get(x.location_id):null})).filter(x=>x.distributor)})
    }else{
      const [distRes,relRes]=await Promise.all([
        supabase.from('distributors').select('id,distributor_name,contact_person,mobile,whatsapp,email,address,maps_url,city_id,image_url').eq('id',id).eq('status','active').maybeSingle(),
        fetchAllPages(()=>supabase.from('distributorships').select('id,company_id,division_id,location_id,territory,verification_status,verification_note').eq('distributor_id',id).eq('status','active').order('id'))
      ])
      if(distRes.error||relRes.error){setError((distRes.error||relRes.error).message);setProfileLoading(false);return}
      const rels=relRes.data||[]
      if(distRes.data){
        rememberRecent('distributor',id,distRes.data.distributor_name)
      }
      const companyIds=[...new Set(rels.map(x=>x.company_id))]
      const divisionIds=[...new Set(rels.map(x=>x.division_id).filter(Boolean))]
      const locationIds=[...new Set(rels.map(x=>x.location_id).filter(Boolean))]
      const brandIds=[...new Set(rels.map(x=>x.brand_id).filter(Boolean))]
      const [cRes,vRes,lRes,bRes]=await Promise.all([
        fetchByIds(companyIds,ids=>supabase.from('companies').select('id,company_name,short_name').in('id',ids).eq('status','active')),
        fetchByIds(divisionIds,ids=>supabase.from('divisions').select('id,division_name').in('id',ids)),
        fetchByIds(locationIds,ids=>supabase.from('locations').select('id,city,district,state,pincode').in('id',ids)),
        fetchByIds(brandIds,ids=>supabase.from('brands').select('id,brand_name,company_id,division_id').in('id',ids).eq('status','active'))
      ])
      if(cRes.error||vRes.error||lRes.error||bRes.error){setError((cRes.error||vRes.error||lRes.error||bRes.error).message||'Unable to load distributor profile data.');setProfileLoading(false);return}
      const cm=new Map((cRes.data||[]).map(x=>[x.id,x]))
      const vm=new Map((vRes.data||[]).map(x=>[x.id,x]))
      const lm=new Map((lRes.data||[]).map(x=>[x.id,x]))
      const bm=new Map((bRes.data||[]).map(x=>[x.id,x]))
      setProfile({type:'distributor',entity:distRes.data,relationships:rels.map(x=>({...x,company:cm.get(x.company_id),division:x.division_id?vm.get(x.division_id):null,brand:x.brand_id?bm.get(x.brand_id):null,location:x.location_id?lm.get(x.location_id):null})).filter(x=>x.company)})
    }
    setProfileLoading(false)
  }

  function closeProfile(){
    if(window.history.state?.kpc==='profile')window.history.back()
    else {setProfile(null);setProfileLoading(false)}
  }

  function renderProfile(){
    const relationshipQuery = relationshipSearch.trim().toLowerCase()
    const visibleRelationships = (profile?.relationships || []).filter(rel => {
      if (profile?.type !== 'distributor' || !relationshipQuery) return true
      return [rel.company?.company_name, rel.division?.division_name, rel.brand?.brand_name]
        .some(value => String(value || '').toLowerCase().includes(relationshipQuery))
    })
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
              <div className="profile-heading profile-heading-with-actions">
                <div className="profile-heading-main">
                  <div className="profile-icon">
                    {profile.entity?.image_url ? <img className="profile-logo-image" src={profile.entity.image_url} alt="" /> : (profile.type !== 'distributor' ? <Building2 size={24}/> : <Truck size={24}/>)}
                  </div>
                  <div className="profile-heading-copy">
                    <p className="profile-kicker">
                      {profile.type === 'company' ? 'COMPANY' : profile.type === 'division' ? 'DIVISION' : profile.type === 'brand' ? 'BRAND' : 'DISTRIBUTOR'}
                    </p>
                    <h2>{profile.entity?.company_name || profile.entity?.division_name || profile.entity?.brand_name || profile.entity?.distributor_name}</h2>
                     {profile.type !== 'distributor' && profile.type !== 'company' && profile.entity.parentCompany && <span className="profile-parent-inline">Part of <button className="profile-link-button" onClick={()=>openProfile('company',profile.entity.parentCompany.id)}>{profile.entity.parentCompany.company_name}</button></span>}
                     {profile.type === 'brand' && profile.entity.division && <span className="profile-parent-inline">Division: {profile.entity.division.division_name}</span>}
                    {profile.entity?.short_name && (
                      <span className="profile-short">{profile.entity.short_name}</span>
                    )}
                    <span className="profile-summary">{profile.type==='company' && (profile.entity.subsidiaries?.length||profile.entity.divisions?.length) ? `${profile.entity.subsidiaries.length} operating compan${profile.entity.subsidiaries.length===1?'y':'ies'}` : `${profile.relationships.length} active Kutch ${profile.relationships.length===1?'relationship':'relationships'}`}</span>
                    {profile.type === 'company' && profile.relationships.some(rel=>rel.verification_status==='verified') && (
                      <span className="verified-badge" title="At least one company–distributor relationship has been verified; this does not verify the distributor itself.">
                        <ShieldCheck size={14}/> Relationship Verified
                      </span>
                    )}                  </div>
                </div>
                <ProfileShareActions profile={profile} siteUrl={KPC_WEBSITE} />
              </div>

              {profile.type === 'distributor' && (
                <div className="contact-panel">
                  {profile.entity.contact_person && (
                    <div><UserRound size={15}/><span>{profile.entity.contact_person}</span></div>
                  )}
                  {profile.entity.mobile && (
                    <div>
                      <Phone size={15}/>
                      <a href={phoneLink(profile.entity.mobile)}>{profile.entity.mobile}</a>
                    </div>
                  )}
                  {profile.entity.whatsapp && (
                    <div>
                      <MessageCircle size={15}/>
                      <a href={waLink(profile.entity.whatsapp || profile.entity.mobile,distributorWhatsAppMessage(profile.entity.distributor_name))} target="_blank" rel="noreferrer">
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
                      <a href={phoneLink(profile.entity.mobile)}><Phone size={15}/> Call</a>
                    )}
                    {profile.entity.whatsapp && (
                      <a href={waLink(profile.entity.whatsapp || profile.entity.mobile,distributorWhatsAppMessage(profile.entity.distributor_name))} target="_blank" rel="noreferrer">
                        <MessageCircle size={15}/> WhatsApp
                      </a>
                    )}
                    {mapsLink(profile.entity) && (
                      <a href={mapsLink(profile.entity)} target="_blank" rel="noreferrer">
                        <MapPin size={15}/> {mapsLabel(profile.entity)}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {profile.type !== 'distributor' && (
                <>
                  {(profile.entity.parentCompany || profile.entity.subsidiaries?.length > 0) && <div className="profile-list company-group-list">
                    <div className="profile-list-title">Company group</div>
                    {(profile.entity.subsidiaries||[]).map(company=><div className="profile-rel company-subsidiary-row" key={company.id}>
                      <div className="company-subsidiary-copy">
                        <small>Operating company</small>
                        <button className="profile-link-button" onClick={()=>openProfile('company',company.id)}>{company.company_name}</button>
                        <span className="company-subsidiary-count">{company.distributorCount} active Kutch distributor {company.distributorCount===1?'relationship':'relationships'}</span>
                        {company.distributorNames.length>0 && <span className="company-subsidiary-preview">{company.distributorNames.slice(0,3).join(' · ')}{company.distributorNames.length>3?' · +'+(company.distributorNames.length-3)+' more':''}</span>}
                      </div>
                      <button className="company-subsidiary-open" onClick={()=>openProfile('company',company.id)}>View distributors <ArrowRight size={15}/></button>
                    </div>)}
                  </div>}

                </>
              )}

              <div className="profile-list">
                <div className="profile-list-title">
                  {profile.type === 'distributor' ? 'Currently handles' : 'Distributors in Kutch'}
                </div>

                {profile.type === 'distributor' && profile.relationships.length > 0 && (
                  <label className="profile-relationship-search">
                    <Search size={16} aria-hidden="true" />
                    <input type="search" value={relationshipSearch} onChange={e => setRelationshipSearch(e.target.value)} placeholder="Search companies, divisions or brands…" aria-label="Search this distributor's companies, divisions or brands" />
                    {relationshipSearch && <button type="button" onClick={() => setRelationshipSearch('')} aria-label="Clear distributorship search"><X size={15}/></button>}
                  </label>
                )}

                {visibleRelationships.length > 0 ? (
                  visibleRelationships.map(rel => (
                    <div className="profile-rel" key={rel.id}>
                      <div>
                        {profile.type !== 'distributor' ? (
                          <button className="profile-link-button" onClick={() => openProfile('distributor', rel.distributor_id)}>
                            {rel.distributor?.distributor_name}
                          </button>
                        ) : (
                          <button className="profile-link-button" onClick={() => openProfile('company', rel.company_id)}>
                            {rel.company?.company_name}
                          </button>
                        )}
                        {rel.division && <span>{rel.division.division_name}</span>}
                        {profile.type !== 'distributor' && rel.distributor?.mobile && (
                          <div className="profile-rel-phone">
                            <Phone size={13}/>
                            <a href={phoneLink(rel.distributor.mobile)}>{rel.distributor.mobile}</a>
                          </div>
                        )}
                      </div>
                      <div className="profile-rel-right">
                        <small>
                          {rel.location ? [rel.location.city,rel.location.district,rel.location.state].filter(Boolean).join(', ') : (rel.territory || 'Kutch')}
                        </small>
                        {rel.verification_status === 'verified' && (
                          <span className="verified-badge verified-badge-small" title="This current distributor-company relationship has been independently verified.">
                            <ShieldCheck size={12}/> Verified
                          </span>
                        )}
                        {rel.verification_status === 'needs_review' && (
                          <span className="status-badge status-review">Under Review</span>
                        )}
                        {rel.verification_status !== 'verified' && rel.verification_status !== 'needs_review' && (
                          <span className="status-badge status-unverified" title="This relationship is listed from supplied directory data but has not been independently confirmed.">
                            <span className="status-symbol">!</span> Not Verified
                          </span>
                        )}
                        {profile.type !== 'distributor' && (
                          <div className="profile-rel-actions">
                            {rel.distributor?.mobile && <a className="profile-rel-action" href={phoneLink(rel.distributor.mobile)}><Phone size={13}/> Call</a>}
                            {(rel.distributor?.whatsapp || rel.distributor?.mobile) && <a className="profile-rel-action" href={waLink(rel.distributor.whatsapp || rel.distributor.mobile,stockWhatsAppMessage(rel.distributor.distributor_name,profile.entity.company_name))} target="_blank" rel="noreferrer"><MessageCircle size={13}/> Check Stock</a>}
                            {mapsLink(rel.distributor) && <a className="profile-rel-action" href={mapsLink(rel.distributor)} target="_blank" rel="noreferrer"><MapPin size={13}/> {mapsLabel(rel.distributor)}</a>}
                          </div>
                        )}
                        {profile.type === 'distributor' && (profile.entity?.whatsapp || profile.entity?.mobile) && (
                          <div className="profile-rel-actions">
                            <a className="profile-rel-action" href={waLink(profile.entity.whatsapp || profile.entity.mobile,stockWhatsAppMessage(profile.entity.distributor_name,rel.company?.company_name||'the product'))} target="_blank" rel="noreferrer">
                              <MessageCircle size={13}/> Check Stock
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="result-state">{profile.relationships.length === 0 ? 'No active distributorships found.' : 'No companies, divisions or brands match your search.'}</div>
                )}
              </div>

                  {!profile.entity.subsidiaries?.length && !profile.entity.divisions?.length && profile.entity.catalog?.length > 0 && <div className="profile-list">
                    <div className="profile-list-title">Product catalogue</div>
                    <p className="result-meta">Company catalogue. Distributor handling or current stock is not confirmed unless a product-specific link is shown.</p>
                    {profile.entity.catalog.map(product=><div className="profile-rel" key={product.id}><div><strong>{product.product_name}</strong>{product.brand_name&&<span>Brand: {product.brand_name}</span>}{product.company_name!==profile.entity.company_name&&<span>Listed under {product.company_name}</span>}<small>{[product.generic_name,product.strength,product.dosage_form,product.pack_size].filter(Boolean).join(' · ')}</small></div></div>)}
                  </div>}

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
          <div className="hero-glow hero-glow-one"></div>
          <div className="hero-glow hero-glow-two"></div>
          <div className="container hero-inner hero-content">
            <div className="eyebrow">
              <ShieldCheck size={16}/> Kutch pharmaceutical directory
            </div>

            <h1>Find Who Handles<br/><span>What in Kutch.</span></h1>

            <p className="hero-copy">
              Search companies, subsidiaries, brands, products or distributors to find catalogue details and current Kutch distributor listings.
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
                placeholder="Search company, subsidiary, brand, product or distributor..."
                aria-label="Search"
              />
              <button type="submit" className="search-submit-button" aria-label="Search directory" title="Search directory"><Search size={21} strokeWidth={2.5}/></button>
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
                  <><div className="search-type-filters" role="group" aria-label="Filter search results">
                    {[
                      { id: 'all', label: 'All results', count: results.length },
                      { id: 'product', label: 'Products', count: results.filter(item => item.type === 'product').length },
                      { id: 'company', label: 'Companies', count: results.filter(item => item.type === 'company').length },
                      { id: 'division', label: 'Divisions', count: results.filter(item => item.type === 'division').length },
                      { id: 'relationship', label: 'Distributor listings', count: results.filter(item => item.type === 'relationship').length }
                    ].filter(item => item.id === 'all' || item.count > 0).map(item => (
                      <button
                        key={item.id}
                        type="button"
                        className={`search-type-filter ${searchFilter === item.id ? 'is-active' : ''}`}
                        aria-pressed={searchFilter === item.id}
                        onClick={() => setSearchFilter(item.id)}
                      >
                        {item.label} <span>{item.count}</span>
                      </button>
                    ))}
                  </div>
                  <div className="results-list">
                    {results.filter(item => searchFilter === 'all' || item.type === searchFilter).map(r => {
                      if (r.type === 'company') return (
                        <div className="result-card result-card-clickable" key={'company-'+r.id} role="link" tabIndex={0} onClick={() => openProfile('company',r.id)} onKeyDown={e => {if(e.key==='Enter'||e.key===' '){e.preventDefault();openProfile('company',r.id)}}}>
                          <div className="result-icon">{r.imageUrl ? <img src={r.imageUrl} alt={`${r.title} logo`} style={{width:'100%',height:'100%',objectFit:'contain',borderRadius:'inherit'}} /> : <Building2 size={19}/>}</div>
                          <div className="result-copy">
                            <strong>{r.title}</strong>
                            <span className="result-relation">{r.parentName ? 'Subsidiary of '+r.parentName : 'Company'}</span>
                            {r.children?.length > 0 && <span className="result-meta">Subsidiaries: {r.children.join(', ')}</span>}
                            <span className="result-meta">Company record · distributor relationships may be listed under subsidiaries</span>
                          </div>
                          <button className="result-open" aria-label={`Open ${r.title} profile`} onClick={e=>{e.stopPropagation();openProfile('company',r.id)}}><ArrowRight size={18}/></button>
                        </div>
                      )
                      if (r.type === 'division') return (
                        <div className="result-card result-card-clickable" key={'division-'+r.id} role="link" tabIndex={0} onClick={() => openProfile('division',r.id)} onKeyDown={e => {if(e.key==='Enter'||e.key===' '){e.preventDefault();openProfile('division',r.id)}}}>
                          <div className="result-icon">{r.imageUrl ? <img src={r.imageUrl} alt={`${r.companyName} logo`} style={{width:'100%',height:'100%',objectFit:'contain',borderRadius:'inherit'}} /> : <Building2 size={19}/>}</div>
                          <div className="result-copy"><strong>{r.title}</strong><span className="result-division">Division</span><span className="result-relation">Company: {r.companyName}</span><span className="result-meta">Open division profile to view its own catalogue and distributor relationships.</span></div>
                          <button className="result-open" aria-label={`Open ${r.companyName}`} onClick={e=>{e.stopPropagation();openProfile('division',r.id)}}><ArrowRight size={18}/></button>
                        </div>
                      )
                      if (r.type === 'product') return (
                        <div className="product-result-group" key={'product-'+r.id}>
                          <div className="result-card product-result-card result-card-clickable" role="link" tabIndex={0} aria-label={`Open ${r.companyName} company profile`} onClick={() => openProfile('company',r.companyId)} onKeyDown={e => {if(e.key==='Enter'||e.key===' '){e.preventDefault();openProfile('company',r.companyId)}}}>
                            <div className="result-icon"><Package size={20}/></div>
                            <div className="result-copy">
                              <strong>{r.title}</strong>
                              {r.brandName && <span className="result-division">Brand: {r.brandName}</span>}
                              {r.divisionName && <span className="result-division">Division: {r.divisionName}</span>}
                              {r.specs && <span className="result-meta">{r.specs}</span>}
                              <span className="result-relation">Company: {r.companyName}{r.parentName ? ' · part of '+r.parentName : ''}</span>
                            </div>
                          </div>
                          <button type="button" className="product-distributors-toggle" aria-expanded={!!expandedProductDistributors[r.id]} onClick={() => setExpandedProductDistributors(current => ({...current,[r.id]:!current[r.id]}))}>
                            <span className="product-distributors-toggle-icon"><Truck size={19}/></span>
                            <span className="product-distributors-toggle-copy">
                              <strong>{expandedProductDistributors[r.id] ? 'Hide distributors' : 'View distributors'}</strong>
                              <small>{r.distributors.length ? `${r.distributors.length} contact${r.distributors.length===1?'':'s'} listed in Kutch` : 'No distributor contacts listed yet'}</small>
                            </span>
                            <ArrowRight size={17} className={expandedProductDistributors[r.id]?'is-expanded':''}/>
                          </button>
                          {expandedProductDistributors[r.id] && (
                            <div className="product-distributors-panel">
                              <div className="product-distributors-heading">
                                <strong>Distributors in Kutch</strong>
                                {!r.directDistributorLinks && r.distributors.length>0 && <span>Company-listed contacts · product-specific handling not confirmed</span>}
                                {r.directDistributorLinks && <span>Product-specific listing · availability not confirmed</span>}
                              </div>
                              {r.distributors.length ? r.distributors.map(distributor => (
                                <div className="product-distributor-row" key={distributor.id}>
                                  <div className="product-distributor-name">
                                    <strong>{distributor.distributor_name}</strong>
                                    {distributor.address && <small><MapPin size={13}/>{distributor.address}</small>}
                                  </div>
                                  <div className="product-distributor-actions">
                                    {distributor.mobile && <a href={phoneLink(distributor.mobile)} onClick={e=>e.stopPropagation()}><Phone size={14}/>Call</a>}
                                    {(distributor.whatsapp || distributor.mobile) && <a href={waLink(distributor.whatsapp||distributor.mobile,stockWhatsAppMessage(distributor.distributor_name,r.title))} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}><MessageCircle size={14}/>WhatsApp</a>}
                                    {mapsLink(distributor) && <a href={mapsLink(distributor)} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}><MapPin size={14}/>{mapsLabel(distributor)}</a>}
                                  </div>
                                </div>
                              )) : <p className="product-distributors-empty">No active distributor contacts are linked to this listing yet.</p>}
                            </div>
                          )}
                        </div>
                      )
                      const profileType = r.icon === 'company' ? 'company' : 'distributor'
                      const profileId = r.icon === 'company'
                        ? r.rel.company_id
                        : r.rel.distributor_id

                      return (
                        <div
                          className="result-card result-card-clickable"
                          key={r.type + r.rel.id}
                          role="link"
                          tabIndex={0}
                          onClick={() => openProfile(profileType, profileId)}
                          onKeyDown={e => {if(e.key==='Enter'||e.key===' '){e.preventDefault();openProfile(profileType, profileId)}}}
                        >
                          <div className={`result-icon ${r.icon === 'distributor' ? 'distributor-icon' : ''}`}>
                            {r.icon === 'company' ? (r.imageUrl ? <img src={r.imageUrl} alt={`${r.title} logo`} style={{width:'100%',height:'100%',objectFit:'contain',borderRadius:'inherit'}} /> : <Building2 size={19}/>) : <Truck size={19}/>}
                          </div>

                          <div className="result-copy">
                            <strong>{r.title}</strong>
                            {r.subtitle && <span className="result-division">{r.subtitle}</span>}
                            <span className="result-relation">{r.relation}</span>
                            <span className="result-target">
                              {r.target.company_name || r.target.distributor_name}
                            </span>
                            <span className="result-meta">{r.rel.territory || 'Kutch'}</span>
                            {r.rel.verification_status === 'verified' && (
                              <span className="verified-badge verified-badge-small" title="This current distributor-company relationship has been independently verified.">
                                <ShieldCheck size={12}/> Verified
                              </span>
                            )}
                            {r.rel.verification_status === 'needs_review' && <span className="status-badge status-review">Under Review</span>}
                            {r.rel.verification_status !== 'verified' && r.rel.verification_status !== 'needs_review' && (
                              <span className="status-badge status-unverified" title="This relationship is listed from supplied directory data but has not been independently confirmed.">
                                <span className="status-symbol">!</span> Not Verified
                              </span>
                            )}

                            {r.target.mobile && (
                              <div className="result-phone">
                                <Phone size={13}/>
                                <a
                                  href={phoneLink(r.target.mobile)}
                                  onClick={e => {e.stopPropagation();trackEvent('phone_click',{entity_type:profileType})}}
                                >
                                  {r.target.mobile}
                                </a>
                              </div>
                            )}

                            <div className="result-actions">
                              {r.contact?.mobile && (
                                <a href={phoneLink(r.contact.mobile)} onClick={e=>e.stopPropagation()}>
                                  <Phone size={14}/> Call
                                </a>
                              )}
                              {(r.contact?.whatsapp || r.contact?.mobile) && (
                                <a href={waLink(r.contact.whatsapp || r.contact.mobile,stockWhatsAppMessage(r.contact.distributor_name,profileType==='company'?r.title:(r.target.company_name||r.title)))} target="_blank" rel="noreferrer" onClick={e=>{e.stopPropagation();trackEvent('whatsapp_stock_inquiry',{entity_type:profileType})}}>
                                  <MessageCircle size={14}/> Check Stock on WhatsApp
                                </a>
                              )}
                              <button type="button" className="result-report-action" onClick={e=>{e.stopPropagation();openReport({type:profileType,id:profileId,name:r.title,message:`Please review the listing or distributorship relationship for ${r.title} and ${r.target.company_name||r.target.distributor_name}.`})}}>
                                <Flag size={13}/> Report / Update Info
                              </button>
                              {mapsLink(r.target) && (
                                <a
                                  href={mapsLink(r.target)}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={e => {e.stopPropagation();trackEvent('maps_click',{entity_type:profileType})}}
                                >
                                  <MapPin size={14}/> {mapsLabel(r.target)}
                                </a>
                              )}
                            </div>
                          </div>

                          <button
                            className="result-open"
                            aria-label={`Open ${r.target.company_name || r.target.distributor_name} profile`}
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
                  </div></>
                )}

                {!loading && !error && results.length === 0 && (
                  <div className="result-state">
                    No current distributor relationship found for this search.
                  </div>
                )}
              </div>
            )}

            {recentSearches.length>0 && (
              <section className="recent-searches" aria-labelledby="recent-searches-title">
                <div className="recent-searches-heading">
                  <h2 id="recent-searches-title">Recent Searches</h2>
                  <button type="button" onClick={clearRecentSearches}>Clear</button>
                </div>
                <div className="recent-searches-list">
                  {recentSearches.map(item=>(
                    <button type="button" key={item.type+'-'+item.id} onClick={()=>openProfile(item.type,item.id)}>
                      {item.type==='company'?<Building2 size={15}/>:<Truck size={15}/>}
                      <span>{item.name}</span><ArrowRight size={14}/>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {!searched && (
              <div className="quick-links">
                <button onClick={()=>{pushRoute('browse',{type:'companies'});setBrowse('companies');setBrowseCategory(null)}}><Building2 size={17}/> Browse Companies <ArrowRight size={15}/></button>
                <button onClick={()=>{pushRoute('browse',{type:'distributors'});setBrowse('distributors');setBrowseCategory(null)}}><Truck size={17}/> Browse Distributors <ArrowRight size={15}/></button>
                <button onClick={()=>{pushRoute('browse',{type:'locations'});setBrowse('locations');setBrowseCategory(null)}}><MapPin size={17}/> Browse Locations <ArrowRight size={15}/></button>
              </div>
            )}
          </div>
        </section>

        <section className="admin-contact-section">
          <div className="container admin-contact-card">
            <div>
              <p className="section-kicker">NEED HELP?</p>
              <h2>Can't find the company or distributor you're looking for?</h2>
              <p>Contact the KutchPharmaConnect admin team for help with directory information or a missing listing.</p>
              <p className="admin-contact-number">Call or WhatsApp: <strong>+91 89800 43357</strong></p>
            </div>
            <div className="admin-contact-actions">
              <a href={phoneLink(ADMIN_PHONE)}><Phone size={16}/> Call Admin</a>
              <a href={waLink(ADMIN_PHONE,adminWhatsAppMessage)} target="_blank" rel="noreferrer"><MessageCircle size={16}/> WhatsApp Admin</a>
            </div>
          </div>
        </section>


      </>
    )
  }

  return (
    <div className={`app app-theme-${theme}`}>
      <header className="header">
        <div className="container header-inner">
          <a className="brand" href={import.meta.env.BASE_URL} aria-label="KutchPharmaConnect home">
            <span className="brand-text">KutchPharmaConnect</span>
          </a>
          <nav className="header-nav">
            <button onClick={()=>{pushRoute('browse',{type:'companies'});setBrowse('companies');setBrowseCategory(null)}}>Companies</button>
            <button onClick={()=>{pushRoute('browse',{type:'distributors'});setBrowse('distributors');setBrowseCategory(null)}}>Distributors</button>
            <button onClick={()=>{pushRoute('browse',{type:'locations'});setBrowse('locations');setBrowseCategory(null)}}>Locations</button>
            <button onClick={()=>{pushRoute('browse',{type:'products'});setBrowse('products');setBrowseCategory(null);setProfile(null);setAdmin(false)}}>Products</button>
            <button
              className="theme-toggle"
              type="button"
              onClick={()=>setTheme(current=>current==='dark'?'light':'dark')}
              aria-label={theme==='dark'?'Switch to light mode':'Switch to dark mode'}
              title={theme==='dark'?'Switch to light mode':'Switch to dark mode'}
            >
              {theme==='dark'?<Sun size={15}/>:<Moon size={15}/>}
              <span>{theme==='dark'?'Light':'Dark'}</span>
            </button>
            <button type="button" onClick={()=>{if(session){pushRoute('admin');setProfile(null);setBrowse(null);setAdmin(true)}else setAuthOpen(true)}} className="admin-nav-button">{session?<><UserRound size={15}/><span>Admin Dashboard</span></>:<><UserRound size={15}/><span>Log in</span></>}</button>
          </nav>
        </div>
      </header>

      <main>
        {policyPage ? <ErrorBoundary><Suspense fallback={<div className="admin-state">Loading policy page…</div>}><PolicyPages page={policyPage} onBack={()=>{setPolicyPage(null);window.location.href=import.meta.env.BASE_URL}} /></Suspense></ErrorBoundary> : admin ? (authLoading ? <div className="admin-state"><LoaderCircle className="spin" size={20}/> Checking admin access…</div> : session ? <ErrorBoundary><Suspense fallback={<div className="admin-state"><LoaderCircle className="spin" size={20}/> Loading admin dashboard…</div>}><AdminDashboard /></Suspense></ErrorBoundary> : <div className="admin-state"><ShieldCheck size={22}/> Admin authentication required.</div>) : profile ? renderProfile() : browse==='products' ? <ErrorBoundary><Suspense fallback={<div className="admin-state"><LoaderCircle className="spin" size={20}/> Loading products…</div>}><ProductDirectory productId={browseCategory} onBack={backFromBrowse} onOpenProduct={id=>{pushRoute('browse',{type:'products',category:id});setBrowse('products');setBrowseCategory(id)}} onOpenCompany={id=>{setBrowse(null);setBrowseCategory(null);openProfile('company',id)}} onOpenDistributor={id=>{setBrowse(null);setBrowseCategory(null);openProfile('distributor',id)}} /></Suspense></ErrorBoundary> : browse ? <ErrorBoundary><Suspense fallback={<div className="admin-state"><LoaderCircle className="spin" size={20}/> Loading directory…</div>}><BrowseDirectory type={browse} category={browseCategory} onBack={backFromBrowse} onOpenProfile={(type,id)=>{setBrowse(null);setBrowseCategory(null);openProfile(type,id)}} onReport={openReport} /></Suspense></ErrorBoundary> : renderSearch()}
      </main>

      {!policyPage && !admin && <section className="distributor-join-section" aria-labelledby="distributor-join-title">
        <div className="container distributor-join-inner">
          <div className="distributor-join-copy">
            <span className="distributor-join-kicker">FOR PHARMACEUTICAL DISTRIBUTORS</span>
            <h2 id="distributor-join-title">Are you a distributor in Kutch?</h2>
            <p>Get your company and distributorship details listed on KutchPharmaConnect. Submit your details for review.</p>
          </div>
          <DistributorSubmissionLauncher variant="inline" />
        </div>
      </section>}

      <button className="report-floating" onClick={openReport}><Flag size={15}/> Report Incorrect Information</button>

      <footer className="site-footer">
        <div className="container site-footer-inner">
          <div className="site-footer-brand">
            <div className="site-footer-copy">
              <span className="footer-brand-text">KutchPharmaConnect</span>
              <span>KutchPharmaConnect — Find Who Handles What in Kutch</span>
              <span>Directory information may change. Please contact the distributor directly to confirm current distributorship, territory, availability, and contact details.</span>
              <nav className="policy-links" aria-label="Legal and information"><a href="?view=about">About</a><a href="?view=privacy">Privacy Policy</a><a href="?view=terms">Terms of Use</a><a href="?view=disclaimer">Disclaimer</a><a href="?view=corrections">Corrections</a><a href="?view=contact">Contact</a></nav>
            </div>
          </div>
          <div className="site-footer-contact">
            <span>Help improve this website</span>
            <SiteFeedback />
            <span>Admin Contact</span>
            {ADMIN_PHONE && <><a href={phoneLink(ADMIN_PHONE)}><Phone size={13}/> Call Admin</a><a href={waLink(ADMIN_PHONE,adminWhatsAppMessage)} target="_blank" rel="noreferrer"><MessageCircle size={13}/> WhatsApp</a></>}
          </div>
        </div>
      </footer>

      {reportOpen && <div className="report-overlay" onMouseDown={e=>e.target===e.currentTarget&&setReportOpen(false)}>
        <div className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title">
          <button className="report-close" onClick={()=>setReportOpen(false)} aria-label="Close"><X size={18}/></button>
          {!reportSent ? <>
            <p className="section-kicker">DIRECTORY FEEDBACK</p>
            <h2 id="report-dialog-title">Report Incorrect Information</h2>
            <p className="report-help">Help us keep KutchPharmaConnect accurate. Report an outdated relationship, incorrect contact detail, company name, or other directory issue.</p>
            {(reportTarget||profile) && <div className="report-target"><strong>{reportTarget?.name || profile?.entity?.company_name || profile?.entity?.distributor_name}</strong><span>{reportTarget?'Listing selected from directory':'Profile currently open'}</span></div>}
            <form onSubmit={submitReport}>
              <label>What is incorrect?
                <select value={report.type} onChange={e=>setReport({...report,type:e.target.value})}>
                  <option value="incorrect_relationship">Company / distributor relationship</option>
                  <option value="incorrect_contact">Contact details</option>
                  <option value="incorrect_company_name">Company or distributor name</option>
                  <option value="other">Other directory information</option>
                </select>
              </label>
              <label>What should be corrected? <span className="required">*</span>
                <textarea required value={report.message} onChange={e=>setReport({...report,message:e.target.value})} placeholder="Example: This distributor no longer handles Cipla in Bhuj. Please remove or update the relationship." rows="5" />
              </label>
              <div className="report-reporter-box">
                <strong>About you</strong>
                <span>Please provide your details so our admin team can verify the information if necessary. We will use them only for directory review.</span>
                <label>Name <span className="required">*</span><input required value={report.reporter_name} onChange={e=>setReport({...report,reporter_name:e.target.value})} placeholder="Your name"/></label>
                <div className="report-reporter-grid">
                  <label>Mobile / WhatsApp <span className="required">*</span><input required value={report.reporter_mobile} onChange={e=>setReport({...report,reporter_mobile:e.target.value})} placeholder="+91 98765 43210"/></label>
                  <label>Email <span className="optional-label">optional</span><input type="email" value={report.reporter_email} onChange={e=>setReport({...report,reporter_email:e.target.value})} placeholder="you@example.com"/></label>
                </div>
              </div>
              {reportError && <div className="report-error">{reportError}</div>}
              <button className="report-submit" disabled={reportSubmitting}>{reportSubmitting ? <><LoaderCircle className="spin" size={16}/> Sending…</> : <><Flag size={16}/> Submit Report</>}</button>
            </form>
          </> : <div className="report-success"><CheckCircle2 size={42}/><h2>Report submitted</h2><p>Thank you. Your correction will be reviewed before directory data is changed.</p><button onClick={()=>setReportOpen(false)}>Close</button></div>}
        </div>
      </div>}

      {authOpen && <div className="report-overlay"><div className="report-modal" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title">
        <button className="report-close" onClick={()=>setAuthOpen(false)} aria-label="Close"><X size={18}/></button>
        <p className="section-kicker">ADMIN ACCESS</p><h2 id="auth-dialog-title">Admin Login</h2><p className="report-help">Sign in with the authorized KutchPharmaConnect admin account.</p>
        <form onSubmit={signInAdmin}>
          <label>Email address<input required type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="admin@example.com" /></label>
          <label>Password<input required type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="Password" /></label>
          {authError&&<div className="report-error">{authError}</div>}
          <button className="report-submit" disabled={authBusy}>{authBusy?<><LoaderCircle className="spin" size={16}/> Signing in…</>:<><ShieldCheck size={16}/> Sign In</>}</button>
        </form>
        <button className="profile-link-button" style={{marginTop:'12px'}} onClick={()=>{setResetError('');setResetSent(false);setAuthOpen(false);setResetOpen(true)}}>Forgot password?</button>
      </div></div>}

      {resetOpen && <div className="report-overlay"><div className="report-modal" role="dialog" aria-modal="true" aria-labelledby="reset-dialog-title">
        <button className="report-close" onClick={()=>setResetOpen(false)} aria-label="Close"><X size={18}/></button>
        <p className="section-kicker">ADMIN ACCESS</p><h2 id="reset-dialog-title">Reset Password</h2>
        {!resetSent ? <>
          <p className="report-help">Password reset remains email-based in this version. Use the admin email configured in Supabase.</p>
          <form onSubmit={requestPasswordReset}>
            <label>Email<input required type="email" value={resetEmail} onChange={e=>setResetEmail(e.target.value)} placeholder="Admin email" /></label>
            {resetError&&<div className="report-error">{resetError}</div>}
            <button className="report-submit" disabled={authBusy}>{authBusy?<><LoaderCircle className="spin" size={16}/> Sending…</>:<>Send Reset Link</>}</button>
          </form>
        </> : <>
          <p className="report-help">Check your email and open the newest reset link. Keep this app running while you open the link.</p>
          <div className="report-success"><CheckCircle2 size={42}/><h2>Reset email sent</h2><p>If the account exists, Supabase has sent a password-reset email to <strong>{resetEmail}</strong>.</p><button onClick={()=>setResetOpen(false)}>Close</button></div>
        </>}
      </div></div>}

      {passwordResetOpen && <div className="report-overlay"><div className="report-modal" role="dialog" aria-modal="true" aria-labelledby="password-reset-dialog-title">
        <p className="section-kicker">ADMIN ACCESS</p><h2 id="password-reset-dialog-title">Set New Password</h2><p className="report-help">Your reset link is valid. Choose a new password for the admin account.</p>
        <form onSubmit={updateAdminPassword}>
          <label>New password<input required type="password" minLength="8" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="New password" /></label>
          <label>Confirm password<input required type="password" minLength="8" value={newPasswordConfirm} onChange={e=>setNewPasswordConfirm(e.target.value)} placeholder="Confirm new password" /></label>
          {resetError&&<div className="report-error">{resetError}</div>}
          <button className="report-submit" disabled={authBusy}>{authBusy?<><LoaderCircle className="spin" size={16}/> Updating…</>:<><ShieldCheck size={16}/> Update Password</>}</button>
        </form>
      </div></div>}

      {admin && session && <button className="admin-signout" onClick={signOutAdmin}>Sign out</button>}

    </div>
  )
}
