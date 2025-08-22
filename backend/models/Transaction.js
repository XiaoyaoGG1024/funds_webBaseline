
import { query } from '../config/database.js'

// 常量定义
const SYMBOL_SIZE = {
  MIN: 30,
  MAX: 80,
  SCALE_FACTOR: 20000
}

const LINE_WIDTH = {
  MIN: 1,
  MAX: 10,
  SCALE_FACTOR: 10000
}

// 资金流向主模型
export class Transaction {
  /**
   * 查询指定卡号相关的所有交易明细，只需卡号参数，自动区分进出方向
   * @param {string} cardId
   */
  static async getByCardId(cardId) {
    const sql = `
      SELECT 
        交易卡号 as cardId,
        交易户名 as cardName,
        交易证件号码 as idCard,
        交易时间 as transactionTime,
        交易金额 as amount,
        交易余额 as balance,
        收付标志 as direction,
        交易对手账卡号 as counterpartCardId,
        对手户名 as counterpartName,
        对手身份证号 as counterpartIdCard,
        对手开户银行 as counterpartBank,
        摘要说明 as description,
        交易类型 as transactionType
      FROM 交易明细表 
      WHERE (交易卡号 = ? OR 交易对手账卡号 = ?)
      ORDER BY 交易时间 DESC
    `
    return await query(sql, [cardId, cardId])
  }
  
  /**
   * 获取资金流向图谱数据
   * @param {string} cardId
   * @param {number} depth
   */
  static async getGraphDataByCardId(cardId, depth = 1) {
    // 1. 获取所有相关交易
    const transactions = await this.getByCardId(cardId)
    // 2. 节点统计（所有出现过的卡号）
    const nodeStats = new Map()
    transactions.forEach(tx => {
      // 统计本卡和对手卡
      [tx.cardId, tx.counterpartCardId].forEach(nodeId => {
        if (!nodeStats.has(nodeId)) {
          nodeStats.set(nodeId, {
            totalIn: 0,
            totalOut: 0,
            countIn: 0,
            countOut: 0,
            transactionTypes: new Set(),
            cardName: nodeId === tx.cardId ? tx.cardName : tx.counterpartName
          })
        }
      })
      // 进出方向统计
      if (tx.direction === '收') {
        nodeStats.get(tx.cardId).totalIn += parseFloat(tx.amount || 0)
        nodeStats.get(tx.cardId).countIn += 1
        nodeStats.get(tx.cardId).transactionTypes.add(tx.transactionType || '转账')
      } else if (tx.direction === '付') {
        nodeStats.get(tx.cardId).totalOut += parseFloat(tx.amount || 0)
        nodeStats.get(tx.cardId).countOut += 1
        nodeStats.get(tx.cardId).transactionTypes.add(tx.transactionType || '转账')
      }
    })
    // 3. 汇总表（仅卡性质）
    const summaryData = new Map()
    try {
      if (nodeStats.size > 0) {
        const summaryQuery = `SELECT 主端卡号, 卡性质 FROM 汇总表 WHERE 主端卡号 IN (${Array.from(nodeStats.keys()).map(() => '?').join(',')})`
        const summaries = await query(summaryQuery, Array.from(nodeStats.keys()))
        summaries.forEach(s => {
          summaryData.set(s.主端卡号, s)
        })
      }
    } catch (e) {
      console.warn('获取汇总数据失败:', e)
    }
    // 4. 构建节点
    const nodes = new Map()
    nodeStats.forEach((stats, nodeId) => {
      const summary = summaryData.get(nodeId)
      nodes.set(nodeId, {
        id: nodeId,
        name: stats.cardName || '未知',
        cardId: nodeId,
        totalIn: stats.totalIn,
        totalOut: stats.totalOut,
        countIn: stats.countIn,
        countOut: stats.countOut,
        transactionTypes: Array.from(stats.transactionTypes),
        cardType: summary?.卡性质 || '普通卡',
        category: summary?.卡性质 || '普通卡',
        symbolSize: Math.min(Math.max((stats.totalIn + stats.totalOut) / SYMBOL_SIZE.SCALE_FACTOR, SYMBOL_SIZE.MIN), SYMBOL_SIZE.MAX),
        label: {
          show: true,
          position: 'right',
          formatter: `{b}\n${nodeId}\n${Array.from(stats.transactionTypes).join(',')}`
        },
        itemStyle: {
          color: this.getNodeColor(summary)
        },
        expanded: nodeId === cardId
      })
    })
    // 5. 边聚合（同一对节点、同一方向、同一类型的交易次数+总金额）
    const linkAgg = new Map()
    transactions.forEach(tx => {
      // 方向：收为流入，付为流出
      const isIn = tx.direction === '收'
      const from = isIn ? tx.counterpartCardId : tx.cardId
      const to = isIn ? tx.cardId : tx.counterpartCardId
      const type = tx.transactionType || '转账'
      const key = `${from}-${to}-${type}`
      if (!linkAgg.has(key)) {
        linkAgg.set(key, {
          source: from,
          target: to,
          type,
          direction: isIn ? '进' : '出',
          amount: 0,
          count: 0
        })
      }
      const agg = linkAgg.get(key)
      agg.amount += parseFloat(tx.amount || 0)
      agg.count += 1
    })
    // 6. 生成links
    const links = Array.from(linkAgg.values()).map(link => ({
      ...link,
      value: link.amount,
      label: {
        show: true,
        formatter: `次数: ${link.count} 金额: ¥${link.amount.toFixed(2)}`
      },
      lineStyle: {
        width: Math.min(Math.max(link.amount / LINE_WIDTH.SCALE_FACTOR, LINE_WIDTH.MIN), LINE_WIDTH.MAX),
        color: link.direction === '进' ? '#52c41a' : '#ff4d4f',
        opacity: 0.8
      }
    }))
    return {
      nodes: Array.from(nodes.values()),
      links
    }
  }
  
