const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const PAGE_SIZE = 100

async function fetchAllInventory() {
  let all = []
  let skip = 0

  while (true) {
    const { data } = await db.collection('inventory')
      .orderBy('itemId', 'asc')
      .skip(skip)
      .limit(PAGE_SIZE)
      .get()

    all = all.concat(data)
    if (data.length < PAGE_SIZE) break
    skip += data.length
  }

  return all
}

exports.main = async () => {
  try {
    const data = await fetchAllInventory()
    return { success: true, data }
  } catch (err) {
    const message = String((err && err.message) || '')
    const notFound = message.includes('collection') && message.includes('does not exist')

    if (notFound) {
      try {
        await db.createCollection('inventory')
      } catch (_) { /* already exists */ }
      return { success: true, data: [] }
    }

    return { success: false, data: [], error: message || '读取库存失败' }
  }
}
