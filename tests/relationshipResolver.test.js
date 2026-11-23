import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveProductDistributors } from '../src/lib/relationshipResolver.js'

const product = { id: 'p1', company_id: 'co1', division_id: 'div1', brand_id: 'br1', category_id: 'cat1' }
const assignment = (overrides = {}) => ({
  id: 'rel1', company_id: 'co1', distributor_id: 'dist-company',
  category_id: 'cat1', location_id: 'loc1', territory: 'Kutch',
  ...overrides
})

test('division assignment overrides company assignment in the same context', () => {
  const rows = resolveProductDistributors(
    { ...product, brand_id: null },
    [assignment(), assignment({ id: 'rel2', distributor_id: 'dist-division', division_id: 'div1' })]
  )
  assert.deepEqual(rows.map(row => row.distributor_id), ['dist-division'])
  assert.equal(rows[0].scope, 'division')
})

test('brand assignment overrides division and company assignments in the same context', () => {
  const rows = resolveProductDistributors(product, [
    assignment(),
    assignment({ id: 'rel2', distributor_id: 'dist-division', division_id: 'div1' }),
    assignment({ id: 'rel3', distributor_id: 'dist-brand', brand_id: 'br1', division_id: 'div1' })
  ])
  assert.deepEqual(rows.map(row => row.distributor_id), ['dist-brand'])
  assert.equal(rows[0].scope, 'brand')
})

test('product assignment overrides broader assignments only in its category/location/territory context', () => {
  const rows = resolveProductDistributors(product, [
    assignment({ id: 'rel-company', distributor_id: 'dist-company' }),
    assignment({ id: 'rel-division', distributor_id: 'dist-division', division_id: 'div1' }),
    assignment({ id: 'rel-other-category', distributor_id: 'dist-other-category', category_id: 'cat2' })
  ], [{ id: 'pd1', product_id: 'p1', distributor_id: 'dist-product', location_id: 'loc1', territory: 'Kutch' }])
  assert.deepEqual(rows.map(row => row.distributor_id), ['dist-product'])
  assert.equal(rows[0].scope, 'product')
})

test('a product assignment does not override a different location context', () => {
  const rows = resolveProductDistributors(product, [
    assignment({ id: 'rel-other-location', distributor_id: 'dist-other-location', location_id: 'loc2' })
  ], [{ id: 'pd1', product_id: 'p1', distributor_id: 'dist-product', location_id: 'loc1', territory: 'Kutch' }])
  assert.deepEqual(new Set(rows.map(row => row.distributor_id)), new Set(['dist-product', 'dist-other-location']))
})

test('multiple distributors at the winning specificity are preserved', () => {
  const rows = resolveProductDistributors(
    { ...product, brand_id: null },
    [
      assignment({ id: 'rel-division-a', distributor_id: 'dist-a', division_id: 'div1' }),
      assignment({ id: 'rel-division-b', distributor_id: 'dist-b', division_id: 'div1' }),
      assignment({ id: 'rel-company', distributor_id: 'dist-company' })
    ]
  )
  assert.deepEqual(new Set(rows.map(row => row.distributor_id)), new Set(['dist-a', 'dist-b']))
})

test('an unclassified product does not treat its category as a wildcard', () => {
  const rows = resolveProductDistributors(
    { ...product, category_id: null },
    [assignment({ id: 'rel-company', distributor_id: 'dist-company' })],
    [{ id: 'pd1', product_id: 'p1', distributor_id: 'dist-product', location_id: 'loc1', territory: 'Kutch' }]
  )
  assert.deepEqual(new Set(rows.map(row => row.distributor_id)), new Set(['dist-company', 'dist-product']))
  assert.equal(rows.find(row => row.distributor_id === 'dist-product').category_context_missing, true)
})
