// Cloud function: userLogin
// Lookup-or-create user profile by openid
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  const col = db.collection('users')
  const { data } = await col.where({ openid: OPENID }).get()

  if (data.length > 0) {
    const user = data[0]
    return { success: true, isNew: !user.displayName, user: { openid: user.openid, displayName: user.displayName || '' } }
  }

  const now = new Date().toISOString()
  await col.add({ data: { openid: OPENID, displayName: '', createdAt: now, updatedAt: now } })
  return { success: true, isNew: true, user: { openid: OPENID, displayName: '' } }
}
