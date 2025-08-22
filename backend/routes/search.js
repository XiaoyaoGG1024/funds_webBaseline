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

// 分页搜索
searchRouter.get('/paged', async (req, res) => {
  try {
    const { q: keyword, page = 1, pageSize = 20 } = req.query
    
    if (!keyword || keyword.trim().length < 2) {
      return res.status(400).json({ error: '搜索关键词不能为空且长度至少为2个字符' })
    }

    const pageNum = parseInt(page)
    const pageSizeNum = parseInt(pageSize)
    
    if (pageNum < 1 || pageSizeNum < 1 || pageSizeNum > 100) {
      return res.status(400).json({ error: '无效的分页参数' })
    }

    const offset = (pageNum - 1) * pageSizeNum
    
    // 获取搜索结果总数和分页数据
    const searchResults = await Transaction.searchByKeywordPaged(keyword.trim(), {
      offset,
      limit: pageSizeNum
    })
    
    const totalCount = await Transaction.getSearchResultCount(keyword.trim())
    const totalPages = Math.ceil(totalCount / pageSizeNum)
    
    res.json({
      success: true,
      data: {
        results: searchResults,
        pagination: {
          currentPage: pageNum,
          pageSize: pageSizeNum,
          totalCount,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        }
      },
      meta: {
        keyword: keyword.trim(),
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('分页搜索失败:', error)
    res.status(500).json({ error: '分页搜索失败', message: error.message })
  }
})