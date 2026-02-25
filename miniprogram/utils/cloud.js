function callCloud(name, data = {}) {
  return wx.cloud.callFunction({ name, data }).then(res => {
    const result = (res && res.result) || {}
    if (result.success === false) {
      const err = new Error(result.error || '请求失败')
      err.result = result
      throw err
    }
    return result
  })
}

module.exports = { callCloud }
