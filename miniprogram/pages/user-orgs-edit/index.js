const app = getApp()
const { callCloud } = require('../../utils/cloud')
const { showError, showSuccess } = require('../../utils/feedback')

Page({
  data: {
    targetOpenid: '',
    targetName: '',
    userOrgs: [],
    availableOrgs: [],
    allOrgs: [],
    saving: false,
  },

  onLoad(options) {
    const targetOpenid = decodeURIComponent(options.openid || '')
    const targetName = decodeURIComponent(options.name || '')
    this.setData({ targetOpenid, targetName })
    wx.setNavigationBarTitle({ title: `编辑组织 - ${targetName}` })
    this._loadData(targetOpenid)
  },

  _loadData(targetOpenid) {
    Promise.all([
      callCloud('configGet'),
      callCloud('userList', { roles: ['normal', 'admin'] }),
    ]).then(([configResult, usersResult]) => {
      const allOrgs = (configResult.data || {}).organizations || []
      const users = usersResult.data || []
      const target = users.find(u => u.openid === targetOpenid)
      const userOrgs = target ? (target.organizations || []) : []
      this.setData({
        allOrgs,
        userOrgs,
        availableOrgs: allOrgs.filter(o => !userOrgs.includes(o)),
      })
    }).catch(() => showError('加载失败'))
  },

  _updateAvailable() {
    const { allOrgs, userOrgs } = this.data
    this.setData({ availableOrgs: allOrgs.filter(o => !userOrgs.includes(o)) })
  },

  onAddOrg(e) {
    const org = this.data.availableOrgs[Number(e.detail.value)]
    if (!org) return
    const userOrgs = [...this.data.userOrgs, org]
    this.setData({ userOrgs })
    this._updateAvailable()
  },

  onRemoveOrg(e) {
    const idx = e.currentTarget.dataset.idx
    const userOrgs = this.data.userOrgs.filter((_, i) => i !== idx)
    this.setData({ userOrgs })
    this._updateAvailable()
  },

  onSave() {
    if (this.data.saving) return
    this.setData({ saving: true })
    callCloud('userSetOrgs', {
      targetOpenid: this.data.targetOpenid,
      organizations: this.data.userOrgs,
    }).then(() => {
      this.setData({ saving: false })
      showSuccess('保存成功')
      wx.navigateBack()
    }).catch(err => {
      this.setData({ saving: false })
      showError(err.message || '保存失败')
    })
  },
})
