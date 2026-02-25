// Cloud function: inventoryRebuild
// Replays all operations to recompute inventory from scratch
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const { data: ops } = await db.collection('operations')
    .orderBy('operationTime', 'asc')
    .get()

  const state = {} // key: `${itemId}::${organization}`

  for (const op of ops) {
    const key = `${op.itemId}::${op.organization}`
    if (!state[key]) {
      state[key] = { itemId: op.itemId, itemName: op.itemName, organization: op.organization, quantity: 0, notes: '' }
    }
    const entry = state[key]
    if (op.operation === '入库' || op.operation === '物资增添') entry.quantity += op.quantity
    else if (op.operation === '出库') entry.quantity = 0
    else if (op.operation === '部分出库') entry.quantity -= op.quantity
    entry.lastOperation = op.operation
    entry.lastOperator = op.operator
    entry.lastOperationTime = op.operationTime
  }

  // Only keep items with quantity > 0
  const validEntries = Object.values(state).filter(e => e.quantity > 0)

  const invCol = db.collection('inventory')
  const { data: existing } = await invCol.get()
  await Promise.all(existing.map(doc => invCol.doc(doc._id).remove()))
  await Promise.all(validEntries.map(doc => invCol.add({ data: doc })))

  return { success: true, rebuilt: validEntries.length }
}
