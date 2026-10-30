import React, { useEffect, useState } from 'react'
import { Building2, Truck, Package, Link2, Inbox, Flag, ShieldAlert, Database, Settings, Search, RefreshCw, ArrowRight, LoaderCircle, Tags, MapPin, GitBranch, MessageSquare, MessageSquareWarning, Plus } from 'lucide-react'
import { supabase } from './lib/supabase'
import AdminReports from './AdminReports'
import AdminDistributorSubmissions from './AdminDistributorSubmissions'
import AdminCompanies from './AdminCompanies'
import AdminProducts from './AdminProducts'
import AdminDataWorkspace from './AdminDataWorkspace'
import AdminDistributors from './AdminDistributors'
import AdminDistributorships from './AdminDistributorships'
import AdminVerification from './AdminVerification'
import AdminDivisions from './AdminDivisions'
import AdminBrands from './AdminBrands'
import AdminCompanyHierarchy from './AdminCompanyHierarchy'
import AdminLocations from './AdminLocations'
import AdminCategories from './AdminCategories'
import AdminAliases from './AdminAliases'
import AdminReviews from './AdminReviews'
import AdminWebsiteFeedback from './AdminWebsiteFeedback'

export default function AdminDashboard() {
  const [view, setView] = useState('dashboard')
  const [workspaceModule, setWorkspaceModule] = useState('overview')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      // Keep the dashboard focused on operational counts. Data-quality metrics are loaded in their own screen.
      const qs = await Promise.all([
        supabase.from('companies').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('distributors').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('distributorships').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('distributor_submissions').select('id', { count: 'exact', head: true }).in('status', ['open', 'under_review']),
        supabase.from('correction_reports').select('id', { count: 'exact', head: true }).in('status', ['open', 'reviewing']),
        supabase.from('website_feedback').select('id', { count: 'exact', head: true }).in('status', ['open', 'reviewing'])
      ])
      const bad = qs.find(x => x.error)
      if (bad) throw new Error(bad.error.message)
      setStats({
        companies: qs[0].count ?? 0,
        distributors: qs[1].count ?? 0,
        relationships: qs[2].count ?? 0,
        products: qs[3].count ?? 0,
        submissions: qs[4].count ?? 0,
        reports: qs[5].count ?? 0,
        websiteFeedback: qs[6].count ?? 0
      })
    } catch (e) {
      setStats(null)
      setError(e?.message || 'Could not load dashboard counts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  const back = () => setView('dashboard')

  if (view === 'submissions') return <AdminDistributorSubmissions onBack={back} />
  if (view === 'reports') return <AdminReports onBack={back} />
  if (view === 'reviews') return <AdminReviews onBack={back} />
  if (view === 'websiteFeedback') return <AdminWebsiteFeedback onBack={back} />
  if (view === 'products') return <AdminProducts onBack={back} />\n  if (view === 'companies') return <AdminCompanies onBack={back} onBulkUpload={() => { setWorkspaceModule('catalog'); setView('workspace') }} />
  if (view === 'workspace') return <AdminDataWorkspace key={workspaceModule} initialModule={workspaceModule} onBack={back} onOpenSubmissions={() => setView('submissions')} />
  if (view === 'distributors') return <AdminDistributors onBack={back} />
  if (view === 'relationships') return <AdminDistributorships onBack={back} />
  if (view === 'verification') return <AdminVerification onBack={back} />
  if (view === 'divisions') return <AdminDivisions onBack={back} />
  if (view === 'brands') return <AdminBrands onBack={back} />
  if (view === 'hierarchy') return <AdminCompanyHierarchy onBack={back} />
  if (view === 'locations') return <AdminLocations onBack={back} />
  if (view === 'categories') return <AdminCategories onBack={back} />
  if (view === 'aliases') return <AdminAliases onBack={back} />

  const pending = [
    ['Distributor Submissions', stats?.submissions, Inbox, 'Match submitted companies and publish only after review', 'submissions'],
    ['Corrections', stats?.reports, Flag, 'Review reported directory errors', 'reports'],
    ['Website Feedback', stats?.websiteFeedback, MessageSquareWarning, 'Review site issues and suggestions', 'websiteFeedback'],
    ['Distributor Reviews', null, MessageSquare, 'Approve or reject distributor profile reviews', 'reviews']
  ]
  const directory = [
    ['Distributors', stats?.distributors, Truck, 'Distributor profiles and contact details', 'distributors'],
    ['Companies', stats?.companies, Building2, 'Company records and legal names', 'companies'],\n    ['Products', stats?.products, Package, 'Search, review and edit the product catalogue', 'products'],
    ['Distributorships', stats?.relationships, Link2, 'Which companies and divisions each distributor handles', 'relationships']
  ]
  const referenceData = [
    ['Company hierarchy', null, GitBranch, 'View and manage parent companies, subsidiaries, divisions, brands and products', 'hierarchy'],
    ['Divisions', null, GitBranch, 'Manage company divisions', 'divisions'],
    ['Brands', null, Tags, 'Manage brands linked to companies', 'brands'],
    ['Categories', null, Tags, 'Manage directory categories', 'categories'],
    ['Locations', null, MapPin, 'Manage distributor operating locations', 'locations'],
    ['Aliases', null, Search, 'Manage alternate names used for matching and search', 'aliases'],
    ['Data Health & Review Exceptions', null, ShieldAlert, 'Inspect unverified relationships and data-quality gaps', 'verification']
  ]
  const renderLinks = items => items.map(([label, count, Icon, help, target]) => (
    <button className="admin-link" key={target} onClick={() => setView(target)}>
      <Icon size={17} />
      <span>
        <strong>{label}{count !== null && count !== undefined && <b className="admin-count">{count}</b>}</strong>
        <small>{help}</small>
      </span>
      <ArrowRight size={15} />
    </button>
  ))

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div>
          <p className="section-kicker">KUTCHPHARMACONNECT ADMIN</p>
          <h1>Control Center</h1>
          <p>Start with pending work, maintain the directory, and use one workspace for data entry and exports.</p>
        </div>
        <button className="admin-refresh" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
      </div>

      {error && <div className="admin-error"><ShieldAlert size={16} />{error}</div>}
      {loading ? (
        <div className="admin-state"><LoaderCircle className="spin" size={20} /> Loading control center…</div>
      ) : !stats ? (
        <div className="admin-state">Dashboard counts could not be loaded. Use Refresh to try again.</div>
      ) : (
        <>
          <section className="admin-control-summary">
            <div><strong>{stats.submissions}</strong><span>Pending submissions</span><small>distributor and product lists</small></div>
            <div><strong>{stats.reports}</strong><span>Corrections</span><small>open or reviewing</small></div>
            <div><strong>{stats.websiteFeedback}</strong><span>Website feedback</span><small>open or reviewing</small></div>
            <div><strong>{stats.companies}</strong><span>Companies</span><small>active directory records</small></div>
            <div><strong>{stats.distributors}</strong><span>Distributors</span><small>active directory records</small></div>\n            <div><strong>{stats.products.toLocaleString()}</strong><span>Products</span><small>active catalogue records</small></div>
            <div><strong>{stats.relationships}</strong><span>Distributorships</span><small>active company–distributor links</small></div>
          </section>

          <div className="admin-workflow-grid">
            <section className="admin-panel admin-workflow-panel">
              <div className="admin-panel-heading"><div><p className="section-kicker">01 · PENDING WORK</p><h2>Pending Work</h2><p>Review submissions and reports before making directory changes.</p></div><Inbox size={20} /></div>
              {renderLinks(pending)}
            </section>

            <section className="admin-panel admin-workflow-panel">
              <div className="admin-panel-heading"><div><p className="section-kicker">02 · DIRECTORY</p><h2>Directory Management</h2><p>Maintain published distributor and company records.</p></div><Building2 size={20} /></div>
              {renderLinks(directory)}
            </section>

            <section className="admin-panel admin-workflow-panel admin-workspace-promo">
              <div className="admin-panel-heading"><div><p className="section-kicker">03 · DATA WORKSPACE</p><h2>All data tools in one place</h2><p>Company catalogue, PDF extraction, manual entry, CSV import, exports and backup.</p></div><Database size={20} /></div>
              <button className="admin-workspace-open" onClick={() => { setWorkspaceModule('overview'); setView('workspace') }}>
                <span className="admin-workspace-open-icon"><Plus size={19} /></span>
                <span><strong>Open Data Workspace</strong><small>Choose the task you need. Excel is optional for routine updates.</small></span>
                <ArrowRight size={16} />
              </button>
            </section>

            <details className="admin-panel admin-reference-panel">
              <summary>
                <span><p className="section-kicker">04 · REFERENCE DATA</p><strong>Settings & Data Quality</strong><small>Divisions, brands, categories, locations, aliases and review exceptions.</small></span>
                <Settings size={20} />
              </summary>
              <div className="admin-reference-links">{renderLinks(referenceData)}</div>
            </details>
          </div>
        </>
      )}
    </div>
  )
}
