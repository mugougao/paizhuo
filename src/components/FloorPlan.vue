<script setup>
import { ref, onMounted, watch } from 'vue'

// 组件属性定义，接收父组件传递的配置数据
const props = defineProps({
  // 会议室设置对象
  roomSettings: {
    type: Object,
    required: true
  },
  // 舞台设置对象
  stageSettings: {
    type: Object,
    required: true
  },
  // 座位分区设置数组
  seatSections: {
    type: Array,
    required: true
  }
})

// Canvas元素引用
const canvasRef = ref(null)

// 座位数据数组，存储所有生成的座位信息
const seats = ref([])

// 画布缩放比例，默认1.0
const zoom = ref(1.0)

// 画布水平偏移量，用于拖拽功能
const offsetX = ref(0)

// 画布垂直偏移量，用于拖拽功能
const offsetY = ref(0)

// 拖拽状态标志，表示是否正在拖拽画布
const isDragging = ref(false)

// 上一次鼠标事件的X坐标，用于计算拖拽距离
const lastMouseX = ref(0)

// 上一次鼠标事件的Y坐标，用于计算拖拽距离
const lastMouseY = ref(0)

// 组件挂载后的初始化操作
onMounted(() => {
  // 初始化画布大小
  updateCanvasSize()
  // 生成初始座位
  generateSeats()
  
  const canvas = canvasRef.value
  if (canvas) {
    // 绑定鼠标滚轮事件，用于缩放
    canvas.addEventListener('wheel', handleWheel)
    // 绑定鼠标按下事件，开始拖拽
    canvas.addEventListener('mousedown', handleMouseDown)
    // 绑定鼠标移动事件，处理拖拽
    canvas.addEventListener('mousemove', handleMouseMove)
    // 绑定鼠标释放事件，结束拖拽
    canvas.addEventListener('mouseup', handleMouseUp)
    // 绑定鼠标离开事件，结束拖拽
    canvas.addEventListener('mouseleave', handleMouseUp)
  }
  
  // 监听窗口大小变化，自适应调整画布
  window.addEventListener('resize', () => {
    updateCanvasSize()
    generateSeats()
  })
})

// 监听配置数据变化，当配置更新时重新生成座位
// 深度监听确保对象内部变化也能触发更新
watch(() => [
  props.roomSettings,
  props.stageSettings,
  props.seatSections
], () => {
  generateSeats()
}, { deep: true })

/**
 * 更新画布大小，使其适应父容器尺寸
 * 用于响应式布局，确保画布始终填满可用空间
 */
function updateCanvasSize() {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const container = canvas.parentElement
  if (!container) return
  
  const containerWidth = container.clientWidth
  const containerHeight = container.clientHeight
  
  if (containerWidth > 0 && containerHeight > 0) {
    canvas.width = containerWidth
    canvas.height = containerHeight
  }
}

/**
 * 生成座位布局的核心算法
 * 根据配置参数计算座位位置，处理过道生成和空间分配
 * 算法步骤：
 * 1. 计算画布缩放比例和偏移量
 * 2. 遍历每个分区，计算分区位置和尺寸
 * 3. 对每排座位，根据最大连续座位数分配过道
 * 4. 优化座位布局，确保紧贴分区边界
 * 5. 生成座位对象并添加到座位数组
 */
