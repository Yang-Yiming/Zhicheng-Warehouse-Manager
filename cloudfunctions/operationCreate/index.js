// Cloud function: operationCreate
// Validates and writes a new operation record, then updates inventory
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const VALID_OPERATIONS = ['入库', '出库', '物资增添', '部分出库']
const COLLECTION_NOT_FOUND_CODE = '-502005'

function getErrMessage(err) {
  return String((err && (err.errMsg || err.message)) || err || '')
}

function isCollectionNotFound(err) {
  const message = getErrMessage(err)
  return message.includes(COLLECTION_NOT_FOUND_CODE)
    || (message.includes('collection') && message.includes('does not exist'))
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name)
  } catch (e) {
    if (!isCollectionNotFound(e) && !getErrMessage(e).includes('already exists')) {
      // ignore create race and non-fatal duplicate errors
    }
  }
}

exports.main = async (event) => {
  try {
    await Promise.all(['users', 'inventory', 'operations'].map(ensureCollection))

    const { OPENID } = cloud.getWXContext()

    // Resolve operator from server-side user profile
    const { data: users } = await db.collection('users').where({ openid: OPENID }).get()
    if (users.length === 0 || !users[0].displayName) {
      return { success: false, error: '请先完善个人信息' }
    }
    const user = users[0]
    if ((user.role || 'unverified') === 'unverified') {
      return { success: false, error: '权限不足，请联系管理员授权' }
    }
    const operator = user.displayName

    const { itemId, itemName, operation, organization, quantity, operationTime } = event

    // Required field validation
    const missing = ['itemId', 'itemName', 'operation', 'organization', 'quantity', 'operationTime']
      .filter(f => event[f] === undefined || event[f] === null || event[f] === '')
    if (missing.length > 0) {
      return { success: false, error: `缺少必填字段: ${missing.join(', ')}` }
    }

    if (!VALID_OPERATIONS.includes(operation)) {
      return { success: false, error: `无效的操作类型: ${operation}` }
    }

    const qty = Number(quantity)
    if (!Number.isInteger(qty) || qty <= 0) {
      return { success: false, error: '数量必须为正整数' }
    }

    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(operationTime)) {
      return { success: false, error: '时间格式必须为 YYYY-MM-DD HH:MM' }
    }

    const invCol = db.collection('inventory')
    const { data: existing } = await invCol.where({ itemId, organization }).get()

    // Inbound: reject duplicate itemId within same organization
    if (operation === '入库' && existing.length > 0) {
      return { success: false, error: `物资 ${itemId} 已存在，请使用"物资增添"操作` }
    }

    // Non-inbound: item must exist
    if (operation !== '入库' && existing.length === 0) {
      return { success: false, error: `物资 ${itemId} 不存在` }
    }

    // Partial outbound: cannot exceed current quantity
    if (operation === '部分出库' && qty > existing[0].quantity) {
      return { success: false, error: `出库数量 (${qty}) 超过当前库存 (${existing[0].quantity})` }
    }

    const submitTime = new Date().toISOString()
    const opRecord = { submitTime, itemId, itemName, operation, organization, quantity: qty, operationTime, operator, submitter: operator, operatorOpenid: OPENID }

    await db.collection('operations').add({ data: opRecord })

    const invUpdate = { itemName, organization, lastOperation: operation, lastOperator: operator, lastOperationTime: operationTime }

    if (existing.length === 0) {
      // New item (入库)
      await invCol.add({ data: { itemId, quantity: qty, ...invUpdate, notes: '' } })
    } else {
      const current = existing[0]
      let newQty = current.quantity
      if (operation === '物资增添') newQty += qty
      else if (operation === '出库') newQty = 0
      else if (operation === '部分出库') newQty -= qty

      if (newQty <= 0) {
        await invCol.doc(current._id).remove()
      } else {
        await invCol.doc(current._id).update({ data: { quantity: newQty, ...invUpdate } })
      }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: getErrMessage(err) || '提交失败' }
  }
}
