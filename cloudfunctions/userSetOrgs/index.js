// Cloud function: userSetOrgs
// Update the organizations list for the logged-in user
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return { success: false, error: '无法获取用户身份' }

    const organizations = Array.isArray(event.organizations) ? event.organizations : []
    await db.collection('users').where({ openid: OPENID }).update({
      data: { organizations, updatedAt: new Date().toISOString() },
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message || '更新失败' }
  }
}
