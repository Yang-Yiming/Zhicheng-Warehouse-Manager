// Cloud DB helpers
const db = wx.cloud.database()
const _ = db.command

const collections = {
  operations: db.collection('operations'),
  inventory: db.collection('inventory'),
  config: db.collection('config'),
}

// Paginated operations list, newest first
function getOperations(page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize
  return collections.operations
    .orderBy('submitTime', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()
}

// Full inventory list sorted by itemId
function getInventory() {
  return collections.inventory
    .orderBy('itemId', 'asc')
    .get()
}

// Config document
function getConfig() {
  return collections.config.doc('settings').get()
}

module.exports = { ...collections, _, getOperations, getInventory, getConfig }