function generateSeats() {
  // 确保画布大小已更新
  updateCanvasSize()
  
  // 新的座位数组，用于存储生成的座位
  let newSeats = []
  
  // 比例尺：1米 = 20像素
  const scale = 20
  
  // 获取Canvas元素
  const canvas = canvasRef.value
  if (!canvas) return
  
  // 获取画布实际尺寸
  const canvasWidth = canvas.width
  const canvasHeight = canvas.height
  
  // 获取会议室尺寸（米）
  const roomWidth = props.roomSettings.width
  const roomLength = props.roomSettings.length
  
  // 将会议室尺寸转换为像素
  const roomWidthPx = roomWidth * scale
  const roomLengthPx = roomLength * scale
  
  // 计算缩放比例，确保会议室适应画布
  const scaleX = canvasWidth / roomWidthPx
  const scaleY = canvasHeight / roomLengthPx
  const baseScale = Math.min(scaleX, scaleY) * 0.9  // 留10%边距
  const finalScale = baseScale * zoom.value  // 应用当前缩放级别
  
  // 计算居中偏移量
  const baseOffsetX = (canvasWidth - roomWidthPx * baseScale) / 2
  const baseOffsetY = (canvasHeight - roomLengthPx * baseScale) / 2
  
  // 应用用户拖拽偏移量
  const offsetXWithZoom = baseOffsetX + offsetX.value
  const offsetYWithZoom = baseOffsetY + offsetY.value
  
  // 当前Y坐标，从画布顶部开始
  let currentY = offsetYWithZoom
  
  // 如果存在舞台，为舞台预留空间
  if (props.stageSettings.exists) {
    const stageWidth = props.stageSettings.width * scale * finalScale
    const stageLength = props.stageSettings.length * scale * finalScale
    currentY += stageLength
  }
  
  // 遍历每个座位分区
  props.seatSections.forEach((section, sectionIndex) => {
    // 添加分区间距
    currentY += section.previousSectionDistance * scale * finalScale
    
    // 计算分区左侧位置和宽度
    const sectionLeft = offsetXWithZoom + section.leftWallDistance * scale * finalScale
    const sectionWidth = roomWidthPx * finalScale - (section.leftWallDistance + section.rightWallDistance) * scale * finalScale
    
    // 计算座位和过道的像素尺寸
    const seatWidth = section.seatWidth * scale * finalScale
    const seatLength = section.seatLength * scale * finalScale
    const seatSpacingX = section.seatLeftRightSpacing * scale * finalScale
    const seatSpacingY = section.seatFrontBackSpacing * scale * finalScale
    const aisleWidth = section.aisleWidth * scale * finalScale
    
    // 座位单元宽度（座位+间距）
    const seatUnitWidth = seatWidth + seatSpacingX
    
    // 遍历每一排座位
    for (let row = 0; row < section.rows; row++) {
      const rowY = currentY + row * (seatLength + seatSpacingY)
      const maxContinuousSeats = section.maxContinuousSeats
      
      // 计算最大可能的座位数（无过道情况）
      const maxSeatsWithoutAisles = Math.floor((sectionWidth + seatSpacingX) / seatUnitWidth)
      
      let bestSeatCount = 0
      let bestAisleWidths = []
      
      // 从最大座位数向下尝试，找到合适的座位布局
      // 限制最大尝试次数，避免性能问题
      const maxTries = 50
      let trySeats = maxSeatsWithoutAisles
      let tries = 0
      
      while (trySeats >= 1 && tries < maxTries) {
        const numBlocks = Math.ceil(trySeats / maxContinuousSeats)
        const numAisles = numBlocks - 1
        
        // 计算座位和过道所需的最小宽度
        const seatsWidth = trySeats * seatUnitWidth - seatSpacingX
        const minAislesWidth = numAisles * aisleWidth
        const minTotalWidth = seatsWidth + minAislesWidth
        
        // 如果宽度合适，使用此方案
        if (minTotalWidth <= sectionWidth) {
          const extraSpace = sectionWidth - minTotalWidth
          const aisleWidths = []
          
          // 如果有过道，分配额外空间
          if (numAisles > 0) {
            const extraPerAisle = extraSpace / numAisles
            for (let i = 0; i < numAisles; i++) {
              aisleWidths.push(aisleWidth + extraPerAisle)
            }
          }
          
          bestSeatCount = trySeats
          bestAisleWidths = aisleWidths
          break
        }
        
        // 减少尝试的座位数，如果maxSeatsWithoutAisles很大，使用更大的步长
        const step = maxSeatsWithoutAisles > 100 ? Math.max(1, Math.floor(maxSeatsWithoutAisles / 50)) : 1
        trySeats -= step
        tries++
      }
      
      // 如果没有找到合适的方案，尝试放置一个座位
      if (bestSeatCount === 0) {
        if (sectionWidth >= seatWidth) {
          bestSeatCount = 1
          bestAisleWidths = []
        } else {
          continue  // 跳过这一排，宽度不足以放置座位
        }
      }
      
      // 计算区块信息
      const numBlocks = Math.ceil(bestSeatCount / maxContinuousSeats)
      const seatsPerBlock = []
      let remainingSeats = bestSeatCount
      
      for (let i = 0; i < numBlocks; i++) {
        const seatsInBlock = Math.min(remainingSeats, maxContinuousSeats)
        seatsPerBlock.push(seatsInBlock)
        remainingSeats -= seatsInBlock
      }
      
      // 生成座位
      let currentX = sectionLeft
      let seatCol = 1  // 当前排的座位列号
      
      for (let blockIndex = 0; blockIndex < numBlocks; blockIndex++) {
        const seatsInBlock = seatsPerBlock[blockIndex]
        
        // 生成当前区块的座位
        for (let seatInBlock = 0; seatInBlock < seatsInBlock; seatInBlock++) {
          const seatX = currentX + seatInBlock * seatUnitWidth
          
          newSeats.push({
            id: `S${sectionIndex + 1}-R${row + 1}-${seatCol}`,
            x: seatX,
            y: rowY,
            width: seatWidth,
            height: seatLength,
            occupied: Math.random() > 0.7,
            vip: false,
            section: section.name,
            row: row + 1,
            col: seatCol
          })
          
          seatCol++
        }
        
        // 移动到下一个区块的起始位置
        currentX += seatsInBlock * seatUnitWidth - seatSpacingX
        
        // 如果不是最后一个区块，添加过道
        if (blockIndex < numBlocks - 1) {
          const actualAisleWidth = bestAisleWidths[blockIndex] || aisleWidth
          currentX += actualAisleWidth
        }
      }
      
      // 检查并调整布局以确保紧贴边界
      const totalOccupiedWidth = currentX - sectionLeft
      const adjustment = sectionWidth - totalOccupiedWidth
      
      if (Math.abs(adjustment) > 0.01) {
        // 重新生成整排座位以应用调整
        // 首先移除这一排的所有座位
        const rowSeats = newSeats.filter(seat => seat.row === row + 1 && seat.section === section.name)
        const rowSeatIndices = rowSeats.map(seat => newSeats.indexOf(seat))
        
        // 按降序删除，避免索引变化
        rowSeatIndices.sort((a, b) => b - a).forEach(index => {
          newSeats.splice(index, 1)
        })
        
        // 重新生成这一排座位
        if (numBlocks > 1) {
          // 多区块情况：调整过道宽度
          const adjustmentPerAisle = adjustment / (numBlocks - 1)
          const adjustedAisleWidths = bestAisleWidths.map(width => width + adjustmentPerAisle)
          
          currentX = sectionLeft
          seatCol = 1
          
          for (let blockIndex = 0; blockIndex < numBlocks; blockIndex++) {
            const seatsInBlock = seatsPerBlock[blockIndex]
            
            for (let seatInBlock = 0; seatInBlock < seatsInBlock; seatInBlock++) {
              const seatX = currentX + seatInBlock * seatUnitWidth
              
              newSeats.push({
                id: `S${sectionIndex + 1}-R${row + 1}-${seatCol}`,
                x: seatX,
                y: rowY,
                width: seatWidth,
                height: seatLength,
                occupied: Math.random() > 0.7,
                vip: false,
                section: section.name,
                row: row + 1,
                col: seatCol
              })
              
              seatCol++
            }
            
            currentX += seatsInBlock * seatUnitWidth - seatSpacingX
            
            if (blockIndex < numBlocks - 1) {
              const actualAisleWidth = adjustedAisleWidths[blockIndex] || aisleWidth + adjustmentPerAisle
              currentX += actualAisleWidth
            }
          }
        } else if (numBlocks === 1 && bestSeatCount > 1) {
          // 单区块多座位：调整座位间距
          const totalSeatWidth = bestSeatCount * seatWidth
          const totalSpacingWidth = sectionWidth - totalSeatWidth
          const spacingBetweenSeats = totalSpacingWidth / (bestSeatCount - 1)
          
          currentX = sectionLeft
          seatCol = 1
          
          for (let seatInBlock = 0; seatInBlock < bestSeatCount; seatInBlock++) {
            const seatX = sectionLeft + seatInBlock * (seatWidth + spacingBetweenSeats)
            
            newSeats.push({
              id: `S${sectionIndex + 1}-R${row + 1}-${seatCol}`,
              x: seatX,
              y: rowY,
              width: seatWidth,
              height: seatLength,
              occupied: Math.random() > 0.7,
              vip: false,
              section: section.name,
              row: row + 1,
              col: seatCol
            })
            
            seatCol++
          }
          
          currentX = sectionLeft + bestSeatCount * seatWidth + (bestSeatCount - 1) * spacingBetweenSeats
        } else if (numBlocks === 1 && bestSeatCount === 1) {
          // 单区块单座位：居中或左对齐
          const seatX = sectionLeft
          
          newSeats.push({
            id: `S${sectionIndex + 1}-R${row + 1}-1`,
            x: seatX,
            y: rowY,
            width: seatWidth,
            height: seatLength,
            occupied: Math.random() > 0.7,
            vip: false,
            section: section.name,
            row: row + 1,
            col: 1
          })
          
          currentX = sectionLeft + seatWidth
        }
      }
    }
    
    // 移动到下一个分区
    currentY += (section.rows * seatLength) + ((section.rows - 1) * seatSpacingY)
  })
  
  // 更新座位数据并重绘
  seats.value = newSeats
  drawSeats()
}

