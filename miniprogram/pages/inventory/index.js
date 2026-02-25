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
  onPullDownRefresh() { this._load() },

  _load() {
    this.setData({ loading: true })
    getInventory()
      .then(res => {
        this.setData({ inventory: res.data, loading: false })
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
})
