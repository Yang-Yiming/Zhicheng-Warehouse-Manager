const app = getApp()

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
    wx.cloud.callFunction({ name: 'userSetProfile', data: { displayName: name } }).then(res => {
      if (!res.result.success) {
        this.setData({ loading: false, error: res.result.error || '保存失败' })
        return
      }
      const user = { ...app.globalData.currentUser, displayName: name, openid: (app.globalData.currentUser || {}).openid || '' }
      app._setLoginReady(user)
      wx.switchTab({ url: '/pages/operations/index' })
    }).catch(() => {
      this.setData({ loading: false, error: '网络错误，请重试' })
    })
  },
})
