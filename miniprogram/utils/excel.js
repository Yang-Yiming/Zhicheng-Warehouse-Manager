const XLSX = require('../libs/xlsx.mini.min')

// --- Column mappings: Chinese header ↔ DB field ---
const OPS_COLUMNS = [
  { header: '提交时间', key: 'submitTime' },
  { header: '物资编号', key: 'itemId' },
  { header: '物品名称', key: 'itemName' },
  { header: '物资操作', key: 'operation' },
  { header: '所属组织', key: 'organization' },
  { header: '物品数量', key: 'quantity' },
  { header: '操作时间', key: 'operationTime' },
  { header: '操作人',   key: 'operator' },
  { header: '提交者',   key: 'submitter' },
  { header: '操作人OpenID', key: 'operatorOpenid' },
]

const INV_COLUMNS = [
  { header: '物资编号', key: 'itemId' },
  { header: '物品名称', key: 'itemName' },
  { header: '所属组织', key: 'organization' },
  { header: '物品数量', key: 'quantity' },
  { header: '最后操作', key: 'lastOperation' },
  { header: '最后操作人', key: 'lastOperator' },
  { header: '最后操作时间', key: 'lastOperationTime' },
  { header: '备注', key: 'notes' },
]

// Old Python format uses "时间" instead of "操作时间"
const OLD_OPS_HEADERS = ['提交时间','物资编号','物品名称','物资操作','所属组织','物品数量','时间','操作人','提交者']

/**
 * Detect file format from workbook
 * @returns {'miniprogram'|'old_inventory'|'old_operations'|'unknown'}
 */
function detectFormat(workbook) {
  const names = workbook.SheetNames
  if (names.includes('操作记录') && names.includes('库存状态')) return 'miniprogram'

  if (names.length < 1) return 'unknown'
  const sheet = workbook.Sheets[names[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
  if (rows.length === 0) return 'unknown'

  const headers = rows[0].map(h => String(h).trim())

  if (headers.includes('最后操作')) return 'old_inventory'

  const hasTime = headers.includes('时间') && !headers.includes('操作时间')
  const hasOp = headers.includes('物资操作')
  if (hasTime && hasOp) return 'old_operations'

  return 'unknown'
}

/**
 * Parse miniprogram-exported format (two sheets)
 */
function parseMiniprogramFormat(workbook) {
  const opsSheet = workbook.Sheets['操作记录']
  const invSheet = workbook.Sheets['库存状态']

  const operations = sheetToRecords(opsSheet, OPS_COLUMNS)
  const inventory = sheetToRecords(invSheet, INV_COLUMNS)

  // Ensure quantity is number
  operations.forEach(op => { op.quantity = Number(op.quantity) || 0 })
  inventory.forEach(item => { item.quantity = Number(item.quantity) || 0 })

  return { operations, inventory }
}

/**
 * Parse old Python inventory export (single sheet)
 */
function parseOldInventory(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const inventory = sheetToRecords(sheet, INV_COLUMNS)
  inventory.forEach(item => { item.quantity = Number(item.quantity) || 0 })
  return { inventory }
}

/**
 * Convert sheet to array of objects using column mapping
 */
function sheetToRecords(sheet, columns) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
  if (rows.length < 2) return []

  const headers = rows[0].map(h => String(h).trim())
  const headerToKey = {}
  columns.forEach(col => {
    const idx = headers.indexOf(col.header)
    if (idx >= 0) headerToKey[idx] = col.key
  })

  const records = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue
    const record = {}
    let hasValue = false
    Object.keys(headerToKey).forEach(idx => {
      const val = row[idx]
      record[headerToKey[idx]] = val !== undefined && val !== null ? String(val) : ''
      if (val !== undefined && val !== null && String(val).trim()) hasValue = true
    })
    if (hasValue) records.push(record)
  }
  return records
}

/**
 * Build export workbook from operations and inventory data
 */
function buildExportWorkbook(operations, inventory) {
  const wb = XLSX.utils.book_new()

  const opsData = [OPS_COLUMNS.map(c => c.header)]
  operations.forEach(op => {
    opsData.push(OPS_COLUMNS.map(c => op[c.key] !== undefined ? op[c.key] : ''))
  })
  const opsSheet = XLSX.utils.aoa_to_sheet(opsData)
  XLSX.utils.book_append_sheet(wb, opsSheet, '操作记录')

  const invData = [INV_COLUMNS.map(c => c.header)]
  inventory.forEach(item => {
    invData.push(INV_COLUMNS.map(c => item[c.key] !== undefined ? item[c.key] : ''))
  })
  const invSheet = XLSX.utils.aoa_to_sheet(invData)
  XLSX.utils.book_append_sheet(wb, invSheet, '库存状态')

  return wb
}

/**
 * Read xlsx file from local path, returns workbook
 */
function readXlsxFile(filePath) {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager()
    fs.readFile({
      filePath,
      success: res => {
        try {
          const wb = XLSX.read(res.data, { type: 'array' })
          resolve(wb)
        } catch (e) {
          reject(new Error('文件解析失败，请确认为xlsx格式'))
        }
      },
      fail: () => reject(new Error('文件读取失败')),
    })
  })
}

/**
 * Write workbook to temp file and trigger share
 */
function writeAndShare(workbook, filename) {
  const data = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' })
  const filePath = `${wx.env.USER_DATA_PATH}/${filename}`
  const fs = wx.getFileSystemManager()

  return new Promise((resolve, reject) => {
    fs.writeFile({
      filePath,
      data,
      encoding: 'base64',
      success: () => {
        wx.shareFileMessage({
          filePath,
          success: resolve,
          fail: () => {
            // User cancelled share — still offer to save
            wx.showModal({
              title: '导出成功',
              content: '文件已生成，是否打开？',
              confirmText: '打开',
              success: modalRes => {
                if (modalRes.confirm) {
                  wx.openDocument({ filePath, showMenu: true, fail: () => {} })
                }
                resolve()
              },
            })
          },
        })
      },
      fail: () => reject(new Error('文件写入失败')),
    })
  })
}

module.exports = {
  detectFormat,
  parseMiniprogramFormat,
  parseOldInventory,
  buildExportWorkbook,
  readXlsxFile,
  writeAndShare,
}
