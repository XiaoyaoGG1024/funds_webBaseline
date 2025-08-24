<template>
  <div class="fund-graph">
    <div class="control-panel">
      <div class="search-section">
        <input 
          v-model="searchKeyword"
          @input="onSearchInput"
          @keyup.enter="searchNode"
          placeholder="搜索卡号（支持实时搜索）"
          class="search-input"
        />
        <button @click="searchNode" class="btn btn-primary">搜索节点</button>
        <button @click="handleClearSearch" class="btn btn-default">清空</button>
      </div>
      <div class="filter-section">
        <label>交易方向：</label>
        <select v-model="selectedDirection" @change="applyFilter" class="type-select">
          <option value="">全部</option>
          <option value="进">进</option>
          <option value="出">出</option>
        </select>
        <label>金额范围：</label>
        <input 
          v-model="minAmount" 
          @input="applyFilter"
          placeholder="最小金额"
          type="number" 
          class="amount-input"
        />
        <input 
          v-model="maxAmount" 
          @input="applyFilter"
          placeholder="最大金额"
          type="number" 
          class="amount-input"
        />
        <button @click="handleResetFilter" class="btn btn-default">重置</button>
      </div>
      <div class="export-section">
        <button @click="exportPNG" class="btn btn-success">导出PNG</button>
        <button @click="exportCSV" class="btn btn-success">导出CSV</button>
      </div>
      <div class="stats-section">
        <span class="stats-item">节点: {{ graphData.nodes.length }}</span>
        <span class="stats-item">连接: {{ graphData.links.length }}</span>
      </div>
    </div>
    
    <div class="graph-container">
      <div ref="chartContainer" class="chart-container"></div>
    </div>
    
    <NodeDetailModal 
      v-if="showNodeDetail"
      :nodeData="selectedNodeData"
      @close="showNodeDetail = false"
    />
    
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner">加载中...</div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, nextTick, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import { saveAs } from 'file-saver'
import { fundApi } from '../api'
import NodeDetailModal from '../components/NodeDetailModal.vue'
import ChartEnhancer from '../utils/chartEnhancer.js'
import { useSearch } from '../composables/useSearch.js'
import { useGraphData } from '../composables/useGraphData.js'
import { useFilter } from '../composables/useFilter.js'

