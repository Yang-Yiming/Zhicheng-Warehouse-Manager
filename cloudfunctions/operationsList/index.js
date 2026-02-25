// Cloud function: operationsList
// Returns paginated operations sorted by submitTime descending
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { page = 1, pageSize = 20 } = event
  const skip = (page - 1) * pageSize

  const col = db.collection('operations')
  const [{ total }, { data }] = await Promise.all([
    col.count(),
    col.orderBy('submitTime', 'desc').skip(skip).limit(pageSize).get()
  ])

  return { success: true, data, total, page, pageSize }
}
