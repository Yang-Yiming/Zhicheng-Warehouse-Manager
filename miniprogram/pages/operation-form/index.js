const app = getApp()
const { callCloud } = require('../../utils/cloud')
const { showError, showSuccess } = require('../../utils/feedback')
const { validateOperation } = require('../../utils/validation')

const OPERATIONS = ['入库', '出库', '物资增添', '部分出库']

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
    app.onLoginReady(user => this.setData({ operatorName: user.displayName }))
    this._loadConfig()
    this._initDateTime()
  },

  _initDateTime() {
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    const dateValue = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const timeValue = `${pad(now.getHours())}:${pad(now.getMinutes())}`
    this.setData({ dateValue, timeValue, 'form.operationTime': `${dateValue} ${timeValue}` })
  },

  _loadConfig() {
    callCloud('configGet')
      .then(result => {
        const config = result.data || {}
        const organizations = Array.isArray(config.organizations) ? config.organizations : []
        this.setData({ organizations })
      })
      .catch(() => showError('配置加载失败'))
  },

  onItemIdInput(e) { this.setData({ 'form.itemId': e.detail.value }) },
  onItemNameInput(e) { this.setData({ 'form.itemName': e.detail.value }) },
  onQuantityInput(e) { this.setData({ 'form.quantity': e.detail.value }) },

  onOperationChange(e) {
    const idx = Number(e.detail.value)
    this.setData({ operationIndex: idx, 'form.operation': OPERATIONS[idx] })
  },

  onOrgChange(e) {
    const idx = Number(e.detail.value)
    this.setData({ orgIndex: idx, 'form.organization': this.data.organizations[idx] })
  },

  onDateChange(e) {
    const dateValue = e.detail.value
    this.setData({ dateValue, 'form.operationTime': `${dateValue} ${this.data.timeValue}` })
  },

  onTimeChange(e) {
    const timeValue = e.detail.value
    this.setData({ timeValue, 'form.operationTime': `${this.data.dateValue} ${timeValue}` })
  },

  onSubmit() {
    if (this.data.submitting) return
    const { form } = this.data
    const payload = {
      itemId: form.itemId.trim(),
      itemName: form.itemName.trim(),
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
    callCloud('operationCreate', payload).then(() => {
      this.setData({ submitting: false })
      showSuccess('提交成功')
      this._resetForm()
    }).catch(err => {
      this.setData({ submitting: false })
      showError(err.message || '网络错误', { modal: true, title: '提交失败' })
    })
  },

  _resetForm() {
    this._initDateTime()
    this.setData({
      'form.itemId': '', 'form.itemName': '', 'form.operation': '',
      'form.organization': '', 'form.quantity': '',
      operationIndex: -1, orgIndex: -1,
    })
  },
})
