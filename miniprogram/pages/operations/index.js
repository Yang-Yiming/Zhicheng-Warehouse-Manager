const app = getApp()
const { callCloud } = require('../../utils/cloud')
const { showError } = require('../../utils/feedback')
const { filterByQuery } = require('../../utils/search')
const { clearPageDirty, isPageDirty, shouldRefreshOnShow } = require('../../utils/page-refresh')

const PAGE_KEY = 'operations'

Page({
  data: {
    operations: [],
    filtered: [],
    searchText: '',
    loading: false,
    page: 1,
    hasMore: true,
    unauthorized: false,
  },

  onLoad() {
    app.onLoginReady(user => {
      if ((user.role || 'unverified') === 'unverified') {
        this.setData({ unauthorized: true })
        return
      }
      this._load(true, { force: true })
    })
  },

  onShow() {
    if (!this._loaded) return
    if (!shouldRefreshOnShow({ lastLoadedAt: this._lastLoadedAt, dirty: isPageDirty(PAGE_KEY) })) return
    this._load(true, { force: true })
  },

  onPullDownRefresh() {
    this._load(true, { force: true })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) this._load(false)
  },

  _load(reset, options = {}) {
    const { force = false } = options
    if (this.data.loading) return
    if (reset && !force && !shouldRefreshOnShow({ lastLoadedAt: this._lastLoadedAt, dirty: isPageDirty(PAGE_KEY) })) return
    const page = reset ? 1 : this.data.page
    this.setData({ loading: true })

    callCloud('operationsList', { page, pageSize: 20 })
      .then(result => {
        const { data, hasMore } = result
        const opClassMap = { '入库': 'in', '出库': 'out', '物资增添': 'add', '部分出库': 'partial' }
        const mapped = data.map(op => ({ ...op, opClass: opClassMap[op.operation] || 'other' }))
        const operations = reset ? mapped : [...this.data.operations, ...mapped]
        this.setData({ operations, page: page + 1, hasMore: !!hasMore, loading: false })
        this._loaded = true
        if (reset) {
          this._lastLoadedAt = Date.now()
          clearPageDirty(PAGE_KEY)
        }
        this._applyFilter()
        if (reset) wx.stopPullDownRefresh()
      })
      .catch(() => {
        this.setData({ loading: false })
        if (reset) wx.stopPullDownRefresh()
        showError('加载失败')
      })
  },

  onSearch(e) {
    this.setData({ searchText: e.detail.value })
    this._applyFilter()
  },

  _applyFilter() {
    const filtered = filterByQuery(
      this.data.operations,
      this.data.searchText,
      ['itemId', 'itemName', 'operation', 'organization', 'operator', 'operationTime']
    )
    this.setData({ filtered })
  },

  onAddNew() {
    wx.navigateTo({ url: '/pages/operation-form/index' })
  },
})