/**
 * 绘制座位布局到Canvas
 * 包括会议室边框、舞台、座位和分区边界
 * 使用2D Canvas API进行绘制
 */
function drawSeats() {
  // 获取Canvas元素和绘图上下文
  const canvas = canvasRef.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  
  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // 比例尺：1米 = 20像素
  const scale = 20
  
  // 获取画布尺寸
  const canvasWidth = canvas.width
  const canvasHeight = canvas.height
  
  // 获取会议室尺寸
  const roomWidth = props.roomSettings.width
  const roomLength = props.roomSettings.length
  
  // 转换为像素尺寸
  const roomWidthPx = roomWidth * scale
  const roomLengthPx = roomLength * scale
  
  // 计算缩放比例
  const scaleX = canvasWidth / roomWidthPx
  const scaleY = canvasHeight / roomLengthPx
  const baseScale = Math.min(scaleX, scaleY) * 0.9
  const finalScale = baseScale * zoom.value
  
  // 计算偏移量以实现居中效果
  const baseOffsetX = (canvasWidth - roomWidthPx * baseScale) / 2
  const baseOffsetY = (canvasHeight - roomLengthPx * baseScale) / 2
  
  // 应用用户拖拽偏移量
  const offsetXWithZoom = baseOffsetX + offsetX.value
  const offsetYWithZoom = baseOffsetY + offsetY.value
  
  // 计算会议室绘制位置
  const roomStartX = offsetXWithZoom
  const roomStartY = offsetYWithZoom
  const roomEndX = offsetXWithZoom + roomWidthPx * finalScale
  const roomEndY = offsetYWithZoom + roomLengthPx * finalScale
  
  // 绘制会议室边框
  ctx.strokeStyle = '#666'
  ctx.lineWidth = 2
  ctx.strokeRect(roomStartX, roomStartY, roomWidthPx * finalScale, roomLengthPx * finalScale)
  
  // 绘制会议室背景
  ctx.fillStyle = 'rgba(240, 240, 240, 0.3)'
  ctx.fillRect(roomStartX, roomStartY, roomWidthPx * finalScale, roomLengthPx * finalScale)
  
  if (props.stageSettings.exists) {
    const stageWidth = props.stageSettings.width * scale * finalScale
    const stageLength = props.stageSettings.length * scale * finalScale
    let stageX, stageY
    
    switch (props.stageSettings.direction) {
      case 'north':
        stageX = offsetXWithZoom + (roomWidthPx * finalScale - stageWidth) / 2
        stageY = offsetYWithZoom
        break
      case 'south':
        stageX = offsetXWithZoom + (roomWidthPx * finalScale - stageWidth) / 2
        stageY = offsetYWithZoom + roomLengthPx * finalScale - stageLength
        break
      case 'east':
        stageX = offsetXWithZoom + roomWidthPx * finalScale - stageWidth
        stageY = offsetYWithZoom + (roomLengthPx * finalScale - stageLength) / 2
        break
      case 'west':
        stageX = offsetXWithZoom
        stageY = offsetYWithZoom + (roomLengthPx * finalScale - stageLength) / 2
        break
      default:
        stageX = offsetXWithZoom + (roomWidthPx * finalScale - stageWidth) / 2
        stageY = offsetYWithZoom
    }
    
    ctx.fillStyle = 'rgba(255, 215, 0, 0.3)'
    ctx.fillRect(stageX, stageY, stageWidth, stageLength)
    ctx.strokeStyle = '#d48806'
    ctx.lineWidth = 1.5
    ctx.strokeRect(stageX, stageY, stageWidth, stageLength)
    
    ctx.fillStyle = '#333'
    ctx.font = 'bold 14px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('舞台', stageX + stageWidth / 2, stageY + stageLength / 2)
  }
  
  // 绘制所有座位
  const totalSeats = seats.value.length
  const shouldDrawText = totalSeats < 1000  // 座位过多时不绘制文字
  
  seats.value.forEach(seat => {
    ctx.fillStyle = seat.occupied ? '#f56c6c' : '#67c23a'
    ctx.fillRect(seat.x, seat.y, seat.width, seat.height)
    
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 0.5
    ctx.strokeRect(seat.x, seat.y, seat.width, seat.height)
    
    // 只在座位数量不多或座位足够大时绘制座位号
    if (shouldDrawText && seat.width > 15) {
      ctx.fillStyle = '#fff'
      ctx.font = '10px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const seatNumber = seat.col
      ctx.fillText(seatNumber, seat.x + seat.width / 2, seat.y + seat.height / 2)
    }
  })
  
  ctx.strokeStyle = '#409eff'
  ctx.lineWidth = 1
  ctx.setLineDash([5, 3])
  
  let currentY = offsetYWithZoom
  
  if (props.stageSettings.exists) {
    currentY += props.stageSettings.length * scale * finalScale
  }
  
  props.seatSections.forEach((section, sectionIndex) => {
    if (sectionIndex === 0) {
      currentY += section.previousSectionDistance * scale * finalScale
    } else {
      currentY += section.previousSectionDistance * scale * finalScale
    }
    
    const sectionLeft = offsetXWithZoom + section.leftWallDistance * scale * finalScale
    const sectionWidth = roomWidthPx * finalScale - (section.leftWallDistance + section.rightWallDistance) * scale * finalScale
    
    const seatLength = section.seatLength * scale * finalScale
    const seatSpacingY = section.seatFrontBackSpacing * scale * finalScale
    const sectionHeight = (section.rows * seatLength) + ((section.rows - 1) * seatSpacingY)
    
    ctx.strokeRect(sectionLeft, currentY, sectionWidth, sectionHeight)
    
    ctx.fillStyle = 'rgba(64, 158, 255, 0.05)'
    ctx.fillRect(sectionLeft, currentY, sectionWidth, sectionHeight)
    
    currentY += sectionHeight
  })
  ctx.setLineDash([])
}

