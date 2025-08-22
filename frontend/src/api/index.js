import axios from 'axios'

const API_BASE = '/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000
})

api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API请求失败:', error.response?.data?.message || error.message)
    return Promise.reject(error)
  }
)


export const fundApi = {
  getGraphData(cardId) {
    return api.get(`/graph/${cardId}`)
  },

  getNodeOnly(cardId) {
    return api.get(`/graph/${cardId}/node-only`)
  },

  batchGetGraphData(cardIds) {
    return api.post('/graph/batch', { cardIds })
  },

  getNodeDetails(cardId) {
    return api.get(`/node/${cardId}`)
  },

  batchGetNodeDetails(cardIds) {
    return api.post('/node/batch', { cardIds })
  },

  searchNode(keyword) {
    return api.get(`/search`, { params: { q: keyword } })
  },

  searchNodePaged(keyword, page = 1, pageSize = 20) {
    return api.get(`/search/paged`, { 
      params: { q: keyword, page, pageSize } 
    })
  },

  getTransactionSummary(cardId) {
    return api.get(`/summary/${cardId}`)
  },

  getSummaryList(params = {}) {
    return api.get('/summary', { params })
  },

  getTransactionsPaged(cardId, page = 1, pageSize = 50) {
    return api.get(`/transactions/${cardId}`, {
      params: { page, pageSize }
    })
  },

  getNodeConnections(cardId, limit = 5) {
    return api.get(`/node/${cardId}/connections`, {
      params: { limit }
    })
  }
}

export default api