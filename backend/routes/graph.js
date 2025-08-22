import express from 'express'
import { Transaction } from '../models/Transaction.js'
import { validateCardId, validateAmount } from '../utils/validation.js'

export const graphRouter = express.Router()

// 获取单个节点信息（不包含关联交易）
graphRouter.get('/:cardId/node-only', async (req, res) => {
  try {
    const { cardId } = req.params
    const cardValidation = validateCardId(cardId)
    if (!cardValidation.valid) {
      return res.status(400).json({ error: cardValidation.message })
    }
    
    const nodeData = await Transaction.getNodeOnlyByCardId(cardId)
    if (!nodeData) {
      return res.status(404).json({ error: '未找到相关交易数据', cardId })
    }
    
    res.json({
      success: true,
      data: {
        nodes: [nodeData],
        links: []
      },
      meta: {
        cardId,
        nodeCount: 1,
        linkCount: 0,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('获取节点数据失败:', error)
    res.status(500).json({ error: '获取节点数据失败', message: error.message })
  }
})

graphRouter.get('/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params
    const { depth = 1 } = req.query
    const cardValidation = validateCardId(cardId)
    if (!cardValidation.valid) {
      return res.status(400).json({ error: cardValidation.message })
    }
    // 只要有一个过滤条件即可
    const graphData = await Transaction.getGraphDataByCardId(cardId, parseInt(depth))
    // 打印节点和链接信息
    // console.log('节点信息:', graphData.nodes[0])
    // console.log('链接信息:', graphData.links[0])
    if (graphData.nodes.length === 0) {
      return res.status(404).json({ error: '未找到相关交易数据', cardId })
    }
    res.json({
      success: true,
      data: graphData,
      meta: {
        cardId,
        nodeCount: graphData.nodes.length,
        linkCount: graphData.links.length,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('获取图谱数据失败:', error)
    res.status(500).json({ error: '获取图谱数据失败', message: error.message })
  }
})

// 批量获取图谱数据
graphRouter.post('/batch', async (req, res) => {
  try {
    const { cardIds } = req.body
    
    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return res.status(400).json({ error: '请提供有效的卡号数组' })
    }
    
    if (cardIds.length > 20) {
      return res.status(400).json({ error: '批量查询最多支持20个卡号' })
    }
    
    // 验证所有卡号
    const invalidCards = []
    for (const cardId of cardIds) {
      const validation = validateCardId(cardId)
      if (!validation.valid) {
        invalidCards.push({ cardId, error: validation.message })
      }
    }
    
    if (invalidCards.length > 0) {
      return res.status(400).json({ error: '无效的卡号', invalidCards })
    }
    
    // 并发获取所有卡号的图谱数据
    const results = await Promise.allSettled(
      cardIds.map(async cardId => {
        try {
          const graphData = await Transaction.getGraphDataByCardId(cardId, 1)
          return {
            cardId,
            success: true,
            data: graphData
          }
        } catch (error) {
          return {
            cardId,
            success: false,
            error: error.message
          }
        }
      })
    )
    
    const batchResults = results.map(result => 
      result.status === 'fulfilled' ? result.value : {
        success: false,
        error: result.reason?.message || '未知错误'
      }
    )
    
    res.json({
      success: true,
      data: batchResults,
      meta: {
        requestedCount: cardIds.length,
        successCount: batchResults.filter(r => r.success).length,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('批量获取图谱数据失败:', error)
    res.status(500).json({ error: '批量获取图谱数据失败', message: error.message })
  }
})