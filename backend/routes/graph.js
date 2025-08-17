import express from 'express'
import { Transaction } from '../models/Transaction.js'
import { validateCardId, validateAmount } from '../utils/validation.js'

export const graphRouter = express.Router()

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