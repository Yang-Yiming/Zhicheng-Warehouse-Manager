const app = getApp()
const { callCloud } = require('../../utils/cloud')
const { showError, showSuccess } = require('../../utils/feedback')
const {
  detectFormat,
  parseMiniprogramFormat,
  parseOldInventory,
  buildExportWorkbook,
  readXlsxFile,
  writeAndShare,
} = require('../../utils/excel')
const { clearPageDirty, isPageDirty, shouldRefreshOnShow } = require('../../utils/page-refresh')

const ROLE_LABELS = {
  unverified: '未认证',
  normal: '普通',
  admin: '管理员',
  superadmin: '超管',
  chairman: '大提督',
}
const PAGE_KEY = 'settings-users'

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
    membersExpanded: false,
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
      if (role !== 'unverified') this._loadUsers({ force: true })
    })
    this._loadConfig()
  },

  onShow() {
    if (this.data.role === 'unverified') return
    if (!shouldRefreshOnShow({ lastLoadedAt: this._usersLoadedAt, dirty: isPageDirty(PAGE_KEY) })) return
    this._loadUsers({ force: true })
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

  _loadUsers(options = {}) {
    const { force = false } = options
    if (this._loadingUsers) return this._usersLoadPromise
    if (!force && !shouldRefreshOnShow({ lastLoadedAt: this._usersLoadedAt, dirty: isPageDirty(PAGE_KEY) })) {
      return Promise.resolve()
    }

    const memberRoles = ['normal', 'admin', 'superadmin', 'chairman']
    const promises = [callCloud('userList', { roles: memberRoles })]
    if (this.data.isAdmin) {
      promises.push(callCloud('userList', { roles: ['unverified'] }))
    }

    this._loadingUsers = true
    this._usersLoadPromise = Promise.all(promises)
      .then(([membersResult, unverifiedResult]) => {
        const members = (membersResult.data || []).map(u => ({
          ...u,
          roleLabel: ROLE_LABELS[u.role] || u.role,
        }))
        this.setData({
          allMembers: members,
          unverifiedUsers: unverifiedResult ? (unverifiedResult.data || []) : [],
        })
        this._usersLoadedAt = Date.now()
        clearPageDirty(PAGE_KEY)
      })
      .catch(() => showError('用户列表加载失败'))
      .finally(() => {
        this._loadingUsers = false
        this._usersLoadPromise = null
      })

    return this._usersLoadPromise
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
      .then(() => { showSuccess('已通过'); this._loadUsers({ force: true }) })
      .catch(err => showError(err.message || '操作失败'))
  },

  onDismissUser(e) {
    const { openid } = e.currentTarget.dataset
    callCloud('userSetRole', { targetOpenid: openid, newRole: 'dismissed' })
      .then(() => { showSuccess('已忽略'); this._loadUsers({ force: true }) })
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
          .then(() => { showSuccess('已提拔'); this._loadUsers({ force: true }) })
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
          .then(() => { showSuccess('已降级'); this._loadUsers({ force: true }) })
          .catch(err => showError(err.message || '操作失败'))
      }
    })
  },

  onTransferChairman(e) {
    const { openid, name } = e.currentTarget.dataset
    wx.showModal({
      title: '转让大提督',
      content: `确认将大提督身份转让给 ${name}？此操作不可撤销。`,
      success: (res) => {
        if (!res.confirm) return
        callCloud('chairmanTransfer', { targetOpenid: openid })
          .then(() => {
            showSuccess('已转让')
            app.globalData.currentUser.role = 'admin'
            this.setData({ role: 'admin', roleLabel: '管理员', isChairman: false })
            this._loadUsers({ force: true })
          })
          .catch(err => showError(err.message || '操作失败'))
      }
    })
  },

  onToggleMembers() {
    this.setData({ membersExpanded: !this.data.membersExpanded })
  },

  onExportData() {
    wx.showLoading({ title: '导出中', mask: true })
    callCloud('dataExport')
      .then(result => {
        const operations = Array.isArray(result.operations) ? result.operations : []
        const inventory = Array.isArray(result.inventory) ? result.inventory : []
        const workbook = buildExportWorkbook(operations, inventory)
        const filename = this._buildExportFilename()
        return writeAndShare(workbook, filename)
      })
      .then(() => showSuccess('导出成功'))
      .catch(err => showError(err.message || '导出失败', { modal: true }))
      .finally(() => wx.hideLoading())
  },

  onImportData() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx'],
      success: async (res) => {
        try {
          const file = (res.tempFiles && res.tempFiles[0]) || {}
          const filePath = file.path || file.tempFilePath || ''
          if (!filePath) throw new Error('未找到所选文件')

          wx.showLoading({ title: '解析中', mask: true })
          const workbook = await readXlsxFile(filePath)
          const payload = this._buildImportPayload(workbook)
          wx.hideLoading()
          this._confirmImport(payload)
        } catch (err) {
          wx.hideLoading()
          showError((err && err.message) || '文件解析失败', { modal: true })
        }
      },
      fail: (err) => {
        if (err && err.errMsg && err.errMsg.includes('cancel')) return
        showError('选择文件失败')
      },
    })
  },

  _buildExportFilename() {
    const now = new Date()
    const parts = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      '-',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ]
    return `warehouse-export-${parts.join('')}.xlsx`
  },

  _buildImportPayload(workbook) {
    const format = detectFormat(workbook)
    if (format === 'miniprogram') {
      const parsed = parseMiniprogramFormat(workbook)
      return {
        mode: 'full',
        operations: parsed.operations,
        inventory: parsed.inventory,
        summary: `将覆盖导入 ${parsed.operations.length} 条操作记录和 ${parsed.inventory.length} 条库存记录。`,
      }
    }

    if (format === 'old_inventory') {
      const parsed = parseOldInventory(workbook)
      return {
        mode: 'old_inventory',
        operations: [],
        inventory: parsed.inventory,
        summary: `将把旧库存表中的 ${parsed.inventory.length} 条库存记录转换为当前系统数据，并清空现有数据。`,
      }
    }

    if (format === 'old_operations') {
      throw new Error('暂不支持直接导入旧问卷操作表，请先导出为当前小程序格式')
    }

    throw new Error('无法识别文件格式，请使用系统导出的 xlsx 或旧库存表')
  },

  _confirmImport(payload) {
    wx.showModal({
      title: '确认导入',
      content: `${payload.summary}\n\n导入会覆盖当前全部操作记录和库存，且不可撤销。`,
      confirmText: '确认导入',
      success: (res) => {
        if (!res.confirm) return
        this._runImport(payload)
      },
    })
  },

  _runImport(payload) {
    wx.showLoading({ title: '导入中', mask: true })
    callCloud('dataImport', {
      mode: payload.mode,
      operations: payload.operations,
      inventory: payload.inventory,
    })
      .then(result => {
        showSuccess(`已导入 ${result.importedOperations || 0} 条操作，${result.importedInventory || 0} 条库存`)
      })
      .catch(err => showError(err.message || '导入失败', { modal: true }))
      .finally(() => wx.hideLoading())
  },

  onOpenOther() {
    wx.navigateTo({ url: '/pages/other/index' })
  },
})
