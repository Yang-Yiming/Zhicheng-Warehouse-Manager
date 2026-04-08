// Cloud function: dataImport
// Overwrite all operations and inventory with imported data (chairman only)
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const PAGE_SIZE = 100

async function ensureCollection(name) {
  try { await db.createCollection(name) } catch (_) { /* already exists */ }
}

async function fetchAll(collectionName) {
  let all = []
  let skip = 0
  while (true) {
    const { data } = await db.collection(collectionName).skip(skip).limit(PAGE_SIZE).get()
    all = all.concat(data)
    if (data.length < PAGE_SIZE) break
    skip += data.length
  }
  return all
}

async function deleteAll(collectionName) {
  const col = db.collection(collectionName)
  while (true) {
    const docs = await fetchAll(collectionName)
    if (docs.length === 0) break
    await Promise.all(docs.map(doc => col.doc(doc._id).remove()))
  }
}

async function batchInsert(collectionName, records) {
  const col = db.collection(collectionName)
  for (let i = 0; i < records.length; i += PAGE_SIZE) {
    const batch = records.slice(i, i + PAGE_SIZE)
    await Promise.all(batch.map(record => col.add({ data: record })))
  }
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return { success: false, error: '无法获取用户身份' }

    // Permission: chairman only
    const { data: userData } = await db.collection('users').where({ openid: OPENID }).get()
    if (userData.length === 0) return { success: false, error: '用户不存在' }
    const role = userData[0].role || 'unverified'
    if (role !== 'chairman') return { success: false, error: '仅大提督可执行导入操作' }

    const operatorName = userData[0].displayName || '大提督'
    const { mode, operations, inventory } = event

    if (!mode) return { success: false, error: '缺少导入模式参数' }

    await Promise.all(['operations', 'inventory'].map(ensureCollection))

    // Clear both collections
    await deleteAll('operations')
    await deleteAll('inventory')

    let importedOperations = 0
    let importedInventory = 0

    if (mode === 'full') {
      // Full restore: insert operations and inventory as-is
      if (Array.isArray(operations) && operations.length > 0) {
        await batchInsert('operations', operations)
        importedOperations = operations.length
      }
      if (Array.isArray(inventory) && inventory.length > 0) {
        await batchInsert('inventory', inventory)
        importedInventory = inventory.length
      }
    } else if (mode === 'old_inventory') {
      // Old Python inventory: create inventory + one operation per item
      if (!Array.isArray(inventory) || inventory.length === 0) {
        return { success: false, error: '导入数据为空' }
      }

      const now = new Date()
      const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

      const invRecords = []
      const opsRecords = []

      inventory.forEach(item => {
        invRecords.push({
          itemId: item.itemId || '',
          itemName: item.itemName || '',
          organization: item.organization || '',
          quantity: Number(item.quantity) || 0,
          lastOperation: '覆盖导入',
          lastOperator: operatorName,
          lastOperationTime: timeStr,
          notes: item.notes || '',
        })

        opsRecords.push({
          submitTime: now.toISOString(),
          itemId: item.itemId || '',
          itemName: item.itemName || '',
          operation: '覆盖导入',
          organization: item.organization || '',
          quantity: Number(item.quantity) || 0,
          operationTime: timeStr,
          operator: operatorName,
          submitter: operatorName,
          operatorOpenid: OPENID,
        })
      })

      await batchInsert('inventory', invRecords)
      await batchInsert('operations', opsRecords)
      importedOperations = opsRecords.length
      importedInventory = invRecords.length
    } else {
      return { success: false, error: '未知的导入模式: ' + mode }
    }

    return { success: true, importedOperations, importedInventory }
  } catch (err) {
    return { success: false, error: err.message || '导入失败' }
  }
}
