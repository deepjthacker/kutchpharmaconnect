import fs from 'node:fs/promises'
import path from 'node:path'

const siteUrl = 'https://deepjthacker.github.io/kutchpharmaconnect'
const baseUrl = (process.env.VITE_SUPABASE_URL || 'https://tyaogpqtpedbucwbjzkw.supabase.co').replace(/\/$/, '')
const apiKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_b1UXANSyOzz5W0FCj6mL2g_0GXJ9edu'

if (!baseUrl || !apiKey) throw new Error('Supabase public API configuration is required to generate SEO pages.')

const publicDir = path.resolve('public')
const generatedDirs = ['companies', 'distributors']
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char])
const slug = value => String(value || 'business')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'business'

async function fetchAll(table, select, filters = {}) {
  const rows = []
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    const params = new URLSearchParams({ select, limit: String(pageSize), offset: String(offset), ...filters })
    const response = await fetch(`${baseUrl}/rest/v1/${table}?${params}`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }
    })
    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`Supabase read failed for ${table} (${response.status}): ${detail.slice(0, 300)}`)
    }
    const batch = await response.json()
    rows.push(...batch)
    if (batch.length < pageSize) break
  }
  return rows
}

function pageHtml({ title, description, canonical, body, schema, activityProfile = null, activityDistributorId = null }) {
  const activityScript = activityProfile ? `<script>
(() => {
  const config = ${JSON.stringify({ url: baseUrl, key: apiKey, profileType: activityProfile.type, profileId: activityProfile.id, distributorId: activityDistributorId })};
  const endpoint = config.url + '/functions/v1/record-distributor-activity';
  let sessionId = null;
  try {
    sessionId = sessionStorage.getItem('kpc-distributor-activity-session');
    if (!sessionId && window.crypto?.randomUUID) {
      sessionId = window.crypto.randomUUID();
      sessionStorage.setItem('kpc-distributor-activity-session', sessionId);
    }
  } catch {}
  const params = new URLSearchParams(window.location.search);
  const context = {
    source_page: window.location.pathname,
    referrer: document.referrer || null,
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    session_id: sessionId
  };
  const record = eventType => {
    if (typeof window.gtag === 'function') {
      window.gtag('event', config.profileType + '_' + eventType, {
        distributor_id: config.distributorId,
        source_page: window.location.pathname
      });
    }
    fetch(endpoint, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: config.key,
        Authorization: 'Bearer ' + config.key
      },
      body: JSON.stringify({
        action: 'event',
        distributor_id: config.distributorId,
        profile_type: config.profileType,
        profile_id: config.profileId,
        event_type: eventType,
        ...context
      })
    }).catch(() => {});
  };
  record('profile_view');
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-kpc-event]');
    if (link) record(link.dataset.kpcEvent);
  });
})();
</script>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="index,follow">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-EBYX3M26DC"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-EBYX3M26DC');
gtag('config', 'G-2WJE72TVYD');
</script>
<meta property="og:type" content="website">
<meta property="og:site_name" content="KutchPharmaConnect">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${siteUrl}/kutchpharma-connect-logo.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${siteUrl}/kutchpharma-connect-logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Serif+Display&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
<style>
:root{color-scheme:light;--ink:#14283b;--muted:#627486;--line:#dbe7e7;--brand:#173a8f;--brand-dark:#102b41;--soft:#eef3ff}
*{box-sizing:border-box}body{margin:0;font:16px/1.65 "DM Sans",Inter,ui-sans-serif,system-ui,sans-serif;color:var(--ink);background:#f7fafb}
header{background:#fff;border-bottom:1px solid var(--line)}.header-inner,main,footer{max-width:1080px;margin:auto;padding:22px}.header-inner{display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-weight:850;text-decoration:none;font-size:1.13rem;letter-spacing:-.04em;color:var(--brand-dark)}.brand span{color:var(--brand)}nav{display:flex;gap:18px}nav a{color:#536679;text-decoration:none;font-size:.82rem;font-weight:750}nav a:hover{color:var(--brand)}
main{padding-top:42px;padding-bottom:56px}h1,h2{font-family:"DM Serif Display",Georgia,serif;font-weight:400}h1{font-size:clamp(1.9rem,5vw,3rem);line-height:1.12;letter-spacing:-.035em;margin:.3em 0}h2{margin-top:2rem;font-size:1.3rem;letter-spacing:-.025em}.eyebrow{color:var(--brand);font-weight:750;font-size:.83rem}.card{border:1px solid var(--line);border-radius:15px;padding:18px;margin:13px 0;background:#fff;box-shadow:0 3px 12px rgba(20,50,66,.035)}.muted{color:var(--muted)}a{color:var(--brand)}.pill{display:inline-block;border-radius:999px;padding:3px 10px;background:var(--soft);color:#3159a8;font-size:.78rem;font-weight:700}.cta{display:inline-block;background:var(--brand);color:white;text-decoration:none;border-radius:10px;padding:11px 16px;margin:6px 8px 6px 0;font-size:.85rem;font-weight:750}.cta:hover{background:#123276}.notice{background:var(--soft);border:1px solid #dce6ff;border-left:4px solid var(--brand);padding:13px 16px;border-radius:10px}
footer{border-top:1px solid #2b485b;color:#c4d4dd;background:var(--brand-dark);max-width:none;font-size:.82rem}footer .footer-inner{max-width:1080px;margin:auto;padding:24px 22px;line-height:1.7}footer a{color:#b7ceef}
@media(max-width:600px){.header-inner{align-items:flex-start;flex-direction:column;gap:8px}nav{gap:14px;flex-wrap:wrap}.header-inner,main{padding-left:16px;padding-right:16px}}
</style>
</head>
<body>
<header><div class="header-inner"><a class="brand" href="${siteUrl}/">Kutch<span>Pharma</span>Connect</a><nav aria-label="Directory"><a href="${siteUrl}/?view=companies">Companies</a><a href="${siteUrl}/?view=distributors">Distributors</a><a href="${siteUrl}/?view=locations">Locations</a></nav></div></header>
<main>${body}<p><a class="cta" href="${siteUrl}/">Search the directory</a><a href="${siteUrl}/?view=companies">Browse companies</a></p></main>
<footer><div class="footer-inner">Business information is provided for directory discovery. Confirm current details and distributorships directly with the business before relying on them. <a href="${siteUrl}/">KutchPharmaConnect</a></div></footer>
${activityScript}
</body></html>`
}

