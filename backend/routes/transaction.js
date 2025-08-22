import express from 'express'
import { Transaction } from '../models/Transaction.js'
import { validateCardId } from '../utils/validation.js'

export const transactionRouter = express.Router()

// 分页获取交易记录
transactionRouter.get('/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params
    const { page = 1, pageSize = 50, sortBy = 'date', sortOrder = 'desc' } = req.query
    
    const cardValidation = validateCardId(cardId)
    if (!cardValidation.valid) {
      return res.status(400).json({ error: cardValidation.message })
    }

    const pageNum = parseInt(page)
    const pageSizeNum = parseInt(pageSize)
    
    if (pageNum < 1 || pageSizeNum < 1 || pageSizeNum > 200) {
      return res.status(400).json({ error: '无效的分页参数' })
    }

    const offset = (pageNum - 1) * pageSizeNum
    
    // 获取交易记录总数
    const totalCount = await Transaction.getTransactionCount(cardId)
    const totalPages = Math.ceil(totalCount / pageSizeNum)
    
    // 获取分页数据
    const transactions = await Transaction.getTransactionsPaged(cardId, {
      offset,
      limit: pageSizeNum,
      sortBy,
      sortOrder
    })

    res.json({
      success: true,
      data: {
        transactions,
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
        cardId,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('获取交易记录失败:', error)
    res.status(500).json({ error: '获取交易记录失败', message: error.message })
  }
})

// 获取交易统计信息
transactionRouter.get('/:cardId/stats', async (req, res) => {
  try {
    const { cardId } = req.params
    const { timeRange = '30d' } = req.query
    
    const cardValidation = validateCardId(cardId)
    if (!cardValidation.valid) {
      return res.status(400).json({ error: cardValidation.message })
    }

    const stats = await Transaction.getTransactionStats(cardId, timeRange)
    
    res.json({
      success: true,
      data: stats,
      meta: {
        cardId,
        timeRange,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('获取交易统计失败:', error)
    res.status(500).json({ error: '获取交易统计失败', message: error.message })
  }
})