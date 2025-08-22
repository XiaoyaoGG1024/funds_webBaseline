<template>
  <div class="transaction-list">
    <div class="list-header">
      <h3>交易记录</h3>
      <div class="pagination-info">
        共 {{ totalCount }} 条记录，第 {{ currentPage }}/{{ totalPages }} 页
      </div>
    </div>
    
    <div class="virtual-container" ref="virtualContainer">
      <!-- 使用虚拟滚动渲染大量数据 -->
      <div 
        v-for="item in visibleItems" 
        :key="item.id"
        class="transaction-item"
        :class="{ 'highlighted': item.highlighted }"
      >
        <div class="transaction-basic">
          <span class="transaction-id">{{ item.transactionId }}</span>
          <span class="transaction-amount" :class="item.direction">
            {{ item.direction === '进' ? '+' : '-' }}¥{{ item.amount.toLocaleString() }}
          </span>
          <span class="transaction-date">{{ formatDate(item.date) }}</span>
        </div>
        <div class="transaction-details">
          <span class="card-info">{{ item.fromCard }} → {{ item.toCard }}</span>
          <span class="transaction-type">{{ item.type }}</span>
        </div>
      </div>
    </div>
    
    <div class="pagination-controls" v-if="totalPages > 1">
      <button 
        @click="goToPage(1)" 
        :disabled="currentPage === 1"
        class="btn btn-pagination"
      >首页</button>
      
      <button 
        @click="goToPage(currentPage - 1)" 
        :disabled="currentPage === 1"
        class="btn btn-pagination"
      >上一页</button>
      
      <span class="page-numbers">
        <button 
          v-for="page in visiblePages" 
          :key="page"
          @click="goToPage(page)"
          :class="{ 'active': page === currentPage }"
          class="btn btn-pagination page-number"
        >{{ page }}</button>
      </span>
      
      <button 
        @click="goToPage(currentPage + 1)" 
        :disabled="currentPage === totalPages"
        class="btn btn-pagination"
      >下一页</button>
      
      <button 
        @click="goToPage(totalPages)" 
        :disabled="currentPage === totalPages"
        class="btn btn-pagination"
      >尾页</button>
    </div>
    
    <div class="loading" v-if="loading">加载中...</div>
  </div>
</template>

<script>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import VirtualScroll from '../utils/virtualScroll.js'
import { fundApi } from '../api'

export default {
  name: 'TransactionList',
  props: {
    cardId: {
      type: String,
      required: true
    },
    pageSize: {
      type: Number,
      default: 50
    }
  },
  setup(props) {
    const virtualContainer = ref(null)
    const virtualScroll = ref(null)
    const transactions = ref([])
    const visibleItems = ref([])
    const loading = ref(false)
    const currentPage = ref(1)
    const totalCount = ref(0)
    const totalPages = ref(0)
    
    const visiblePages = computed(() => {
      const start = Math.max(1, currentPage.value - 2)
      const end = Math.min(totalPages.value, currentPage.value + 2)
      const pages = []
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      return pages
    })

    const loadTransactions = async (page = 1) => {
      if (!props.cardId || loading.value) return
      
      try {
        loading.value = true
        const response = await fundApi.getTransactionsPaged(props.cardId, page, props.pageSize)
        
        if (response.success) {
          transactions.value = response.data.transactions
          totalCount.value = response.data.total
          totalPages.value = response.data.totalPages
          currentPage.value = page
          
          // 更新虚拟滚动数据
          if (virtualScroll.value) {
            virtualScroll.value.setData(transactions.value)
          }
        }
      } catch (error) {
        console.error('加载交易记录失败:', error)
      } finally {
        loading.value = false
      }
    }

    const goToPage = (page) => {
      if (page >= 1 && page <= totalPages.value && page !== currentPage.value) {
        loadTransactions(page)
      }
    }

    const formatDate = (dateString) => {
      const date = new Date(dateString)
      return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const initVirtualScroll = () => {
      if (!virtualContainer.value) return
      
      virtualScroll.value = new VirtualScroll(virtualContainer.value, 60, 3)
      
      virtualScroll.value.setRenderCallback((item, index) => {
        const div = document.createElement('div')
        div.className = `transaction-item ${item.highlighted ? 'highlighted' : ''}`
        div.innerHTML = `
          <div class="transaction-basic">
            <span class="transaction-id">${item.transactionId}</span>
            <span class="transaction-amount ${item.direction}">
              ${item.direction === '进' ? '+' : '-'}¥${item.amount.toLocaleString()}
            </span>
            <span class="transaction-date">${formatDate(item.date)}</span>
          </div>
          <div class="transaction-details">
            <span class="card-info">${item.fromCard} → ${item.toCard}</span>
            <span class="transaction-type">${item.type}</span>
          </div>
        `
        return div
      })
      
      virtualScroll.value.setData(transactions.value)
    }

    watch(() => props.cardId, (newCardId) => {
      if (newCardId) {
        currentPage.value = 1
        loadTransactions(1)
      }
    })

    onMounted(async () => {
      await nextTick()
      initVirtualScroll()
      if (props.cardId) {
        loadTransactions(1)
      }
    })

    return {
      virtualContainer,
      transactions,
      visibleItems,
      loading,
      currentPage,
      totalCount,
      totalPages,
      visiblePages,
      loadTransactions,
      goToPage,
      formatDate
    }
  }
}
</script>

<style scoped>
.transaction-list {
  display: flex;
  flex-direction: column;
  height: 400px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #f0f0f0;
}

.list-header h3 {
  margin: 0;
  color: #333;
}

.pagination-info {
  font-size: 12px;
  color: #666;
}

.virtual-container {
  flex: 1;
  overflow: auto;
  position: relative;
}

.transaction-item {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f5f5f5;
  transition: background 0.2s;
}

.transaction-item:hover {
  background: #fafafa;
}

.transaction-item.highlighted {
  background: #fff7e6;
  border-left: 3px solid #faad14;
}

.transaction-basic {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.transaction-id {
  font-family: monospace;
  font-size: 12px;
  color: #666;
}

.transaction-amount {
  font-weight: bold;
  font-size: 14px;
}

.transaction-amount.进 {
  color: #52c41a;
}

.transaction-amount.出 {
  color: #ff4d4f;
}

.transaction-date {
  font-size: 12px;
  color: #999;
}

.transaction-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #666;
}

.card-info {
  font-family: monospace;
}

.transaction-type {
  background: #f0f0f0;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 11px;
}

.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  gap: 0.5rem;
  border-top: 1px solid #f0f0f0;
}

.btn-pagination {
  padding: 0.25rem 0.5rem;
  border: 1px solid #d9d9d9;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.btn-pagination:hover:not(:disabled) {
  border-color: #1890ff;
  color: #1890ff;
}

.btn-pagination:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-pagination.active {
  background: #1890ff;
  color: white;
  border-color: #1890ff;
}

.page-numbers {
  display: flex;
  gap: 0.25rem;
}

.page-number {
  min-width: 32px;
  text-align: center;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}
</style>