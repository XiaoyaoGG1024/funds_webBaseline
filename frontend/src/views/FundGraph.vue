<template>
  <div class="fund-graph">
    <div class="control-panel">
      <div class="search-section">
        <input 
          v-model="searchKeyword"
          @keyup.enter="searchNode"
          placeholder="搜索卡号"
          class="search-input"
        />
        <button @click="searchNode" class="btn btn-primary">搜索</button>
      </div>
      <div class="filter-section">
        <label>交易方向：</label>
        <select v-model="selectedDirection" class="type-select">
          <option value="">全部</option>
          <option value="进">进</option>
          <option value="出">出</option>
        </select>
        <button @click="applyFilter" class="btn btn-secondary">应用过滤</button>
        <button @click="resetFilter" class="btn btn-default">重置</button>
      </div>
      <div class="export-section">
        <button @click="exportPNG" class="btn btn-success">导出PNG</button>
        <button @click="exportCSV" class="btn btn-success">导出CSV</button>
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
import { ref, onMounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { saveAs } from 'file-saver'
import { fundApi } from '../api'
import NodeDetailModal from '../components/NodeDetailModal.vue'

export default {
  name: 'FundGraph',
  components: {
    NodeDetailModal
  },
  setup() {
    const chartContainer = ref(null)
    const chart = ref(null)
    const searchKeyword = ref('')
    const selectedDirection = ref('')
    const showNodeDetail = ref(false)
    const selectedNodeData = ref(null)
    const loading = ref(false)
    const graphData = ref({ nodes: [], links: [] })
    const originalGraphData = ref({ nodes: [], links: [] })
    const expandedNodes = ref(new Set())

    const initChart = () => {
      if (!chartContainer.value) return

      chart.value = echarts.init(chartContainer.value)

      const option = {
        title: {
          text: '资金流向图谱',
          top: 'top',
          left: 'center'
        },
        tooltip: {
          trigger: 'item',
          formatter: (params) => {
            if (params.dataType === 'node') {
              return `${params.data.name}<br/>卡号: ${params.data.cardId}<br/>金额: ¥${params.data.amount || 0}`
            } else if (params.dataType === 'edge') {
              return `交易次数: ${params.data.count || 0}<br/>交易总金额: ¥${params.data.amount || 0}`
            }
          }
        },
        series: [{
          type: 'graph',
          layout: 'force',
          animation: false,
          label: {
            show: true,
            position: 'right',
            formatter: function (params) {
              if (params.dataType === 'edge') {
                return `次数:${params.data.count || 0} 金额:¥${params.data.amount || 0}`
              }
              return '{b}'
            }
          },
          draggable: true,
          data: graphData.value.nodes,
          links: graphData.value.links,
          categories: [
            { name: '起始节点', itemStyle: { color: '#1890ff' } },
            { name: '收款方', itemStyle: { color: '#52c41a' } },
            { name: '付款方', itemStyle: { color: '#faad14' } },
            { name: '中转卡', itemStyle: { color: '#722ed1' } },
            { name: '风险卡', itemStyle: { color: '#ff4d4f' } }
          ],
          force: {
            initLayout: 'circular',
            repulsion: 1000,
            gravity: 0.1,
            edgeLength: 200,
            layoutAnimation: true
          },
          lineStyle: {
            color: 'source',
            curveness: 0.3
          }
        }]
      }

      chart.value.setOption(option)

      chart.value.on('click', (params) => {
        if (params.dataType === 'node') {
          onNodeClick(params.data)
        }
      })
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

    const updateGraphData = (data, isOriginal = false) => {
      console.log('更新图之前数据:', graphData.value)
      graphData.value = data
      console.log('更新图数据:', graphData.value)
      if (isOriginal) {
        originalGraphData.value = JSON.parse(JSON.stringify(data))
      }
      if (chart.value) {
        chart.value.setOption({
          series: [{
            data: graphData.value.nodes,
            links: graphData.value.links
          }]
        })
      }
    }

 const searchNode = async () => {
  if (!searchKeyword.value.trim()) return

  try {
    loading.value = true
    const res = await fundApi.getGraphData(searchKeyword.value.trim())
    console.log('响应结果:', res)
    // res 就是后端返回的对象（已是data层）
    if (res && Array.isArray(res.nodes)) {
      console.log('搜索结果:', res)
      updateGraphData(res, true)
      expandedNodes.value.clear()
    } else {
      alert('未找到相关交易数据或接口返回异常')
    }
  } catch (error) {
    console.error('搜索失败:', error)
    alert('搜索失败，请检查卡号是否正确')
  } finally {
    loading.value = false
  }
 }

    const applyFilter = () => {
      if (!originalGraphData.value.nodes.length) return
      let filteredLinks = originalGraphData.value.links.filter(link => {
        if (!selectedDirection.value) return true
        return link.direction === selectedDirection.value
      })
      const nodeIds = new Set()
      filteredLinks.forEach(link => {
        nodeIds.add(link.source)
        nodeIds.add(link.target)
      })
      let filteredNodes = originalGraphData.value.nodes.filter(node => nodeIds.has(node.id))
      updateGraphData({
        nodes: filteredNodes,
        links: filteredLinks
      })
    }

    const resetFilter = () => {
      selectedDirection.value = ''
      updateGraphData(JSON.parse(JSON.stringify(originalGraphData.value)))
    }

    const toggleNodeExpansion = async (nodeData) => {
      const nodeId = nodeData.cardId

      if (expandedNodes.value.has(nodeId)) {
        expandedNodes.value.delete(nodeId)
        collapseNode(nodeId)
      } else {
        expandedNodes.value.add(nodeId)
        await expandNode(nodeId)
      }
    }

    const expandNode = async (cardId) => {
      try {
        loading.value = true
        const newData = await fundApi.getGraphData(cardId)

        const existingNodeIds = new Set(graphData.value.nodes.map(n => n.id))
        const existingLinkIds = new Set(graphData.value.links.map(l => `${l.source}-${l.target}`))

        const newNodes = newData.nodes.filter(n => !existingNodeIds.has(n.id))
        const newLinks = newData.links.filter(l => !existingLinkIds.has(`${l.source}-${l.target}`))

        graphData.value.nodes = [...graphData.value.nodes, ...newNodes]
        graphData.value.links = [...graphData.value.links, ...newLinks]

        updateGraphData(graphData.value)
      } catch (error) {
        console.error('展开节点失败:', error)
      } finally {
        loading.value = false
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
        node => node.cardId === cardId || !connectedNodeIds.has(node.cardId)
      )

      graphData.value.links = graphData.value.links.filter(
        link => link.source !== cardId && link.target !== cardId
      )

      updateGraphData(graphData.value)
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
        ['节点ID', '节点名称', '卡号', '类型'],
        ...graphData.value.nodes.map(node => [
          node.id, node.name, node.cardId, node.category
        ]),
        [],
        ['源节点', '目标节点', '交易金额', '交易类型'],
        ...graphData.value.links.map(link => [
          link.source, link.target, link.amount, link.type
        ])
      ].map(row => row.join(',')).join('\n')

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
      saveAs(blob, `资金流向数据_${cardId}.csv`)
    }

    onMounted(async () => {
      await nextTick()
      initChart()
      updateGraphData({ nodes: [{ id: 'empty', name: '请先搜索卡号', cardId: '', category: '提示' }], links: [] }, true)
      window.addEventListener('resize', () => {
        if (chart.value) {
          chart.value.resize()
        }
      })
    })

    return {
      chartContainer,
      searchKeyword,
      selectedDirection,
      showNodeDetail,
      selectedNodeData,
      loading,
      searchNode,
      applyFilter,
      resetFilter,
      exportPNG,
      exportCSV
    }
  }
}
</script>

<style scoped>
.fund-graph {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
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
}

.search-section, .filter-section, .export-section {
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
  width: 200px;
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

.btn-secondary {
  background: #faad14;
  color: white;
}

.btn-secondary:hover {
  background: #ffc53d;
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
}

.chart-container {
  width: 100%;
  height: 100%;
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
}

.loading-spinner {
  font-size: 18px;
  color: #666;
}
</style>