const [companies, distributors, relations, divisions, brands, categories, locations] = await Promise.all([
  fetchAll('companies', 'id,company_name,legal_name,short_name,description,status,parent_company_id,ownership_percentage,ownership_relationship,ownership_note,company_group_id', { status: 'eq.active', order: 'company_name.asc' }),
  fetchAll('distributors', 'id,distributor_name,legal_name,contact_person,mobile,whatsapp,email,address,city_id,maps_url,website,status', { status: 'eq.active', order: 'distributor_name.asc' }),
  fetchAll('distributorships', 'id,company_id,division_id,brand_id,category_id,distributor_id,location_id,territory,status,verification_status,verified_date,source', { status: 'eq.active' }),
  fetchAll('divisions', 'id,company_id,division_name,status', { status: 'eq.active' }),
  fetchAll('brands', 'id,company_id,division_id,brand_name,status', { status: 'eq.active' }),
  fetchAll('categories', 'id,name,status', { status: 'eq.active' }),
  fetchAll('locations', 'id,city,district,state,status', { status: 'eq.active' })
])

const companyById = new Map(companies.map(row => [row.id, row]))
const subsidiariesByParent = new Map()
for (const company of companies) {
  if (!company.parent_company_id) continue
  if (!subsidiariesByParent.has(company.parent_company_id)) subsidiariesByParent.set(company.parent_company_id, [])
  subsidiariesByParent.get(company.parent_company_id).push(company)
}
const companyProfileUrl = company => `${siteUrl}/companies/${slug(company.company_name)}-${String(company.id || '').slice(0, 8)}/`
const ownershipLabel = relationship => ({
  direct_subsidiary: 'Direct subsidiary',
  majority_owned: 'Majority-owned subsidiary',
  step_down_subsidiary: 'Step-down subsidiary',
  joint_venture: 'Joint venture'
}[relationship] || 'Operating company')
const ownershipSection = company => {
  const parent = company.parent_company_id ? companyById.get(company.parent_company_id) : null
  const children = subsidiariesByParent.get(company.id) || []
  if (!parent && !children.length && company.ownership_relationship !== 'joint_venture') return ''
  const parentCard = parent ? `<article class="card"><span class="pill">${esc(ownershipLabel(company.ownership_relationship))}</span><p><strong>Parent / holding entity:</strong> <a href="${companyProfileUrl(parent)}">${esc(parent.company_name)}</a></p><p class="muted">${company.ownership_percentage != null ? `${esc(company.ownership_percentage)}% ownership` : ''}${company.ownership_note ? ` · ${esc(company.ownership_note)}` : ''}</p></article>` : ''
  const jvCard = company.ownership_relationship === 'joint_venture' ? `<article class="card"><span class="pill">Joint venture</span><p>${esc(company.ownership_note || 'Joint venture relationship recorded.')}</p></article>` : ''
  const childCards = children.map(child => `<article class="card"><span class="pill">${esc(ownershipLabel(child.ownership_relationship))}</span><p><strong><a href="${companyProfileUrl(child)}">${esc(child.company_name)}</a></strong></p><p class="muted">${child.ownership_percentage != null ? `${esc(child.ownership_percentage)}% ownership` : ''}${child.ownership_note ? ` · ${esc(child.ownership_note)}` : ''}</p></article>`).join('')
  return `<h2>Corporate ownership structure</h2>${parentCard}${jvCard}${children.length ? `<p class="muted">Entities directly linked under this company. Each entity has its own distributor records and product catalogue.</p>${childCards}` : ''}`
}
const distributorById = new Map(distributors.map(row => [row.id, row]))
const divisionById = new Map(divisions.map(row => [row.id, row]))
const brandById = new Map(brands.map(row => [row.id, row]))
const categoryById = new Map(categories.map(row => [row.id, row]))
const relationshipKey = (rel, otherId) => JSON.stringify([
  otherId, rel.division_id || null, rel.brand_id || null,
  rel.category_id || null, rel.location_id || null, rel.territory || null
])
const divisionsByCompany = new Map()
for (const division of divisions) {
  if (!divisionsByCompany.has(division.company_id)) divisionsByCompany.set(division.company_id, [])
  divisionsByCompany.get(division.company_id).push(division)
}
const divisionSection = company => {
  const rows = divisionsByCompany.get(company.id) || []
  return rows.length ? `<h2>Divisions</h2>${rows.map(row => `<article class="card"><strong>${esc(row.division_name)}</strong></article>`).join('')}` : ''
}
const locationById = new Map(locations.map(row => [row.id, row]))
const relsByCompany = new Map()
const relsByDistributor = new Map()
for (const rel of relations) {
  if (rel.company_id && companyById.has(rel.company_id) && rel.distributor_id && distributorById.has(rel.distributor_id)) {
    if (!relsByCompany.has(rel.company_id)) relsByCompany.set(rel.company_id, [])
    if (!relsByDistributor.has(rel.distributor_id)) relsByDistributor.set(rel.distributor_id, [])
    relsByCompany.get(rel.company_id).push(rel)
    relsByDistributor.get(rel.distributor_id).push(rel)
  }
}

