/**
 * 图表增强器
 * 添加缩放、拖动、性能优化等功能
 */
class ChartEnhancer {
  constructor(chart, options = {}) {
    this.chart = chart
    this.options = {
      enableZoom: true,
      enablePan: true,
      enableBrush: true,
      minZoom: 0.1,
      maxZoom: 5,
      zoomSensitivity: 0.1,
      ...options
    }
    
    this.zoomLevel = 1
    this.panOffset = { x: 0, y: 0 }
    this.isDragging = false
    this.lastMousePos = { x: 0, y: 0 }
    
    this.init()
  }

  init() {
    this.setupZoomFeatures()
    this.setupPanFeatures()
    this.setupToolbox()
  }

  setupZoomFeatures() {
    if (!this.options.enableZoom) return

    // 对于图形布局，不使用dataZoom，而是使用原生缩放
    this.bindZoomEvents()
  }

  setupPanFeatures() {
    if (!this.options.enablePan) return

    const chartDom = this.chart.getDom()
    
    chartDom.addEventListener('mousedown', this.onMouseDown.bind(this))
    chartDom.addEventListener('mousemove', this.onMouseMove.bind(this))
    chartDom.addEventListener('mouseup', this.onMouseUp.bind(this))
    // 移除wheel事件监听，让ECharts原生处理
    
    // 防止上下文菜单
    chartDom.addEventListener('contextmenu', e => e.preventDefault())
  }

  setupToolbox() {
  }

  bindZoomEvents() {
    this.chart.on('datazoom', (params) => {
      console.log('数据缩放事件:', params)
    })
  }

  onMouseDown(e) {
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) { // 中键或Ctrl+左键
      this.isDragging = true
      this.lastMousePos = { x: e.clientX, y: e.clientY }
      e.preventDefault()
    }
  }

  onMouseMove(e) {
    if (!this.isDragging) return

    const deltaX = e.clientX - this.lastMousePos.x
    const deltaY = e.clientY - this.lastMousePos.y

    this.panOffset.x += deltaX
    this.panOffset.y += deltaY

    this.applyTransform()
    
    this.lastMousePos = { x: e.clientX, y: e.clientY }
    e.preventDefault()
  }

  onMouseUp(e) {
    this.isDragging = false
  }

  onWheel(e) {
    // 让ECharts原生处理缩放，不拦截wheel事件
    // ECharts图形组件自带缩放功能，无需自定义处理
  }

  applyTransform() {
    // 对于图形布局，使用ECharts原生的缩放和平移功能
    // 不需要手动变换节点位置
  }

  updateNodePositions(nodes) {
    // 对于图形布局，节点位置由ECharts的力导向算法控制
    // 不需要手动更新位置
  }

  zoomIn() {
    const newZoom = Math.min(this.options.maxZoom, this.zoomLevel + 0.2)
    if (newZoom !== this.zoomLevel) {
      this.zoomLevel = newZoom
      this.applyTransform()
    }
  }

  zoomOut() {
    const newZoom = Math.max(this.options.minZoom, this.zoomLevel - 0.2)
    if (newZoom !== this.zoomLevel) {
      this.zoomLevel = newZoom
      this.applyTransform()
    }
  }

  centerView() {
    this.panOffset = { x: 0, y: 0 }
    this.applyTransform()
  }

  fitToView() {
    this.zoomLevel = 1
    this.panOffset = { x: 0, y: 0 }
    this.applyTransform()
  }

  // 性能优化：节流渲染
  throttledRender = this.throttle((callback) => {
    callback()
  }, 16) // 60fps

  throttle(func, delay) {
    let timeoutId
    let lastExecTime = 0
    return function (...args) {
      const currentTime = Date.now()
      
      if (currentTime - lastExecTime > delay) {
        func.apply(this, args)
        lastExecTime = currentTime
      } else {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          func.apply(this, args)
          lastExecTime = Date.now()
        }, delay - (currentTime - lastExecTime))
      }
    }
  }

  getTransformState() {
    return {
      zoom: this.zoomLevel,
      pan: { ...this.panOffset }
    }
  }

  setTransformState(state) {
    this.zoomLevel = state.zoom || 1
    this.panOffset = { ...state.pan } || { x: 0, y: 0 }
    this.applyTransform()
  }

  destroy() {
    const chartDom = this.chart.getDom()
    chartDom.removeEventListener('mousedown', this.onMouseDown)
    chartDom.removeEventListener('mousemove', this.onMouseMove)
    chartDom.removeEventListener('mouseup', this.onMouseUp)
    chartDom.removeEventListener('wheel', this.onWheel)
  }
}

export default ChartEnhancer