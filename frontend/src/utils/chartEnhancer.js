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

    // 启用数据缩放
    const option = this.chart.getOption()
    
    const enhancedOption = {
      ...option,
      dataZoom: [
        {
          type: 'inside',
          disabled: false,
          zoomLock: false,
          throttle: 100
        },
        {
          type: 'slider',
          show: true,
          xAxisIndex: 0,
          start: 0,
          end: 100,
          height: 20,
          bottom: 10
        }
      ],
      toolbox: {
        feature: {
          dataZoom: {
            yAxisIndex: false
          },
          restore: {},
          saveAsImage: {
            pixelRatio: 2
          }
        }
      }
    }

    this.chart.setOption(enhancedOption, true)
    this.bindZoomEvents()
  }

  setupPanFeatures() {
    if (!this.options.enablePan) return

    const chartDom = this.chart.getDom()
    
    chartDom.addEventListener('mousedown', this.onMouseDown.bind(this))
    chartDom.addEventListener('mousemove', this.onMouseMove.bind(this))
    chartDom.addEventListener('mouseup', this.onMouseUp.bind(this))
    chartDom.addEventListener('wheel', this.onWheel.bind(this))
    
    // 防止上下文菜单
    chartDom.addEventListener('contextmenu', e => e.preventDefault())
  }

  setupToolbox() {
    const currentOption = this.chart.getOption()
    
    const toolboxFeatures = {
      ...currentOption.toolbox?.[0]?.feature || {},
      myZoomIn: {
        show: true,
        title: '放大',
        icon: 'path://M18.5,10.5l-7-7c-0.6-0.6-1.5-0.6-2.1,0s-0.6,1.5,0,2.1L15.7,12l-6.3,6.3c-0.6,0.6-0.6,1.5,0,2.1c0.3,0.3,0.7,0.4,1.1,0.4s0.8-0.1,1.1-0.4l7-7C19.1,12.9,19.1,11.1,18.5,10.5z',
        onclick: () => this.zoomIn()
      },
      myZoomOut: {
        show: true,
        title: '缩小',
        icon: 'path://M11.5,10.5l7-7c0.6-0.6,0.6-1.5,0-2.1s-1.5-0.6-2.1,0L10.1,7.7L3.8,1.4c-0.6-0.6-1.5-0.6-2.1,0c-0.6,0.6-0.6,1.5,0,2.1l6.3,6.3l-6.3,6.3c-0.6,0.6-0.6,1.5,0,2.1C2,16.6,2.4,16.7,2.8,16.7s0.8-0.1,1.1-0.4l6.3-6.3l6.3,6.3c0.3,0.3,0.7,0.4,1.1,0.4s0.8-0.1,1.1-0.4c0.6-0.6,0.6-1.5,0-2.1L11.5,10.5z',
        onclick: () => this.zoomOut()
      },
      myCenter: {
        show: true,
        title: '居中',
        icon: 'path://M12,2C6.5,2,2,6.5,2,12s4.5,10,10,10s10-4.5,10-10S17.5,2,12,2z M12,20c-4.4,0-8-3.6-8-8s3.6-8,8-8s8,3.6,8,8S16.4,20,12,20z M12,6c-3.3,0-6,2.7-6,6s2.7,6,6,6s6-2.7,6-6S15.3,6,12,6z M12,16c-2.2,0-4-1.8-4-4s1.8-4,4-4s4,1.8,4,4S14.2,16,12,16z',
        onclick: () => this.centerView()
      },
      myFitView: {
        show: true,
        title: '适应视图',
        icon: 'path://M3,3h18v18H3V3z M5,5v14h14V5H5z M7,7h10v10H7V7z',
        onclick: () => this.fitToView()
      }
    }

    this.chart.setOption({
      toolbox: {
        show: true,
        orient: 'vertical',
        left: 'right',
        top: 'center',
        feature: toolboxFeatures
      }
    })
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
    if (!this.options.enableZoom) return

    e.preventDefault()
    
    const delta = e.deltaY > 0 ? -this.options.zoomSensitivity : this.options.zoomSensitivity
    const newZoom = Math.max(this.options.minZoom, 
                           Math.min(this.options.maxZoom, this.zoomLevel + delta))
    
    if (newZoom !== this.zoomLevel) {
      this.zoomLevel = newZoom
      this.applyTransform()
    }
  }

  applyTransform() {
    const option = this.chart.getOption()
    
    // 应用缩放和平移变换
    const series = option.series[0]
    if (series && series.type === 'graph') {
      // 对于图形，我们需要更新节点位置
      this.updateNodePositions(series.data)
    }
  }

  updateNodePositions(nodes) {
    nodes.forEach(node => {
      if (node.x !== undefined && node.y !== undefined) {
        // 应用缩放和平移
        node.x = (node.x * this.zoomLevel) + this.panOffset.x
        node.y = (node.y * this.zoomLevel) + this.panOffset.y
      }
    })

    this.chart.setOption({
      series: [{
        data: nodes
      }]
    })
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