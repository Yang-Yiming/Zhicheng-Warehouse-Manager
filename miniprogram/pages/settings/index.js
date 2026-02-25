const app = getApp()
const { callCloud } = require('../../utils/cloud')
const { showError, showSuccess } = require('../../utils/feedback')

Page({
  data: {
    displayName: '',
    editingName: false,
    nameInput: '',
    config: { organizations: [] },
    newOrg: '',
    userOrgs: [],
    availableOrgs: [],
    editingOrgs: false,
  },

  onLoad() {
    app.onLoginReady(user => {
      const userOrgs = Array.isArray(user.organizations) ? user.organizations : []
      this.setData({ displayName: user.displayName, userOrgs })
      this._updateAvailable()
    })
    this._loadConfig()
  },

  _loadConfig() {
    callCloud('configGet')
      .then(result => {
        const config = result.data || {}
        this.setData({
          config: {
            organizations: Array.isArray(config.organizations) ? config.organizations : [],
          },
        })
        this._updateAvailable()
      })
      .catch(() => showError('配置加载失败'))
  },

  _updateAvailable() {
    const all = this.data.config.organizations
    const mine = this.data.userOrgs
    this.setData({ availableOrgs: all.filter(o => !mine.includes(o)) })
  },

  // --- Display name ---
  onEditName() { this.setData({ editingName: true, nameInput: this.data.displayName }) },
  onNameInput(e) { this.setData({ nameInput: e.detail.value }) },
  onCancelEdit() { this.setData({ editingName: false }) },

  onSaveName() {
    const name = this.data.nameInput.trim()
    if (!name) { showError('昵称不能为空'); return }
    if (name.length > 20) { showError('昵称不能超过20个字符'); return }
    callCloud('userSetProfile', { displayName: name }).then(() => {
      app.globalData.currentUser.displayName = name
      this.setData({ displayName: name, editingName: false })
      showSuccess('保存成功')
    }).catch(err => showError(err.message || '网络错误'))
  },

  // --- User organizations ---
  onAddUserOrg(e) {
    const org = this.data.availableOrgs[Number(e.detail.value)]
    if (!org) return
    const userOrgs = [...this.data.userOrgs, org]
    callCloud('userSetOrgs', { organizations: userOrgs }).then(() => {
      app.globalData.currentUser.organizations = userOrgs
      this.setData({ userOrgs })
      this._updateAvailable()
    }).catch(err => showError(err.message || '网络错误'))
  },

  onRemoveUserOrg(e) {
    const idx = e.currentTarget.dataset.idx
    const userOrgs = this.data.userOrgs.filter((_, i) => i !== idx)
    callCloud('userSetOrgs', { organizations: userOrgs }).then(() => {
      app.globalData.currentUser.organizations = userOrgs
      this.setData({ userOrgs })
      this._updateAvailable()
    }).catch(err => showError(err.message || '网络错误'))
  },

  onEditOrgs() { this.setData({ editingOrgs: true }) },
  onDoneOrgs() { this.setData({ editingOrgs: false }) },

  // --- All organizations ---
  onNewOrgInput(e) { this.setData({ newOrg: e.detail.value }) },

  onAddOrg() {
    const name = this.data.newOrg.trim()
    if (!name) return
    if (this.data.config.organizations.includes(name)) {
      showError('已存在'); return
    }
    const organizations = [...this.data.config.organizations, name]
    this._saveConfig({ organizations }, () => {
      this.setData({ 'config.organizations': organizations, newOrg: '' })
      this._updateAvailable()
    })
  },

  onRemoveOrg(e) {
    const idx = e.currentTarget.dataset.idx
    const organizations = this.data.config.organizations.filter((_, i) => i !== idx)
    this._saveConfig({ organizations }, () => {
      this.setData({ 'config.organizations': organizations })
      this._updateAvailable()
    })
  },

  _saveConfig(patch, onSuccess) {
    callCloud('configUpdate', patch)
      .then(onSuccess)
      .catch(err => showError(err.message || '网络错误'))
  },
})
