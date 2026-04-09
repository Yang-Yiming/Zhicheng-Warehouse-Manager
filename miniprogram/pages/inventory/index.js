const app = getApp()
const { getInventory } = require('../../utils/db')
const { showError } = require('../../utils/feedback')
const { filterByQuery } = require('../../utils/search')

Page({
  data: {
    inventory: [],
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
      this._load(true)
    })
  },
  onShow() { if (this._loaded) this._load(true) },
  onPullDownRefresh() { this._load(true) },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) this._load(false)
  },

  _load(reset) {
    if (this.data.loading) return
    const page = reset ? 1 : this.data.page
    this.setData({ loading: true })

    getInventory(page, 20)
      .then(({ data, hasMore }) => {
        const inventory = reset ? data : [...this.data.inventory, ...data]
        this.setData({ inventory, page: page + 1, hasMore: !!hasMore, loading: false })
        this._loaded = true
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
      this.data.inventory,
      this.data.searchText,
      ['itemId', 'itemName', 'organization', 'lastOperator', 'lastOperation']
    )
    this.setData({ filtered })
  },

  onItemTap(e) {
    const item = e.currentTarget.dataset.item
    wx.showActionSheet({
      itemList: ['入库', '出库'],
      success: (res) => {
        const ops = ['入库', '出库']
        const op = ops[res.tapIndex]
        wx.navigateTo({
          url: `/pages/operation-form/index?itemId=${encodeURIComponent(item.itemId)}&itemName=${encodeURIComponent(item.itemName)}&organization=${encodeURIComponent(item.organization)}&operation=${encodeURIComponent(op)}&locked=1`
        })
      }
    })
  },

  onAddNew() {
    wx.navigateTo({ url: '/pages/operation-form/index?operation=%E5%85%A5%E5%BA%93' })
  },
})
