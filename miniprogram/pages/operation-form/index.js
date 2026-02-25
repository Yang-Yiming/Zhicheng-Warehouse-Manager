const app = getApp()
const { callCloud } = require('../../utils/cloud')
const { showError, showSuccess } = require('../../utils/feedback')
const { validateOperation } = require('../../utils/validation')

const OPERATIONS = ['入库', '出库']
const db = wx.cloud.database()

Page({
  data: {
    form: { itemId: '', itemName: '', operation: '', organization: '', quantity: '', operationTime: '' },
    operatorName: '',
    organizations: [],
    operationIndex: -1,
    orgIndex: -1,
    dateValue: '',
    timeValue: '',
    submitting: false,
    locked: false,
    maxQuantity: null,
    OPERATIONS,
  },

  onLoad(options) {
    const { itemId, itemName, organization, operation, locked } = options
    const isLocked = locked === '1'
    const updates = { locked: isLocked }

    if (itemId) updates['form.itemId'] = decodeURIComponent(itemId)
    if (itemName) updates['form.itemName'] = decodeURIComponent(itemName)
    if (organization) updates['form.organization'] = decodeURIComponent(organization)
    if (operation) {
      const op = decodeURIComponent(operation)
      const idx = OPERATIONS.indexOf(op)
      updates['form.operation'] = op
      updates.operationIndex = idx
    }

    this.setData(updates)
    if (updates['form.operation'] === '出库') this._fetchMaxQuantity()
    app.onLoginReady(user => {
      if ((user.role || 'unverified') === 'unverified') {
        showError('权限不足，请联系管理员授权', { modal: true, title: '无权限' })
        wx.navigateBack()
        return
      }
      this.setData({ operatorName: user.displayName })
      const orgs = Array.isArray(user.organizations) ? user.organizations : []
      if (orgs.length > 0 && !isLocked) {
        this.setData({ organizations: orgs, orgIndex: 0, 'form.organization': orgs[0] })
        if (updates['form.operation'] === '出库') this._fetchMaxQuantity()
      } else {
        this.setData({ organizations: orgs })
      }
    })
    this._initDateTime()
  },

  _initDateTime() {
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    const dateValue = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const timeValue = `${pad(now.getHours())}:${pad(now.getMinutes())}`
    this.setData({ dateValue, timeValue, 'form.operationTime': `${dateValue} ${timeValue}` })
  },

  onItemIdInput(e) { this.setData({ 'form.itemId': e.detail.value }) },
  onItemIdBlur() { if (this.data.form.operation === '出库') this._fetchMaxQuantity() },
  onItemNameInput(e) { this.setData({ 'form.itemName': e.detail.value }) },
  onQuantityInput(e) { this.setData({ 'form.quantity': e.detail.value }) },

  onSelectOperation(e) {
    const op = e.currentTarget.dataset.op
    const idx = OPERATIONS.indexOf(op)
    this.setData({ operationIndex: idx, 'form.operation': op })
    if (op === '出库') this._fetchMaxQuantity()
    else this.setData({ maxQuantity: null })
  },

  onQuantityStep(e) {
    const delta = Number(e.currentTarget.dataset.delta)
    const cur = Number(this.data.form.quantity) || 0
    const { maxQuantity } = this.data
    const max = maxQuantity !== null ? maxQuantity : Infinity
    const next = Math.min(max, Math.max(1, cur + delta))
    this.setData({ 'form.quantity': String(next) })
  },

  onQuantityMin() { this.setData({ 'form.quantity': '1' }) },
  onQuantityMax() {
    const { maxQuantity } = this.data
    if (maxQuantity !== null) this.setData({ 'form.quantity': String(maxQuantity) })
  },

  onOrgChange(e) {
    const idx = Number(e.detail.value)
    this.setData({ orgIndex: idx, 'form.organization': this.data.organizations[idx] })
    if (this.data.form.operation === '出库') this._fetchMaxQuantity()
  },

  onDateChange(e) {
    const dateValue = e.detail.value
    this.setData({ dateValue, 'form.operationTime': `${dateValue} ${this.data.timeValue}` })
  },

  onTimeChange(e) {
    const timeValue = e.detail.value
    this.setData({ timeValue, 'form.operationTime': `${this.data.dateValue} ${timeValue}` })
  },

  async _fetchMaxQuantity() {
    const { form } = this.data
    if (!form.itemId || !form.organization) { this.setData({ maxQuantity: null }); return }
    try {
      const { data } = await db.collection('inventory').where({ itemId: form.itemId, organization: form.organization }).limit(1).get()
      this.setData({ maxQuantity: data.length > 0 ? data[0].quantity : null })
    } catch {
      this.setData({ maxQuantity: null })
    }
  },

  async _resolveOperation(userOp, itemId, organization) {
    if (userOp === '出库') return '部分出库'
    const { data } = await db.collection('inventory').where({ itemId, organization }).limit(1).get()
    return data.length > 0 ? '物资增添' : '入库'
  },

  async onSubmit() {
    if (this.data.submitting) return
    const { form } = this.data
    const itemId = form.itemId.trim()
    const itemName = form.itemName.trim()
    const payload = {
      itemId,
      itemName,
      operation: form.operation,
      organization: form.organization,
      quantity: Number(form.quantity),
      operationTime: form.operationTime,
    }
    const errors = validateOperation(payload)
    if (errors.length > 0) {
      showError(errors[0], { modal: true, title: '请检查输入' })
      return
    }

    this.setData({ submitting: true })
    try {
      payload.operation = await this._resolveOperation(form.operation, itemId, form.organization)
      await callCloud('operationCreate', payload)
      this.setData({ submitting: false })
      showSuccess('提交成功')
      this._resetForm()
    } catch (err) {
      this.setData({ submitting: false })
      showError(err.message || '网络错误', { modal: true, title: '提交失败' })
    }
  },

  _resetForm() {
    this._initDateTime()
    this.setData({
      'form.itemId': '', 'form.itemName': '', 'form.operation': '',
      'form.organization': '', 'form.quantity': '',
      operationIndex: -1, orgIndex: -1, maxQuantity: null,
    })
  },
})
