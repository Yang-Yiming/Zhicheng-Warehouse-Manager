// Cloud function: configUpdate
// Updates organizations and/or operators in the config document
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
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
    // Doc doesn't exist yet — create it
    await db.collection('config').add({ data: { _id: 'settings', organizations: [], operators: [], ...update } })
  }

  return { success: true }
}
