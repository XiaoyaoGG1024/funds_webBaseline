<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>节点详情</h3>
        <button @click="$emit('close')" class="close-btn">&times;</button>
      </div>
     
      
      <div class="modal-body">

        <div class="detail-section">
          <div class="detail-row">
            <span class="label">姓名：</span>
            <span class="value">{{ nodeData.name || '未知' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">卡号：</span>
            <span class="value">{{ nodeData.cardId }}</span>
          </div>
          <div class="detail-row">
            <span class="label">身份证号：</span>
            <span class="value">{{ nodeData.idCard || '未知' }}</span>
          </div>
          <div class="detail-row">
            <span class="label">开户银行：</span>
            <span class="value">{{ nodeData.bank || '未知' }}</span>
          </div>
        </div>
        
        <div class="detail-section" v-if="nodeData.summary">
          <h4>交易汇总</h4>
          <div class="detail-row">
            <span class="label">总进金额：</span>
            <span class="value amount-in">¥{{ formatAmount(nodeData.summary.totalInAmount) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">总出金额：</span>
            <span class="value amount-out">¥{{ formatAmount(nodeData.summary.totalOutAmount) }}</span>
          </div>
          <div class="detail-row">
            <span class="label">交易总笔数：</span>
            <span class="value">{{ nodeData.summary.totalCount }}</span>
          </div>
          <div class="detail-row">
            <span class="label">最大单笔金额：</span>
            <span class="value">¥{{ formatAmount(nodeData.summary.maxAmount) }}</span>
          </div>
          <div class="detail-row" v-if="nodeData.summary.tags">
            <span class="label">风险标签：</span>
            <span class="value">
              <span 
                v-for="tag in nodeData.summary.tags" 
                :key="tag" 
                class="risk-tag"
                :class="getTagClass(tag)"
              >
                {{ tag }}
              </span>
            </span>
          </div>
        </div>
        
        <div class="detail-section" v-if="nodeData.recentTransactions">
          <h4>近期交易</h4>
          <div class="transaction-list">
            <div 
              v-for="transaction in nodeData.recentTransactions" 
              :key="transaction.id"
              class="transaction-item"
            >
              <div class="transaction-info">
                <span class="transaction-time">{{ formatTime(transaction.time) }}</span>
                <span class="transaction-type" :class="transaction.type === '收入' ? 'type-in' : 'type-out'">
                  {{ transaction.type }}
                </span>
                <span class="transaction-amount" :class="transaction.type === '收入' ? 'amount-in' : 'amount-out'">
                  ¥{{ formatAmount(transaction.amount) }}
                </span>
              </div>
              <div class="transaction-desc">{{ transaction.description }}</div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button @click="$emit('close')" class="btn btn-default">关闭</button>
        <button 
          @click="toggleExpansion" 
          class="btn btn-primary"
          :class="{ 'btn-warning': nodeData.expanded }"
        >
          {{ nodeData.expanded ? '收起路径' : '展开路径' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import moment from 'moment'
import api from '../api'

export default {
  name: 'NodeDetailModal',
  props: {
    nodeData: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      fullSummaryData: null,
      loadingSummary: false
    }
  },
  watch: {
    'nodeData.cardId': {
      handler(newCardId) {
        this.fetchFullSummary(newCardId);
      },
      immediate: true
    }
  },
  emits: ['close', 'expand'],
  methods: {
    async fetchFullSummary(cardId) {
      if (!cardId) {
        this.fullSummaryData = null;
        return;
      }
      console.log('Fetching summary data for cardId:', cardId);
      this.loadingSummary = true;
      try {
        const res = await api.get(`/summary/${cardId}`);
        // axios返回结构为 { data: { success: true, data: {...} } }
        if (res && res.data && res.data.success && res.data.data) {
          this.fullSummaryData = res.data.data;
        } else {
          this.fullSummaryData = null;
          console.warn('No summary data found or invalid response:', res);
        }
      } catch (error) {
        console.error("获取弹窗汇总信息失败:", error);
        this.fullSummaryData = null;
      } finally {
        this.loadingSummary = false;
      }
    },
    formatAmount(amount) {
      if (!amount) return '0'
      return Number(amount).toLocaleString()
    },
    
    formatTime(time) {
            return time ? moment(time).format('YYYY-MM-DD HH:mm:ss') : 'N/A'
    },
    
    getTagClass(tag) {
      const riskTags = {
        '高风险': 'tag-high-risk',
        '可疑': 'tag-suspicious',
        '正常': 'tag-normal',
        '收款卡': 'tag-receiver',
        '中转卡': 'tag-transfer',
        '空壳公司': 'tag-shell'
      }
      return riskTags[tag] || 'tag-default'
    },
    
    toggleExpansion() {
      if (this.nodeData.onExpand) {
        this.nodeData.onExpand()
      }
      this.$emit('close')
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  justify-content: center;
  z-index: 2000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h3 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #666;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  max-height: 70vh;
}

.detail-section {
  margin-bottom: 1.5rem;
}

.detail-section h4 {
  margin: 0 0 0.75rem 0;
  color: #333;
  font-size: 16px;
  border-bottom: 2px solid #1890ff;
  padding-bottom: 0.25rem;
}

.detail-row {
  display: flex;
  margin-bottom: 0.5rem;
  align-items: center;
}

.label {
  font-weight: 500;
  color: #666;
  width: 100px;
  flex-shrink: 0;
}

.value {
  color: #333;
  flex: 1;
}

.amount-in {
  color: #52c41a;
  font-weight: 500;
}

.amount-out {
  color: #ff4d4f;
  font-weight: 500;
}

.risk-tag {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  font-size: 12px;
  margin-right: 0.5rem;
  font-weight: 500;
}

.tag-high-risk {
  background: #ffebe6;
  color: #ff4d4f;
}

.tag-suspicious {
  background: #fff2e6;
  color: #fa8c16;
}

.tag-normal {
  background: #f6ffed;
  color: #52c41a;
}

.tag-receiver {
  background: #e6fffb;
  color: #13c2c2;
}

.tag-transfer {
  background: #f9f0ff;
  color: #722ed1;
}

.tag-shell {
  background: #fef1f0;
  color: #cf1322;
}

.tag-default {
  background: #fafafa;
  color: #666;
}

.transaction-list {
  max-height: 200px;
  overflow-y: auto;
}

.transaction-item {
  padding: 0.75rem;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.transaction-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.25rem;
}

.transaction-time {
  color: #999;
  font-size: 12px;
}

.transaction-type {
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.type-in {
  background: #f6ffed;
  color: #52c41a;
}

.type-out {
  background: #fff2f0;
  color: #ff4d4f;
}

.transaction-amount {
  font-weight: 500;
  margin-left: auto;
}

.transaction-desc {
  color: #666;
  font-size: 13px;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #f0f0f0;
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.btn-default {
  background: #f0f0f0;
  color: #666;
}

.btn-default:hover {
  background: #d9d9d9;
}

.btn-primary {
  background: #1890ff;
  color: white;
}

.btn-primary:hover {
  background: #40a9ff;
}

.btn-warning {
  background: #faad14 !important;
  color: white;
}

.btn-warning:hover {
  background: #ffc53d !important;
}
</style>