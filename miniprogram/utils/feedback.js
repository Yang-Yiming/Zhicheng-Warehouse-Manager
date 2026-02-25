function showError(message, options = {}) {
  const { modal = false, title = '操作失败' } = options
  const content = message || '网络错误'

  if (modal) {
    wx.showModal({ title, content, showCancel: false })
    return
  }

  wx.showToast({ title: content, icon: 'none' })
}

function showSuccess(message = '操作成功') {
  wx.showToast({ title: message, icon: 'success' })
}

module.exports = { showError, showSuccess }
