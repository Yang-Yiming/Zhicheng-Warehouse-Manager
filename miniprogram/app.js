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
    console.log('[Login] wx.login 开始')
    wx.login({
      success: (loginRes) => {
        console.log('[Login] wx.login 成功, code:', loginRes.code ? '已获取' : '无code')
        console.log('[Login] 调用云函数 userLogin...')
        wx.cloud.callFunction({ name: 'userLogin' })
          .then(res => {
            console.log('[Login] 云函数返回:', JSON.stringify(res.result))
            const { success, isNew, user } = res.result
            if (!success) {
              console.error('[Login] 云函数返回 success=false')
              this._showRetry()
              return
            }
            console.log('[Login] 登录成功, isNew:', isNew, 'displayName:', user.displayName)
            if (isNew || !user.displayName) {
              wx.navigateTo({ url: '/pages/profile-setup/index' })
            } else {
              this._setLoginReady(user)
            }
          })
          .catch(err => {
            console.error('[Login] 云函数调用失败:', err)
            console.error('[Login] errMsg:', err && err.errMsg)
            console.error('[Login] errCode:', err && err.errCode)
            this._showRetry()
          })
      },
      fail: (err) => {
        console.error('[Login] wx.login 失败:', err)
        console.error('[Login] errMsg:', err && err.errMsg)
        this._showRetry()
      },
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
