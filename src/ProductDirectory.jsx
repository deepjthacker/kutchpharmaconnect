import React, { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Package, Search, LoaderCircle, Building2, Phone, MessageCircle, MapPin } from 'lucide-react'
import { supabase } from './lib/supabase'

const normalizePhone = number => {
  const raw = String(number || '').trim()
  if (!raw) return ''
  if (raw.startsWith('+')) return '+' + raw.slice(1).replace(/\D/g, '')
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return '+91' + digits
  if (digits.length === 11 && digits.startsWith('0')) return '+91' + digits.slice(1)
  if (digits.startsWith('91') && digits.length === 12) return '+' + digits
  return digits
}
const phoneLink = number => `tel:${normalizePhone(number)}`
const waLink = (number, message) => `https://wa.me/${normalizePhone(number).replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
const mapsLink = d => d.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([d.distributor_name,d.address,'Kutch','Gujarat'].filter(Boolean).join(', '))}`

export default function ProductDirectory({ productId, onBack, onOpenProduct, onOpenCompany, onOpenDistributor }) {
  const [items,setItems] = useState([])
  const [query,setQuery] = useState('')
  const [product,setProduct] = useState(null)
  const [company,setCompany] = useState(null)
  const [brand,setBrand] = useState(null)
  const [distributors,setDistributors] = useState([])
  const [productSpecificDistributors,setProductSpecificDistributors] = useState(false)
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError('')
      if (!productId) {
        const {data: products,error: productError} = await supabase.from('products').select('id,product_name,company_id,brand_id,generic_name,strength,dosage_form,pack_size').eq('status','active').order('product_name').limit(1000)
        if (productError) { if(!cancelled){setError(productError.message);setLoading(false)}; return }
        const companyIds=[...new Set((products||[]).map(x=>x.company_id).filter(Boolean))]
        const brandIds=[...new Set((products||[]).map(x=>x.brand_id).filter(Boolean))]
        const [companiesRes,brandsRes] = await Promise.all([
          companyIds.length ? supabase.from('companies').select('id,company_name').in('id',companyIds).eq('status','active') : Promise.resolve({data:[],error:null}),
          brandIds.length ? supabase.from('brands').select('id,brand_name').in('id',brandIds).eq('status','active') : Promise.resolve({data:[],error:null})
        ])
        if(companiesRes.error||brandsRes.error){if(!cancelled){setError((companiesRes.error||brandsRes.error).message);setLoading(false)};return}
        const cm=new Map((companiesRes.data||[]).map(x=>[x.id,x.company_name]))
        const bm=new Map((brandsRes.data||[]).map(x=>[x.id,x.brand_name]))
        if(!cancelled)setItems((products||[]).map(x=>({...x,companyName:cm.get(x.company_id)||'Company not assigned',brandName:bm.get(x.brand_id)||''})))
      } else {
        const {data:p,error:pe}=await supabase.from('products').select('id,product_name,company_id,brand_id,generic_name,strength,dosage_form,pack_size').eq('id',productId).eq('status','active').maybeSingle()
        if(pe||!p){if(!cancelled){setError(pe?.message||'This product could not be found.');setLoading(false)};return}
        const [co,br,direct,companyRels]=await Promise.all([
          p.company_id ? supabase.from('companies').select('id,company_name,short_name').eq('id',p.company_id).eq('status','active').maybeSingle() : Promise.resolve({data:null,error:null}),
          p.brand_id ? supabase.from('brands').select('id,brand_name').eq('id',p.brand_id).eq('status','active').maybeSingle() : Promise.resolve({data:null,error:null}),
          supabase.from('product_distributors').select('distributor_id').eq('product_id',p.id).eq('status','active'),
          p.company_id ? supabase.from('distributorships').select('distributor_id').eq('company_id',p.company_id).eq('status','active') : Promise.resolve({data:[],error:null})
        ])
        if(co.error||br.error||direct.error||companyRels.error){if(!cancelled){setError((co.error||br.error||direct.error||companyRels.error).message);setLoading(false)};return}
        const directIds=(direct.data||[]).map(x=>x.distributor_id)
        const companyIds=(companyRels.data||[]).map(x=>x.distributor_id)
        const ids=[...new Set(directIds.length?directIds:companyIds)].filter(Boolean)
        const dRes=ids.length?await supabase.from('distributors').select('id,distributor_name,mobile,whatsapp,address,maps_url').in('id',ids).eq('status','active').order('distributor_name'):{data:[],error:null}
        if(dRes.error){if(!cancelled){setError(dRes.error.message);setLoading(false)};return}
        if(!cancelled){setProduct(p);setCompany(co.data);setBrand(br.data);setDistributors(dRes.data||[]);setProductSpecificDistributors(directIds.length>0)}
      }
      if(!cancelled)setLoading(false)
    }
    load()
    return()=>{cancelled=true}
  },[productId])

  const filtered=items.filter(x=>[x.product_name,x.companyName,x.brandName,x.generic_name,x.strength,x.dosage_form].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase()))
  const specs=[product?.generic_name,product?.strength,product?.dosage_form,product?.pack_size].filter(Boolean).join(' · ')

  return <section className="browse-section product-directory-section"><div className="container browse-container">
    <button className="back-button" onClick={onBack}><ArrowLeft size={16}/> {productId?'Back to Products':'Back'}</button>
    {productId ? <>
      {loading && <div className="result-state"><LoaderCircle className="spin" size={20}/> Loading product…</div>}
      {!loading && error && <div className="result-state">{error}</div>}
      {!loading && product && <div className="product-detail-layout">
        <div className="product-detail-main">
          <p className="section-kicker">PRODUCT DETAILS</p>
          <div className="product-detail-title-row"><span className="product-detail-icon"><Package size={24}/></span><div><h1>{product.product_name}</h1>{brand?.brand_name&&<p>{brand.brand_name}</p>}</div></div>
          {specs&&<p className="product-detail-specs">{specs}</p>}
          <div className="product-detail-company"><Building2 size={18}/><div><span>Company</span><strong>{company?.company_name||'Company not assigned'}</strong></div>{company&&<button type="button" onClick={()=>onOpenCompany(company.id)} aria-label="Open company profile"><ArrowRight size={17}/></button>}</div>
          <div className="product-detail-distributors"><div className="product-detail-section-heading"><div><h2>{productSpecificDistributors?'Product-linked distributors':'Company distributors'}</h2><p>{productSpecificDistributors?'These distributors are linked to this product. Confirm current stock before ordering.':'These distributors are listed for the company; handling of this specific product has not been confirmed.'}</p></div><span>{distributors.length}</span></div>
          {!distributors.length?<div className="result-state">No active distributor links are listed for this product or company yet.</div>:distributors.map(d=><article className="product-distributor-card" key={d.id} onClick={()=>onOpenDistributor(d.id)}><div className="product-distributor-copy"><strong>{d.distributor_name}</strong>{(d.address)&&<span>{d.address}</span>}<small>{productSpecificDistributors?'Confirm current stock and availability directly.':'Company relationship only — product handling is not confirmed.'}</small></div><div className="browse-contact-actions" onClick={e=>e.stopPropagation()}>{d.mobile&&<a className="contact-action call-action" href={phoneLink(d.mobile)}><Phone size={14}/><span>Call</span></a>}{(d.whatsapp||d.mobile)&&<a className="contact-action whatsapp-action" href={waLink(d.whatsapp||d.mobile,`Hello ${d.distributor_name}, do you currently handle ${company?.company_name||product.product_name} and have stock available in Kutch? I found your contact through KutchPharmaConnect.`)} target="_blank" rel="noreferrer"><MessageCircle size={14}/><span>WhatsApp</span></a>}<a className="contact-action maps-action" href={mapsLink(d)} target="_blank" rel="noreferrer"><MapPin size={14}/><span>Maps</span></a></div></article>)}
          </div>
        </div>
      </div>}
    </> : <>
      <div className="browse-header"><div><p className="section-kicker">PRODUCT CATALOGUE</p><h1>Products</h1><p>Search products by name, brand, company, generic name, or strength.</p></div>{!loading&&!error&&<div className="browse-count">{filtered.length} products</div>}</div>
      <div className="browse-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products, brands, companies…" aria-label="Search products"/></div>
      {loading&&<div className="result-state"><LoaderCircle className="spin" size={20}/> Loading products…</div>}
      {!loading&&error&&<div className="result-state">{error}</div>}
      {!loading&&!error&&<div className="browse-grid product-directory-grid">{filtered.map(p=><button type="button" className="product-directory-card" key={p.id} onClick={()=>onOpenProduct(p.id)}><span className="product-directory-icon"><Package size={19}/></span><span className="product-directory-copy"><strong>{p.product_name}</strong>{p.brandName&&<span>{p.brandName}</span>}<small>{p.companyName}</small>{[p.generic_name,p.strength,p.dosage_form].filter(Boolean).length>0&&<small>{[p.generic_name,p.strength,p.dosage_form].filter(Boolean).join(' · ')}</small>}</span><ArrowRight size={17}/></button>)}</div>}
      {!loading&&!error&&!filtered.length&&<div className="result-state">No matching products found.</div>}
    </>}
  </div></section>
}
