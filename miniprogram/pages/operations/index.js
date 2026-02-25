Page({
  data: {
    operations: [],
    filtered: [],
    searchText: '',
    loading: false,
    page: 1,
    hasMore: true,
  },

  onLoad() {
    this._load(true)
  },

  onPullDownRefresh() {
    this._load(true)
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) this._load(false)
  },

  _load(reset) {
    if (this.data.loading) return
    const page = reset ? 1 : this.data.page
    this.setData({ loading: true })

    wx.cloud.callFunction({ name: 'operationsList', data: { page, pageSize: 20 } })
      .then(res => {
        const { data, total } = res.result
        const operations = reset ? data : [...this.data.operations, ...data]
        this.setData({ operations, page: page + 1, hasMore: operations.length < total, loading: false })
        this._applyFilter()
        if (reset) wx.stopPullDownRefresh()
      })
      .catch(() => {
        this.setData({ loading: false })
        if (reset) wx.stopPullDownRefresh()
        wx.showToast({ title: '加载失败', icon: 'none' })
      })
  },

  onSearch(e) {
    this.setData({ searchText: e.detail.value })
    this._applyFilter()
  },

  _applyFilter() {
    const q = this.data.searchText.trim().toLowerCase()
    if (!q) { this.setData({ filtered: this.data.operations }); return }
    const filtered = this.data.operations.filter(op =>
      [op.itemId, op.itemName, op.operation, op.organization, op.operator, op.operationTime]
        .some(v => v && String(v).toLowerCase().includes(q))
    )
    this.setData({ filtered })
  },
})
