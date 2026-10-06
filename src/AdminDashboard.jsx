import React,{useEffect,useState} from 'react'
import {Building2,Truck,Link2,Inbox,Flag,ShieldAlert,Database,Upload,Download,Settings,Search,RefreshCw,ArrowRight,LoaderCircle,Tags,MapPin,GitBranch} from 'lucide-react'
import {supabase} from './lib/supabase'
import AdminReports from './AdminReports'
import AdminDistributorSubmissions from './AdminDistributorSubmissions'
import AdminCompanies from './AdminCompanies'
import AdminCompanyCatalogUpload from './AdminCompanyCatalogUpload'
import AdminDocumentImport from './AdminDocumentImport'
import AdminDistributors from './AdminDistributors'
import AdminDistributorships from './AdminDistributorships'
import AdminVerification from './AdminVerification'
import AdminDivisions from './AdminDivisions'
import AdminBrands from './AdminBrands'
import AdminLocations from './AdminLocations'
import AdminCategories from './AdminCategories'
import AdminTools from './AdminTools'
import AdminAliases from './AdminAliases'

export default function AdminDashboard(){
 const [view,setView]=useState('dashboard'),[stats,setStats]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('')
 async function load(){
  setLoading(true);setError('')
  const qs=await Promise.all([
   supabase.from('companies').select('id',{count:'exact',head:true}).eq('status','active'),
   supabase.from('distributors').select('id',{count:'exact',head:true}).eq('status','active'),
   supabase.from('distributorships').select('id',{count:'exact',head:true}).eq('status','active'),
   supabase.from('brands').select('id',{count:'exact',head:true}).eq('status','active'),
   supabase.from('distributor_submissions').select('id',{count:'exact',head:true}).in('status',['open','under_review']),
   supabase.from('correction_reports').select('id',{count:'exact',head:true}).in('status',['open','reviewing']),
   supabase.from('distributorships').select('id',{count:'exact',head:true}).eq('status','active').eq('verification_status','needs_review'),
   supabase.from('distributorships').select('id',{count:'exact',head:true}).eq('status','active').is('location_id',null),
   supabase.from('distributorships').select('id',{count:'exact',head:true}).eq('status','active').eq('verification_status','unverified'),
   supabase.from('companies').select('id',{count:'exact',head:true}).eq('status','inactive')
  ])
  const bad=qs.find(x=>x.error)
  if(bad)setError(bad.error.message)
  else setStats({companies:qs[0].count||0,distributors:qs[1].count||0,relationships:qs[2].count||0,brands:qs[3].count||0,submissions:qs[4].count||0,reports:qs[5].count||0,needsReview:qs[6].count||0,missingLocation:qs[7].count||0,unverified:qs[8].count||0,inactiveCompanies:qs[9].count||0})
  setLoading(false)
 }
 useEffect(()=>{load()},[])
 const back=()=>setView('dashboard')
 if(view==='submissions')return <AdminDistributorSubmissions onBack={back}/>
 if(view==='reports')return <AdminReports onBack={back}/>
 if(view==='companies')return <AdminCompanies onBack={back} onBulkUpload={()=>setView('companyCatalogUpload')}/>
 if(view==='companyCatalogUpload')return <AdminCompanyCatalogUpload onBack={()=>setView('companies')}/>
 if(view==='documentImport')return <AdminDocumentImport onBack={back} onOpenSubmissions={()=>setView('submissions')}/>
 if(view==='distributors')return <AdminDistributors onBack={back}/>
 if(view==='relationships')return <AdminDistributorships onBack={back}/>
 if(view==='verification')return <AdminVerification onBack={back}/>
 if(view==='divisions')return <AdminDivisions onBack={back}/>
 if(view==='brands')return <AdminBrands onBack={back}/>
 if(view==='locations')return <AdminLocations onBack={back}/>
 if(view==='categories')return <AdminCategories onBack={back}/>
 if(view==='aliases')return <AdminAliases onBack={back}/>
 if(view==='tools')return <AdminTools onBack={back}/>
 const work=[
  ['Distributor Inbox',stats?.submissions,Inbox,'New distributor submissions awaiting review','submissions'],
  ['Corrections',stats?.reports,Flag,'Public reports that need admin attention','reports'],
  ['Review Exceptions',stats?.needsReview,ShieldAlert,'Relationships requiring a re-check','verification']
 ]
 const directory=[
  ['Companies',stats?.companies,Building2,'One record per legal/business company','companies'],
  ['Distributors',stats?.distributors,Truck,'Distributor profiles and contact details','distributors'],
  ['Relationships',stats?.relationships,Link2,'Company–distributor records','relationships'],
  ['Brands',stats?.brands,Tags,'Brands belong to a parent company','brands']
 ]
 const data=[
  ['Data Health',stats?.missingLocation||0,Database,'Missing location records / data-quality checks','verification'],
  ['Company Catalog Upload',null,Upload,'Add companies, their divisions and brands only','companyCatalogUpload'],
  ['Distributor PDF Import',null,Upload,'Read a distributor PDF and send the extracted list to review','documentImport'],
  ['Import & Export',null,Database,'Controlled distributor/relationship import, export and backup','tools'],
  ['Aliases',null,Search,'Alternate names used for matching and search','aliases']
 ]
 return <div className="admin-page">
  <div className="admin-head">
   <div><p className="section-kicker">KUTCHPHARMACONNECT ADMIN</p><h1>Control Center</h1><p>Review incoming data first. Manage the directory only when an action is required.</p></div>
   <button className="admin-refresh" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button>
  </div>
  {error&&<div className="admin-error">{error}</div>}
  {loading?<div className="admin-state"><LoaderCircle className="spin" size={20}/> Loading control center…</div>:<>
   <section className="admin-control-summary">
    <div><strong>{stats.submissions}</strong><span>Action required</span><small>submissions waiting for review</small></div>
    <div><strong>{stats.reports}</strong><span>Corrections</span><small>open or reviewing</small></div>
    <div><strong>{stats.needsReview}</strong><span>Exceptions</span><small>relationships needing review</small></div>
    <div><strong>{stats.companies}</strong><span>Companies</span><small>active directory records</small></div>
    <div><strong>{stats.distributors}</strong><span>Distributors</span><small>active directory records</small></div>
    <div><strong>{stats.relationships}</strong><span>Relationships</span><small>active company–distributor links</small></div>
   </section>
   <div className="admin-workflow-grid">
    <section className="admin-panel admin-workflow-panel">
     <div className="admin-panel-heading"><div><p className="section-kicker">WORK</p><h2>Inbox</h2><p>These are the places where admin decisions are required.</p></div><Inbox size={20}/></div>
     {work.map(([label,count,Icon,help,target])=><button className="admin-link" key={target} onClick={()=>setView(target)}><Icon size={17}/><span><strong>{label}{count>0&&<b className="admin-count">{count}</b>}</strong><small>{help}</small></span><ArrowRight size={15}/></button>)}
    </section>
    <section className="admin-panel admin-workflow-panel">
     <div className="admin-panel-heading"><div><p className="section-kicker">DIRECTORY</p><h2>Manage records</h2><p>Profiles and relationships, without mixing workflow queues.</p></div><Building2 size={20}/></div>
     {directory.map(([label,count,Icon,help,target])=><button className="admin-link" key={target} onClick={()=>setView(target)}><Icon size={17}/><span><strong>{label}<b className="admin-count">{count}</b></strong><small>{help}</small></span><ArrowRight size={15}/></button>)}
    </section>
   </div>
   <div className="admin-workflow-grid">
    <section className="admin-panel admin-workflow-panel">
     <div className="admin-panel-heading"><div><p className="section-kicker">DATA</p><h2>Data health & tools</h2><p>Use these only when maintaining the directory data.</p></div><Database size={20}/></div>
     {data.map(([label,count,Icon,help,target])=><button className="admin-link" key={target} onClick={()=>setView(target)}><Icon size={17}/><span><strong>{label}{count!==null&&<b className="admin-count">{count}</b>}</strong><small>{help}</small></span><ArrowRight size={15}/></button>)}
    </section>
    <section className="admin-panel admin-workflow-panel">
     <div className="admin-panel-heading"><div><p className="section-kicker">SETTINGS</p><h2>Directory structure</h2><p>Reference data used by the matching and browsing system.</p></div><Settings size={20}/></div>
     <button className="admin-link" onClick={()=>setView('divisions')}><GitBranch size={17}/><span><strong>Divisions</strong><small>Only actual company divisions; do not use this for brands.</small></span><ArrowRight size={15}/></button>
     <button className="admin-link" onClick={()=>setView('categories')}><Tags size={17}/><span><strong>Categories</strong><small>A company can belong to multiple categories.</small></span><ArrowRight size={15}/></button>
     <button className="admin-link" onClick={()=>setView('locations')}><MapPin size={17}/><span><strong>Locations</strong><small>Distributor operating locations in Kutch.</small></span><ArrowRight size={15}/></button>
     <button className="admin-link" onClick={()=>setView('brands')}><Tags size={17}/><span><strong>Brands</strong><small>One company can own or market many brands.</small></span><ArrowRight size={15}/></button>
    </section>
   </div>
   <div className="admin-health-strip">
    <span><ShieldAlert size={15}/> {stats.unverified} unverified relationships</span>
    <span><MapPin size={15}/> {stats.missingLocation} active relationships without a location</span>
    <span><Building2 size={15}/> {stats.inactiveCompanies} inactive companies</span>
   </div>
  </>}
 </div>
}
