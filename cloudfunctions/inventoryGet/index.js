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

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { success: false, found: false, error: '无法获取用户身份' }

  try {
    const role = await getCallerRole(OPENID)
    if (role === 'unverified') {
      return { success: false, found: false, error: '权限不足，请联系管理员授权' }
    }

    const itemId = String(event.itemId || '').trim()
    const organization = String(event.organization || '').trim()

    if (!itemId) {
      return { success: true, found: false, data: null }
    }

    const query = organization ? { itemId, organization } : { itemId }
    const { data } = await db.collection('inventory').where(query).limit(1).get()

    if (data.length === 0) {
      return { success: true, found: false, data: null }
    }

    const item = data[0]
    return {
      success: true,
      found: true,
      data: {
        itemId: item.itemId,
        itemName: item.itemName,
        organization: item.organization,
        quantity: item.quantity,
      },
    }
  } catch (err) {
    if (isCollectionNotFound(err)) {
      try {
        await db.createCollection('inventory')
      } catch (_) { /* ignore race */ }
      return { success: true, found: false, data: null }
    }

    return { success: false, found: false, error: getErrMessage(err) || '查询库存失败' }
  }
}
