// Search normalization keeps punctuation, spacing and letter/number separators
// from changing whether an otherwise identical catalogue term can be found.
export function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLocaleLowerCase('en-IN')
    .replace(/([a-z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function searchTokens(value) {
  return [...new Set(normalizeSearchText(value).split(' ').filter(token => token.length > 0))]
}

// Each token is searched independently across the selected columns. The first
// four characters provide a forgiving fallback for small spelling mistakes;
// AND-ing the token groups prevents unrelated partial matches from dominating.
export function applyFlexibleSearch(query, fields, term) {
  const tokens = searchTokens(term)
  if (!tokens.length) return query

  const groups = tokens.map(token => {
    const fragment = token.length >= 5 ? token.slice(0, 4) : token
    const pattern = '%' + fragment.replace(/[%_]/g, '') + '%'
    return 'or(' + fields.map(field => field + '.ilike.' + pattern).join(',') + ')'
  })
  return query.or('and(' + groups.join(',') + ')')
}

function editDistance(left, right) {
  const a = String(left || '')
  const b = String(right || '')
  if (!a) return b.length
  if (!b) return a.length
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
    previous = current
  }
  return previous[b.length]
}

export function searchMatchScore(label, term) {
  const normalizedLabel = normalizeSearchText(label)
  const normalizedTerm = normalizeSearchText(term)
  if (!normalizedLabel || !normalizedTerm) return 0
  if (normalizedLabel === normalizedTerm) return 1000
  if (normalizedLabel.startsWith(normalizedTerm)) return 900
  if (normalizedLabel.includes(normalizedTerm)) return 800

  const labelTokens = normalizedLabel.split(' ')
  const queryTokens = searchTokens(term)
  let score = 0
  for (const token of queryTokens) {
    const best = Math.max(0, ...labelTokens.map(candidate => {
      if (candidate === token) return 100
      if (candidate.startsWith(token) || token.startsWith(candidate)) return 70
      const distance = editDistance(token, candidate)
      const similarity = 1 - distance / Math.max(token.length, candidate.length, 1)
      return similarity >= 0.72 ? similarity * 60 : 0
    }))
    score += best
  }
  return score / Math.max(queryTokens.length, 1)
}

const TYPE_TIE_BREAK = {
  product: 6,
  brand: 5,
  division: 4,
  company: 3,
  distributor: 2,
  relationship: 1
}

// getLabel may return one label or an ordered array of fields. The primary
// name receives full weight; secondary details help retrieval without allowing
// a company/specification match to outrank an exact entity-name match.
export function scoreSearchItem(item, term, getLabel = value => value?.label || value?.title || '') {
  const raw = getLabel(item)
  const fields = (Array.isArray(raw) ? raw : [raw]).filter(value => String(value || '').trim())
  if (!fields.length) return 0
  const combinedScore = searchMatchScore(fields.join(' '), term) * 0.84
  const weights = [1, 0.84, 0.76, 0.70, 0.64, 0.58]
  const fieldScore = Math.max(...fields.map((field, index) => searchMatchScore(field, term) * (weights[index] ?? 0.52)))
  return Math.max(combinedScore, fieldScore)
}

export function rankSearchItems(items, term, getLabel = item => item?.label || item?.title || '') {
  return [...(items || [])].sort((a, b) =>
    scoreSearchItem(b, term, getLabel) - scoreSearchItem(a, term, getLabel)
    || (TYPE_TIE_BREAK[b?.type] || 0) - (TYPE_TIE_BREAK[a?.type] || 0)
    || String((Array.isArray(getLabel(a)) ? getLabel(a)[0] : getLabel(a)) || '').localeCompare(String((Array.isArray(getLabel(b)) ? getLabel(b)[0] : getLabel(b)) || ''))
    || String(a?.id || '').localeCompare(String(b?.id || ''))
  )
}
