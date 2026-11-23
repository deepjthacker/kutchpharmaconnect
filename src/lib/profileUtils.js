// Keep each distributor-company assignment intact while grouping the profile
// by company. Scope, category, location and territory remain on each row.
export function groupDistributorAssignments(rows = []) {
  const groups = new Map()
  for (const relationship of rows || []) {
    const company = relationship?.company
    if (!company?.id) continue
    if (!groups.has(company.id)) groups.set(company.id, { company, relationships: [] })
    groups.get(company.id).relationships.push(relationship)
  }
  return [...groups.values()]
}
