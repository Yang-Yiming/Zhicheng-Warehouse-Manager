const test = require('node:test')
const assert = require('node:assert/strict')

const {
  AUTO_REFRESH_TTL_MS,
  clearPageDirty,
  isPageDirty,
  markPageDirty,
  shouldRefreshOnShow,
} = require('../miniprogram/utils/page-refresh')

test('shouldRefreshOnShow skips quick revisits inside the ttl window', () => {
  const lastLoadedAt = 10_000
  const now = lastLoadedAt + AUTO_REFRESH_TTL_MS - 1

  assert.equal(shouldRefreshOnShow({ lastLoadedAt, now }), false)
})

test('shouldRefreshOnShow refreshes once the ttl has elapsed', () => {
  const lastLoadedAt = 10_000
  const now = lastLoadedAt + AUTO_REFRESH_TTL_MS

  assert.equal(shouldRefreshOnShow({ lastLoadedAt, now }), true)
})

test('shouldRefreshOnShow always refreshes dirty pages', () => {
  assert.equal(shouldRefreshOnShow({ lastLoadedAt: Date.now(), now: Date.now(), dirty: true }), true)
})

test('page dirty flags can be marked and cleared', () => {
  const pageKey = 'inventory'

  clearPageDirty(pageKey)
  assert.equal(isPageDirty(pageKey), false)

  markPageDirty(pageKey)
  assert.equal(isPageDirty(pageKey), true)

  clearPageDirty(pageKey)
  assert.equal(isPageDirty(pageKey), false)
})