/**
 * 重置所有座位状态为未占用
 * 用于清空当前座位占用情况
 */
function resetSeats() {
  seats.value.forEach(seat => {
    seat.occupied = false
  })
  drawSeats()
}

/**
 * 随机设置座位占用状态
 * 每个座位有50%的概率被标记为占用，用于演示和测试
 */
function randomizeSeats() {
  seats.value.forEach(seat => {
    seat.occupied = Math.random() > 0.5
  })
  drawSeats()
}

/**
 * 处理鼠标滚轮事件，实现画布缩放功能
 * 支持以鼠标位置为中心的缩放，提供更好的用户体验
 * @param {WheelEvent} event - 鼠标滚轮事件对象
 */
function handleWheel(event) {
  event.preventDefault()
  
  // 根据滚轮方向计算缩放增量（向下滚缩小，向上滚放大）
  const delta = event.deltaY > 0 ? -0.1 : 0.1
  const newZoom = Math.max(0.5, Math.min(3.0, zoom.value + delta))
  
  const canvas = canvasRef.value
  if (!canvas) return
  
  // 获取鼠标在Canvas中的相对位置
  const rect = canvas.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top
  
  // 计算缩放相关的几何参数
  const scale = 20
  const canvasWidth = canvas.width
  const canvasHeight = canvas.height
  
  const roomWidth = props.roomSettings.width
  const roomLength = props.roomSettings.length
  
  const roomWidthPx = roomWidth * scale
  const roomLengthPx = roomLength * scale
  
  const scaleX = canvasWidth / roomWidthPx
  const scaleY = canvasHeight / roomLengthPx
  const baseScale = Math.min(scaleX, scaleY) * 0.9
  
  const oldBaseOffsetX = (canvasWidth - roomWidthPx * baseScale) / 2
  const oldBaseOffsetY = (canvasHeight - roomLengthPx * baseScale) / 2
  
  // 将鼠标位置转换为世界坐标（实际会议室坐标系）
  const worldX = (mouseX - oldBaseOffsetX - offsetX.value) / (baseScale * zoom.value)
  const worldY = (mouseY - oldBaseOffsetY - offsetY.value) / (baseScale * zoom.value)
  
  // 更新缩放比例
  zoom.value = newZoom
  
  // 调整偏移量，使缩放以鼠标位置为中心
  offsetX.value = mouseX - oldBaseOffsetX - worldX * (baseScale * zoom.value)
  offsetY.value = mouseY - oldBaseOffsetY - worldY * (baseScale * zoom.value)
  
  // 重新生成座位布局
  generateSeats()
}

