import React,{useEffect,useState} from 'react'
import {Building2,Truck,Link2,Inbox,Flag,ShieldAlert,Database,Upload,Download,Settings,Search,RefreshCw,ArrowRight,LoaderCircle,Tags,MapPin,GitBranch,MessageSquare,MessageSquareWarning,Plus} from 'lucide-react'
import {supabase} from './lib/supabase'
import AdminReports from './AdminReports'
import AdminDistributorSubmissions from './AdminDistributorSubmissions'
import AdminProductSubmissions from './AdminProductSubmissions'
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
import AdminSingleEntry from './AdminSingleEntry'
import AdminAliases from './AdminAliases'
import AdminReviews from './AdminReviews'
import AdminWebsiteFeedback from './AdminWebsiteFeedback'

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
   supabase.from('product_submissions').select('id',{count:'exact',head:true}).in('status',['open','under_review','ready']),
   supabase.from('correction_reports').select('id',{count:'exact',head:true}).in('status',['open','reviewing']),
   supabase.from('distributorships').select('id',{count:'exact',head:true}).eq('status','active').eq('verification_status','needs_review'),
   supabase.from('distributorships').select('id',{count:'exact',head:true}).eq('status','active').is('location_id',null),
   supabase.from('distributorships').select('id',{count:'exact',head:true}).eq('status','active').eq('verification_status','unverified'),
   supabase.from('companies').select('id',{count:'exact',head:true}).eq('status','inactive'),
   supabase.from('profile_reviews').select('id',{count:'exact',head:true}).eq('status','pending').eq('entity_type','distributor'),
   supabase.from('website_feedback').select('id',{count:'exact',head:true}).in('status',['open','reviewing'])
  ])
  const bad=qs.find(x=>x.error)
  if(bad)setError(bad.error.message)
  else setStats({companies:qs[0].count||0,distributors:qs[1].count||0,relationships:qs[2].count||0,brands:qs[3].count||0,submissions:qs[4].count||0,reports:qs[5].count||0,needsReview:qs[6].count||0,missingLocation:qs[7].count||0,unverified:qs[8].count||0,inactiveCompanies:qs[9].count||0,pendingReviews:qs[10].count||0,websiteFeedback:qs[12].count||0,productSubmissions:qs[4].count||0})
  setLoading(false)
 }
 useEffect(()=>{load()},[])
 const back=()=>setView('dashboard')
 if(view==='submissions')return <AdminDistributorSubmissions onBack={back}/>
 if(view==='productSubmissions')return <AdminProductSubmissions onBack={back}/>
 if(view==='reports')return <AdminReports onBack={back}/>
 if(view==='reviews')return <AdminReviews onBack={back}/>
 if(view==='websiteFeedback')return <AdminWebsiteFeedback onBack={back}/>
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
 if(view==='singleEntry')return <AdminSingleEntry onBack={back}/>
 const pending=[
  ['Distributor Submissions',stats?.submissions,Inbox,'Review new distributor details and company lists','submissions'],
  ['Product / Brand Submissions',stats?.productSubmissions,Tags,'Review submitted product lists and publish approved records','productSubmissions'],
  ['Corrections',stats?.reports,Flag,'Review reported directory errors','reports'],
  ['Website Feedback',stats?.websiteFeedback,MessageSquareWarning,'Review site issues and suggestions','websiteFeedback']
 ]
 const directory=[
  ['Distributors',stats?.distributors,Truck,'Distributor profiles and contact details','distributors'],
  ['Companies',stats?.companies,Building2,'Company records and legal names','companies'],
  ['Distributorships',stats?.relationships,Link2,'Which companies and divisions each distributor handles','relationships']
 ]
 const toolsList=[
  ['Company Catalog Upload',null,Upload,'Upload companies, divisions and brands','companyCatalogUpload'],
  ['Distributor PDF Import',null,Upload,'Extract a distributor list from a PDF for review','documentImport'],
  ['Manual Single Entry',null,Plus,'Add one directory record at a time','singleEntry'],
  ['Import & Export',null,Database,'Import data, export separate CSVs or create a backup','tools']
 ]
 const settings=[
  ['Divisions',null,GitBranch,'Manage company divisions','divisions'],
  ['Brands',stats?.brands,Tags,'Manage brands linked to companies','brands'],
  ['Categories',null,Tags,'Manage directory categories','categories'],
  ['Locations',null,MapPin,'Manage distributor operating locations','locations'],
  ['Aliases',null,Search,'Manage alternate names for matching and search','aliases'],
  ['Data Health & Review Exceptions',stats?.needsReview||0,ShieldAlert,'Check unverified relationships and data-quality gaps','verification']
 ]
 const renderLinks=(items)=>items.map(([label,count,Icon,help,target])=><button className="admin-link" key={target} onClick={()=>setView(target)}><Icon size={17}/><span><strong>{label}{count!==null&&count!==undefined&&<b className="admin-count">{count}</b>}</strong><small>{help}</small></span><ArrowRight size={15}/></button>)
 return <div className="admin-page">
  <div className="admin-head">
   <div><p className="section-kicker">KUTCHPHARMACONNECT ADMIN</p><h1>Control Center</h1><p>One control center for submissions, directory records, data tools and data quality.</p></div>
   <button className="admin-refresh" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button>
  </div>
  {error&&<div className="admin-error">{error}</div>}
  {loading?<div className="admin-state"><LoaderCircle className="spin" size={20}/> Loading control center…</div>:<>
   <section className="admin-control-summary">
    <div><strong>{stats.submissions}</strong><span>Pending submissions</span><small>awaiting review</small></div>
    <div><strong>{stats.reports}</strong><span>Corrections</span><small>open or reviewing</small></div>
    <div><strong>{stats.websiteFeedback}</strong><span>Website feedback</span><small>open or reviewing</small></div>
    <div><strong>{stats.companies}</strong><span>Companies</span><small>active directory records</small></div>
    <div><strong>{stats.distributors}</strong><span>Distributors</span><small>active directory records</small></div>
    <div><strong>{stats.relationships}</strong><span>Distributorships</span><small>active company–distributor links</small></div>
   </section>
   <div className="admin-workflow-grid">
    <section className="admin-panel admin-workflow-panel">
     <div className="admin-panel-heading"><div><p className="section-kicker">01 · PENDING WORK</p><h2>Pending Work</h2><p>Review incoming information and reports first.</p></div><Inbox size={20}/></div>
     {renderLinks(pending)}
     <div className="admin-secondary-tools"><strong>Additional review tools</strong>{renderLinks([
      ['Distributor Reviews',stats?.pendingReviews,MessageSquare,'Approve or reject distributor reviews','reviews']
     ])}</div>
    </section>
    <section className="admin-panel admin-workflow-panel">
     <div className="admin-panel-heading"><div><p className="section-kicker">02 · DIRECTORY</p><h2>Directory Management</h2><p>Maintain published distributor and company records.</p></div><Building2 size={20}/></div>
     {renderLinks(directory)}
    </section>
    <section className="admin-panel admin-workflow-panel">
     <div className="admin-panel-heading"><div><p className="section-kicker">03 · DATA TOOLS</p><h2>Upload & Data Tools</h2><p>Bring data in, add records and export what you need.</p></div><Database size={20}/></div>
     {renderLinks(toolsList)}
    </section>
    <section className="admin-panel admin-workflow-panel">
     <div className="admin-panel-heading"><div><p className="section-kicker">04 · SETTINGS</p><h2>Settings & Data Quality</h2><p>Maintain the reference data used across the directory.</p></div><Settings size={20}/></div>
     {renderLinks(settings)}
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
