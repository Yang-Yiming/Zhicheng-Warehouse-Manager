// Cloud function: operationCreate
// Writes a new operation record and updates inventory accordingly
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { itemId, itemName, operation, organization, quantity, operationTime, operator, submitter } = event
  const submitTime = new Date().toISOString()

  const opRecord = { submitTime, itemId, itemName, operation, organization, quantity, operationTime, operator, submitter }

  // Write operation record
  await db.collection('operations').add({ data: opRecord })

  // Update inventory
  const invCol = db.collection('inventory')
  const existing = await invCol.where({ itemId, organization }).get()

  const invUpdate = {
    itemName,
    organization,
    lastOperation: operation,
    lastOperator: operator,
    lastOperationTime: operationTime,
  }

  if (existing.data.length === 0) {
    await invCol.add({ data: { itemId, quantity, ...invUpdate, notes: '' } })
  } else {
    const current = existing.data[0]
    let newQty = current.quantity
    if (operation === '入库' || operation === '补充') newQty += quantity
    else if (operation === '出库' || operation === '部分出库') newQty -= quantity
    await invCol.doc(current._id).update({ data: { quantity: newQty, ...invUpdate } })
  }

  return { success: true }
}
