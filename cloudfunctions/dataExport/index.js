// Cloud function: dataExport
// Export all operations and inventory for authenticated users
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const PAGE_SIZE = 100

async function ensureCollection(name) {
  try { await db.createCollection(name) } catch (_) { /* already exists */ }
}

async function fetchAll(collectionName, orderField, order) {
  let all = []
  let skip = 0
  const col = db.collection(collectionName)

  while (true) {
    let query = col.skip(skip).limit(PAGE_SIZE)
    if (orderField) query = query.orderBy(orderField, order || 'asc')
    const { data } = await query.get()
    all = all.concat(data)
    if (data.length < PAGE_SIZE) break
    skip += data.length
  }
  return all
}

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return { success: false, error: '无法获取用户身份' }

    // Permission: must be verified user
    const { data: userData } = await db.collection('users').where({ openid: OPENID }).get()
    if (userData.length === 0) return { success: false, error: '用户不存在' }
    const role = userData[0].role || 'unverified'
    if (role === 'unverified') return { success: false, error: '未认证用户无法导出数据' }

    await Promise.all(['operations', 'inventory'].map(ensureCollection))

    const [operations, inventory] = await Promise.all([
      fetchAll('operations', 'submitTime', 'desc'),
      fetchAll('inventory', 'itemId', 'asc'),
    ])

    // Strip _id fields
    const cleanOps = operations.map(({ _id, ...rest }) => rest)
    const cleanInv = inventory.map(({ _id, ...rest }) => rest)

    return { success: true, operations: cleanOps, inventory: cleanInv }
  } catch (err) {
    return { success: false, error: err.message || '导出失败' }
  }
}
