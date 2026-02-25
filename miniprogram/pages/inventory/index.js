const { getInventory } = require('../../utils/db')

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
        wx.showToast({ title: '加载失败', icon: 'none' })
      })
  },

  onSearch(e) {
    this.setData({ searchText: e.detail.value })
    this._applyFilter()
  },

  _applyFilter() {
    const q = this.data.searchText.trim().toLowerCase()
    if (!q) { this.setData({ filtered: this.data.inventory }); return }
    const filtered = this.data.inventory.filter(item =>
      [item.itemId, item.itemName, item.organization, item.lastOperator, item.lastOperation]
        .some(v => v && String(v).toLowerCase().includes(q))
    )
    this.setData({ filtered })
  },
})
