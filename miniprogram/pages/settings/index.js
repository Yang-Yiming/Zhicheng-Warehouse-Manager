const app = getApp()

Page({
  data: {
    displayName: '',
    editingName: false,
    nameInput: '',
    config: { organizations: [], operators: [] },
    newOrg: '',
    newOperator: '',
  },

  onLoad() {
    app.onLoginReady(user => this.setData({ displayName: user.displayName }))
    this._loadConfig()
  },

  _loadConfig() {
    wx.cloud.callFunction({ name: 'configGet' }).then(res => {
      if (res.result.success) this.setData({ config: res.result.data })
    })
  },

  // --- Display name ---
  onEditName() { this.setData({ editingName: true, nameInput: this.data.displayName }) },
  onNameInput(e) { this.setData({ nameInput: e.detail.value }) },
  onCancelEdit() { this.setData({ editingName: false }) },

  onSaveName() {
    const name = this.data.nameInput.trim()
    if (!name) { wx.showToast({ title: '昵称不能为空', icon: 'none' }); return }
    if (name.length > 20) { wx.showToast({ title: '昵称不能超过20个字符', icon: 'none' }); return }
    wx.cloud.callFunction({ name: 'userSetProfile', data: { displayName: name } }).then(res => {
      if (!res.result.success) { wx.showToast({ title: res.result.error || '保存失败', icon: 'none' }); return }
      app.globalData.currentUser.displayName = name
      this.setData({ displayName: name, editingName: false })
      wx.showToast({ title: '保存成功', icon: 'success' })
    }).catch(() => wx.showToast({ title: '网络错误', icon: 'none' }))
  },

  // --- Organizations ---
  onNewOrgInput(e) { this.setData({ newOrg: e.detail.value }) },

  onAddOrg() {
    const name = this.data.newOrg.trim()
    if (!name) return
    if (this.data.config.organizations.includes(name)) {
      wx.showToast({ title: '已存在', icon: 'none' }); return
    }
    const organizations = [...this.data.config.organizations, name]
    this._saveConfig({ organizations }, () => this.setData({ 'config.organizations': organizations, newOrg: '' }))
  },

  onRemoveOrg(e) {
    const idx = e.currentTarget.dataset.idx
    const organizations = this.data.config.organizations.filter((_, i) => i !== idx)
    this._saveConfig({ organizations }, () => this.setData({ 'config.organizations': organizations }))
  },

  // --- Operators ---
  onNewOperatorInput(e) { this.setData({ newOperator: e.detail.value }) },

  onAddOperator() {
    const name = this.data.newOperator.trim()
    if (!name) return
    if (this.data.config.operators.includes(name)) {
      wx.showToast({ title: '已存在', icon: 'none' }); return
    }
    const operators = [...this.data.config.operators, name]
    this._saveConfig({ operators }, () => this.setData({ 'config.operators': operators, newOperator: '' }))
  },

  onRemoveOperator(e) {
    const idx = e.currentTarget.dataset.idx
    const operators = this.data.config.operators.filter((_, i) => i !== idx)
    this._saveConfig({ operators }, () => this.setData({ 'config.operators': operators }))
  },

  _saveConfig(patch, onSuccess) {
    wx.cloud.callFunction({ name: 'configUpdate', data: patch }).then(res => {
      if (!res.result.success) { wx.showToast({ title: '保存失败', icon: 'none' }); return }
      onSuccess()
    }).catch(() => wx.showToast({ title: '网络错误', icon: 'none' }))
  },
})
