// Search normalization keeps punctuation, spacing and letter/number separators
// from changing whether an otherwise identical catalogue term can be found.
export function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
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

export function rankSearchItems(items, term, getLabel = item => item?.label || item?.title || '') {
  return [...(items || [])].sort((a, b) =>
    searchMatchScore(getLabel(b), term) - searchMatchScore(getLabel(a), term)
    || String(getLabel(a)).localeCompare(String(getLabel(b)))
  )
}