export default {
  name: 'FundGraph',
  components: {
    NodeDetailModal
  },
  setup() {
    const chartContainer = ref(null)
    const chart = ref(null)
    const chartEnhancer = ref(null)
    const showNodeDetail = ref(false)
    const selectedNodeData = ref(null)
    
    // 使用组合式函数
    const {
      searchKeyword,
      searchSuggestions,
      isSearching,
      searchHistory,
      searchedCardIds,
      onSearchInput,
      clearSearch
    } = useSearch()
    
    const {
      loading,
      graphData,
      originalGraphData,
      expandedNodes,
      updateGraphData,
      searchNode: performSearch,
      expandNode,
      multiLevelMode,
      searchMultiLevelAssociations,
      toggleSearchMode,
      associationRules,
      updateAssociationRules,
      getLevelStats,
      currentLevel,
      maxLevels
    } = useGraphData()
    
    const {
      selectedDirection,
      minAmount,
      maxAmount,
      applyFilter: performFilter,
      resetFilter
    } = useFilter()

    // 图表初始化
    const initChart = () => {
      if (!chartContainer.value) return

      chart.value = echarts.init(chartContainer.value)
      
      chartEnhancer.value = new ChartEnhancer(chart.value, {
        enableZoom: false,
        enablePan: true,
        minZoom: 0.3,
        maxZoom: 3,
        zoomSensitivity: 0.05
      })

      const option = {
        title: {
          text: '资金流向图谱',
          top: 'top',
          left: 'center',
          textStyle: {
            fontSize: 18,
            color: '#333'
          }
        },
        tooltip: {
          trigger: 'item',
          confine: true,
          formatter: (params) => {
            if (params.dataType === 'node') {
              const node = params.data
              return `
                <div style="padding: 8px;">
                  <strong>${node.name}</strong><br/>
                  卡号: ${node.cardId}<br/>
                  金额: ¥${(node.amount || 0).toLocaleString()}<br/>
                  类型: ${node.category || '未知'}<br/>
                  ${node.expanded ? '已展开' : '点击展开'}
                </div>
              `
            } else if (params.dataType === 'edge') {
              const link = params.data
              return `
                <div style="padding: 8px;">
                  交易次数: ${(link.count || 0).toLocaleString()}<br/>
                  交易总金额: ¥${(link.amount || 0).toLocaleString()}<br/>
                  方向: ${link.direction || '未知'}
                </div>
              `
            }
          }
        },
        series: [{
          id: 'fund-graph-series', // 固定 ID
          name: '资金流向图',
          type: 'graph',
          layout: 'force',
          animation: true,
          animationDurationUpdate: 300,
          animationEasingUpdate: 'cubicOut',
          label: {
            show: true,
            position: 'right',
            fontSize: 11,
            formatter: function (params) {
              const node = params.data
              if (node.cardId && node.name) {
                return `${node.name}\n${node.cardId}`
              } else if (node.name) {
                return node.name.length > 8 ? node.name.substring(0, 8) + '...' : node.name
              }
              return '{b}'
            }
          },
          labelLayout: {
            hideOverlap: true
          },
          draggable: true,
          roam: { scale: false, move: true }, // 禁用缩放，保留平移
          data: [],
          links: [],
          categories: [
            { name: '搜索节点', itemStyle: { color: '#ff4d4f' } },
            { name: '关联节点', itemStyle: { color: '#52c41a' } },
            { name: '收款方', itemStyle: { color: '#52c41a' } },
            { name: '付款方', itemStyle: { color: '#faad14' } },
            { name: '中转卡', itemStyle: { color: '#722ed1' } },
            { name: '风险卡', itemStyle: { color: '#ff4d4f' } }
          ],
          force: {
            repulsion: [200, 800],
            gravity: 0.05,
            edgeLength: [120, 250],
            layoutAnimation: true,
            friction: 0.8,
            initLayout: 'circular'
          },
          edgeLabel: {
            show: true,
            fontSize: 9,
            color: '#555',
            position: 'middle',
            formatter: function(params) {
              const link = params.data
              if (link.amount && link.amount > 0) {
                return `¥${(link.amount / 10000).toFixed(1)}万`
              }
              return `${link.count || 1}笔`
            }
          },
          edgeLabelLayout: {
            hideOverlap: true,
            moveOverlap: 'shiftX'
          },
          lineStyle: {
            color: 'source',
            curveness: 0.2,
            width: (params) => {
              const amount = params.data.amount || 0
              return Math.max(1, Math.min(8, amount / 10000))
            },
            opacity: 0.8
          },
          emphasis: {
            focus: 'adjacency',
            blurScope: 'coordinateSystem',
            lineStyle: {
              width: 8,
              opacity: 1
            },
            itemStyle: {
              borderWidth: 3,
              borderColor: '#fff',
              shadowBlur: 10,
              shadowColor: 'rgba(0,0,0,0.3)'
            }
          }
        }]
      }

      chart.value.setOption(option)
      bindChartEvents()
    }

    // 图表事件绑定
    const bindChartEvents = () => {
      chart.value.on('click', (params) => {
        if (params.dataType === 'node') {
          onNodeClick(params.data)
        }
      })
      
      chart.value.on('dblclick', (params) => {
        if (params.dataType === 'node') {
          toggleNodeExpansion(params.data)
        }
      })

      // 移除有问题的事件监听
    }

    // 移除有问题的动态更新函数
    const updateEdgeLabelsPosition = () => {
      // 暂时移除，避免配置错误
    }

    const onNodeClick = async (nodeData) => {
      try {
        loading.value = true
        const details = await fundApi.getNodeDetails(nodeData.cardId)
        selectedNodeData.value = { 
          ...nodeData, 
          ...details.data,
          onExpand: () => toggleNodeExpansion(nodeData),
          expanded: expandedNodes.value.has(nodeData.cardId)
        }
        showNodeDetail.value = true
      } catch (error) {
        console.error('获取节点详情失败:', error)
      } finally {
        loading.value = false
      }
    }

    // 更新图表显示 - 优化版本，避免状态丢失
    const refreshChart = () => {
      console.log('refreshChart 被调用，当前数据:', {
        nodes: graphData.value.nodes?.length || 0,
        links: graphData.value.links?.length || 0
      })
      
      if (chart.value && graphData.value) {
        // 保存现有节点位置
        const currentOption = chart.value.getOption()
        if (currentOption?.series?.[0]?.data) {
          currentOption.series[0].data.forEach(node => {
            if (node.x && node.y && (node.id || node.cardId)) {
              nodePositionCache.value.set(node.id || node.cardId, { x: node.x, y: node.y })
            }
          })
        }
        
        // 为新节点恢复缓存位置
        const nodesWithPosition = (graphData.value.nodes || []).map(node => {
          const cachedPos = nodePositionCache.value.get(node.id || node.cardId)
          if (cachedPos && !node.x && !node.y) {
            return { ...node, x: cachedPos.x, y: cachedPos.y }
          }
          return node
        })
        
        // 只更新数据和类别，不重新初始化力导向布局
        chart.value.setOption({
          series: [{
            id: 'fund-graph-series', // 固定 ID 避免重建
            data: nodesWithPosition,
            links: graphData.value.links || [],
            categories: [
              { name: '搜索节点', itemStyle: { color: '#ff4d4f' } },
              { name: '转入节点', itemStyle: { color: '#52c41a' } },
              { name: '转出节点', itemStyle: { color: '#faad14' } },
              { name: '关联节点', itemStyle: { color: '#1890ff' } },
              { name: '中转卡', itemStyle: { color: '#722ed1' } },
              { name: '风险卡', itemStyle: { color: '#ff4d4f' } }
            ],
            edgeLabel: {
              show: true,
              fontSize: 9,
              color: '#555',
              position: 'middle',
              formatter: function(params) {
                const link = params.data
                if (link.amount && link.amount > 0) {
                  return `¥${(link.amount / 10000).toFixed(1)}万`
                }
                return `${link.count || 1}笔`
              }
            },
            edgeLabelLayout: {
              hideOverlap: true,
              moveOverlap: 'shiftX'
            }
            // 不重复设置 layout 和 force 配置，保持现有状态
          }]
        }, {
          // 使用增量更新模式，保持动画连续性
          replaceMerge: ['series'],
          notMerge: false
        })
        
        console.log('图表已增量更新，节点位置已缓存')
      } else {
        console.warn('图表或数据为空:', { chart: !!chart.value, data: !!graphData.value })
      }
    }
    // 搜索功能 - 只显示搜索节点本身
    const searchNode = async () => {
      const result = await performSearch(searchKeyword, searchHistory, searchedCardIds, refreshChart)
      if (result.success) {
        if (result.partialSuccess) {
          alert(result.message) // 显示部分成功的提示
        }
      } else {
        alert(result.message)
      }
    }
    
    const handleClearSearch = () => {
      clearSearch()
      updateGraphData({ nodes: [], links: [] }, true)
      expandedNodes.value.clear()
      debouncedRefreshChart()
    }

    // 过滤功能
    const applyFilter = () => {
      performFilter(originalGraphData, updateGraphData)
      debouncedRefreshChart()
    }

    const handleResetFilter = () => {
      resetFilter(originalGraphData, updateGraphData)
      debouncedRefreshChart()
    }

    // 节点展开/收缩 - 展开时进行关联分析
    const toggleNodeExpansion = async (nodeData) => {
      const nodeId = nodeData.cardId

      if (expandedNodes.value.has(nodeId)) {
        // 收缩节点
        expandedNodes.value.delete(nodeId)
        collapseNode(nodeId)
      } else {
        // 展开节点并进行关联分析
        expandedNodes.value.add(nodeId)
        try {
          console.log(`展开节点 ${nodeId}，正在分析关联...`)
          
          // 创建一个临时的关键字引用来调用多层级关联
          const tempKeyword = ref(nodeId)
          const tempHistory = ref([])
          
          const result = await searchMultiLevelAssociations(
            tempKeyword,
            tempHistory, 
            searchedCardIds,
            refreshChart,
            2 // 展开时只分析2层，避免图谱过于复杂
          )
          
          if (result.success) {
            console.log(`节点 ${nodeId} 关联分析完成:`, {
              新增节点: result.nodes?.length || 0,
              层级统计: result.levelStats
            })
          }
        } catch (error) {
          console.error(`展开节点 ${nodeId} 失败:`, error)
          // 即使关联分析失败，也保留原有的单层展开逻辑作为降级
          await expandNode(nodeId, searchedCardIds, refreshChart)
        }
      }
    }

    const collapseNode = (cardId) => {
      const connectedLinks = graphData.value.links.filter(
        link => link.source === cardId || link.target === cardId
      )

      const connectedNodeIds = new Set()
      connectedLinks.forEach(link => {
        if (link.source !== cardId) connectedNodeIds.add(link.source)
        if (link.target !== cardId) connectedNodeIds.add(link.target)
      })

      graphData.value.nodes = graphData.value.nodes.filter(
        node => node.isSearched || node.cardId === cardId || !connectedNodeIds.has(node.cardId)
      )

      graphData.value.links = graphData.value.links.filter(
        link => link.source !== cardId && link.target !== cardId
      )
      
      originalGraphData.value = JSON.parse(JSON.stringify(graphData.value))
      debouncedRefreshChart()
    }

    const exportPNG = () => {
      if (!chart.value) return

      const url = chart.value.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: '#fff'
      })

      const link = document.createElement('a')
      link.href = url
      link.download = `资金流向图谱_${new Date().getTime()}.png`
      link.click()
    }

    const exportCSV = () => {
      if (!graphData.value.nodes.length) return

      const csvContent = [
        ['节点ID', '节点名称', '卡号', '类型', '层级'],
        ...graphData.value.nodes.map(node => [
          node.id, node.name, node.cardId, node.category, node.level || 1
        ]),
        [],
        ['源节点', '目标节点', '交易金额', '交易类型'],
        ...graphData.value.links.map(link => [
          link.source, link.target, link.amount, link.type
        ])
      ].map(row => row.join(',')).join('\n')

      const searchKey = searchKeyword.value || 'search'
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
      saveAs(blob, `关联分析_${searchKey}.csv`)
    }
    
    // 监听过滤条件变化
    watch([selectedDirection, minAmount, maxAmount], () => {
      if (originalGraphData.value.nodes.length > 0) {
        applyFilter()
      }
    })
    
    // resize监听器引用，供清理使用
    const resizeHandler = ref(null)
    
    // 节点位置缓存，优化增量更新
    const nodePositionCache = ref(new Map())
    
    // 防抖刷新函数
    const debounce = (func, delay) => {
      let timeoutId
      return (...args) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => func.apply(this, args), delay)
      }
    }
    
    const debouncedRefreshChart = debounce(() => refreshChart(), 100)
    const debouncedUpdateLabels = debounce(() => updateEdgeLabelsPosition(), 50)
    
    onMounted(async () => {
      await nextTick()
      initChart()
      updateGraphData({ 
        nodes: [{ 
          id: 'welcome', 
          name: '请先搜索卡号', 
          cardId: '', 
          category: '提示',
          symbolSize: 40,
          itemStyle: { color: '#1890ff' }
        }], 
        links: [] 
      }, true)
      
      resizeHandler.value = () => {
        if (chart.value) {
          chart.value.resize()
        }
      }
      window.addEventListener('resize', resizeHandler.value)
    })
    
    onUnmounted(() => {
      if (chartEnhancer.value) {
        chartEnhancer.value.destroy()
      }
      if (resizeHandler.value) {
        window.removeEventListener('resize', resizeHandler.value)
      }
      if (chart.value) {
        chart.value.dispose() // 释放 ECharts 实例
      }
    })

    return {
      chartContainer,
      searchKeyword,
      selectedDirection,
      minAmount,
      maxAmount,
      showNodeDetail,
      selectedNodeData,
      loading,
      graphData,
      searchSuggestions,
      isSearching,
      searchNode,
      onSearchInput,
      handleClearSearch,
      applyFilter,
      handleResetFilter,
      exportPNG,
      exportCSV,
      searchedCardIds
    }
  }
}
</script>

