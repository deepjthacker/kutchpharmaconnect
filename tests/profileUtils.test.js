import test from 'node:test'
import assert from 'node:assert/strict'
import { groupDistributorAssignments } from '../src/lib/profileUtils.js'

test('groups assignments by company without losing division, brand or territory contexts', () => {
  const companyA = { id: 'company-a', company_name: 'Company A' }
  const companyB = { id: 'company-b', company_name: 'Company B' }
  const rows = [
    { id: 'a1', company_id: 'company-a', company: companyA, division_id: 'division-1', division: { division_name: 'Division 1' }, territory: 'Mundra' },
    { id: 'a2', company_id: 'company-a', company: companyA, brand_id: 'brand-1', brand: { brand_name: 'Brand 1' }, territory: 'Bhuj' },
    { id: 'a3', company_id: 'company-a', company: companyA, category_id: 'category-2', territory: 'Anjar' },
    { id: 'b1', company_id: 'company-b', company: companyB, territory: 'Kutch' }
  ]
  const groups = groupDistributorAssignments(rows)
  assert.equal(groups.length, 2)
  assert.equal(groups[0].company.id, 'company-a')
  assert.deepEqual(groups[0].relationships.map(row => row.id), ['a1', 'a2', 'a3'])
  assert.equal(groups[0].relationships[1].brand.brand_name, 'Brand 1')
  assert.equal(groups[0].relationships[2].territory, 'Anjar')
  assert.equal(groups[1].relationships.length, 1)
})

test('ignores rows without a resolvable company rather than creating anonymous groups', () => {
  assert.deepEqual(groupDistributorAssignments([{ id: 'missing-company' }, { id: 'missing-id', company: {} }]), [])
})
