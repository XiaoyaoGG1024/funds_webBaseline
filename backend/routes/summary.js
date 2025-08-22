import express from 'express';
import { query } from '../config/database.js';

const router = express.Router();

/**
 * 获取指定卡号的汇总表数据
 * GET /api/summary/:cardId
 */
router.get('/:cardId', async (req, res) => {
  const { cardId } = req.params;
  
  if (!cardId) {
    return res.status(400).json({
      success: false,
      message: '卡号参数不能为空'
    });
  }

  try {
    // 查询汇总表数据
    const summaryRows = await query(`
      SELECT 
        主端卡号,
        最后交易时间,
        首次交易时间,
        交易次数,
        交易流水,
        疑似团伙卡,
        交易余额,
        出款次数,
        进款次数,
        单次出款平均值,
        单次进款平均值,
        峰值日期,
        峰值次数,
        三方支付次数,
        公司次数,
        消费次数,
        空壳公司次数,
        转账次数,
        三方支付金额,
        公司金额,
        消费金额,
        空壳公司金额,
        转账金额,
        消费率,
        消费占比,
        进出比,
        卡性质
      FROM 汇总表 
      WHERE 主端卡号 = ?
    `, [cardId]);

    if (summaryRows.length === 0) {
      return res.json({
        success: false,
        message: '未找到该卡号的汇总数据'
      });
    }
    console.log('查询结果:', summaryRows);

    const summaryData = summaryRows[0];
    
    // 格式化响应数据
    const formattedData = {
      cardId: summaryData.主端卡号,
      lastTransactionTime: summaryData.最后交易时间,
      firstTransactionTime: summaryData.首次交易时间,
      transactionCount: summaryData.交易次数,
      transactionSerial: summaryData.交易流水,
      suspiciousGroupCard: summaryData.疑似团伙卡,
      transactionBalance: summaryData.交易余额,
      outboundCount: summaryData.出款次数,
      inboundCount: summaryData.进款次数,
      avgOutboundAmount: summaryData.单次出款平均值,
      avgInboundAmount: summaryData.单次进款平均值,
      peakDate: summaryData.峰值日期,
      peakCount: summaryData.峰值次数,
      thirdPartyPaymentCount: summaryData.三方支付次数,
      companyCount: summaryData.公司次数,
      consumptionCount: summaryData.消费次数,
      shellCompanyCount: summaryData.空壳公司次数,
      transferCount: summaryData.转账次数,
      thirdPartyPaymentAmount: summaryData.三方支付金额,
      companyAmount: summaryData.公司金额,
      consumptionAmount: summaryData.消费金额,
      shellCompanyAmount: summaryData.空壳公司金额,
      transferAmount: summaryData.转账金额,
      consumptionRate: summaryData.消费率,
      consumptionRatio: summaryData.消费占比,
      inOutRatio: summaryData.进出比,
      cardNature: summaryData.卡性质
    };

    res.json({
      success: true,
      data: formattedData
    });

  } catch (error) {
    console.error('获取汇总数据失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

export default router;