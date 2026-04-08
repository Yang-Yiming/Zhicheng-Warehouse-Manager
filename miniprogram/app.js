const { callCloud, setSessionToken, clearSessionToken } = require('./utils/cloud')

App({
  globalData: {
    currentUser: null,
    loginReady: false,
    _loginCallbacks: [],
    sessionToken: '',
  },

  onLaunch() {
    this._doLogin()
  },

  _doLogin() {
    wx.login({
      success: (res) => {
        if (!res.code) {
          this._showRetry('微信登录未返回有效 code')
          return
        }
        callCloud('userLogin', { code: res.code }, { skipAuth: true })
          .then(result => {
            const { isNew, user, sessionToken } = result
            this.globalData.currentUser = user
            this.globalData.sessionToken = sessionToken || ''
            setSessionToken(sessionToken || '')
            if (isNew || !user.displayName) {
              wx.navigateTo({ url: '/pages/profile-setup/index' })
            } else {
              this._setLoginReady(user)
            }
          })
          .catch((error) => {
            clearSessionToken()
            this._showRetry(error && error.message)
          })
      },
      fail: (error) => this._showRetry(error && error.errMsg),
    })
  },

  _showRetry(message) {
    const detail = String(message || '').trim()
    const content = detail
      ? `登录接口返回错误：${detail}`
      : '无法连接到服务器，请重试'
    wx.showModal({
      title: '登录失败',
      content,
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
