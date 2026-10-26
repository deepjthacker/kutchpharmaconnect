export async function fetchAllPages(makeQuery, pageSize = 500) {
  const rows = []
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await makeQuery().range(start, start + pageSize - 1)
    if (error) return { data: null, error }
    const batch = data || []
    rows.push(...batch)
    if (batch.length < pageSize) return { data: rows, error: null }
  }
}

export async function fetchByIds(ids, makeQuery, batchSize = 100) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))]
  if (!uniqueIds.length) return { data: [], error: null }

  const batches = []
  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    batches.push(uniqueIds.slice(i, i + batchSize))
  }

  const results = await Promise.all(batches.map(makeQuery))
  const failed = results.find(result => result.error)
  if (failed) return { data: null, error: failed.error }
  return { data: results.flatMap(result => result.data || []), error: null }
}
