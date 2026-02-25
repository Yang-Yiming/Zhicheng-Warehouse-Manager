// Cloud DB helpers
const db = wx.cloud.database()

const collections = {
  operations: db.collection('operations'),
  inventory: db.collection('inventory'),
  config: db.collection('config'),
}

module.exports = collections
