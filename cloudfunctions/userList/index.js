// Cloud function: userList
// Returns users filtered by role (admin+ only)
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const ADMIN_ROLES = ['admin', 'superadmin', 'chairman']

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return { success: false, error: '无法获取用户身份' }

    const { data: callerData } = await db.collection('users').where({ openid: OPENID }).get()
    const callerRole = callerData.length > 0 ? (callerData[0].role || 'unverified') : 'unverified'
    if (!ADMIN_ROLES.includes(callerRole)) {
      return { success: false, error: '权限不足' }
    }

    const roles = Array.isArray(event.roles) ? event.roles : []
    if (roles.length === 0) return { success: true, data: [] }

    const query = { role: _.in(roles), dismissed: _.neq(true) }
    const { data } = await db.collection('users').where(query).get()

    const result = data.map(u => ({
      openid: u.openid,
      displayName: u.displayName || '',
      role: u.role || 'unverified',
      organizations: Array.isArray(u.organizations) ? u.organizations : [],
    }))

    return { success: true, data: result }
  } catch (err) {
    return { success: false, error: err.message || '查询失败' }
  }
}
