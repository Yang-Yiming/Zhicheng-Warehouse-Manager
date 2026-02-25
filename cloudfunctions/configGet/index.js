// Cloud function: configGet
// Returns the config document (organizations + operators).
// Creates a default config if none exists.
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const DEFAULT_CONFIG = {
  _id: 'settings',
  organizations: [
    '学生会', '团委', '学生发展中心', '社区管理委员会',
    '"橙光"志愿服务队', '足球队器材存放', '篮球队器材存放',
    '其他体育器材存放', '备用储物箱'
  ],
  operators: []
}

exports.main = async () => {
  try {
    const { data } = await db.collection('config').doc('settings').get()
    return { success: true, data }
  } catch (e) {
    // Document doesn't exist yet — seed with defaults
    await db.collection('config').add({ data: DEFAULT_CONFIG })
    return { success: true, data: DEFAULT_CONFIG }
  }
}
