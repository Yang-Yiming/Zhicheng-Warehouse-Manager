// Cloud function: userSetProfile
// Save display name for the logged-in user (openid from server context, never client)
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const displayName = (event.displayName || '').trim()

  if (!displayName) return { success: false, error: '昵称不能为空' }
  if (displayName.length > 20) return { success: false, error: '昵称不能超过20个字符' }

  const now = new Date().toISOString()
  await db.collection('users').where({ openid: OPENID }).update({ data: { displayName, updatedAt: now } })
  return { success: true, displayName }
}
