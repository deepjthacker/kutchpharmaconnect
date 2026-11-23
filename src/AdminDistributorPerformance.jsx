import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BarChart3, Download, LoaderCircle, RefreshCw, Search, Users, MousePointerClick, ClipboardList, TrendingUp } from 'lucide-react'
import { supabase } from './lib/supabase'

const EVENT_LABELS = {
  profile_view: 'Profile views',
  call_click: 'Call clicks',
  whatsapp_click: 'WhatsApp clicks',
  maps_click: 'Maps clicks',
  email_click: 'Email clicks'
}
const STATUSES = ['new','contacted','converted','not_converted','invalid']

function csvCell(value) {
  const text = String(value ?? '')
  return '"' + text.replaceAll('"','""') + '"'
}
function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function AdminDistributorPerformance({ onBack }) {
  const [days, setDays] = useState('30')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [events, setEvents] = useState([])
  const [enquiries, setEnquiries] = useState([])
  const [distributors, setDistributors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    setNotice('')
    const since = new Date(Date.now() - Number(days) * 86400000).toISOString()
    const [eventRes, enquiryRes, distributorRes] = await Promise.all([
      supabase.from('distributor_contact_events')
        .select('id,distributor_id,event_type,company_id,division_id,brand_id,product_id,occurred_at,source_page,utm_source,utm_medium,utm_campaign')
        .gte('occurred_at', since).order('occurred_at', { ascending: false }).limit(5000),
      supabase.from('distributor_enquiries')
        .select('id,distributor_id,company_id,division_id,brand_id,product_id,customer_name,mobile,email,message,consent,routing_status,status,source_page,created_at,updated_at,admin_notes,contacted_at,follow_up_at,distributors(distributor_name),companies(company_name),divisions(division_name),brands(brand_name),products(product_name)')
        .gte('created_at', since).order('created_at', { ascending: false }).limit(1000),
      supabase.from('distributors').select('id,distributor_name,mobile,whatsapp').eq('status','active').order('distributor_name')
    ])
    const bad = eventRes.error || enquiryRes.error || distributorRes.error
    if (bad) {
      setError(bad.message || 'Could not load distributor performance.')
      setLoading(false)
      return
    }
    setEvents(eventRes.data || [])
    setEnquiries(enquiryRes.data || [])
    setDistributors(distributorRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [days])

  const performance = useMemo(() => {
    const map = new Map()
    distributors.forEach(d => map.set(d.id, {
      id: d.id, name: d.distributor_name, mobile: d.mobile,
      profileViews: 0, calls: 0, whatsapp: 0, maps: 0, emails: 0,
      enquiries: 0, converted: 0, newEnquiries: 0
    }))
    events.forEach(event => {
      const row = map.get(event.distributor_id)
      if (!row) return
      if (event.event_type === 'profile_view') row.profileViews++
      if (event.event_type === 'call_click') row.calls++
      if (event.event_type === 'whatsapp_click') row.whatsapp++
      if (event.event_type === 'maps_click') row.maps++
      if (event.event_type === 'email_click') row.emails++
    })
    enquiries.forEach(enquiry => {
      if (!enquiry.distributor_id) return
      const row = map.get(enquiry.distributor_id)
      if (!row) return
      row.enquiries++
      if (enquiry.status === 'converted') row.converted++
      if (enquiry.status === 'new') row.newEnquiries++
    })
    return [...map.values()].sort((a,b) =>
      (b.enquiries - a.enquiries) || (b.whatsapp + b.calls - a.whatsapp - a.calls) || (b.profileViews - a.profileViews) || a.name.localeCompare(b.name)
    )
  }, [distributors, events, enquiries])

  const filteredPerformance = performance.filter(row => row.name.toLowerCase().includes(search.trim().toLowerCase()))
  const filteredEnquiries = enquiries.filter(row => {
    const distributorName = row.distributors?.distributor_name || 'Needs admin review'
    const context = [row.companies?.company_name,row.divisions?.division_name,row.brands?.brand_name,row.products?.product_name].filter(Boolean).join(' ')
    const matchesSearch = [row.customer_name,row.mobile,row.email,distributorName,row.message,context].join(' ').toLowerCase().includes(search.trim().toLowerCase())
    return matchesSearch && (statusFilter === 'all' || row.status === statusFilter)
  })

  const totals = useMemo(() => ({
    views: events.filter(x=>x.event_type==='profile_view').length,
    calls: events.filter(x=>x.event_type==='call_click').length,
    whatsapp: events.filter(x=>x.event_type==='whatsapp_click').length,
    maps: events.filter(x=>x.event_type==='maps_click').length,
    enquiries: enquiries.length,
    converted: enquiries.filter(x=>x.status==='converted').length,
    new: enquiries.filter(x=>x.status==='new').length,
    engaged: new Set(events.map(x=>x.distributor_id)).size
  }), [events,enquiries])

  async function updateEnquiry(row) {
    setSavingId(row.id)
    setError('')
    setNotice('')
    const patch = {
      status: row.status,
      admin_notes: row.admin_notes || null,
      follow_up_at: row.follow_up_at || null,
      updated_at: new Date().toISOString(),
      ...(row.status === 'contacted' && !row.contacted_at ? { contacted_at: new Date().toISOString() } : {})
    }
    const { error: updateError } = await supabase.from('distributor_enquiries').update(patch).eq('id',row.id)
    setSavingId('')
    if (updateError) { setError(updateError.message); return }
    setNotice('Enquiry updated.')
    setEnquiries(current=>current.map(item=>item.id===row.id?{...item,...patch}:item))
  }

  function exportPerformance() {
    downloadCsv('kpc-distributor-performance.csv',
      ['Distributor','Profile views','Call clicks','WhatsApp clicks','Maps clicks','Email clicks','Enquiries','New enquiries','Converted'],
      filteredPerformance.map(x=>[x.name,x.profileViews,x.calls,x.whatsapp,x.maps,x.emails,x.enquiries,x.newEnquiries,x.converted])
    )
  }

  function exportEnquiries() {
    downloadCsv('kpc-customer-enquiries.csv',
      ['Submitted at','Customer','Mobile','Email','Distributor','Company','Division','Brand','Product','Message','Status','Routing','Follow-up'],
      filteredEnquiries.map(x=>[x.created_at,x.customer_name,x.mobile,x.email,x.distributors?.distributor_name,x.companies?.company_name,x.divisions?.division_name,x.brands?.brand_name,x.products?.product_name,x.message,x.status,x.routing_status,x.follow_up_at])
    )
  }

  return (
    <div className="admin-page kpc-performance-page">
      <div className="admin-head">
        <div>
          <button className="back-button" onClick={onBack}><ArrowLeft size={16}/> Control Center</button>
          <p className="section-kicker">DISTRIBUTOR ANALYTICS</p>
          <h1>Performance &amp; Leads</h1>
          <p>Separate contact activity from customer-submitted enquiries. Clicks do not prove that a call or message was completed.</p>
        </div>
        <button className="admin-refresh" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button>
      </div>

      <div className="kpc-performance-toolbar">
        <label>Period
          <select value={days} onChange={e=>setDays(e.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </label>
        <label className="kpc-performance-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search distributor or enquiry"/></label>
      </div>

      {error && <div className="admin-error">{error}</div>}
      {notice && <div className="admin-success">{notice}</div>}
      {loading ? <div className="admin-state"><LoaderCircle className="spin" size={20}/> Loading performance data…</div> : (
        <>
          <section className="kpc-performance-kpis">
            <div><span><Users size={16}/> Distributors with activity</span><strong>{totals.engaged}</strong></div>
            <div><span><BarChart3 size={16}/> Profile views</span><strong>{totals.views}</strong></div>
            <div><span><MousePointerClick size={16}/> Call / WhatsApp clicks</span><strong>{totals.calls + totals.whatsapp}</strong><small>{totals.calls} calls · {totals.whatsapp} WhatsApp</small></div>
            <div><span><ClipboardList size={16}/> Actual enquiries</span><strong>{totals.enquiries}</strong><small>{totals.new} new · {totals.converted} converted</small></div>
          </section>

          <section className="admin-panel kpc-performance-panel">
            <div className="kpc-performance-section-head">
              <div><p className="section-kicker">CONTACT ACTIVITY</p><h2>Distributor performance</h2><p>Activity recorded from distributor profiles and contact buttons during the selected period.</p></div>
              <button className="admin-refresh" onClick={exportPerformance}><Download size={15}/> Export CSV</button>
            </div>
            <div className="kpc-performance-table-wrap">
              <table className="kpc-performance-table">
                <thead><tr><th>Distributor</th><th>Profile views</th><th>Call</th><th>WhatsApp</th><th>Maps</th><th>Enquiries</th><th>Converted</th></tr></thead>
                <tbody>
                  {filteredPerformance.map(row=><tr key={row.id}>
                    <td><strong>{row.name}</strong>{row.mobile&&<small>{row.mobile}</small>}</td>
                    <td>{row.profileViews}</td><td>{row.calls}</td><td>{row.whatsapp}</td><td>{row.maps}</td><td><strong>{row.enquiries}</strong>{row.newEnquiries>0&&<small>{row.newEnquiries} new</small>}</td><td>{row.converted}</td>
                  </tr>)}
                  {!filteredPerformance.length&&<tr><td colSpan="7">No distributors match this search.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-panel kpc-performance-panel">
            <div className="kpc-performance-section-head">
              <div><p className="section-kicker">CUSTOMER SUBMISSIONS</p><h2>Enquiry management</h2><p>These are submitted enquiries, not inferred clicks. Customer details are visible only in this admin area.</p></div>
              <button className="admin-refresh" onClick={exportEnquiries}><Download size={15}/> Export enquiries</button>
            </div>
            <div className="kpc-enquiry-filters">
              <label>Status
                <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  {STATUSES.map(status=><option key={status} value={status}>{status.replace('_',' ')}</option>)}
                </select>
              </label>
              <span>{filteredEnquiries.length} enquiries shown</span>
            </div>
            <div className="kpc-admin-enquiry-list">
              {filteredEnquiries.map(row=><article className="kpc-admin-enquiry" key={row.id}>
                <div className="kpc-admin-enquiry-top">
                  <div><strong>{row.customer_name}</strong><span>{row.mobile}{row.email?' · '+row.email:''}</span></div>
                  <small>{new Date(row.created_at).toLocaleString('en-IN')}</small>
                </div>
                <div className="kpc-admin-enquiry-context">
                  <strong>{row.distributors?.distributor_name || 'Needs admin review'}</strong>
                  <span>{[row.companies?.company_name,row.divisions?.division_name,row.brands?.brand_name,row.products?.product_name].filter(Boolean).join(' · ') || 'General distributor enquiry'}</span>
                  {row.routing_status==='needs_review'&&<em>Unassigned — admin review required</em>}
                </div>
                <p>{row.message}</p>
                <div className="kpc-admin-enquiry-controls">
                  <label>Status<select value={row.status} onChange={e=>setEnquiries(current=>current.map(item=>item.id===row.id?{...item,status:e.target.value}:item))}>
                    {STATUSES.map(status=><option key={status} value={status}>{status.replace('_',' ')}</option>)}
                  </select></label>
                  <label>Follow-up<input type="date" value={row.follow_up_at?row.follow_up_at.slice(0,10):''} onChange={e=>setEnquiries(current=>current.map(item=>item.id===row.id?{...item,follow_up_at:e.target.value?new Date(e.target.value+'T12:00:00').toISOString():null}:item))}/></label>
                  <label className="kpc-admin-enquiry-notes">Admin notes<input value={row.admin_notes||''} maxLength={2000} onChange={e=>setEnquiries(current=>current.map(item=>item.id===row.id?{...item,admin_notes:e.target.value}:item))} placeholder="Add follow-up notes"/></label>
                  <button className="admin-refresh" onClick={()=>updateEnquiry(row)} disabled={savingId===row.id}>{savingId===row.id?<LoaderCircle size={14} className="spin"/>:'Save'}</button>
                </div>
              </article>)}
              {!filteredEnquiries.length&&<div className="admin-state">No customer enquiries in this period.</div>}
            </div>
          </section>
          <p className="kpc-performance-footnote"><TrendingUp size={14}/> Activity data starts from the date tracking is enabled. It cannot reconstruct older clicks reliably.</p>
        </>
      )}
    </div>
  )
}
