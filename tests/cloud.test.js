const test = require('node:test')
const assert = require('node:assert/strict')

function loadCloud() {
  const cloudPath = require.resolve('../miniprogram/utils/cloud')
  delete require.cache[cloudPath]
  return require('../miniprogram/utils/cloud')
}

test('callCloud reuses the same in-flight promise for identical requests', async () => {
  let requestCount = 0
  let finishRequest

  global.wx = {
    getStorageSync: () => 'session-token',
    removeStorageSync: () => {},
    setStorageSync: () => {},
    request: ({ success }) => {
      requestCount += 1
      finishRequest = () => success({ statusCode: 200, data: { success: true, value: 1 } })
    },
  }

  const { callCloud } = loadCloud()

  const first = callCloud('inventoryList', { page: 1, pageSize: 20 })
  const second = callCloud('inventoryList', { page: 1, pageSize: 20 })

  assert.strictEqual(first, second)
  assert.equal(requestCount, 1)

  finishRequest()
  await assert.doesNotReject(first)
})

test('callCloud does not merge different payloads', async () => {
  let requestCount = 0
  const pending = []

  global.wx = {
    getStorageSync: () => 'session-token',
    removeStorageSync: () => {},
    setStorageSync: () => {},
    request: ({ success }) => {
      requestCount += 1
      pending.push(() => success({ statusCode: 200, data: { success: true, value: requestCount } }))
    },
  }

  const { callCloud } = loadCloud()

  const first = callCloud('inventoryList', { page: 1, pageSize: 20 })
  const second = callCloud('inventoryList', { page: 2, pageSize: 20 })

  assert.notStrictEqual(first, second)
  assert.equal(requestCount, 2)

  pending.forEach(resolve => resolve())
  await Promise.all([first, second])
})
