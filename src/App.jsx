import { useEffect, useState } from 'react'
import { Search, Building2, Truck, ArrowRight, ShieldCheck, LoaderCircle } from 'lucide-react'
import { supabase } from './lib/supabase'

const categories=['Pharmaceutical','Surgical','OTC','Ayurvedic','Nutraceutical','Medical Devices','Diagnostic','Veterinary']

export default function App(){
  const [q,setQ]=useState(''),[results,setResults]=useState([]),[loading,setLoading]=useState(false),[searched,setSearched]=useState(false),[error,setError]=useState('')
  useEffect(()=>{const t=setTimeout(()=>q.trim().length>=2?search(q.trim()):(setResults([]),setSearched(false)),250);return()=>clearTimeout(t)},[q])
  async function search(term){
    setLoading(true);setSearched(true);setError('')
    const p='%'+term.replace(/[%_]/g,'')+'%'
    const [co,di,dv,al]=await Promise.all([
      supabase.from('companies').select('id,company_name,short_name').eq('status','active').or(`company_name.ilike.${p},legal_name.ilike.${p},short_name.ilike.${p}`).limit(8),
      supabase.from('distributors').select('id,distributor_name,contact_person').eq('status','active').or(`distributor_name.ilike.${p},legal_name.ilike.${p},contact_person.ilike.${p}`).limit(8),
      supabase.from('divisions').select('id,division_name,company_id').eq('status','active').or(`division_name.ilike.${p},division_code.ilike.${p}`).limit(8),
      supabase.from('search_aliases').select('entity_id,alias').eq('entity_type','company').ilike('alias',p).limit(8)
    ])
    const err=co.error||di.error||dv.error||al.error
    if(err){setError(err.message);setResults([]);setLoading(false);return}
    const ids=[...new Set((al.data||[]).map(x=>x.entity_id))]
    let aliasCompanies=[]
    if(ids.length){const r=await supabase.from('companies').select('id,company_name').in('id',ids).eq('status','active');if(r.error){setError(r.error.message);setLoading(false);return}aliasCompanies=r.data||[]}
    const companies=[...(co.data||[]),...aliasCompanies]
    const unique=[...new Map(companies.map(x=>[x.id,x])).values()]
    setResults([
      ...unique.map(x=>({type:'company',id:x.id,title:x.company_name,meta:'Company'})),
      ...(di.data||[]).map(x=>({type:'distributor',id:x.id,title:x.distributor_name,meta:x.contact_person?`Contact: ${x.contact_person}`:'Distributor'})),
      ...(dv.data||[]).map(x=>({type:'division',id:x.id,title:x.division_name,meta:'Division'}))
    ])
    setLoading(false)
  }
  return <div className="app">
    <header className="header"><div className="container header-inner"><a className="brand" href="/"><div className="brand-mark">KP</div><div><div className="brand-name">KutchPharmaConnect</div><div className="brand-tagline">Find Who Handles What in Kutch</div></div></a></div></header>
    <main><section className="hero"><div className="container hero-inner">
      <div className="eyebrow"><ShieldCheck size={16}/> Kutch pharmaceutical directory</div>
      <h1>Find Who Handles<br/><span>What in Kutch.</span></h1>
      <p className="hero-copy">Search pharmaceutical companies, distributors, divisions and local contact details.</p>
      <form className="search-box" onSubmit={e=>{e.preventDefault();if(q.trim().length>=2)search(q.trim())}}><Search size={22}/><input value={q} onChange={e=>setQ(e.target.value)} type="search" placeholder="Search company, distributor, division..." aria-label="Search"/><button>Search</button></form>
      {searched&&<div className="search-results">{loading?<div className="result-state"><LoaderCircle className="spin" size={20}/> Searching…</div>:error?<div className="result-state">{error}</div>:results.length?<div className="results-list">{results.map(r=><button className="result-card" key={r.type+r.id}><div className="result-icon">{r.type==='company'?<Building2 size={19}/>:<Truck size={19}/>}</div><div className="result-copy"><strong>{r.title}</strong><span>{r.meta}</span></div><ArrowRight size={17}/></button>)}</div>:<div className="result-state">No matching companies, distributors or divisions found.</div>}</div>}
      {!searched&&<div className="quick-links"><button><Building2 size={17}/> Browse Companies <ArrowRight size={15}/></button><button><Truck size={17}/> Browse Distributors <ArrowRight size={15}/></button></div>}
    </div></section>
    <section className="directory-section"><div className="container"><div className="section-heading"><div><p className="section-kicker">DIRECTORY</p><h2>Browse by category</h2></div><p>Start with the type of business you are looking for.</p></div><div className="category-grid">{categories.map(x=><button className="category-card" key={x}><span>{x}</span><ArrowRight size={17}/></button>)}</div></div></section></main>
    <footer><div className="container footer-inner"><span>KutchPharmaConnect</span><span>Companies • Distributors • Divisions • Contact Details</span></div></footer>
  </div>
}