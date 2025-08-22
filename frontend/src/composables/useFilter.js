import { ref } from 'vue'

export function useFilter() {
  const selectedDirection = ref('')
  const minAmount = ref('')
  const maxAmount = ref('')

  const applyFilter = (originalGraphData, updateGraphData) => {
    if (!originalGraphData.value.nodes.length) return
    
    let filteredNodes = [...originalGraphData.value.nodes]
    let filteredLinks = [...originalGraphData.value.links]
    
    if (selectedDirection.value) {
      filteredLinks = filteredLinks.filter(link => 
        link.direction === selectedDirection.value
      )
    }
    
    if (minAmount.value || maxAmount.value) {
      const min = parseFloat(minAmount.value) || 0
      const max = parseFloat(maxAmount.value) || Infinity
      
      filteredLinks = filteredLinks.filter(link => {
        const amount = parseFloat(link.amount) || 0
        return amount >= min && amount <= max
      })
      
      filteredNodes = filteredNodes.filter(node => {
        const amount = parseFloat(node.amount) || 0
        return amount >= min && amount <= max
      })
    }
    
    const nodeIds = new Set()
    filteredLinks.forEach(link => {
      nodeIds.add(link.source)
      nodeIds.add(link.target)
    })
    
    filteredNodes = filteredNodes.filter(node => 
      node.isSearched || nodeIds.has(node.id)
    )
    
    const filteredData = {
      nodes: filteredNodes,
      links: filteredLinks
    }
    
    updateGraphData(filteredData)
  }

  const resetFilter = (originalGraphData, updateGraphData) => {
    selectedDirection.value = ''
    minAmount.value = ''
    maxAmount.value = ''
    updateGraphData(JSON.parse(JSON.stringify(originalGraphData.value)))
  }

  return {
    selectedDirection,
    minAmount,
    maxAmount,
    applyFilter,
    resetFilter
  }
}