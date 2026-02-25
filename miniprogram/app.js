// TODO: Replace 'your-env-id' with your actual cloud environment ID
// Create one at: WeChat DevTools → 云开发 → 开通 or mp.weixin.qq.com → 云开发
App({
  onLaunch() {
    wx.cloud.init({
      env: 'cloudbase-7g480302495d5794',
      traceUser: true,
    })
  },
})
