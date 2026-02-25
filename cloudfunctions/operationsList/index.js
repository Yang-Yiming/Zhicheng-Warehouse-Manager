// Cloud function: operationsList
// Returns paginated operations sorted by submitTime descending
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

async function getCallerRole(openid) {
  const { data } = await db.collection('users').where({ openid }).get()
  if (data.length === 0) return 'unverified'
  return data[0].role || 'unverified'
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return { success: false, data: [], total: 0, error: '无法获取用户身份' }
    const role = await getCallerRole(OPENID)
    if (role === 'unverified') {
      return { success: false, data: [], total: 0, error: '权限不足，请联系管理员授权' }
    }

    const { page = 1, pageSize = 20 } = event
    const skip = (page - 1) * pageSize

    const col = db.collection('operations')
    const [{ total }, { data }] = await Promise.all([
      col.count(),
      col.orderBy('submitTime', 'desc').skip(skip).limit(pageSize).get()
    ])

    return { success: true, data, total, page, pageSize }
  } catch (err) {
    const message = getErrMessage(err)
    const notFound = isCollectionNotFound(err)

    if (notFound) {
      try {
        await db.createCollection('operations')
      } catch (_) { /* already exists */ }
      return { success: true, data: [], total: 0, page: event.page || 1, pageSize: event.pageSize || 20 }
    }

    return { success: false, data: [], total: 0, error: message || '读取操作记录失败' }
  }
}
