const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const COLLECTION_NOT_FOUND_CODE = '-502005'

function getErrMessage(err) {
  return String((err && (err.errMsg || err.message)) || err || '')
}

function isCollectionNotFound(err) {
  const message = getErrMessage(err)
  return message.includes(COLLECTION_NOT_FOUND_CODE)
    || message.includes('collection not exists')
    || message.includes('does not exist')
    || message.includes('Db or Table not exist')
}

const COUNT_BATCH = 100

async function countAll() {
  let total = 0
  let skip = 0
  while (true) {
    const { data } = await db.collection('inventory').skip(skip).limit(COUNT_BATCH).get()
    total += data.length
    if (data.length < COUNT_BATCH) break
    skip += data.length
  }
  return total
}

exports.main = async (event = {}) => {
  const page = event.page || 1
  const pageSize = event.pageSize || 20
  const skip = (page - 1) * pageSize
  try {
    const [{ data }, total] = await Promise.all([
      db.collection('inventory').orderBy('itemId', 'asc').skip(skip).limit(pageSize).get(),
      countAll(),
    ])
    return { success: true, data, total }
  } catch (err) {
    const message = getErrMessage(err)
    const notFound = isCollectionNotFound(err)

    if (notFound) {
      try {
        await db.createCollection('inventory')
      } catch (_) { /* already exists */ }
      return { success: true, data: [] }
    }

    return { success: false, data: [], error: message || '读取库存失败' }
  }
}
