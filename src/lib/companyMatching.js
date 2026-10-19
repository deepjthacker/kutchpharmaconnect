const GENERIC_COMPANY_WORDS = new Set([
  'a','an','and','the','of','for','in','on','at','to',
  'pharma','pharmaceutical','pharmaceuticals','healthcare','health','medical',
  'industries','industry','private','limited','ltd','pvt','inc','incorporated',
  'company','co','corporation','corp','india','indian','international',
  'enterprise','enterprises','trading','agency','agencies','distributor',
  'distributors','wholesale','wholesaler','group','llp','llc','plc'
])

export function normalizeCompanyName(value) {
  return String(value || '').toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim().replace(/\s+/g, ' ')
}

export function compactCompanyName(value) {
  return normalizeCompanyName(value).replace(/[^a-z0-9]/g, '')
}

function meaningfulTokens(value) {
  return [...new Set(normalizeCompanyName(value).split(' ')
    .filter(token => token.length > 1 && !GENERIC_COMPANY_WORDS.has(token)))]
}

function editSimilarity(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  if (Math.min(a.length, b.length) < 5) return 0
  if (Math.abs(a.length - b.length) / Math.max(a.length, b.length) > 0.3) return 0
  if (a[0] !== b[0]) return 0
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    previous = current
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length)
}

export function scoreCompanyName(query, candidate) {
  const q = normalizeCompanyName(query)
  const n = normalizeCompanyName(candidate)
  if (!q || !n) return 0
  if (q === n) return 1
  const qc = compactCompanyName(q)
  const nc = compactCompanyName(n)
  if (qc === nc) return 0.99
  if (Math.min(qc.length, nc.length) >= 5 && (
    nc.startsWith(qc) || qc.startsWith(nc) ||
    (nc.includes(qc) && qc.length / nc.length >= 0.55) ||
    (qc.includes(nc) && nc.length / qc.length >= 0.55)
  )) return 0.93

  const qt = meaningfulTokens(q)
  const nt = meaningfulTokens(n)
  const shared = qt.filter(token => nt.includes(token))
  if (shared.length) {
    const coverage = shared.length / Math.max(1, Math.min(qt.length, nt.length))
    if (shared.some(token => token.length >= 5)) {
      return Math.min(0.88, 0.62 + 0.14 * coverage + 0.04 * Math.min(shared.length - 1, 2))
    }
    if (shared.length >= 2) return Math.min(0.78, 0.56 + 0.12 * coverage)
  }

  const similarity = editSimilarity(qc, nc)
  if (similarity >= 0.82) return Math.min(0.86, similarity)
  const tokenSimilarity = Math.max(0, ...meaningfulTokens(n).map(token => editSimilarity(qc, compactCompanyName(token))))
  if (tokenSimilarity >= 0.82) return Math.min(0.88, tokenSimilarity)
  return 0
}

export function findCompanyCandidates(query, companies, aliases = [], minimumScore = 0.45) {
  const q = normalizeCompanyName(query)
  const qc = compactCompanyName(query)
  if (!q) return []
  const ranked = (companies || []).map(company => {
    const names = [company.company_name, company.legal_name, company.short_name]
      .filter(Boolean)
    const companyAliases = (aliases || [])
      .filter(alias => alias.entity_type === 'company' && alias.entity_id === company.id)
      .flatMap(alias => [alias.alias, alias.normalized_alias])
      .filter(Boolean)
    const score = Math.max(0, ...[...names, ...companyAliases].map(name => scoreCompanyName(query, name)))
    const exact = [...names, ...companyAliases].some(name =>
      normalizeCompanyName(name) === q || compactCompanyName(name) === qc
    )
    return { company, score, exact }
  }).filter(item => item.score >= minimumScore)
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.score - a.score ||
      String(a.company.company_name).localeCompare(String(b.company.company_name)))
  return ranked.slice(0, 5)
}
