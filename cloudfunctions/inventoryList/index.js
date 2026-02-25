const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  try {
    const { data } = await db.collection('inventory').orderBy('itemId', 'asc').get()
    return { success: true, data }
  } catch (err) {
    return { success: false, data: [], error: err.message }
  }
}