/**
 * 处理鼠标按下事件，开始画布拖拽
 * @param {MouseEvent} event - 鼠标事件对象
 */
function handleMouseDown(event) {
  event.preventDefault()
  isDragging.value = true
  lastMouseX.value = event.clientX
  lastMouseY.value = event.clientY
}

/**
 * 处理鼠标移动事件，实现画布拖拽
 * 计算鼠标移动距离并更新画布偏移量
 * @param {MouseEvent} event - 鼠标事件对象
 */
function handleMouseMove(event) {
  if (!isDragging.value) return
  event.preventDefault()
  
  const deltaX = event.clientX - lastMouseX.value
  const deltaY = event.clientY - lastMouseY.value
  
  offsetX.value += deltaX
  offsetY.value += deltaY
  
  lastMouseX.value = event.clientX
  lastMouseY.value = event.clientY
  
  generateSeats()
}

/**
 * 处理鼠标释放事件，结束画布拖拽
 * @param {MouseEvent} event - 鼠标事件对象
 */
function handleMouseUp(event) {
  event.preventDefault()
  isDragging.value = false
}

/**
 * 重置缩放和平移状态
 * 将画布恢复默认缩放比例和居中位置
 */
function resetZoomAndPan() {
  zoom.value = 1.0
  offsetX.value = 0
  offsetY.value = 0
  generateSeats()
}
</script>