for (const dir of generatedDirs) await fs.rm(path.join(publicDir, dir), { recursive: true, force: true })
const sitemapUrls = [`${siteUrl}/`]
const now = new Date().toISOString().slice(0, 10)

function relationshipCard(rel, side) {
  const company = companyById.get(rel.company_id)
  const distributor = distributorById.get(rel.distributor_id)
  const division = divisionById.get(rel.division_id)
  const brand = brandById.get(rel.brand_id)
  const category = categoryById.get(rel.category_id)
  const location = locationById.get(rel.location_id)
  const other = side === 'company' ? distributor : company
  const href = side === 'company'
    ? `${siteUrl}/distributors/${slug(distributor?.distributor_name)}-${String(distributor?.id || '').slice(0, 8)}/`
    : `${siteUrl}/companies/${slug(company?.company_name)}-${String(company?.id || '').slice(0, 8)}/`
  const label = side === 'company' ? distributor?.distributor_name : company?.company_name
  const status = String(rel.verification_status || 'unverified').replace(/_/g, ' ')
  const detail = [
    brand?.brand_name ? `Brand: ${esc(brand.brand_name)}` : '',
    division?.division_name ? `Division: ${esc(division.division_name)}` : '',
    category?.name ? `Category: ${esc(category.name)}` : '',
    location ? [location.city, location.district, location.state].filter(Boolean).map(esc).join(', ') : '',
    rel.territory ? `Territory: ${esc(rel.territory)}` : ''
  ].filter(Boolean).join(' · ')
  return `<article class="card"><strong><a href="${href}">${esc(label || other?.legal_name || 'Business profile')}</a></strong><div><span class="pill">Relationship status: ${esc(status)}</span></div>${detail ? `<p class="muted">${detail}</p>` : ''}</article>`
}

