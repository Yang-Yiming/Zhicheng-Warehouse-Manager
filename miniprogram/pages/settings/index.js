const app = getApp()
const { callCloud } = require('../../utils/cloud')
const { showError, showSuccess } = require('../../utils/feedback')

const ROLE_LABELS = {
  unverified: '未认证',
  normal: '普通',
  admin: '管理员',
  superadmin: '牛马站长',
  chairman: '主席',
}

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
    role: 'unverified',
    roleLabel: '未认证',
    isAdmin: false,
    isChairman: false,
    allMembers: [],
    unverifiedUsers: [],
  },

  onLoad() {
    app.onLoginReady(user => {
      const role = user.role || 'unverified'
      const userOrgs = Array.isArray(user.organizations) ? user.organizations : []
      const isAdmin = ['admin', 'superadmin', 'chairman'].includes(role)
      const isChairman = role === 'chairman'
      this.setData({
        displayName: user.displayName,
        userOrgs,
        role,
        roleLabel: ROLE_LABELS[role] || role,
        isAdmin,
        isChairman,
      })
      this._updateAvailable()
      if (role !== 'unverified') this._loadUsers()
    })
    this._loadConfig()
  },

  onShow() {
    if (this.data.role !== 'unverified') this._loadUsers()
  },

  _loadConfig() {
    callCloud('configGet')
      .then(result => {
        const config = result.data || {}
        this.setData({
          config: { organizations: Array.isArray(config.organizations) ? config.organizations : [] },
        })
        this._updateAvailable()
      })
      .catch(() => showError('配置加载失败'))
  },

  _loadUsers() {
    const memberRoles = ['normal', 'admin', 'superadmin', 'chairman']
    const promises = [callCloud('userList', { roles: memberRoles })]
    if (this.data.isAdmin) {
      promises.push(callCloud('userList', { roles: ['unverified'] }))
    }
    Promise.all(promises)
      .then(([membersResult, unverifiedResult]) => {
        const members = (membersResult.data || []).map(u => ({
          ...u,
          roleLabel: ROLE_LABELS[u.role] || u.role,
        }))
        this.setData({
          allMembers: members,
          unverifiedUsers: unverifiedResult ? (unverifiedResult.data || []) : [],
        })
      })
      .catch(() => showError('用户列表加载失败'))
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

  // --- User organizations (admin+ only) ---
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
    if (this.data.config.organizations.includes(name)) { showError('已存在'); return }
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
    callCloud('configUpdate', patch).then(onSuccess).catch(err => showError(err.message || '网络错误'))
  },

  // --- User management ---
  onApproveUser(e) {
    const { openid } = e.currentTarget.dataset
    callCloud('userSetRole', { targetOpenid: openid, newRole: 'normal' })
      .then(() => { showSuccess('已通过'); this._loadUsers() })
      .catch(err => showError(err.message || '操作失败'))
  },

  onDismissUser(e) {
    const { openid } = e.currentTarget.dataset
    callCloud('userSetRole', { targetOpenid: openid, newRole: 'dismissed' })
      .then(() => { showSuccess('已忽略'); this._loadUsers() })
      .catch(err => showError(err.message || '操作失败'))
  },

  onEditUserOrgs(e) {
    const { openid, name } = e.currentTarget.dataset
    wx.navigateTo({ url: `/pages/user-orgs-edit/index?openid=${encodeURIComponent(openid)}&name=${encodeURIComponent(name)}` })
  },

  onPromoteToAdmin(e) {
    const { openid, name } = e.currentTarget.dataset
    wx.showModal({
      title: '提拔为管理员',
      content: `确认将 ${name} 提拔为管理员？`,
      success: (res) => {
        if (!res.confirm) return
        callCloud('userSetRole', { targetOpenid: openid, newRole: 'admin' })
          .then(() => { showSuccess('已提拔'); this._loadUsers() })
          .catch(err => showError(err.message || '操作失败'))
      }
    })
  },

  onDemoteToNormal(e) {
    const { openid, name } = e.currentTarget.dataset
    wx.showModal({
      title: '降级为普通用户',
      content: `确认将 ${name} 降级为普通用户？`,
      success: (res) => {
        if (!res.confirm) return
        callCloud('userSetRole', { targetOpenid: openid, newRole: 'normal' })
          .then(() => { showSuccess('已降级'); this._loadUsers() })
          .catch(err => showError(err.message || '操作失败'))
      }
    })
  },

  onTransferChairman(e) {
    const { openid, name } = e.currentTarget.dataset
    wx.showModal({
      title: '转让主席',
      content: `确认将主席身份转让给 ${name}？此操作不可撤销。`,
      success: (res) => {
        if (!res.confirm) return
        callCloud('chairmanTransfer', { targetOpenid: openid })
          .then(() => {
            showSuccess('已转让')
            app.globalData.currentUser.role = 'admin'
            this.setData({ role: 'admin', roleLabel: '管理员', isChairman: false })
            this._loadUsers()
          })
          .catch(err => showError(err.message || '操作失败'))
      }
    })
  },
})

