// Cloud function: configUpdate
// Updates organizations and/or operators in the config document
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const ADMIN_ROLES = ['admin', 'superadmin', 'chairman']

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { success: false, error: '无法获取用户身份' }

  const { data: users } = await db.collection('users').where({ openid: OPENID }).get()
  const role = users.length > 0 ? (users[0].role || 'unverified') : 'unverified'
  if (!ADMIN_ROLES.includes(role)) {
    return { success: false, error: '权限不足' }
  }

  const { organizations, operators } = event
  const update = {}
  if (Array.isArray(organizations)) update.organizations = organizations
  if (Array.isArray(operators)) update.operators = operators

  if (Object.keys(update).length === 0) {
    return { success: false, error: '没有要更新的字段' }
  }

  try {
    await db.collection('config').doc('settings').update({ data: update })
  } catch (e) {
    await db.collection('config').doc('settings').set({
      data: { organizations: [], operators: [], ...update }
    })
  }

  return { success: true }
}