<template>
  <div class="floor-plan">
    <div class="floor-plan-header">
      <h2>座位平面图</h2>
      <div class="controls">
        <button @click="generateSeats">重新生成</button>
        <button @click="resetSeats">清空座位</button>
        <button @click="randomizeSeats">随机占用</button>
        <button @click="resetZoomAndPan">重置缩放</button>
      </div>
    </div>
    
    <div class="canvas-container">
      <canvas 
        ref="canvasRef"
        class="seat-canvas"
      ></canvas>
      
      <div class="legend">
        <div class="legend-item">
          <span class="color-box available"></span>
          <span>可用座位</span>
        </div>
        <div class="legend-item">
          <span class="color-box occupied"></span>
          <span>已占用</span>
        </div>
        <div class="legend-item">
          <span class="color-box section"></span>
          <span>分区边界</span>
        </div>
      </div>
    </div>
    
    <div class="instructions">
      <p>提示：点击平面图上的座位可以切换占用状态（待实现）</p>
    </div>
  </div>
</template>

<style scoped>
.floor-plan {
  background-color: white;
  padding: 10px;
  border-radius: 0;
  box-shadow: none;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.floor-plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.floor-plan-header h2 {
  margin: 0;
  color: #333;
}

.controls {
  display: flex;
  gap: 10px;
}

.controls button {
  padding: 8px 16px;
  background-color: #409eff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.controls button:hover {
  background-color: #337ecc;
}

.canvas-container {
  flex: 1;
  position: relative;
  background-color: #f8f9fa;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 0;
}

.seat-canvas {
  background-color: white;
  border: none;
  max-width: 100%;
  max-height: 100%;
}

.legend {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 10px 15px;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  gap: 15px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.color-box {
  width: 16px;
  height: 16px;
  border: 1px solid #333;
  border-radius: 2px;
}

.color-box.available {
  background-color: #67c23a;
}

.color-box.occupied {
  background-color: #f56c6c;
}

.color-box.section {
  background-color: #409eff;
  opacity: 0.3;
}

.instructions {
  margin-top: 20px;
  padding: 10px;
  background-color: #f0f9ff;
  border-radius: 4px;
  border-left: 4px solid #409eff;
  font-size: 14px;
  color: #666;
}
</style>