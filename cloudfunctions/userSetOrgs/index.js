// Cloud function: userSetOrgs
// Update the organizations list for a user (self or proxy by admin+)
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const ADMIN_ROLES = ['admin', 'superadmin', 'chairman']

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return { success: false, error: '无法获取用户身份' }

    const { data: callerData } = await db.collection('users').where({ openid: OPENID }).get()
    const callerRole = callerData.length > 0 ? (callerData[0].role || 'unverified') : 'unverified'

    if (!ADMIN_ROLES.includes(callerRole)) {
      return { success: false, error: '权限不足，请联系管理员修改所属组织' }
    }

    const targetOpenid = event.targetOpenid || OPENID
    const organizations = Array.isArray(event.organizations) ? event.organizations : []

    await db.collection('users').where({ openid: targetOpenid }).update({
      data: { organizations, updatedAt: new Date().toISOString() },
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message || '更新失败' }
  }
}
