import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, Download, LoaderCircle, RefreshCw, Search, Users, MousePointerClick, ClipboardList, TrendingUp, Phone, MessageCircle, MapPin, Mail, CalendarClock, AlertTriangle, Eye, Package, Building2 } from 'lucide-react'
import { supabase } from './lib/supabase'
import './AdminDistributorPerformance.css'

const EVENT_LABELS = { profile_view:'Profile views', call_click:'Call clicks', whatsapp_click:'WhatsApp clicks', maps_click:'Maps clicks', email_click:'Email clicks' }
const STATUSES = ['new','contacted','converted','not_converted','invalid']
const COLORS = ['#4778d0','#16a085','#d49a36','#8b6bd6','#d36b78']
function csvCell(value) { return '"' + String(value ?? '').replaceAll('"','""') + '"' }
function downloadCsv(filename, headers, rows) {
  const csv = [headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'})
  const url = URL.createObjectURL(blob); const link=document.createElement('a')
  link.href=url; link.download=filename; link.click(); URL.revokeObjectURL(url)
}
function dateKey(value) { const d=new Date(value); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0') }
function dateLabel(value) { return new Date(value+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'}) }
function TrendChart({data,visibleSeries}) {
  const w=680,h=220,l=34,r=14,t=16,b=34,keys=['views','contacts','enquiries'].filter(k=>visibleSeries[k]),max=Math.max(1,...data.flatMap(x=>keys.map(k=>x[k])))
  const x=i=>l+(data.length<=1?0:i*(w-l-r)/(data.length-1)), y=v=>t+(h-t-b)*(1-v/max)
  const path=key=>data.map((d,i)=>(i?'L':'M')+' '+x(i)+' '+y(d[key])).join(' ')
  const labels=data.filter((d,i)=>i===0||i===data.length-1||i%Math.max(1,Math.ceil(data.length/6))===0)
  const area=key=>path(key)+' L '+x(data.length-1)+' '+(h-b)+' L '+x(0)+' '+(h-b)+' Z'
  return <div className="kpc-chart-canvas"><svg viewBox={'0 0 '+w+' '+h} role="img" aria-label="Daily profile views, contact clicks and enquiries">
    <defs>
      <linearGradient id="kpc-view-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#4778d0" stopOpacity=".22"/><stop offset="100%" stopColor="#4778d0" stopOpacity="0"/></linearGradient>
      <linearGradient id="kpc-contact-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#16a085" stopOpacity=".16"/><stop offset="100%" stopColor="#16a085" stopOpacity="0"/></linearGradient>
    </defs>
    {[0,.25,.5,.75,1].map((p,i)=><g key={i}><line x1={l} x2={w-r} y1={t+(h-t-b)*p} y2={t+(h-t-b)*p} className="kpc-chart-gridline"/><text x={l-9} y={t+(h-t-b)*p+4} textAnchor="end" className="kpc-chart-axis">{Math.round(max*(1-p))}</text></g>)}
    {visibleSeries.views&&<path d={area('views')} fill="url(#kpc-view-fill)"/>}{visibleSeries.contacts&&<path d={area('contacts')} fill="url(#kpc-contact-fill)"/>}
    {visibleSeries.views&&<path d={path('views')} className="kpc-chart-line kpc-chart-line-views"/>}{visibleSeries.contacts&&<path d={path('contacts')} className="kpc-chart-line kpc-chart-line-contacts"/>}{visibleSeries.enquiries&&<path d={path('enquiries')} className="kpc-chart-line kpc-chart-line-enquiries"/>}
    {data.map((d,i)=><g key={d.date}>{visibleSeries.views&&<circle cx={x(i)} cy={y(d.views)} r="2.5" className="kpc-chart-dot kpc-chart-dot-views"><title>{d.date}: {d.views} profile views</title></circle>}{visibleSeries.contacts&&<circle cx={x(i)} cy={y(d.contacts)} r="2.5" className="kpc-chart-dot kpc-chart-dot-contacts"><title>{d.date}: {d.contacts} contact clicks</title></circle>}{visibleSeries.enquiries&&<circle cx={x(i)} cy={y(d.enquiries)} r="2.5" className="kpc-chart-dot kpc-chart-dot-enquiries"><title>{d.date}: {d.enquiries} enquiries</title></circle>}</g>)}
    {labels.map(d=><text key={d.date} x={x(data.indexOf(d))} y={h-10} textAnchor="middle" className="kpc-chart-axis">{dateLabel(d.date)}</text>)}
  </svg></div>
}
function HorizontalBars({items,color}) {
  const max=Math.max(1,...items.map(x=>x.value))
  return <div className="kpc-horizontal-bars">{items.length?items.map((item,i)=><div className="kpc-hbar-row" key={item.id||item.label||i}><div className="kpc-hbar-label"><span title={item.label}>{item.label}</span><strong>{Math.round(item.value).toLocaleString('en-IN')}</strong></div><div className="kpc-hbar-track"><span style={{width:(item.value/max*100)+'%',background:color}}/></div></div>):<div className="kpc-chart-empty">No contextual activity recorded yet.</div>}</div>
}
function DonutChart({items}) {
  const total=items.reduce((s,x)=>s+x.value,0);let offset=0
  const stops=items.map((item,i)=>{const start=offset;offset+=total?item.value/total*100:0;return COLORS[i%COLORS.length]+' '+start+'% '+offset+'%'})
  return <div className="kpc-donut-layout"><div className="kpc-donut" style={{background:total?'conic-gradient('+stops.join(',')+')':'conic-gradient(#e8edf3 0% 100%)'}}><div><strong>{total}</strong><span>Enquiries</span></div></div><div className="kpc-donut-legend">{items.map((item,i)=><div key={item.label}><span style={{background:COLORS[i%COLORS.length]}}/><label>{item.label}</label><strong>{item.value}</strong></div>)}</div></div>
}

export default function AdminDistributorPerformance({onBack}) {
  const [days,setDays]=useState('30'),[search,setSearch]=useState(''),[statusFilter,setStatusFilter]=useState('all'),[visibleTrend,setVisibleTrend]=useState({views:true,contacts:true,enquiries:true})
  const [events,setEvents]=useState([]),[enquiries,setEnquiries]=useState([]),[distributors,setDistributors]=useState([]),[sessions,setSessions]=useState([])
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[savingId,setSavingId]=useState(''),[notice,setNotice]=useState('')
  async function load() {
    setLoading(true);setError('');setNotice('')
    const since=new Date(Date.now()-Number(days)*86400000).toISOString()
    const [eventRes,enquiryRes,distributorRes,sessionRes]=await Promise.all([
      supabase.from('distributor_contact_events').select('id,distributor_id,event_type,profile_type,profile_id,session_id,company_id,division_id,brand_id,product_id,occurred_at,source_page,referrer,utm_source,utm_medium,utm_campaign,companies(company_name),products(product_name)').gte('occurred_at',since).order('occurred_at',{ascending:false}).limit(10000),
      supabase.from('distributor_enquiries').select('id,distributor_id,company_id,division_id,brand_id,product_id,customer_name,mobile,email,message,consent,routing_status,status,source_page,created_at,updated_at,admin_notes,contacted_at,follow_up_at,distributors(distributor_name),companies(company_name),divisions(division_name),brands(brand_name),products(product_name)').gte('created_at',since).order('created_at',{ascending:false}).limit(5000),
      supabase.from('distributors').select('id,distributor_name,mobile,whatsapp').eq('status','active').order('distributor_name'),
      supabase.from('kpc_visitor_sessions').select('session_id,first_seen_at,last_seen_at,landing_page,landing_referrer,utm_source,utm_medium,utm_campaign').gte('last_seen_at',since).order('last_seen_at',{ascending:false}).limit(10000)
    ])
    const bad=eventRes.error||enquiryRes.error||distributorRes.error||sessionRes.error
    if(bad){setError(bad.message||'Could not load distributor performance.');setLoading(false);return}
    setEvents(eventRes.data||[]);setEnquiries(enquiryRes.data||[]);setDistributors(distributorRes.data||[]);setSessions(sessionRes.data||[]);setLoading(false)
  }
  useEffect(()=>{load()},[days])
  const reportEvents=events
  const performance=useMemo(()=>{
    const map=new Map()
    distributors.forEach(d=>map.set(d.id,{id:d.id,name:d.distributor_name,mobile:d.mobile,profileViews:0,calls:0,whatsapp:0,maps:0,emails:0,enquiries:0,converted:0,newEnquiries:0}))
    reportEvents.forEach(e=>{const r=map.get(e.distributor_id);if(!r)return;if(e.event_type==='profile_view')r.profileViews++;if(e.event_type==='call_click')r.calls++;if(e.event_type==='whatsapp_click')r.whatsapp++;if(e.event_type==='maps_click')r.maps++;if(e.event_type==='email_click')r.emails++})
    enquiries.forEach(e=>{const r=map.get(e.distributor_id);if(!r)return;r.enquiries++;if(e.status==='converted')r.converted++;if(e.status==='new')r.newEnquiries++})
    return [...map.values()].sort((a,b)=>(b.enquiries-a.enquiries)||(b.calls+b.whatsapp-a.calls-a.whatsapp)||(b.profileViews-a.profileViews)||a.name.localeCompare(b.name))
  },[distributors,reportEvents,enquiries])
  const filteredPerformance=performance.filter(r=>r.name.toLowerCase().includes(search.trim().toLowerCase()))
  const filteredEnquiries=enquiries.filter(r=>{
    const context=[r.companies?.company_name,r.divisions?.division_name,r.brands?.brand_name,r.products?.product_name].filter(Boolean).join(' ')
    const text=[r.customer_name,r.mobile,r.email,r.distributors?.distributor_name||'Needs admin review',r.message,context].join(' ').toLowerCase()
    return text.includes(search.trim().toLowerCase())&&(statusFilter==='all'||r.status===statusFilter)
  })
  const totals=useMemo(()=>({
    views:reportEvents.filter(x=>x.event_type==='profile_view').length,calls:reportEvents.filter(x=>x.event_type==='call_click').length,
    whatsapp:reportEvents.filter(x=>x.event_type==='whatsapp_click').length,maps:reportEvents.filter(x=>x.event_type==='maps_click').length,
    emails:reportEvents.filter(x=>x.event_type==='email_click').length,enquiries:enquiries.length,
    sessions:sessions.length,
    converted:enquiries.filter(x=>x.status==='converted').length,new:enquiries.filter(x=>x.status==='new').length,
    engaged:new Set(reportEvents.map(x=>x.distributor_id).filter(Boolean)).size,
    due:enquiries.filter(x=>x.follow_up_at&&new Date(x.follow_up_at)<=new Date()&&!['converted','not_converted','invalid'].includes(x.status)).length,
    review:enquiries.filter(x=>x.routing_status==='needs_review').length
  }),[reportEvents,enquiries,sessions])
  const trend=useMemo(()=>{
    const n=Number(days),rows=Array.from({length:n},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(n-1-i));return {date:dateKey(d),views:0,contacts:0,enquiries:0}})
    const ix=new Map(rows.map((r,i)=>[r.date,i]))
    reportEvents.forEach(e=>{const i=ix.get(dateKey(e.occurred_at));if(i===undefined)return;if(e.event_type==='profile_view')rows[i].views++;else rows[i].contacts++})
    enquiries.forEach(e=>{const i=ix.get(dateKey(e.created_at));if(i!==undefined)rows[i].enquiries++})
    return rows
  },[days,reportEvents,enquiries])
  const eventBreakdown=useMemo(()=>Object.keys(EVENT_LABELS).map(k=>({id:k,label:EVENT_LABELS[k],value:reportEvents.filter(e=>e.event_type===k).length})),[reportEvents])
  const companyInsights=useMemo(()=>{
    const map=new Map()
    reportEvents.forEach(e=>{if(e.company_id){const x=map.get(e.company_id)||{id:e.company_id,label:e.companies?.company_name||'Company',value:0};x.value++;map.set(e.company_id,x)}})
    enquiries.forEach(e=>{if(e.company_id){const x=map.get(e.company_id)||{id:e.company_id,label:e.companies?.company_name||'Company',value:0};x.label=e.companies?.company_name||x.label;x.value++;map.set(e.company_id,x)}})
    return [...map.values()].sort((a,b)=>b.value-a.value).slice(0,5)
  },[reportEvents,enquiries])
  const productInsights=useMemo(()=>{
    const map=new Map()
    reportEvents.forEach(e=>{if(e.product_id){const x=map.get(e.product_id)||{id:e.product_id,label:e.products?.product_name||'Product',value:0};x.value++;map.set(e.product_id,x)}})
    enquiries.forEach(e=>{if(e.product_id){const x=map.get(e.product_id)||{id:e.product_id,label:e.products?.product_name||'Product',value:0};x.label=e.products?.product_name||x.label;x.value++;map.set(e.product_id,x)}})
    return [...map.values()].sort((a,b)=>b.value-a.value).slice(0,5)
  },[reportEvents,enquiries])
  const profileTypeBreakdown=['company','distributor','division','brand','product'].map(type=>({type,count:reportEvents.filter(e=>e.event_type==='profile_view'&&e.profile_type===type).length}))
  const topDistributors=performance.filter(x=>x.profileViews+x.calls+x.whatsapp+x.maps+x.emails+x.enquiries>0).slice(0,6).map(x=>({id:x.id,label:x.name,value:x.enquiries*3+x.calls+x.whatsapp+x.profileViews*.15}))
  const statusItems=STATUSES.map(s=>({label:s.replace('_',' '),value:enquiries.filter(e=>e.status===s).length}))
  async function updateEnquiry(row) {
    setSavingId(row.id);setError('');setNotice('')
    const patch={status:row.status,admin_notes:row.admin_notes||null,follow_up_at:row.follow_up_at||null,updated_at:new Date().toISOString(),...(row.status==='contacted'&&!row.contacted_at?{contacted_at:new Date().toISOString()}:{})}
    const {error:updateError}=await supabase.from('distributor_enquiries').update(patch).eq('id',row.id)
    setSavingId('')
    if(updateError){setError(updateError.message);return}
    setNotice('Enquiry updated.');setEnquiries(old=>old.map(x=>x.id===row.id?{...x,...patch}:x))
  }
  function exportPerformance(){downloadCsv('kpc-distributor-performance.csv',['Distributor','Profile views','Call clicks','WhatsApp clicks','Maps clicks','Email clicks','Enquiries','New enquiries','Converted'],filteredPerformance.map(x=>[x.name,x.profileViews,x.calls,x.whatsapp,x.maps,x.emails,x.enquiries,x.newEnquiries,x.converted]))}
  function exportEnquiries(){downloadCsv('kpc-customer-enquiries.csv',['Submitted at','Customer','Mobile','Email','Distributor','Company','Division','Brand','Product','Message','Status','Routing','Follow-up'],filteredEnquiries.map(x=>[x.created_at,x.customer_name,x.mobile,x.email,x.distributors?.distributor_name,x.companies?.company_name,x.divisions?.division_name,x.brands?.brand_name,x.products?.product_name,x.message,x.status,x.routing_status,x.follow_up_at]))}

  return <div className="admin-page kpc-performance-page">
    <div className="admin-head"><div><button className="back-button" onClick={onBack}><ArrowLeft size={16}/> Control Center</button><p className="section-kicker">DISTRIBUTOR ANALYTICS</p><h1>Distributor Performance</h1><p>One view of distributor engagement, customer enquiries and follow-up work.</p></div><button className="admin-refresh" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
    <div className="kpc-performance-toolbar"><label>Reporting period<select value={days} onChange={e=>setDays(e.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label><label className="kpc-performance-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search distributor or enquiry"/></label><span className="kpc-data-updated">Live database data · refreshed {loading?'…':new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span></div>
    {error&&<div className="admin-error">{error}</div>}{notice&&<div className="admin-success">{notice}</div>}
    {loading?<div className="admin-state"><LoaderCircle className="spin" size={20}/> Loading performance data…</div>:<>
      <section className="kpc-performance-kpis">
        <div><span><Users size={16}/> Visitor sessions</span><strong>{totals.sessions.toLocaleString('en-IN')}</strong><small>Distinct browser sessions · not unique people</small></div>
        <div><span><ClipboardList size={16}/> Customer enquiries</span><strong>{totals.enquiries.toLocaleString('en-IN')}</strong><small>{totals.new} new · {totals.converted} converted</small></div>
        <div><span><Eye size={16}/> Profile views</span><strong>{totals.views.toLocaleString('en-IN')}</strong><small>All five profile types</small></div>
        <div><span><MousePointerClick size={16}/> Contact clicks</span><strong>{(totals.calls+totals.whatsapp+totals.maps+totals.emails).toLocaleString('en-IN')}</strong><small>{totals.calls} calls · {totals.whatsapp} WhatsApp</small></div>
        <div><span><CalendarClock size={16}/> Follow-ups due</span><strong>{totals.due.toLocaleString('en-IN')}</strong><small>{totals.review} enquiries need routing review</small></div>
      </section>
      <section className="admin-panel kpc-performance-panel">
        <div className="kpc-performance-section-head"><div><p className="section-kicker">PROFILE INTEREST</p><h2>Views by profile type</h2><p>Recorded profile views, grouped by the actual entity type.</p></div></div>
        <div className="kpc-channel-list">{profileTypeBreakdown.map(item=><div key={item.type}><label>{item.type.charAt(0).toUpperCase()+item.type.slice(1)}</label><strong>{item.count.toLocaleString('en-IN')}</strong></div>)}</div>
      </section>
      <section className="kpc-chart-grid">
        <article className="admin-panel kpc-chart-panel kpc-chart-wide"><div className="kpc-chart-heading"><div><p className="section-kicker">ACTIVITY TREND</p><h2>Engagement over time</h2><p>Daily profile views, contact clicks and submitted enquiries.</p></div><TrendingUp size={19}/></div><div className="kpc-chart-legend" aria-label="Toggle chart series">{[{key:'views',label:'Profile views'},{key:'contacts',label:'Contact clicks'},{key:'enquiries',label:'Enquiries'}].map(item=><button type="button" key={item.key} className={!visibleTrend[item.key]?'is-muted':''} aria-pressed={visibleTrend[item.key]} onClick={()=>setVisibleTrend(old=>({...old,[item.key]:!old[item.key]}))}><i className={item.key}/>{item.label}</button>)}</div><TrendChart data={trend} visibleSeries={visibleTrend}/></article>
        <article className="admin-panel kpc-chart-panel"><div className="kpc-chart-heading"><div><p className="section-kicker">ENQUIRY PIPELINE</p><h2>Enquiry status</h2><p>Submissions by current status.</p></div><ClipboardList size={19}/></div><DonutChart items={statusItems}/></article>
        <article className="admin-panel kpc-chart-panel"><div className="kpc-chart-heading"><div><p className="section-kicker">CONTACT CHANNELS</p><h2>How visitors connect</h2><p>Recorded clicks, not completed conversations.</p></div><MousePointerClick size={19}/></div><div className="kpc-channel-list">{eventBreakdown.filter(x=>x.id!=='profile_view').map(item=><div key={item.id}><span className="kpc-channel-icon">{item.id==='call_click'?<Phone size={16}/>:item.id==='whatsapp_click'?<MessageCircle size={16}/>:item.id==='maps_click'?<MapPin size={16}/>:<Mail size={16}/>}</span><label>{item.label}</label><strong>{item.value.toLocaleString('en-IN')}</strong></div>)}</div></article>
        <article className="admin-panel kpc-chart-panel"><div className="kpc-chart-heading"><div><p className="section-kicker">DISTRIBUTOR LEADERBOARD</p><h2>Most engaged distributors</h2><p>Weighted activity indicator; enquiries receive higher weight.</p></div><Users size={19}/></div><HorizontalBars items={topDistributors} color="#4778d0"/></article>
        <article className="admin-panel kpc-chart-panel"><div className="kpc-chart-heading"><div><p className="section-kicker">COMPANY INTEREST</p><h2>Top companies</h2><p>Events and enquiries associated with a company.</p></div><Building2 size={19}/></div><HorizontalBars items={companyInsights} color="#16a085"/></article>
        <article className="admin-panel kpc-chart-panel"><div className="kpc-chart-heading"><div><p className="section-kicker">PRODUCT INTEREST</p><h2>Top products</h2><p>Product-related activity and enquiries.</p></div><Package size={19}/></div><HorizontalBars items={productInsights} color="#8b6bd6"/></article>
      </section>
      <section className="admin-panel kpc-performance-panel"><div className="kpc-performance-section-head"><div><p className="section-kicker">DISTRIBUTOR COMPARISON</p><h2>Distributor performance</h2><p>Clicks do not prove a call or message was completed.</p></div><button className="admin-refresh" onClick={exportPerformance}><Download size={15}/> Export CSV</button></div><div className="kpc-performance-table-wrap"><table className="kpc-performance-table"><thead><tr><th>Distributor</th><th>Profile views</th><th>Call</th><th>WhatsApp</th><th>Maps</th><th>Enquiries</th><th>Converted</th></tr></thead><tbody>{filteredPerformance.map(row=><tr key={row.id}><td><strong>{row.name}</strong>{row.mobile&&<small>{row.mobile}</small>}</td><td>{row.profileViews}</td><td>{row.calls}</td><td>{row.whatsapp}</td><td>{row.maps}</td><td><strong>{row.enquiries}</strong>{row.newEnquiries>0&&<small>{row.newEnquiries} new</small>}</td><td>{row.converted}</td></tr>)}{!filteredPerformance.length&&<tr><td colSpan="7">No distributors match this search.</td></tr>}</tbody></table></div></section>
      <section className="admin-panel kpc-performance-panel"><div className="kpc-performance-section-head"><div><p className="section-kicker">CUSTOMER SUBMISSIONS</p><h2>Enquiry management</h2><p>Submitted enquiries, not inferred clicks. Customer details are visible only in this admin area.</p></div><button className="admin-refresh" onClick={exportEnquiries}><Download size={15}/> Export enquiries</button></div>
        <div className="kpc-enquiry-filters"><label>Status<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option>{STATUSES.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}</select></label><span>{filteredEnquiries.length} enquiries shown</span></div>
        <div className="kpc-admin-enquiry-list">{filteredEnquiries.map(row=><article className="kpc-admin-enquiry" key={row.id}><div className="kpc-admin-enquiry-top"><div><strong>{row.customer_name}</strong><span>{row.mobile}{row.email?' · '+row.email:''}</span></div><small>{new Date(row.created_at).toLocaleString('en-IN')}</small></div><div className="kpc-admin-enquiry-context"><strong>{row.distributors?.distributor_name||'Needs admin review'}</strong><span>{[row.companies?.company_name,row.divisions?.division_name,row.brands?.brand_name,row.products?.product_name].filter(Boolean).join(' · ')||'General distributor enquiry'}</span>{row.routing_status==='needs_review'&&<em><AlertTriangle size={12}/> Manual routing review required</em>}</div><p>{row.message}</p><div className="kpc-admin-enquiry-controls"><label>Status<select value={row.status} onChange={e=>setEnquiries(old=>old.map(x=>x.id===row.id?{...x,status:e.target.value}:x))}>{STATUSES.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}</select></label><label>Follow-up<input type="date" value={row.follow_up_at?row.follow_up_at.slice(0,10):''} onChange={e=>setEnquiries(old=>old.map(x=>x.id===row.id?{...x,follow_up_at:e.target.value?new Date(e.target.value+'T12:00:00').toISOString():null}:x))}/></label><label className="kpc-admin-enquiry-notes">Admin notes<input value={row.admin_notes||''} maxLength={2000} onChange={e=>setEnquiries(old=>old.map(x=>x.id===row.id?{...x,admin_notes:e.target.value}:x))} placeholder="Add follow-up notes"/></label><button className="admin-refresh" onClick={()=>updateEnquiry(row)} disabled={savingId===row.id}>{savingId===row.id?<LoaderCircle size={14} className="spin"/>:'Save'}</button></div></article>)}{!filteredEnquiries.length&&<div className="admin-state">No customer enquiries in this period.</div>}</div>
      </section>
      <p className="kpc-performance-footnote"><Eye size={14}/> Activity starts from the date tracking was enabled. Historical clicks cannot be reconstructed. Session counts are browser sessions, not unique people.</p>
    </>}
  </div>
}
