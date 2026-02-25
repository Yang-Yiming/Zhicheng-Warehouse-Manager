const { callCloud } = require('./utils/cloud')

App({
  globalData: {
    currentUser: null,
    loginReady: false,
    _loginCallbacks: [],
  },

  onLaunch() {
    wx.cloud.init({
      env: 'cloudbase-7g480302495d5794',
      traceUser: true,
    })
    this._doLogin()
  },

  _doLogin() {
    wx.login({
      success: () => {
        callCloud('userLogin')
          .then(result => {
            const { isNew, user } = result
            if (isNew || !user.displayName) {
              wx.navigateTo({ url: '/pages/profile-setup/index' })
            } else {
              this._setLoginReady(user)
            }
          })
          .catch(() => this._showRetry())
      },
      fail: () => this._showRetry(),
    })
  },

  _showRetry() {
    wx.showModal({
      title: '登录失败',
      content: '无法连接到服务器，请重试',
      showCancel: false,
      confirmText: '重试',
      success: () => this._doLogin(),
    })
  },

  _setLoginReady(user) {
    this.globalData.currentUser = user
    this.globalData.loginReady = true
    const cbs = this.globalData._loginCallbacks.splice(0)
    cbs.forEach(cb => cb(user))
  },

  onLoginReady(callback) {
    if (this.globalData.loginReady) {
      callback(this.globalData.currentUser)
    } else {
      this.globalData._loginCallbacks.push(callback)
    }
  },
})
