import React,{useEffect,useMemo,useState} from 'react'
import {AlertTriangle,Check,Eye,LoaderCircle,Package,RefreshCw,Search,ShieldAlert,X} from 'lucide-react'
import {supabase} from './lib/supabase'

const norm=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')
const entriesOf=r=>Array.isArray(r.product_entries)?r.product_entries:[]

export default function AdminProductSubmissions({onBack}){
 const [rows,setRows]=useState([]),[companies,setCompanies]=useState([]),[products,setProducts]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[selected,setSelected]=useState(null),[saving,setSaving]=useState('')
 async function load(){setLoading(true);setError('');const [s,c,p]=await Promise.all([
  supabase.from('product_submissions').select('*').order('submitted_at',{ascending:false}),
  supabase.from('companies').select('id,company_name,legal_name,short_name,status').eq('status','active').order('company_name'),
  supabase.from('products').select('id,product_name,normalized_product_name,company_id,status').eq('status','active').limit(5000)
 ]);const bad=s.error||c.error||p.error;if(bad)setError(bad.message);else{setRows(s.data||[]);setCompanies(c.data||[]);setProducts(p.data||[])}setLoading(false)}
 useEffect(()=>{load()},[])
 async function status(id,status){setSaving(id);const {data:{user}}=await supabase.auth.getUser();const patch={status,reviewed_at:status==='approved'||status==='rejected'?new Date().toISOString():null,reviewed_by:status==='approved'||status==='rejected'?user?.id:null};const {error}=await supabase.from('product_submissions').update(patch).eq('id',id);if(error)setError(error.message);else setRows(x=>x.map(r=>r.id===id?{...r,...patch}:r));setSaving('')}
 function companyMatch(name){
  const q=norm(name);if(!q)return {kind:'incomplete',label:'Company missing'}
  const exact=companies.find(c=>norm(c.company_name)===q);if(exact)return {kind:'matched',label:exact.company_name,company:exact,method:'Exact'}
  const candidates=companies.filter(c=>[c.company_name,c.legal_name,c.short_name].filter(Boolean).some(v=>{const n=norm(v);return n===q||n.includes(q)||q.includes(n)}))
  if(candidates.length===1)return {kind:'suggested',label:candidates[0].company_name,company:candidates[0],method:'Normalized / possible match'}
  if(candidates.length>1)return {kind:'review',label:candidates.slice(0,4).map(c=>c.company_name).join(' / '),candidates,method:'Multiple matches'}
  return {kind:'new',label:'No existing company match'}
 }
 function productMatch(e,m){
  const q=norm(e.product_name);return products.filter(p=>norm(p.product_name)===q&&(!m.company||p.company_id===m.company.id))
 }
 const selectedEntries=selected?entriesOf(selected):[]
 const summary=useMemo(()=>{const x={matched:0,suggested:0,review:0,incomplete:0,newProduct:0,duplicate:0};selectedEntries.forEach(e=>{const m=companyMatch(e);if(m.kind==='matched')x.matched++;else if(m.kind==='suggested')x.suggested++;else if(m.kind==='review')x.review++;else if(m.kind==='incomplete')x.incomplete++;else x.newProduct++;if(productMatch(e,m).length)x.duplicate++});return x},[selected,companies,products])
 return <div className="admin-page">
  <div className="admin-head"><div><button className="admin-back" onClick={onBack}>← Dashboard</button><p className="section-kicker">ADMIN</p><h1>Product Submissions</h1><p>Review uploaded product lists. Automatic matches are separated from exceptions.</p></div><button className="admin-refresh" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
  {error&&<div className="admin-error"><ShieldAlert size={16}/>{error}</div>}
  {loading?<div className="admin-state"><LoaderCircle className="spin" size={20}/> Loading product submissions…</div>:<div className="admin-table">{rows.length?rows.map(r=><div className="admin-report" key={r.id}><div className="admin-report-top"><span className={'admin-status '+r.status}>{r.status.replace('_',' ')}</span><small>{new Date(r.submitted_at).toLocaleString()}</small></div><h3>{r.distributor_name}</h3><p><strong>Contact:</strong> {r.mobile} · <strong>Rows:</strong> {r.row_count||entriesOf(r).length} · <strong>Source:</strong> {r.source}</p><div className="admin-actions">{(r.status==='open'||r.status==='under_review')&&<button onClick={()=>setSelected(r)}><Eye size={14}/> Review & Match</button>}{r.status==='open'&&<button onClick={()=>status(r.id,'under_review')}>Mark Under Review</button>}{r.status!=='rejected'&&r.status!=='approved'&&<button onClick={()=>status(r.id,'rejected')}>Reject</button>}{r.status!=='open'&&<button onClick={()=>status(r.id,'open')}>Reopen</button>}</div></div>):<div className="admin-state"><Package size={22}/> No product submissions yet.</div>}</div>}
  {selected&&<div className="report-overlay" onMouseDown={e=>e.target===e.currentTarget&&!saving&&setSelected(null)}><div className="report-modal admin-edit-modal" style={{maxWidth:'1050px'}}><button className="report-close" onClick={()=>!saving&&setSelected(null)}><X size={18}/></button><p className="section-kicker">PRODUCT REVIEW</p><h2>{selected.distributor_name}</h2><p className="report-help">No product is published from this screen. The system suggests company matches and flags duplicates/missing companies for review.</p>
   <div style={{display:'flex',gap:'8px',flexWrap:'wrap',margin:'12px 0 18px'}}><span className="admin-status approved">✓ {summary.matched} company matched</span><span className="admin-status under_review">⚠ {summary.suggested+summary.review} company review</span><span className="admin-status open">＋ {summary.newProduct} new company</span>{summary.incomplete>0&&<span className="admin-status rejected">! {summary.incomplete} missing company</span>}<span className="admin-status under_review">↻ {summary.duplicate} existing product match</span></div>
   <div style={{display:'grid',gap:'8px',maxHeight:'600px',overflowY:'auto'}}>{selectedEntries.map((e,i)=>{const m=companyMatch(e),dups=productMatch(e,m);return <div key={i} style={{border:'1px solid var(--border,#e5e7eb)',borderRadius:'10px',padding:'11px'}}><div style={{display:'flex',justifyContent:'space-between',gap:'12px'}}><div><strong>{e.product_name}</strong><div className="report-help">Submitted company: {e.company||'—'}{e.division&&<> · Division: {e.division}</>}{e.strength&&<> · {e.strength}</>}</div></div><span className={'admin-status '+(m.kind==='matched'?'approved':m.kind==='new'||m.kind==='incomplete'?'rejected':'under_review')}>{m.kind==='matched'?<><Check size={13}/> {m.label}</>:m.kind==='incomplete'?'Company missing':m.kind==='new'?'New company':<>Review: {m.label}</>}</span></div>{dups.length>0&&<div style={{marginTop:'7px',padding:'7px 9px',borderRadius:'8px',background:'#fff7ed',display:'flex',gap:'7px',alignItems:'center'}}><AlertTriangle size={14}/> Possible existing product: {dups.map(x=>x.product_name).join(', ')}</div>}</div>})}</div>
   <div className="admin-actions" style={{marginTop:'18px'}}><button onClick={()=>status(selected.id,'under_review')}>Mark Under Review</button><button onClick={()=>setSelected(null)}>Close</button></div>
  </div></div>}
 </div>
}