for (const company of companies) {
  const rels = relsByCompany.get(company.id) || []
  if (!rels.length && !company.description && !(subsidiariesByParent.get(company.id) || []).length && !(divisionsByCompany.get(company.id) || []).length && company.ownership_relationship !== 'joint_venture') continue
  const url = `${siteUrl}/companies/${slug(company.company_name)}-${company.id.slice(0, 8)}/`
  const title = `${company.company_name} | Pharma Company Directory | KutchPharmaConnect`
  const description = `Explore company information and listed distributor relationships for ${company.company_name} in the Kutch pharmaceutical directory. Confirm current relationships directly with the businesses.`
  const uniqueRels = [...new Map(rels.map(rel => [relationshipKey(rel, rel.distributor_id), rel])).values()]
  const body = `<div class="eyebrow">Pharmaceutical company profile</div><h1>${esc(company.company_name)}</h1>${company.legal_name && company.legal_name !== company.company_name ? `<p class="muted">Legal name: ${esc(company.legal_name)}</p>` : ''}${company.short_name ? `<p class="muted">Also known as: ${esc(company.short_name)}</p>` : ''}${company.description ? `<p>${esc(company.description)}</p>` : ''}${ownershipSection(company)}${divisionSection(company)}<p class="notice">This page lists directory relationship records. A listing does not itself prove that a distributorship is current or exclusive. Confirm directly before placing orders.</p><h2>Listed distributors and divisions</h2>${uniqueRels.length ? uniqueRels.map(rel => relationshipCard(rel, 'company')).join('') : '<p>No distributor relationships are currently listed.</p>'}<p class="muted">Page generated ${now}.</p>`
  await fs.mkdir(path.join(publicDir, 'companies', `${slug(company.company_name)}-${company.id.slice(0, 8)}`), { recursive: true })
  await fs.writeFile(path.join(publicDir, 'companies', `${slug(company.company_name)}-${company.id.slice(0, 8)}`, 'index.html'), pageHtml({
    title, description, canonical: url, body,
    schema: { '@context': 'https://schema.org', '@type': 'Organization', name: company.company_name, url, description },
    activityProfile: { type: 'company', id: company.id }
  }))
  sitemapUrls.push(url)
}

