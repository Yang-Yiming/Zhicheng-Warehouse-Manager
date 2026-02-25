// Cloud function: configGet
// Returns the config document (organizations + operators).
// Creates a default config if none exists.
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const DEFAULT_CONFIG = {
  organizations: [
    '学生会', '团委', '学生发展中心', '社区管理委员会',
    '"橙光"志愿服务队', '足球队器材存放', '篮球队器材存放',
    '其他体育器材存放', '备用储物箱'
  ],
  operators: []
}

function sanitizeStringArray(arr) {
  const seen = new Set()
  const out = []

  ;(arr || []).forEach(item => {
    const text = String(item || '').trim()
    if (!text || seen.has(text)) return
    seen.add(text)
    out.push(text)
  })

  return out
}

function normalizeConfig(data) {
  return {
    organizations: sanitizeStringArray(data && data.organizations),
    operators: sanitizeStringArray(data && data.operators),
  }
}

exports.main = async () => {
  try {
    const { data } = await db.collection('config').doc('settings').get()
    const normalized = normalizeConfig(data)

    if (
      JSON.stringify(normalized.organizations) !== JSON.stringify(data.organizations || []) ||
      JSON.stringify(normalized.operators) !== JSON.stringify(data.operators || [])
    ) {
      await db.collection('config').doc('settings').set({ data: normalized })
    }

    return { success: true, data: normalized }
  } catch (e) {
    try {
      try { await db.createCollection('config') } catch (_) { /* already exists */ }
      await db.collection('config').doc('settings').set({ data: DEFAULT_CONFIG })
      return { success: true, data: DEFAULT_CONFIG }
    } catch (err) {
      return { success: false, error: err.message || '读取配置失败', data: DEFAULT_CONFIG }
    }
  }
}
