
import { query } from '../config/database.js'


// 资金流向主模型，所有字段、聚合、标签、接口严格对齐需求文档
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
   * 获取资金流向图谱数据，节点/边聚合、标签、颜色、所有字段严格对齐需求文档
   * @param {string} cardId
   * @param {number} depth
   * @param {object} filter
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
        symbolSize: Math.min(Math.max((stats.totalIn + stats.totalOut) / 20000, 30), 80),
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
        width: Math.min(Math.max(link.amount / 10000, 1), 10),
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
   * 仅支持卡号模糊搜索
   */
  static async searchByKeyword(keyword) {
    const sql = `
      SELECT DISTINCT 交易卡号 as cardId
      FROM 交易明细表 
      WHERE 交易卡号 LIKE ?
      LIMIT 20
    `
    const searchPattern = `%${keyword}%`
    return await query(sql, [searchPattern])
  }
}