import express from 'express'
import { Transaction } from '../models/Transaction.js'

export const nodeRouter = express.Router()

nodeRouter.get('/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params
    
    if (!cardId) {
      return res.status(400).json({ error: '卡号参数不能为空' })
    }
    
    const [basicInfo, summary, recentTransactions] = await Promise.all([
      Transaction.getByCardId(cardId, { limit: 1 }),
      Transaction.getSummaryByCardId(cardId),
      Transaction.getByCardId(cardId, { limit: 10 })
    ])
    
    if (!basicInfo.length) {
      return res.status(404).json({ 
        error: '未找到该卡号的信息', 
        cardId 
      })
    }
    
    const nodeData = {
      cardId,
      name: basicInfo[0].cardName,
      idCard: basicInfo[0].idCard,
      bank: basicInfo[0].counterpartBank,
      summary: summary ? {
        totalInAmount: 0,
        totalOutAmount: 0,
        totalCount: summary.totalCount || 0,
        maxAmount: summary.maxAmount || 0,
        tags: summary.cardType ? [summary.cardType] : []
      } : null,
      recentTransactions: recentTransactions.slice(0, 5).map(t => ({
        id: `${t.cardId}-${t.transactionTime}`,
        time: t.transactionTime,
        type: t.direction === '收' ? '收入' : '支出',
        amount: t.amount,
        description: t.description || t.transactionType || '转账'
      }))
    }
    
    if (summary) {
      const inTransactions = recentTransactions.filter(t => t.direction === '收')
      const outTransactions = recentTransactions.filter(t => t.direction === '付')
      
      nodeData.summary.totalInAmount = inTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
      nodeData.summary.totalOutAmount = outTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
    }
    
    res.json({
      success: true,
      data: nodeData,
      meta: {
        cardId,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('获取节点详情失败:', error)
    res.status(500).json({ 
      error: '获取节点详情失败', 
      message: error.message 
    })
  }
})