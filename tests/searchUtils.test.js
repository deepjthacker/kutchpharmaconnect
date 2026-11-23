import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSearchText, searchMatchScore, scoreSearchItem, rankSearchItems } from '../src/lib/searchUtils.js'

test('normalization handles punctuation and letter-number separators', () => {
  assert.equal(normalizeSearchText('AstraZeneca-500mg'), 'astrazeneca 500 mg')
})

test('exact primary name ranks above a secondary company/specification match', () => {
  const items = [
    { id: 'company-match', type: 'product', title: 'Other Medicine', companyName: 'Metformin' },
    { id: 'exact-product', type: 'product', title: 'Metformin', companyName: 'Other Pharma' }
  ]
  const ranked = rankSearchItems(items, 'Metformin', item => [item.title, item.companyName])
  assert.equal(ranked[0].id, 'exact-product')
})

test('exact distributor name ranks above a secondary relationship preview match', () => {
  const items = [
    { id: 'preview', type: 'distributor', title: 'Kutch Pharma Agency', preview: ['Shree Distributor · Company-level listing'] },
    { id: 'exact', type: 'distributor', title: 'Shree Distributor', preview: ['Other Company · Division'] }
  ]
  const ranked = rankSearchItems(items, 'Shree Distributor', item => [item.title, ...(item.preview || [])])
  assert.equal(ranked[0].id, 'exact')
})

test('product type is a deterministic tie-breaker after equal name relevance', () => {
  const items = [
    { id: 'brand', type: 'brand', title: 'Neuro' },
    { id: 'product', type: 'product', title: 'Neuro' }
  ]
  assert.equal(rankSearchItems(items, 'Neuro')[0].id, 'product')
})

test('punctuation-insensitive and typo-tolerant scoring remains available', () => {
  assert.equal(searchMatchScore('Astra-Zeneca', 'AstraZeneca'), 1000)
  assert.ok(scoreSearchItem({ title: 'Paracetamol' }, 'Paracetmol', item => [item.title]) > 0)
})
