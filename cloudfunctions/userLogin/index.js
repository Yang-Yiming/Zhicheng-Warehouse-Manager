// Cloud function: userLogin
// Lookup-or-create user profile by openid
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  const col = db.collection('users')

  let existing = []
  try {
    const { data } = await col.where({ openid: OPENID }).get()
    existing = data
  } catch (e) {
    // collection may not exist yet on first run — proceed to create user
    if (!String(e).includes('-502005')) throw e
  }

  if (existing.length > 0) {
    const user = existing[0]
    return { success: true, isNew: !user.displayName, user: { openid: user.openid, displayName: user.displayName || '' } }
  }

  const now = new Date().toISOString()
  await col.add({ data: { openid: OPENID, displayName: '', createdAt: now, updatedAt: now } })
  return { success: true, isNew: true, user: { openid: OPENID, displayName: '' } }
}
