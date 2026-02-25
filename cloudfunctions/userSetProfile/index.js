// Cloud function: userSetProfile
// Save display name for the logged-in user (openid from server context, never client)
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const MAX_DISPLAY_NAME_LEN = 20

function normalizeDisplayName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

exports.main = async (event = {}) => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return { success: false, error: '无法获取用户身份' }

    const displayName = normalizeDisplayName(event.displayName)
    if (!displayName) return { success: false, error: '昵称不能为空' }
    if (displayName.length > MAX_DISPLAY_NAME_LEN) return { success: false, error: `昵称不能超过${MAX_DISPLAY_NAME_LEN}个字符` }

    const now = new Date().toISOString()
    const col = db.collection('users')
    const { data: users } = await col.where({ openid: OPENID }).get()

    if (users.length > 0) {
      await col.doc(users[0]._id).update({ data: { displayName, updatedAt: now } })
    } else {
      await col.add({ data: { openid: OPENID, displayName, createdAt: now, updatedAt: now } })
    }

    return { success: true, displayName }
  } catch (err) {
    return { success: false, error: err.message || '保存失败' }
  }
}
