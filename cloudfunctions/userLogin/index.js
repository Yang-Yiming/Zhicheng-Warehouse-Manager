// Cloud function: userLogin
// Lookup-or-create user profile by openid
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function formatUser(user) {
  return {
    openid: user.openid,
    displayName: String(user.displayName || ''),
    organizations: Array.isArray(user.organizations) ? user.organizations : [],
    role: user.role || 'unverified',
  }
}

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return { success: false, error: '无法获取用户身份' }

    const col = db.collection('users')
    let existing = []

    try {
      const { data } = await col.where({ openid: OPENID }).get()
      existing = data
    } catch (e) {
      if (!String(e).includes('-502005')) throw e
    }

    if (existing.length > 0) {
      const user = existing[0]
      return { success: true, isNew: !user.displayName, user: formatUser(user) }
    }

    const now = new Date().toISOString()
    try {
      await col.add({ data: { openid: OPENID, displayName: '', role: 'unverified', createdAt: now, updatedAt: now } })
      return { success: true, isNew: true, user: { openid: OPENID, displayName: '', role: 'unverified' } }
    } catch (_) {
      const { data: retryData } = await col.where({ openid: OPENID }).get()
      if (retryData.length > 0) {
        const user = retryData[0]
        return { success: true, isNew: !user.displayName, user: formatUser(user) }
      }
      throw _
    }
  } catch (err) {
    return { success: false, error: err.message || '登录失败' }
  }
}
