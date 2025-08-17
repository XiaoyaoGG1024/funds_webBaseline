export const validateCardId = (cardId) => {
  if (!cardId) {
    return { valid: false, message: '卡号不能为空' }
  }
  
  if (typeof cardId !== 'string') {
    return { valid: false, message: '卡号必须是字符串' }
  }
  
  if (cardId.length < 10 || cardId.length > 30) {
    return { valid: false, message: '卡号长度必须在10-30位之间' }
  }
  
  if (!/^[0-9]+$/.test(cardId)) {
    return { valid: false, message: '卡号只能包含数字' }
  }
  
  return { valid: true }
}

export const validateAmount = (amount) => {
  if (amount === undefined || amount === null) {
    return { valid: true }
  }
  
  const numAmount = parseFloat(amount)
  if (isNaN(numAmount)) {
    return { valid: false, message: '金额必须是有效数字' }
  }
  
  if (numAmount < 0) {
    return { valid: false, message: '金额不能为负数' }
  }
  
  if (numAmount > 999999999.99) {
    return { valid: false, message: '金额不能超过9.99亿' }
  }
  
  return { valid: true }
}

export const validateSearchKeyword = (keyword) => {
  if (!keyword) {
    return { valid: false, message: '搜索关键词不能为空' }
  }
  
  if (typeof keyword !== 'string') {
    return { valid: false, message: '搜索关键词必须是字符串' }
  }
  
  if (keyword.trim().length < 2) {
    return { valid: false, message: '搜索关键词长度至少为2个字符' }
  }
  
  if (keyword.length > 100) {
    return { valid: false, message: '搜索关键词长度不能超过100个字符' }
  }
  
  return { valid: true }
}