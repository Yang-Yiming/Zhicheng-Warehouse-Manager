const app = getApp()
const { callCloud } = require('../../utils/cloud')
const { showError, showSuccess } = require('../../utils/feedback')

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
    callCloud('configGet')
      .then(result => {
        const config = result.data || {}
        this.setData({
          config: {
            organizations: Array.isArray(config.organizations) ? config.organizations : [],
            operators: Array.isArray(config.operators) ? config.operators : [],
          },
        })
      })
      .catch(() => showError('配置加载失败'))
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

  // --- Organizations ---
  onNewOrgInput(e) { this.setData({ newOrg: e.detail.value }) },

  onAddOrg() {
    const name = this.data.newOrg.trim()
    if (!name) return
    if (this.data.config.organizations.includes(name)) {
      showError('已存在'); return
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
      showError('已存在'); return
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
    callCloud('configUpdate', patch)
      .then(onSuccess)
      .catch(err => showError(err.message || '网络错误'))
  },
})
