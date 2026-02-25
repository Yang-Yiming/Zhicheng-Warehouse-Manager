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

module.exports = { required, positiveInt }
