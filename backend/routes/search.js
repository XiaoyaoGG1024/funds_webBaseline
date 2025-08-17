import express from 'express'
import { Transaction } from '../models/Transaction.js'

export const searchRouter = express.Router()

searchRouter.get('/', async (req, res) => {
  try {
    const { q: keyword } = req.query
    
    if (!keyword || keyword.trim().length < 2) {
      return res.status(400).json({ 
        error: '搜索关键词不能为空且长度至少为2个字符' 
      })
    }
    
    const results = await Transaction.searchByKeyword(keyword.trim())
    
    res.json({
      success: true,
      data: results,
      meta: {
        keyword,
        count: results.length,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('搜索失败:', error)
    res.status(500).json({ 
      error: '搜索失败', 
      message: error.message 
    })
  }
})