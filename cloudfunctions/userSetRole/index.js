// Cloud function: userSetRole
// Change a user's role (with permission checks)
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const ADMIN_ROLES = ['admin', 'superadmin', 'chairman']

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return { success: false, error: '无法获取用户身份' }

    const { targetOpenid, newRole } = event
    if (!targetOpenid || !newRole) return { success: false, error: '参数缺失' }
    if (targetOpenid === OPENID) return { success: false, error: '不能修改自己的角色' }

    const { data: callerData } = await db.collection('users').where({ openid: OPENID }).get()
    const callerRole = callerData.length > 0 ? (callerData[0].role || 'unverified') : 'unverified'
    if (!ADMIN_ROLES.includes(callerRole)) return { success: false, error: '权限不足' }

    const { data: targetData } = await db.collection('users').where({ openid: targetOpenid }).get()
    if (targetData.length === 0) return { success: false, error: '用户不存在' }
    const targetRole = targetData[0].role || 'unverified'

    if (targetRole === 'superadmin') return { success: false, error: '不能修改超管的角色' }

    // dismissed: set dismissed flag, don't change role
    if (newRole === 'dismissed') {
      if (targetRole !== 'unverified') return { success: false, error: '只能忽略未认证用户' }
      await db.collection('users').where({ openid: targetOpenid }).update({
        data: { dismissed: true, updatedAt: new Date().toISOString() }
      })
      return { success: true }
    }

    // admin/superadmin: can only approve (unverified→normal) or dismiss
    if (callerRole === 'admin' || callerRole === 'superadmin') {
      if (!(targetRole === 'unverified' && newRole === 'normal')) {
        return { success: false, error: '权限不足，只能审批未认证用户' }
      }
    }

    // chairman: can also promote/demote admin
    if (callerRole === 'chairman') {
      const allowed = (
        (targetRole === 'unverified' && newRole === 'normal') ||
        (targetRole === 'normal' && newRole === 'admin') ||
        (targetRole === 'admin' && newRole === 'normal')
      )
      if (!allowed) return { success: false, error: '不支持该角色变更' }
    }

    await db.collection('users').where({ openid: targetOpenid }).update({
      data: { role: newRole, dismissed: false, updatedAt: new Date().toISOString() }
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message || '操作失败' }
  }
}
