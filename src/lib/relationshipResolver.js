// Resolve the most specific applicable distributor assignment for a product.
// Specificity is evaluated independently inside each category/location/territory context.
export function resolveProductDistributors(product, distributorships = [], productLinks = []) {
  const candidates = []
  const matchesProduct = (row, scope) => {
    if (scope === 'product') return row.product_id === product.id
    if (scope === 'brand') return Boolean(product.brand_id && row.brand_id === product.brand_id)
    if (scope === 'division') return Boolean(product.division_id && !row.brand_id && row.division_id === product.division_id)
    return !row.brand_id && !row.division_id && row.company_id === product.company_id
  }

  ;(productLinks || []).filter(row => matchesProduct(row, 'product')).forEach(row => {
    candidates.push({ ...row, scope: 'product', priority: 4, _categoryWildcard: row.category_id == null })
  })
  ;(distributorships || []).forEach(row => {
    if (row.company_id !== product.company_id) return
    const scope = row.brand_id && matchesProduct(row, 'brand')
      ? 'brand'
      : !row.brand_id && row.division_id && matchesProduct(row, 'division')
        ? 'division'
        : !row.brand_id && !row.division_id && matchesProduct(row, 'company')
          ? 'company'
          : null
    if (scope) candidates.push({ ...row, scope, priority: { company: 1, division: 2, brand: 3 }[scope] })
  })

  const contextKey = row => [row.category_id ?? '', row.location_id ?? '', String(row.territory || '').trim().toLowerCase()].join('|')
  const contexts = new Map()
  candidates.filter(row => row.scope !== 'product').forEach(row => {
    const key = contextKey(row)
    if (!contexts.has(key)) contexts.set(key, [])
    contexts.get(key).push(row)
  })

  const productRows = candidates.filter(row => row.scope === 'product')
  productRows.forEach(row => {
    const compatible = [...contexts.entries()].filter(([, rows]) => {
      const sample = rows[0]
      return (row.location_id ?? null) === (sample.location_id ?? null)
        && String(row.territory || '').trim().toLowerCase() === String(sample.territory || '').trim().toLowerCase()
        && (row.category_id == null || row.category_id === sample.category_id)
    })
    if (compatible.length) {
      compatible.forEach(([key]) => contexts.get(key).push(row))
    } else {
      const key = contextKey(row)
      if (!contexts.has(key)) contexts.set(key, [])
      contexts.get(key).push(row)
    }
  })

  const winners = []
  contexts.forEach(rows => {
    const highest = Math.max(...rows.map(row => row.priority))
    winners.push(...rows.filter(row => row.priority === highest))
  })

  const byDistributor = new Map()
  winners.forEach(row => {
    if (!row.distributor_id) return
    const current = byDistributor.get(row.distributor_id) || { distributor_id: row.distributor_id, scopes: [], assignments: [], priority: 0 }
    if (!current.scopes.includes(row.scope)) current.scopes.push(row.scope)
    current.assignments.push(row)
    current.priority = Math.max(current.priority, row.priority)
    byDistributor.set(row.distributor_id, current)
  })
  return [...byDistributor.values()].map(item => ({
    ...item.assignments.reduce((best, row) => row.priority > best.priority ? row : best, item.assignments[0]),
    scope: item.scopes.length === 1 ? item.scopes[0] : item.scopes.sort((a, b) => ({ company: 1, division: 2, brand: 3, product: 4 }[a] - { company: 1, division: 2, brand: 3, product: 4 }[b])).join(' + '),
    scopes: item.scopes,
    assignments: item.assignments
  }))
}
