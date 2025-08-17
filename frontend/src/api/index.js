import axios from 'axios'

const API_BASE = '/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000
})

api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)


export const fundApi = {
  getGraphData(cardId) {
  return api.get(`/graph/${cardId}`).then(response => {
    console.log('API 返回数据:', response) // 打印返回的完整数据
    return response.data // 返回接口数据
  }).catch(error => {
    console.error('API 请求失败:', error) // 打印错误信息
    throw error
  })
},
  getNodeDetails(cardId) {
    return api.get(`/node/${cardId}`)
  },
  searchNode(keyword) {
    return api.get(`/search`, { params: { q: keyword } })
  },
  getTransactionSummary(cardId) {
    return api.get(`/summary/${cardId}`)
  },
  getSummaryList(params = {}) {
    return api.get('/summary', { params })
  }
}

export default api