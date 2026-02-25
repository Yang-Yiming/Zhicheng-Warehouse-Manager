// Cloud function: chairmanTransfer
// Transfer chairman role to an admin user
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return { success: false, error: '无法获取用户身份' }

    const { targetOpenid } = event
    if (!targetOpenid) return { success: false, error: '参数缺失' }
    if (targetOpenid === OPENID) return { success: false, error: '不能转让给自己' }

    const { data: callerData } = await db.collection('users').where({ openid: OPENID }).get()
    const callerRole = callerData.length > 0 ? (callerData[0].role || 'unverified') : 'unverified'
    if (callerRole !== 'chairman') return { success: false, error: '只有主席可以转让主席身份' }

    const { data: targetData } = await db.collection('users').where({ openid: targetOpenid }).get()
    if (targetData.length === 0) return { success: false, error: '目标用户不存在' }
    const targetRole = targetData[0].role || 'unverified'
    if (targetRole !== 'admin') return { success: false, error: '只能将主席身份转让给管理员' }

    const now = new Date().toISOString()
    await Promise.all([
      db.collection('users').where({ openid: targetOpenid }).update({ data: { role: 'chairman', updatedAt: now } }),
      db.collection('users').where({ openid: OPENID }).update({ data: { role: 'admin', updatedAt: now } }),
    ])
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message || '操作失败' }
  }
}
