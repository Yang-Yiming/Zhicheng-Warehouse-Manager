Page({
	onCopy(e) {
		const text = e.currentTarget?.dataset?.text
		if (!text) return

		wx.setClipboardData({
			data: text,
			success: () => {
				wx.showToast({
					title: '已复制',
					icon: 'success',
				})
			},
		})
	},
})
