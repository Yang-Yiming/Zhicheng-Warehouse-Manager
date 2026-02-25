const app = getApp()

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
    OPERATIONS,
  },

  onLoad() {
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
    wx.cloud.callFunction({ name: 'configGet' }).then(res => {
      if (res.result.success) this.setData({ organizations: res.result.data.organizations || [] })
    })
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
    const errors = []
    if (!form.itemId.trim()) errors.push('物资编号不能为空')
    if (!form.itemName.trim()) errors.push('物品名称不能为空')
    if (!form.operation) errors.push('请选择操作类型')
    if (!form.organization) errors.push('请选择所属组织')
    const qty = Number(form.quantity)
    if (!form.quantity || !Number.isInteger(qty) || qty <= 0) errors.push('数量必须为正整数')
    if (!form.operationTime) errors.push('请选择操作时间')

    if (errors.length > 0) {
      wx.showModal({ title: '请检查输入', content: errors[0], showCancel: false })
      return
    }

    this.setData({ submitting: true })
    wx.cloud.callFunction({
      name: 'operationCreate',
      data: {
        itemId: form.itemId.trim(),
        itemName: form.itemName.trim(),
        operation: form.operation,
        organization: form.organization,
        quantity: qty,
        operationTime: form.operationTime,
      },
    }).then(res => {
      this.setData({ submitting: false })
      if (!res.result.success) {
        wx.showModal({ title: '提交失败', content: res.result.error, showCancel: false })
        return
      }
      wx.showToast({ title: '提交成功', icon: 'success' })
      this._resetForm()
    }).catch(() => {
      this.setData({ submitting: false })
      wx.showToast({ title: '网络错误', icon: 'none' })
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
