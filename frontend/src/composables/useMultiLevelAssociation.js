import { ref, reactive } from 'vue'
import { fundApi } from '../api'

/**
 * 多层级关联分析组合式函数
 * 
 * 核心功能：
 * 1. 从指定的根节点开始，递归发现多层级的资金流向关联
 * 2. 支持智能过滤，避免无意义的弱关联
 * 3. 提供可配置的关联规则和层级限制
 * 4. 防止循环引用和无限递归
 * 
 * 算法原理：
 * A -> B, C (第一层搜索A，发现关联B、C)
 * B -> D, E; C -> F (第二层搜索B、C，发现D、E、F)  
 * D -> G; E -> H (第三层继续递归...)
 * 
 * @returns {Object} 多层级关联分析相关的方法和状态
 */
export function useMultiLevelAssociation() {
  // ========== 状态管理 ==========
  const loading = ref(false) // 加载状态
  const maxLevels = ref(3) // 默认最大层级深度
  const currentLevel = ref(1) // 当前处理的层级
  
  // 使用Map存储每层数据，key为层级数，value为该层的节点和连接数据
  const levelData = reactive(new Map()) 
  
  // 已处理的节点集合，防止重复处理和循环引用
  const processedNodes = ref(new Set()) 
  
  // 关联分析规则配置 - 优化默认值
  const associationRules = ref({
    minAmount: 500, // 降低最小金额阈值，发现更多关联
    maxNodesPerLevel: 15, // 适中的每层节点数限制
    enableSmartFilter: true, // 启用智能过滤
    includeIndirectLinks: true // 包含间接关联
  })

  // ========== 核心算法实现 ==========
  
  /**
   * 多层级递归关联查找 - 主入口函数
   * 
   * 执行流程：
   * 1. 初始化：清空之前的数据，设置第一层节点
   * 2. 逐层递归：从第一层开始，依次发现每一层的关联节点
   * 3. 关联发现：分析上一层节点的所有连接，找出下一层候选节点
   * 4. 智能过滤：根据关联规则过滤掉弱关联和无意义连接
   * 5. 数据合并：将所有层级数据合并为最终图谱结构
   * 
   * @param {Array} rootCardIds - 根节点卡号数组（第一层搜索的起始卡号）
   * @param {Number} maxDepth - 最大递归深度（防止无限递归）
   * @param {Function} onProgress - 进度回调函数（可选，用于UI更新）
   * @returns {Promise<Object>} 包含所有层级节点和连接的图谱数据
   */
  const discoverMultiLevelAssociations = async (rootCardIds, maxDepth = 3, onProgress) => {
    try {
      loading.value = true
      
      // 重置所有状态，开始新的多层级分析
      levelData.clear()
      processedNodes.value.clear()
      currentLevel.value = 1

      // 步骤1：初始化第一层（根节点层）
      const level1Nodes = new Set(rootCardIds)
      levelData.set(1, {
        nodes: new Map(), // 存储节点数据，key为cardId
        links: new Map(), // 存储连接数据，key为linkId
        cardIds: level1Nodes // 存储该层所有卡号
      })

      // 步骤2：获取第一层的完整图谱数据
      await fetchLevelData(1, Array.from(level1Nodes))
      onProgress?.({ level: 1, total: maxDepth, nodes: level1Nodes.size })

      // 步骤3：递归获取后续层级数据
      for (let level = 2; level <= maxDepth; level++) {
        const prevLevelData = levelData.get(level - 1)
        
        // 检查上一层是否有数据，没有则停止递归
        if (!prevLevelData || prevLevelData.cardIds.size === 0) {
          console.log(`第${level}层：上一层无数据，停止递归`)
          break
        }

        // 分析上一层的连接，找出下一层的关联节点
        const nextLevelCardIds = await findNextLevelAssociations(level - 1)
        
        // 如果没有找到新的关联节点，停止递归
        if (nextLevelCardIds.size === 0) {
          console.log(`第${level}层：未发现新关联节点，停止递归`)
          break
        }

        // 初始化当前层级的数据结构
        levelData.set(level, {
          nodes: new Map(),
          links: new Map(),
          cardIds: nextLevelCardIds
        })

        // 获取当前层级的图谱数据
        await fetchLevelData(level, Array.from(nextLevelCardIds))
        onProgress?.({ level, total: maxDepth, nodes: nextLevelCardIds.size })
        currentLevel.value = level
      }

      // 步骤4：合并所有层级数据并返回最终结果
      return buildFinalGraphData()
      
    } catch (error) {
      console.error('多层级关联发现失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 查找下一层级的关联节点 - 关联发现核心算法
   * 
   * 算法逻辑：
   * 1. 遍历当前层级的所有连接（交易关系）
   * 2. 分析每个连接的source和target，找出指向下一层的节点
   * 3. 应用过滤规则，排除弱关联和已处理的节点
   * 4. 返回候选的下一层节点集合
   * 
   * 举例：当前层有A、B两个节点
   * - A的连接：A->C, A->D, E->A
   * - B的连接：B->F, G->B  
   * - 下一层候选：C, D, E, F, G
   * 
   * @param {Number} currentLevelNum - 当前层级编号
   * @returns {Set} 下一层级的卡号集合
   */
  const findNextLevelAssociations = async (currentLevelNum) => {
    const currentLevelData = levelData.get(currentLevelNum)
    if (!currentLevelData) {
      console.warn(`第${currentLevelNum}层数据不存在`)
      return new Set()
    }

    const nextLevelCardIds = new Set()
    
    console.log(`分析第${currentLevelNum}层的${currentLevelData.links.size}个连接`)
    
    // 遍历当前层级的所有交易连接
    for (const [linkId, link] of currentLevelData.links) {
      const sourceInCurrentLevel = currentLevelData.cardIds.has(link.source)
      const targetInCurrentLevel = currentLevelData.cardIds.has(link.target)
      
      // 情况1：当前层的节点指向外部节点（出向关联）
      if (sourceInCurrentLevel && !processedNodes.value.has(link.target)) {
        if (shouldIncludeAssociation(link, 'target')) {
          nextLevelCardIds.add(link.target)
          console.log(`发现出向关联: ${link.source} -> ${link.target}`)
        }
      }
      
      // 情况2：外部节点指向当前层的节点（入向关联）
      if (targetInCurrentLevel && !processedNodes.value.has(link.source)) {
        if (shouldIncludeAssociation(link, 'source')) {
          nextLevelCardIds.add(link.source)
          console.log(`发现入向关联: ${link.source} -> ${link.target}`)
        }
      }
    }

    console.log(`第${currentLevelNum + 1}层候选节点数量: ${nextLevelCardIds.size}`)

    // 应用每层最大节点数限制，防止图谱过于复杂
    if (nextLevelCardIds.size > associationRules.value.maxNodesPerLevel) {
      console.warn(`第${currentLevelNum + 1}层节点数量超限，从${nextLevelCardIds.size}个限制到${associationRules.value.maxNodesPerLevel}个`)
      
      // 可以在这里实现更智能的节点选择策略，比如按交易金额排序
      const sortedCardIds = Array.from(nextLevelCardIds)
      return new Set(sortedCardIds.slice(0, associationRules.value.maxNodesPerLevel))
    }

    return nextLevelCardIds
  }

  /**
   * 判断是否应该包含此关联
   * @param {Object} link - 连接对象
   * @param {String} direction - 方向 ('source' 或 'target')
   */
  const shouldIncludeAssociation = (link, direction) => {
    const rules = associationRules.value
    
    // 金额过滤
    if (rules.minAmount && link.amount < rules.minAmount) {
      return false
    }
    
    // 智能过滤：优先选择交易频次高或金额大的关联
    if (rules.enableSmartFilter) {
      const score = calculateAssociationScore(link)
      return score > 0.05 // 降低阈值，发现更多有价值的关联
    }
    
    return true
  }

  /**
   * 计算关联重要性评分
   * @param {Object} link - 连接对象
   */
  const calculateAssociationScore = (link) => {
    const amountScore = Math.min(link.amount / 100000, 1) // 金额权重
    const countScore = Math.min((link.count || 1) / 10, 1) // 频次权重
    const timeScore = link.isRecent ? 0.5 : 0 // 时间权重
    
    return (amountScore * 0.4 + countScore * 0.4 + timeScore * 0.2)
  }

  // ========== 数据获取和错误处理 ==========
  
  /**
   * 获取指定层级的数据 - 带完善错误处理的数据获取
   * 
   * 错误处理策略：
   * 1. 单个节点失败不影响整体流程
   * 2. 记录详细的错误信息用于调试
   * 3. 统计成功和失败的节点数量
   * 4. 提供降级处理机制
   * 
   * @param {Number} level - 目标层级
   * @param {Array} cardIds - 需要获取数据的卡号数组
   */
  const fetchLevelData = async (level, cardIds) => {
    const levelInfo = levelData.get(level)
    if (!levelInfo) {
      console.error(`第${level}层数据结构未初始化`)
      return
    }

    if (!cardIds || cardIds.length === 0) {
      console.warn(`第${level}层没有需要获取的卡号`)
      return
    }

    console.log(`开始获取第${level}层数据，卡号数量: ${cardIds.length}`)
    
    let successCount = 0
    let failureCount = 0
    const errorDetails = []

    // 批量获取节点数据，使用Promise.allSettled确保不会因单个失败而中断
    const promises = cardIds.map(async (cardId) => {
      try {
        // 增加超时保护和重试机制
        const response = await Promise.race([
          fundApi.getGraphData(cardId),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('请求超时')), 10000)
          )
        ])
        
        const data = response.data || response
        
        if (!data || (!data.nodes && !data.links)) {
          throw new Error('返回数据格式错误或为空')
        }
        
        successCount++
        return { cardId, data, success: true }
        
      } catch (error) {
        failureCount++
        const errorDetail = {
          cardId,
          error: error.message,
          code: error.code || 'UNKNOWN',
          timestamp: new Date().toISOString()
        }
        errorDetails.push(errorDetail)
        console.warn(`获取节点 ${cardId} 数据失败:`, error)
        return { cardId, data: null, success: false, error }
      }
    })

    const results = await Promise.allSettled(promises)
    
    console.log(`第${level}层数据获取完成 - 成功: ${successCount}, 失败: ${failureCount}`)
    
    // 处理获取到的数据
    let processedNodesCount = 0
    let skippedNodesCount = 0
    
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.success && result.value.data) {
        const { cardId, data } = result.value
        
        try {
          // 数据有效性检查
          if (!cardId) {
            console.warn('节点数据缺少cardId')
            skippedNodesCount++
            return
          }
          
          // 处理节点数据
          if (data.nodes && Array.isArray(data.nodes)) {
            data.nodes.forEach(node => {
              // 节点数据完整性检查
              if (!node.cardId) {
                console.warn('节点缺少cardId字段:', node)
                return
              }
              
              if (!levelInfo.nodes.has(node.cardId)) {
                // 设置节点层级属性
                node.level = level
                node.levelColor = getLevelColor(level)
                
                // 确保必要的默认值
                node.name = node.name || `节点${node.cardId}`
                node.amount = node.amount || 0
                node.category = node.category || `第${level}层节点`
                
                levelInfo.nodes.set(node.cardId, node)
              }
            })
          }
          
          // 处理连接数据
          if (data.links && Array.isArray(data.links)) {
            data.links.forEach(link => {
              // 连接数据完整性检查
              if (!link.source || !link.target) {
                console.warn('连接缺少source或target字段:', link)
                return
              }
              
              const linkId = `${link.source}-${link.target}`
              if (!levelInfo.links.has(linkId)) {
                // 确保必要的默认值
                link.amount = link.amount || 0
                link.count = link.count || 1
                link.direction = link.direction || '未知'
                
                levelInfo.links.set(linkId, link)
              }
            })
          }
          
          processedNodes.value.add(cardId)
          processedNodesCount++
          
        } catch (processError) {
          console.error(`处理节点 ${cardId} 数据时发生错误:`, processError)
          skippedNodesCount++
        }
      } else {
        skippedNodesCount++
      }
    })
    
    console.log(`第${level}层数据处理完成 - 已处理: ${processedNodesCount}, 跳过: ${skippedNodesCount}`)
    
    // 如果失败过多，记录警告
    if (failureCount > cardIds.length * 0.5) {
      console.warn(`第${level}层超过50%的节点获取失败，可能影响关联分析的完整性`)
    }
    
    // 返回处理结果统计
    return {
      total: cardIds.length,
      success: successCount,
      failure: failureCount,
      processed: processedNodesCount,
      errors: errorDetails
    }
  }

  /**
   * 构建最终图谱数据
   */
  const buildFinalGraphData = () => {
    const allNodes = new Map()
    const allLinks = new Map()
    const levelStats = new Map()

    // 合并所有层级数据
    for (const [level, levelInfo] of levelData) {
      levelStats.set(level, {
        nodeCount: levelInfo.nodes.size,
        linkCount: levelInfo.links.size
      })

      // 合并节点
      for (const [cardId, node] of levelInfo.nodes) {
        if (!allNodes.has(cardId)) {
          allNodes.set(cardId, { ...node, level })
        }
      }

      // 合并连接
      for (const [linkId, link] of levelInfo.links) {
        if (!allLinks.has(linkId)) {
          allLinks.set(linkId, link)
        }
      }
    }

    return {
      nodes: Array.from(allNodes.values()),
      links: Array.from(allLinks.values()),
      levelStats,
      totalLevels: levelData.size
    }
  }

  /**
   * 获取层级颜色
   * @param {Number} level - 层级
   */
  const getLevelColor = (level) => {
    const colors = [
      '#ff4d4f', // 第一层 - 红色（搜索节点）
      '#52c41a', // 第二层 - 绿色
      '#1890ff', // 第三层 - 蓝色
      '#722ed1', // 第四层 - 紫色
      '#faad14', // 第五层 - 橙色
      '#13c2c2', // 第六层 - 青色
    ]
    return colors[(level - 1) % colors.length]
  }

  /**
   * 获取指定层级的数据
   * @param {Number} level - 层级
   */
  const getLevelData = (level) => {
    return levelData.get(level) || { nodes: new Map(), links: new Map(), cardIds: new Set() }
  }

  /**
   * 设置关联规则
   * @param {Object} rules - 新规则
   */
  const updateAssociationRules = (rules) => {
    Object.assign(associationRules.value, rules)
  }

  /**
   * 重置多层级数据
   */
  const resetMultiLevelData = () => {
    levelData.clear()
    processedNodes.value.clear()
    currentLevel.value = 1
  }

  /**
   * 获取层级统计信息
   */
  const getLevelStats = () => {
    const stats = []
    for (const [level, levelInfo] of levelData) {
      stats.push({
        level,
        nodeCount: levelInfo.nodes.size,
        linkCount: levelInfo.links.size,
        cardIds: Array.from(levelInfo.cardIds)
      })
    }
    return stats
  }

  return {
    loading,
    maxLevels,
    currentLevel,
    associationRules,
    discoverMultiLevelAssociations,
    getLevelData,
    updateAssociationRules,
    resetMultiLevelData,
    getLevelStats,
    getLevelColor
  }
}