for (const distributor of distributors) {
  const rels = relsByDistributor.get(distributor.id) || []
  const location = locationById.get(distributor.city_id)
  const url = `${siteUrl}/distributors/${slug(distributor.distributor_name)}-${distributor.id.slice(0, 8)}/`
  const title = `${distributor.distributor_name} | Distributor in Kutch | KutchPharmaConnect`
  const cityLine = location ? [location.city, location.district, location.state].filter(Boolean).join(', ') : ''
  const description = `Find available business contact details and listed pharmaceutical company relationships for ${distributor.distributor_name}${cityLine ? ` in ${cityLine}` : ' in the Kutch region'}.`
  const uniqueRels = [...new Map(rels.map(rel => [relationshipKey(rel, rel.company_id), rel])).values()]
  const whatsappNumber = distributor.whatsapp || distributor.mobile
  const whatsappMessage = `Hello, I found ${distributor.distributor_name} through KutchPharmaConnect. I’m contacting you regarding your current distributorships in Kutch. KutchPharmaConnect: ${siteUrl}/`
  const mapsQuery = [distributor.distributor_name, distributor.address, cityLine, 'Kutch', 'Gujarat'].filter(Boolean).join(', ')
  const mapsHref = distributor.maps_url && /^https?:\/\//i.test(distributor.maps_url)
    ? distributor.maps_url
    : mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}` : null
  const contacts = [
    distributor.contact_person ? `<p><strong>Contact person:</strong> ${esc(distributor.contact_person)}</p>` : '',
    distributor.mobile ? `<p><strong>Phone:</strong> <a href="tel:${esc(distributor.mobile)}" data-kpc-event="call_click">${esc(distributor.mobile)}</a></p>` : '',
    whatsappNumber ? `<p><strong>WhatsApp:</strong> <a href="https://wa.me/${esc(whatsappNumber.replace(/[^0-9]/g, ''))}?text=${encodeURIComponent(whatsappMessage)}" data-kpc-event="whatsapp_click">${esc(whatsappNumber)}</a></p>` : '',
    distributor.email ? `<p><strong>Email:</strong> <a href="mailto:${esc(distributor.email)}" data-kpc-event="email_click">${esc(distributor.email)}</a></p>` : '',
    distributor.address ? `<p><strong>Address:</strong> ${esc(distributor.address)}${cityLine ? `, ${esc(cityLine)}` : ''}</p>` : cityLine ? `<p><strong>Location:</strong> ${esc(cityLine)}</p>` : '',
    distributor.website && /^https?:\/\//i.test(distributor.website) ? `<p><strong>Website:</strong> <a href="${esc(distributor.website)}" rel="nofollow noopener">${esc(distributor.website)}</a></p>` : '',
    mapsHref ? `<p><a href="${esc(mapsHref)}" rel="nofollow noopener" data-kpc-event="maps_click">View map / directions</a></p>` : ''
  ].filter(Boolean).join('')
  const enquiryProfileUrl = `${siteUrl}/?view=profile&type=distributor&id=${encodeURIComponent(distributor.id)}`
  const enquiryCta = `<p><a class="cta" href="${enquiryProfileUrl}">Open profile to send an enquiry</a></p>`
  const body = `<div class="eyebrow">Distributor profile</div><h1>${esc(distributor.distributor_name)}</h1>${distributor.legal_name && distributor.legal_name !== distributor.distributor_name ? `<p class="muted">Legal name: ${esc(distributor.legal_name)}</p>` : ''}<section class="card"><h2>Business contact information</h2>${contacts || '<p>Contact information has not been provided.</p>'}</section>${enquiryCta}<p class="notice">The relationships below are directory records and may require confirmation. Contact the distributor to confirm current company divisions and territory before placing orders.</p><h2>Listed companies and divisions</h2>${uniqueRels.length ? uniqueRels.map(rel => relationshipCard(rel, 'distributor')).join('') : '<p>No company relationships are currently listed.</p>'}<p class="muted">Directory record refreshed ${now}.</p>`
  await fs.mkdir(path.join(publicDir, 'distributors', `${slug(distributor.distributor_name)}-${distributor.id.slice(0, 8)}`), { recursive: true })
  await fs.writeFile(path.join(publicDir, 'distributors', `${slug(distributor.distributor_name)}-${distributor.id.slice(0, 8)}`, 'index.html'), pageHtml({
    title, description, canonical: url, body,
    schema: { '@context': 'https://schema.org', '@type': 'Organization', name: distributor.distributor_name, url, ...(distributor.website ? { sameAs: [distributor.website] } : {}), ...(distributor.address ? { address: { '@type': 'PostalAddress', streetAddress: distributor.address, addressLocality: location?.city || undefined, addressRegion: location?.state || 'Gujarat', addressCountry: 'IN' } } : {}) },
    activityProfile: { type: 'distributor', id: distributor.id },
    activityDistributorId: distributor.id
  }))
  sitemapUrls.push(url)
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map(url => `  <url><loc>${esc(url)}</loc><lastmod>${now}</lastmod></url>`).join('\n')}\n</urlset>\n`
await fs.writeFile(path.join(publicDir, 'sitemap.xml'), xml)
console.log(`Generated ${companies.length} active company records, ${distributors.length} active distributor records, ${sitemapUrls.length - 1} profile URLs in sitemap.`)
