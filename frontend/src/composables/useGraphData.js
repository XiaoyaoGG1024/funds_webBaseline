import { ref } from 'vue'
import { fundApi } from '../api'
import { useMultiLevelAssociation } from './useMultiLevelAssociation.js'

/**
 * 资金流向图谱数据管理组合式函数
 * 
 * 核心职责：
 * 1. 图谱数据的获取、存储和更新
 * 2. 单层级和多层级搜索模式的统一管理
 * 3. 节点布局算法的实现（单层级 vs 多层级）
 * 4. 节点展开和收缩功能
 * 5. 搜索历史和状态管理
 * 
 * 数据流：
 * 搜索输入 -> API调用 -> 数据处理 -> 布局计算 -> 图谱更新 -> UI渲染
 * 
 * 支持两种搜索模式：
 * - 单层级模式：只显示直接关联的节点
 * - 多层级模式：递归发现多层关联关系
 * 
 * @returns {Object} 图谱数据管理相关的状态和方法
 */
export function useGraphData() {
  // ========== 核心数据状态 ==========
  const loading = ref(false) // 全局加载状态
  const graphData = ref({ nodes: [], links: [] }) // 当前显示的图谱数据
  const originalGraphData = ref({ nodes: [], links: [] }) // 原始图谱数据（未过滤）
  const filteredGraphData = ref({ nodes: [], links: [] }) // 过滤后的图谱数据
  const expandedNodes = ref(new Set()) // 已展开的节点集合
  
  // ========== 多层级关联功能集成 ==========
  const multiLevelMode = ref(true) // 默认启用多层级模式
  const {
    discoverMultiLevelAssociations, // 多层级关联发现算法
    getLevelData, // 获取指定层级数据
    updateAssociationRules, // 更新关联规则
    resetMultiLevelData, // 重置多层级数据
    getLevelStats, // 获取层级统计
    getLevelColor, // 获取层级颜色
    associationRules, // 关联规则配置
    currentLevel, // 当前处理层级
    maxLevels // 最大层级数
  } = useMultiLevelAssociation()

  const updateGraphData = (data, isOriginal = false) => {
    console.log('更新图之前数据:', graphData.value)
    
    if (data.nodes && data.nodes.length > 0) {
      if (multiLevelMode.value) {
        // 多层级布局
        layoutMultiLevelNodes(data)
      } else {
        // 原有布局逻辑
        layoutSingleLevelNodes(data)
      }
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
          
          // 只获取搜索节点本身，不包含关联节点
          const searchedNode = graphData.nodes.find(node => node.cardId === cardId)
          if (searchedNode) {
            searchedNode.isSearched = true
            searchedNode.itemStyle = { color: '#ff4d4f', shadowBlur: 10 }
            searchedNode.category = '搜索节点'
            searchedNode.symbolSize = 35
            
            allNodes.push(searchedNode)
          }
          
          // 不添加任何连接，只显示搜索节点
          
        } else if (result.status === 'rejected') {
          console.warn(`卡号 ${cardId} 请求失败:`, result.reason?.response?.data?.error || result.reason?.message)
          failedCards.push(cardId)
        }
      })
      
      if (allNodes.length > 0) {
        // 设置搜索节点的布局位置
        allNodes.forEach((node, index) => {
          if (allNodes.length === 1) {
            node.x = 400
            node.y = 300
          } else {
            const angle = (index / allNodes.length) * 2 * Math.PI
            const radius = 100
            node.x = 400 + radius * Math.cos(angle)
            node.y = 300 + radius * Math.sin(angle)
          }
          node.fixed = false
        })
        
        console.log('搜索结果:', { nodes: allNodes, links: allLinks })
        updateGraphData({ nodes: allNodes, links: allLinks }, true)
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

      // 分类新节点：转入（右边）和转出（左边）
      const incomingNodes = []
      const outgoingNodes = []
      
      newNodes.forEach(node => {
        if (!searchedCardIds.value.has(node.cardId)) {
          // 检查节点与中心节点的关系
          const hasIncomingLink = newLinks.some(link => 
            link.source === node.cardId && link.target === cardId
          )
          const hasOutgoingLink = newLinks.some(link => 
            link.source === cardId && link.target === node.cardId
          )
          
          if (hasIncomingLink) {
            incomingNodes.push(node)
            node.itemStyle = { 
              color: '#52c41a', // 转入绿色
              borderColor: '#389e0d',
              borderWidth: 2
            }
            node.category = '转入节点'
          } else if (hasOutgoingLink) {
            outgoingNodes.push(node)
            node.itemStyle = { 
              color: '#faad14', // 转出橙色
              borderColor: '#d48806',
              borderWidth: 2
            }
            node.category = '转出节点'
          } else {
            // 关联节点（既有进又有出或者间接关联）
            outgoingNodes.push(node)
            node.itemStyle = { 
              color: '#1890ff', // 关联蓝色
              borderColor: '#096dd9',
              borderWidth: 2
            }
            node.category = '关联节点'
          }
          node.symbolSize = 22
        }
      })

      // 转入节点布局（右边扇形分布）
      incomingNodes.forEach((node, index) => {
        const angle = (index / Math.max(1, incomingNodes.length - 1)) * Math.PI * 0.6 - Math.PI * 0.3 // -54度到+54度
        const radius = 250 + Math.random() * 50 // 添加随机性避免重叠
        node.x = centerX + radius * Math.cos(angle)
        node.y = centerY + radius * Math.sin(angle)
      })

      // 转出节点布局（左边扇形分布）  
      outgoingNodes.forEach((node, index) => {
        const angle = (index / Math.max(1, outgoingNodes.length - 1)) * Math.PI * 0.6 + Math.PI * 0.7 // 126度到234度
        const radius = 250 + Math.random() * 50 // 添加随机性避免重叠
        node.x = centerX + radius * Math.cos(angle)
        node.y = centerY + radius * Math.sin(angle)
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

  // ========== 节点布局算法 ==========
  
  /**
   * 单层级节点布局算法
   * 
   * 布局策略：
   * 1. 搜索节点：位于图谱中心或围绕中心圆形分布
   * 2. 关联节点：根据交易方向分区布局
   *    - 收入方节点：放置在右侧区域
   *    - 支出方节点：放置在左侧区域
   *    - 双向交易节点：随机分布在周围
   * 3. 添加随机偏移避免节点重叠
   * 
   * 适用场景：传统的单层关联分析，关注直接交易关系
   * 
   * @param {Object} data - 图谱数据 {nodes: [], links: []}
   */
  const layoutSingleLevelNodes = (data) => {
    const centerX = 400
    const centerY = 300
    
    // 统计搜索节点数量，避免重叠
    const searchedNodes = data.nodes.filter(node => node.isSearched)
    const searchNodeCount = searchedNodes.length
    
    data.nodes.forEach((node, index) => {
      if (node.isSearched) {
        // 搜索节点按圆形分布避免重叠
        if (searchNodeCount === 1) {
          node.x = centerX
          node.y = centerY
        } else {
          const searchIndex = searchedNodes.indexOf(node)
          const angle = (searchIndex / searchNodeCount) * 2 * Math.PI
          const radius = 80 // 搜索节点之间的距离
          node.x = centerX + radius * Math.cos(angle)
          node.y = centerY + radius * Math.sin(angle)
        }
        node.fixed = false // 不固定位置，允许力导向调整
      } else {
        const hasIncoming = data.links && data.links.some(link => link.target === node.cardId || link.target === node.id)
        const hasOutgoing = data.links && data.links.some(link => link.source === node.cardId || link.source === node.id)
        
        // 随机分布避免重叠
        const randomAngle = Math.random() * 2 * Math.PI
        const randomRadius = 200 + Math.random() * 150
        
        if (hasIncoming && !hasOutgoing) {
          // 收入方节点放在右边区域
          node.x = centerX + randomRadius * Math.cos(randomAngle * 0.5)
          node.y = centerY + randomRadius * Math.sin(randomAngle * 0.5)
        } else if (hasOutgoing && !hasIncoming) {
          // 支出方节点放在左边区域  
          node.x = centerX - randomRadius * Math.cos(randomAngle * 0.5)
          node.y = centerY + randomRadius * Math.sin(randomAngle * 0.5)
        } else {
          // 其他节点随机分布
          node.x = centerX + randomRadius * Math.cos(randomAngle)
          node.y = centerY + randomRadius * Math.sin(randomAngle)
        }
      }
    })
  }

  /**
   * 多层级节点布局算法
   * 
   * 布局策略：
   * 1. 层级化环形布局：不同层级的节点分布在不同半径的环上
   * 2. 第一层（搜索节点）：位于中心区域，半径最小
   * 3. 后续层级：半径递增，形成同心圆结构
   * 4. 层级颜色：每层使用不同颜色便于区分
   * 5. 随机偏移：避免完美圆形，使布局更自然
   * 
   * 视觉特点：
   * - 中心向外扩散的布局，直观显示关联层级
   * - 颜色编码的层级区分
   * - 动态调整的环形半径
   * 
   * 适用场景：多层级关联分析，展示资金流向的传播路径
   * 
   * @param {Object} data - 包含层级信息的图谱数据
   */
  const layoutMultiLevelNodes = (data) => {
    const centerX = 400
    const centerY = 300
    const levelRadius = 180 // 层级间距
    
    // 按层级分组节点
    const nodesByLevel = new Map()
    data.nodes.forEach(node => {
      const level = node.level || 1
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, [])
      }
      nodesByLevel.get(level).push(node)
    })
    
    // 为每层节点分配位置
    for (const [level, nodes] of nodesByLevel) {
      const radius = levelRadius * (level - 1)
      const nodeCount = nodes.length
      
      if (level === 1) {
        // 第一层（搜索节点）居中分布
        if (nodeCount === 1) {
          nodes[0].x = centerX
          nodes[0].y = centerY
        } else {
          nodes.forEach((node, index) => {
            const angle = (index / nodeCount) * 2 * Math.PI
            const r = Math.min(50, 20 + nodeCount * 3) // 根据节点数调整半径
            node.x = centerX + r * Math.cos(angle)
            node.y = centerY + r * Math.sin(angle)
          })
        }
      } else {
        // 其他层级环形分布
        nodes.forEach((node, index) => {
          const baseAngle = (index / nodeCount) * 2 * Math.PI
          // 添加随机偏移避免完美圆形
          const angleOffset = (Math.random() - 0.5) * 0.3
          const angle = baseAngle + angleOffset
          
          // 添加随机半径偏移
          const radiusOffset = (Math.random() - 0.5) * 30
          const finalRadius = radius + radiusOffset
          
          node.x = centerX + finalRadius * Math.cos(angle)
          node.y = centerY + finalRadius * Math.sin(angle)
          
          // 设置层级颜色
          node.itemStyle = {
            ...node.itemStyle,
            color: getLevelColor(level)
          }
        })
      }
    }
  }

  /**
   * 多层级关联搜索
   */
  const searchMultiLevelAssociations = async (searchKeyword, searchHistory, searchedCardIds, refreshChart, maxDepth = 3) => {
    if (!searchKeyword.value.trim()) return null

    try {
      multiLevelMode.value = true
      resetMultiLevelData()
      
      const cardIds = searchKeyword.value.split(',').map(id => id.trim()).filter(id => id.length > 0)
      
      const progressCallback = (progress) => {
        console.log(`发现第${progress.level}层关联，共${progress.nodes}个节点`)
      }
      
      const result = await discoverMultiLevelAssociations(cardIds, maxDepth, progressCallback)
      
      if (result.nodes.length > 0) {
        // 更新搜索历史
        const keyword = searchKeyword.value.trim()
        if (!searchHistory.value.includes(keyword)) {
          searchHistory.value.unshift(keyword)
          searchHistory.value = searchHistory.value.slice(0, 10)
          localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value))
        }
        
        searchedCardIds.value = new Set(cardIds)
        updateGraphData(result, true)
        expandedNodes.value.clear()
        
        if (refreshChart) {
          refreshChart()
        }
        
        return { 
          success: true, 
          message: `发现${result.totalLevels}层关联，共${result.nodes.length}个节点`,
          levelStats: result.levelStats
        }
      } else {
        return { success: false, message: '未找到多层级关联数据' }
      }
    } catch (error) {
      console.error('多层级关联搜索失败:', error)
      return { success: false, message: '多层级关联搜索失败' }
    }
  }

  /**
   * 切换搜索模式
   */
  const toggleSearchMode = () => {
    multiLevelMode.value = !multiLevelMode.value
    resetMultiLevelData()
  }

  return {
    loading,
    graphData,
    originalGraphData,
    filteredGraphData,
    expandedNodes,
    updateGraphData,
    searchNode,
    expandNode,
    // 多层级关联功能
    multiLevelMode,
    searchMultiLevelAssociations,
    toggleSearchMode,
    associationRules,
    updateAssociationRules,
    getLevelStats,
    currentLevel,
    maxLevels
  }
}