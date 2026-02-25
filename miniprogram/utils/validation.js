// Input validation helpers

function required(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return `${fieldName} 不能为空`
  }
  return null
}

function positiveInt(value, fieldName) {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) {
    return `${fieldName} 必须为正整数`
  }
  return null
}

function datetimeFormat(value, fieldName) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) {
    return `${fieldName} 格式必须为 YYYY-MM-DD HH:MM`
  }
  return null
}

// Validates all fields for a new operation. Returns array of error strings.
function validateOperation(data) {
  const errors = []
  const check = (fn, ...args) => { const e = fn(...args); if (e) errors.push(e) }

  check(required, data.itemId, '物资编号')
  check(required, data.itemName, '物品名称')
  check(required, data.operation, '物资操作')
  check(required, data.organization, '所属组织')
  check(required, data.operator, '操作人')
  check(required, data.submitter, '提交者')
  check(positiveInt, data.quantity, '物品数量')

  if (data.operationTime) {
    check(datetimeFormat, data.operationTime, '时间')
  } else {
    errors.push('时间 不能为空')
  }

  return errors
}

module.exports = { required, positiveInt, datetimeFormat, validateOperation }
