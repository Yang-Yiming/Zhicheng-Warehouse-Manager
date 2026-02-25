const app = getApp()
const { callCloud } = require('../../utils/cloud')
const { showError } = require('../../utils/feedback')

Page({
  data: { displayName: '', loading: false, error: '' },

  onBackPress() { return true },

  onInput(e) {
    this.setData({ displayName: e.detail.value, error: '' })
  },

  onConfirm() {
    const name = this.data.displayName.trim()
    if (!name) { this.setData({ error: '昵称不能为空' }); return }
    if (name.length > 20) { this.setData({ error: '昵称不能超过20个字符' }); return }

    this.setData({ loading: true, error: '' })
    callCloud('userSetProfile', { displayName: name }).then(() => {
      const user = { ...app.globalData.currentUser, displayName: name, openid: (app.globalData.currentUser || {}).openid || '' }
      app._setLoginReady(user)
      wx.switchTab({ url: '/pages/operations/index' })
    }).catch(err => {
      const message = err.message || '网络错误，请重试'
      this.setData({ loading: false, error: message })
      showError(message)
    })
  },
})
