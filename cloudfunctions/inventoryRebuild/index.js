// Cloud function: inventoryRebuild
// Replays all operations to recompute inventory from scratch
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const PAGE_SIZE = 100

async function fetchAllByOrder(collectionName, orderField, order = 'asc') {
  let all = []
  let skip = 0

  while (true) {
    const { data } = await db.collection(collectionName)
      .orderBy(orderField, order)
      .skip(skip)
      .limit(PAGE_SIZE)
      .get()

    all = all.concat(data)
    if (data.length < PAGE_SIZE) break
    skip += data.length
  }

  return all
}

async function fetchAll(collectionName) {
  let all = []
  let skip = 0

  while (true) {
    const { data } = await db.collection(collectionName)
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
  const ops = await fetchAllByOrder('operations', 'operationTime', 'asc')

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
  const existing = await fetchAll('inventory')
  await Promise.all(existing.map(doc => invCol.doc(doc._id).remove()))
  await Promise.all(validEntries.map(doc => invCol.add({ data: doc })))

  return { success: true, rebuilt: validEntries.length }
}