<style scoped>
.fund-graph {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.control-panel {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 1rem;
  display: flex;
  gap: 2rem;
  align-items: center;
  flex-wrap: wrap;
  flex-shrink: 0;
  position: relative;
  z-index: 1000;
}

.search-section, .filter-section, .export-section, .stats-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.search-input, .amount-input, .type-select {
  padding: 0.5rem;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
}

.search-input {
  width: 250px;
}

.amount-input {
  width: 120px;
}

.type-select {
  width: 150px;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.btn-primary {
  background: #1890ff;
  color: white;
}

.btn-primary:hover {
  background: #40a9ff;
}

.btn-success {
  background: #52c41a;
  color: white;
}

.btn-success:hover {
  background: #73d13d;
}

.btn-default {
  background: #f0f0f0;
  color: #666;
}

.btn-default:hover {
  background: #d9d9d9;
}

.graph-container {
  flex: 1;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  position: relative;
  overflow: hidden;
  min-height: 0;
}

.chart-container {
  width: 100%;
  height: 100%;
  position: relative;
  cursor: grab;
}

.chart-container:active {
  cursor: grabbing;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255,255,255,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.loading-spinner {
  font-size: 18px;
  color: #666;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.stats-section {
  margin-left: auto;
  font-size: 12px;
  color: #666;
}

.stats-item {
  background: #f0f0f0;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  margin-left: 0.5rem;
}

@media (max-width: 768px) {
  .control-panel {
    flex-direction: column;
    gap: 1rem;
  }
  
  .search-section, .filter-section, .export-section {
    width: 100%;
    justify-content: center;
  }
  
  .search-input {
    width: 100%;
    max-width: 300px;
  }
  
  .stats-section {
    margin-left: 0;
    justify-content: center;
  }
}

</style>