  /**
   * 节点颜色：仅根据卡类型标签
   */
  static getNodeColor(summary) {
    if (!summary) return '#1890ff'
    switch (summary.卡性质) {
      case '收款卡': return '#52c41a'
      case '付款卡': return '#faad14'
      case '中转卡': return '#722ed1'
      case '空壳公司': return '#cf1322'
      default: return '#1890ff'
    }
  }
  
  /**
   * 获取汇总表信息，仅包含卡性质
   */
  static async getSummaryByCardId(cardId) {
    const sql = `
      SELECT 
        主端卡号 as cardId,
        卡性质 as cardType
      FROM 汇总表 
      WHERE 主端卡号 = ?
    `
    const [result] = await query(sql, [cardId])
    return result
  }

  /**
   * 获取单个节点的基本信息（不包含关联交易）
   */
  static async getNodeOnlyByCardId(cardId) {
    // 获取节点的基本交易统计
    const transactions = await this.getByCardId(cardId)
    if (transactions.length === 0) {
      return null
    }

    // 统计节点的进出金额
    let totalIn = 0
    let totalOut = 0
    let countIn = 0
    let countOut = 0
    const transactionTypes = new Set()

    transactions.forEach(tx => {
      if (tx.direction === '收') {
        totalIn += parseFloat(tx.amount || 0)
        countIn += 1
      } else if (tx.direction === '付') {
        totalOut += parseFloat(tx.amount || 0)
        countOut += 1
      }
      transactionTypes.add(tx.transactionType || '转账')
    })

    // 获取汇总信息
    let summary = null
    try {
      const summaryQuery = `SELECT 主端卡号, 卡性质 FROM 汇总表 WHERE 主端卡号 = ?`
      const summaries = await query(summaryQuery, [cardId])
      if (summaries.length > 0) {
        summary = summaries[0]
      }
    } catch (e) {
      console.warn('获取汇总数据失败:', e)
    }

    const cardName = transactions[0]?.cardName || '未知'
    
    return {
      id: cardId,
      name: cardName,
      cardId: cardId,
      totalIn,
      totalOut,
      countIn,
      countOut,
      transactionTypes: Array.from(transactionTypes),
      cardType: summary?.卡性质 || '普通卡',
      category: summary?.卡性质 || '普通卡',
      symbolSize: Math.min(Math.max((totalIn + totalOut) / SYMBOL_SIZE.SCALE_FACTOR, SYMBOL_SIZE.MIN), SYMBOL_SIZE.MAX),
      itemStyle: {
        color: this.getNodeColor(summary)
      }
    }
  }
  
  /**
   * 仅支持卡号模糊搜索
   */
  static async searchByKeyword(keyword) {
    const sql = `
      SELECT DISTINCT 交易卡号 as cardId, 交易户名 as cardName
      FROM 交易明细表 
      WHERE 交易卡号 LIKE ?
      LIMIT 20
    `
    const searchPattern = `%${keyword}%`
    return await query(sql, [searchPattern])
  }

  /**
   * 分页搜索卡号
   */
  static async searchByKeywordPaged(keyword, options = {}) {
    const { offset = 0, limit = 20 } = options
    const sql = `
      SELECT DISTINCT 交易卡号 as cardId, 交易户名 as cardName
      FROM 交易明细表 
      WHERE 交易卡号 LIKE ?
      LIMIT ? OFFSET ?
    `
    const searchPattern = `%${keyword}%`
    return await query(sql, [searchPattern, limit, offset])
  }

  /**
   * 获取搜索结果总数
   */
  static async getSearchResultCount(keyword) {
    const sql = `
      SELECT COUNT(DISTINCT 交易卡号) as total
      FROM 交易明细表 
      WHERE 交易卡号 LIKE ?
    `
    const searchPattern = `%${keyword}%`
    const [result] = await query(sql, [searchPattern])
    return result?.total || 0
  }
}