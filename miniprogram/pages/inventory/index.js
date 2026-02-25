const { getInventory } = require('../../utils/db')
const { showError } = require('../../utils/feedback')
const { filterByQuery } = require('../../utils/search')

Page({
  data: {
    inventory: [],
    filtered: [],
    searchText: '',
    loading: false,
  },

  onLoad() { this._load() },
  onShow() { if (this._loaded) this._load() },
  onPullDownRefresh() { this._load() },

  _load() {
    this.setData({ loading: true })
    getInventory()
      .then(res => {
        this.setData({ inventory: res.data, loading: false })
        this._loaded = true
        this._applyFilter()
        wx.stopPullDownRefresh()
      })
      .catch(() => {
        this.setData({ loading: false })
        wx.stopPullDownRefresh()
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
      itemList: ['物资增添', '部分出库', '出库'],
      success: (res) => {
        const ops = ['物资增添', '部分出库', '出库']
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
