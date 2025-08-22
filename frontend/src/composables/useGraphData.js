import { ref } from 'vue'
import { fundApi } from '../api'

export function useGraphData() {
  const loading = ref(false)
  const graphData = ref({ nodes: [], links: [] })
  const originalGraphData = ref({ nodes: [], links: [] })
  const filteredGraphData = ref({ nodes: [], links: [] })
  const expandedNodes = ref(new Set())

  const updateGraphData = (data, isOriginal = false) => {
    console.log('更新图之前数据:', graphData.value)
    
    if (data.nodes && data.nodes.length > 0) {
      const centerX = 400
      const centerY = 300
      
      data.nodes.forEach((node, index) => {
        if (node.isSearched) {
          node.x = centerX
          node.y = centerY + index * 100
          node.fixed = true
        } else {
          const hasIncoming = data.links && data.links.some(link => link.target === node.id)
          const hasOutgoing = data.links && data.links.some(link => link.source === node.id)
          
          if (hasIncoming && !hasOutgoing) {
            node.x = centerX + 200 + Math.random() * 100
            node.y = centerY + (Math.random() - 0.5) * 400
          } else if (hasOutgoing && !hasIncoming) {
            node.x = centerX - 200 - Math.random() * 100
            node.y = centerY + (Math.random() - 0.5) * 400
          } else {
            node.x = centerX + (Math.random() - 0.5) * 300
            node.y = centerY + (Math.random() - 0.5) * 300
          }
        }
      })
    }
    
    graphData.value = data
    console.log('更新图数据:', graphData.value)
    if (isOriginal) {
      originalGraphData.value = JSON.parse(JSON.stringify(data))
    }
  }

  const searchNode = async (searchKeyword, searchHistory, searchedCardIds, refreshChart) => {
    if (!searchKeyword.value.trim()) return null

    try {
      loading.value = true
      
      const keyword = searchKeyword.value.trim()
      if (!searchHistory.value.includes(keyword)) {
        searchHistory.value.unshift(keyword)
        searchHistory.value = searchHistory.value.slice(0, 10)
        localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value))
      }
      
      const cardIds = keyword.split(',').map(id => id.trim()).filter(id => id.length > 0)
      console.log('搜索的卡号:', cardIds)
      
      searchedCardIds.value = new Set(cardIds)
      
      const nodePromises = cardIds.map(cardId => 
        fundApi.getNodeOnly(cardId)
      )
      
      const results = await Promise.allSettled(nodePromises)
      let allNodes = []
      let allLinks = []
      let failedCards = []
      
      results.forEach((result, index) => {
        const cardId = cardIds[index]
        
        if (result.status === 'fulfilled' && result.value) {
          // API返回格式: { success: true, data: { nodes: [...], links: [...] } }
          const graphData = result.value.data || result.value
          
          if (!graphData.nodes || graphData.nodes.length === 0) {
            console.warn(`卡号 ${cardId} 未找到交易数据`)
            failedCards.push(cardId)
            return
          }
          
          graphData.nodes.forEach((node, nodeIndex) => {
            if (node.cardId === cardId) {
              node.isSearched = true
              node.itemStyle = { color: '#ff4d4f', shadowBlur: 10 }
              node.category = '搜索节点'  
              node.symbolSize = 30
              // 搜索节点固定在中心位置
              node.x = 400
              node.y = 300 + nodeIndex * 120
              node.fixed = true
            }
          })
          
          allNodes.push(...graphData.nodes)
          allLinks.push(...graphData.links)
        } else if (result.status === 'rejected') {
          console.warn(`卡号 ${cardId} 请求失败:`, result.reason?.response?.data?.error || result.reason?.message)
          failedCards.push(cardId)
        }
      })
      
      if (allNodes.length > 0) {
        const nodeMap = new Map()
        const linkSet = new Set()
        
        allNodes.forEach(node => {
          if (!nodeMap.has(node.cardId)) {
            nodeMap.set(node.cardId, node)
          } else {
            const existing = nodeMap.get(node.cardId)
            if (node.isSearched) {
              existing.isSearched = true
              existing.itemStyle = node.itemStyle
              existing.category = node.category
              existing.symbolSize = node.symbolSize
            }
          }
        })
        
        allLinks.forEach(link => {
          linkSet.add(JSON.stringify(link))
        })
        
        const finalNodes = Array.from(nodeMap.values())
        const finalLinks = Array.from(linkSet).map(linkStr => JSON.parse(linkStr))
        
        console.log('搜索结果:', { nodes: finalNodes, links: finalLinks })
        updateGraphData({ nodes: finalNodes, links: finalLinks }, true)
        expandedNodes.value.clear()
        
        // 立即刷新图表
        if (refreshChart) {
          refreshChart()
        }
        
        const message = failedCards.length > 0 
          ? `搜索完成，以下卡号未找到数据：${failedCards.join(', ')}` 
          : '搜索成功'
        
        return { success: true, message, partialSuccess: failedCards.length > 0 }
      } else {
        const message = failedCards.length > 0 
          ? `未找到任何交易数据，失败的卡号：${failedCards.join(', ')}`
          : '未找到相关交易数据'
        return { success: false, message }
      }
    } catch (error) {
      console.error('搜索失败:', error)
      return { success: false, message: '搜索失败，请检查卡号是否正确' }
    } finally {
      loading.value = false
    }
  }

  const expandNode = async (cardId, searchedCardIds, refreshChart) => {
    try {
      loading.value = true
      
      const response = await fundApi.getGraphData(cardId)
      const newData = response.data || response
      if (!newData || !newData.nodes || newData.nodes.length === 0) return

      const existingNodeIds = new Set(graphData.value.nodes.map(n => n.cardId))
      const existingLinkIds = new Set(graphData.value.links.map(l => `${l.source}-${l.target}`))

      const newNodes = newData.nodes.filter(n => !existingNodeIds.has(n.cardId))
      const newLinks = newData.links.filter(l => !existingLinkIds.has(`${l.source}-${l.target}`))

      // 分析节点是进账还是出账来确定位置
      const centerNode = graphData.value.nodes.find(n => n.cardId === cardId)
      const centerX = centerNode?.x || 400
      const centerY = centerNode?.y || 300

      newNodes.forEach((node, index) => {
        if (!searchedCardIds.value.has(node.cardId)) {
          // 确定节点是进账还是出账关系
          const isIncoming = newLinks.some(link => 
            link.source === node.cardId && link.target === cardId
          )
          const isOutgoing = newLinks.some(link => 
            link.source === cardId && link.target === node.cardId
          )

          node.itemStyle = { 
            color: isIncoming ? '#52c41a' : '#faad14', // 进账绿色，出账橙色
            borderColor: isIncoming ? '#389e0d' : '#d48806',
            borderWidth: 2
          }
          node.category = isIncoming ? '进账节点' : '出账节点'
          node.symbolSize = 20

          // 设置节点位置：进账在右边，出账在左边
          const angle = (index / newNodes.length) * Math.PI * 0.8 // 扇形分布
          const radius = 200
          
          if (isIncoming) {
            // 进账节点放在右边
            node.x = centerX + radius * Math.cos(angle - Math.PI * 0.4)
            node.y = centerY + radius * Math.sin(angle - Math.PI * 0.4)
          } else {
            // 出账节点放在左边  
            node.x = centerX - radius * Math.cos(angle - Math.PI * 0.4)
            node.y = centerY + radius * Math.sin(angle - Math.PI * 0.4)
          }
        }
      })

      const updatedNodes = [...graphData.value.nodes, ...newNodes]
      const updatedLinks = [...graphData.value.links, ...newLinks]
      
      graphData.value = { nodes: updatedNodes, links: updatedLinks }
      originalGraphData.value = JSON.parse(JSON.stringify(graphData.value))
      
      updateGraphData(graphData.value)
      
      // 立即刷新图表
      if (refreshChart) {
        refreshChart()
      }
      
    } catch (error) {
      console.error('展开节点失败:', error)
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    graphData,
    originalGraphData,
    filteredGraphData,
    expandedNodes,
    updateGraphData,
    searchNode,
    expandNode
  }
}