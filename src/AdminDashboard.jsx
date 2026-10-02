import { useEffect, useState } from 'react'
import { Building2, Truck, Link2, ShieldCheck, Clock3, Flag, RefreshCw, LoaderCircle, ArrowRight } from 'lucide-react'
import { supabase } from './lib/supabase'
import AdminReports from './AdminReports'
import AdminCompanies from './AdminCompanies'
import AdminDistributors from './AdminDistributors'
import AdminDivisions from './AdminDivisions'
import AdminDistributorships from './AdminDistributorships'
import AdminVerification from './AdminVerification'
import AdminLocations from './AdminLocations'
import AdminCategories from './AdminCategories'
import AdminTools from './AdminTools'

export default function AdminDashboard(){
  const [stats,setStats]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[view,setView]=useState('dashboard')

  async function load(){
    setLoading(true);setError('')
    const queries=await Promise.all([
      supabase.from('companies').select('id',{count:'exact',head:true}).eq('status','active'),
      supabase.from('distributors').select('id',{count:'exact',head:true}).eq('status','active'),
      supabase.from('distributorships').select('id',{count:'exact',head:true}).eq('status','active'),
      supabase.from('distributorships').select('id',{count:'exact',head:true}).eq('status','active').eq('verification_status','verified'),
      supabase.from('distributorships').select('id',{count:'exact',head:true}).eq('status','active').eq('verification_status','needs_review'),
      supabase.from('distributorships').select('id',{count:'exact',head:true}).eq('status','active').eq('verification_status','unverified'),
      supabase.from('correction_reports').select('id',{count:'exact',head:true}).eq('status','open')
    ])
    const bad=queries.find(x=>x.error)
    if(bad){setError(bad.error.message);setStats(null)}
    else setStats({
      companies:queries[0].count||0,distributors:queries[1].count||0,relationships:queries[2].count||0,
      verified:queries[3].count||0,review:queries[4].count||0,unverified:queries[5].count||0,reports:queries[6].count||0
    })
    setLoading(false)
  }

  useEffect(()=>{load()},[])

  if(view==='companies') return <AdminCompanies onBack={()=>setView('dashboard')} />
  if(view==='distributors') return <AdminDistributors onBack={()=>setView('dashboard')} />
  if(view==='divisions') return <AdminDivisions onBack={()=>setView('dashboard')} />
  if(view==='distributorships') return <AdminDistributorships onBack={()=>setView('dashboard')} />
  if(view==='verification') return <AdminVerification onBack={()=>setView('dashboard')} />
  if(view==='locations') return <AdminLocations onBack={()=>setView('dashboard')} />
  if(view==='categories') return <AdminCategories onBack={()=>setView('dashboard')} />
  if(view==='tools') return <AdminTools onBack={()=>setView('dashboard')} />
  if(view==='reports') return <AdminReports onBack={()=>setView('dashboard')} />

  const cards=[
    ['Companies',stats?.companies,Building2,'active companies'],
    ['Distributors',stats?.distributors,Truck,'active distributors'],
    ['Distributorships',stats?.relationships,Link2,'active relationships'],
    ['Verified',stats?.verified,ShieldCheck,'verified relationships'],
    ['Under Review',stats?.review,Clock3,'relationships needing review'],
    ['Not Verified',stats?.unverified,Clock3,'unverified relationships'],
    ['Open Reports',stats?.reports,Flag,'public correction reports']
  ]

  return <div className="admin-page">
    <div className="admin-head">
      <div><p className="section-kicker">ADMIN</p><h1>Dashboard</h1><p>Live directory overview and administration.</p></div>
      <button className="admin-refresh" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button>
    </div>
    {error&&<div className="admin-error">{error}</div>}
    {loading?<div className="admin-state"><LoaderCircle className="spin" size={20}/> Loading dashboard…</div>:<>
      <div className="admin-stats">{cards.map(([label,value,Icon,help])=><div className="admin-stat" key={label}><div className="admin-stat-icon"><Icon size={17}/></div><div><strong>{value}</strong><span>{label}</span><small>{help}</small></div></div>)}</div>
      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <p className="section-kicker">QUICK ACTIONS</p><h2>Administration</h2>
          <button className="admin-link" onClick={()=>setView('companies')}><Building2 size={16}/><span><strong>Companies</strong><small>Manage company identities and active status</small></span><ArrowRight size={15}/></button>
          <button className="admin-link" onClick={()=>setView('distributors')}><Truck size={16}/><span><strong>Distributors</strong><small>Manage distributor records and contacts</small></span><ArrowRight size={15}/></button>
          <button className="admin-link" onClick={()=>setView('distributorships')}><Link2 size={16}/><span><strong>Distributorships</strong><small>Manage company–distributor relationships</small></span><ArrowRight size={15}/></button>
          <button className="admin-link" onClick={()=>setView('verification')}><ShieldCheck size={16}/><span><strong>Verification</strong><small>Review and verify relationship records</small></span><ArrowRight size={15}/></button>
          <button className="admin-link" onClick={()=>setView('divisions')}><Building2 size={16}/><span><strong>Divisions</strong><small>Manage company divisions</small></span><ArrowRight size={15}/></button>
          <button className="admin-link" onClick={()=>setView('locations')}><Flag size={16}/><span><strong>Locations</strong><small>Manage directory locations</small></span><ArrowRight size={15}/></button>
          <button className="admin-link" onClick={()=>setView('categories')}><Building2 size={16}/><span><strong>Categories</strong><small>Manage directory categories</small></span><ArrowRight size={15}/></button>
          <button className="admin-link" onClick={()=>setView('reports')}><Flag size={16}/><span><strong>Correction Reports</strong><small>Review public-submitted directory corrections</small></span><ArrowRight size={15}/></button>
          <button className="admin-link" onClick={()=>setView('tools')}><RefreshCw size={16}/><span><strong>Import, Export & Backup</strong><small>Controlled data export and backup tools</small></span><ArrowRight size={15}/></button>
        </section>
        <section className="admin-panel">
          <p className="section-kicker">DATA STATUS</p><h2>Verification</h2>
          <div className="admin-progress-row"><span>Verified</span><strong>{stats.verified}</strong></div>
          <div className="admin-progress-row"><span>Under Review</span><strong>{stats.review}</strong></div>
          <div className="admin-progress-row"><span>Not Verified</span><strong>{stats.unverified}</strong></div>
          <p className="admin-note">Verification status describes the relationship record, not whether the company itself exists.</p>
        </section>
      </div>
    </>}
  </div>
}