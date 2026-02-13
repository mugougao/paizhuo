<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import * as XLSX from 'xlsx'

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

// 嘉宾数据数组，存储从Excel导入的嘉宾信息
const guests = ref([])

// 分区颜色映射，为每个分区分配唯一颜色
const sectionColors = ref({})

// 当前选中的座位ID
const selectedSeatId = ref(null)

// 拖拽相关状态
const dragSourceSeatId = ref(null)
const dragTargetSeatId = ref(null)
const isDraggingSeat = ref(false)
const dragPosition = ref({ x: 0, y: 0 })

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
 * 获取鼠标在画布内部的坐标（考虑画布实际尺寸与CSS尺寸的差异）
 * @param {MouseEvent} event - 鼠标事件
 * @returns {{x: number, y: number}} - 画布内部坐标系中的坐标
 */
function getCanvasMousePosition(event) {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  }
}

/**
 * 限制偏移量范围，防止会议室被拖出画布可视区域
 * 考虑会议室最大尺寸80*80米，允许更大的拖动范围，特别是在放大时
 */
function clampOffsets() {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const canvasWidth = canvas.width
  const canvasHeight = canvas.height
  
  // 比例尺：1米 = 20像素
  const scale = 20
  
  // 获取会议室实际尺寸
  const roomWidth = props.roomSettings.width
  const roomLength = props.roomSettings.length
  
  // 会议室最大可能尺寸（按80*80米考虑）
  const maxRoomWidth = 80
  const maxRoomLength = 80
  
  // 转换为像素尺寸
  const roomWidthPx = roomWidth * scale
  const roomLengthPx = roomLength * scale
  const maxRoomWidthPx = maxRoomWidth * scale
  const maxRoomLengthPx = maxRoomLength * scale
  
  // 计算缩放比例
  const scaleX = canvasWidth / roomWidthPx
  const scaleY = canvasHeight / roomLengthPx
  const baseScale = Math.min(scaleX, scaleY) * 0.9
  
  // 会议室缩放后的实际尺寸
  const roomScaledWidth = roomWidthPx * baseScale * zoom.value
  const roomScaledHeight = roomLengthPx * baseScale * zoom.value
  
  // 最大会议室缩放后的尺寸（用于计算最大允许偏移量）
  const maxRoomScaledWidth = maxRoomWidthPx * baseScale * zoom.value
  const maxRoomScaledHeight = maxRoomLengthPx * baseScale * zoom.value
  
  // 计算最大允许偏移量
  // 允许会议室边缘与画布边缘对齐，确保放大后能看到最右和最下部分
  // 最小可见要求：确保会议室至少有5%在画布内可见
  const minVisibleRatio = 0.05 // 至少5%可见
  
  // 当会议室尺寸小于画布时，确保至少minVisibleRatio部分可见
  // 当会议室尺寸大于画布时，允许拖动到边缘对齐
  let maxOffsetX, maxOffsetY
  
  if (roomScaledWidth <= canvasWidth) {
    // 会议室宽度小于等于画布宽度：确保至少5%可见，允许中心在画布内移动
    maxOffsetX = Math.max(0, (canvasWidth - roomScaledWidth * minVisibleRatio) / 2)
  } else {
    // 会议室宽度大于画布宽度：允许拖动到边缘对齐
    // 最大偏移量 = (会议室宽度 - 画布宽度 * 最小可见比例) / 2
    // 这样即使放大很多，也能看到会议室边缘
    maxOffsetX = Math.max(0, (roomScaledWidth - canvasWidth * minVisibleRatio) / 2)
  }
  
  if (roomScaledHeight <= canvasHeight) {
    // 会议室高度小于等于画布高度：确保至少5%可见
    maxOffsetY = Math.max(0, (canvasHeight - roomScaledHeight * minVisibleRatio) / 2)
  } else {
    // 会议室高度大于画布高度：允许拖动到边缘对齐
    maxOffsetY = Math.max(0, (roomScaledHeight - canvasHeight * minVisibleRatio) / 2)
  }
  
  // 基于最大会议室尺寸（80*80米）增加额外的拖动范围
  // 这样即使实际会议室较小，放大后也能有足够的拖动空间
  const extraOffsetFromMaxSizeX = Math.max(0, (maxRoomScaledWidth - roomScaledWidth) / 2)
  const extraOffsetFromMaxSizeY = Math.max(0, (maxRoomScaledHeight - roomScaledHeight) / 2)
  
  // 最终最大允许偏移量
  maxOffsetX += extraOffsetFromMaxSizeX
  maxOffsetY += extraOffsetFromMaxSizeY
  
  // 限制偏移量范围
  offsetX.value = Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX.value))
  offsetY.value = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY.value))
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
  
  // 创建现有座位状态映射，用于保留座位状态（如占用、嘉宾信息等）
  const existingSeatsMap = {}
  seats.value.forEach(seat => {
    existingSeatsMap[seat.id] = {
      occupied: seat.occupied,
      vip: seat.vip,
      guestId: seat.guestId,
      guestNumber: seat.guestNumber,
      guestName: seat.guestName,
      guestUnit: seat.guestUnit,
      assignedSection: seat.assignedSection,
      sectionColor: seat.sectionColor,
      isSelected: seat.isSelected
    }
  })
  
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
          
          const seatId = `S${sectionIndex + 1}-R${row + 1}-${seatCol}`
          const existingState = existingSeatsMap[seatId]
          
          newSeats.push({
            id: seatId,
            x: seatX,
            y: rowY,
            width: seatWidth,
            height: seatLength,
            occupied: existingState ? existingState.occupied : Math.random() > 0.7,
            vip: existingState ? existingState.vip : false,
            section: section.name,
            row: row + 1,
            col: seatCol,
            guestId: existingState ? existingState.guestId : null,
            guestNumber: existingState ? existingState.guestNumber : null,
            guestName: existingState ? existingState.guestName : null,
            guestUnit: existingState ? existingState.guestUnit : null,
            assignedSection: existingState ? existingState.assignedSection : null,
            sectionColor: existingState ? existingState.sectionColor : null,
            isSelected: existingState ? existingState.isSelected : false
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
              
              const seatId = `S${sectionIndex + 1}-R${row + 1}-${seatCol}`
              const existingState = existingSeatsMap[seatId]
              
              newSeats.push({
                id: seatId,
                x: seatX,
                y: rowY,
                width: seatWidth,
                height: seatLength,
                occupied: existingState ? existingState.occupied : Math.random() > 0.7,
                vip: existingState ? existingState.vip : false,
                section: section.name,
                row: row + 1,
                col: seatCol,
                guestId: existingState ? existingState.guestId : null,
                guestNumber: existingState ? existingState.guestNumber : null,
                guestName: existingState ? existingState.guestName : null,
                guestUnit: existingState ? existingState.guestUnit : null,
                assignedSection: existingState ? existingState.assignedSection : null,
                sectionColor: existingState ? existingState.sectionColor : null,
                isSelected: existingState ? existingState.isSelected : false
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
          // 单区块多座位：保持用户设置的座位间距，多余空间作为左右边距（居中）
          const totalSeatWidth = bestSeatCount * seatWidth
          const totalUserSpacingWidth = seatSpacingX * (bestSeatCount - 1)
          const totalOccupiedWidthWithSpacing = totalSeatWidth + totalUserSpacingWidth
          const extraSpace = sectionWidth - totalOccupiedWidthWithSpacing
          
          // 如果用户设置的间距为0，座位紧挨着，多余空间作为左右边距（居中）
          // 如果用户设置的间距大于0，保持该间距不变，多余空间作为左右边距（居中）
          const leftMargin = extraSpace / 2
          const spacingBetweenSeats = seatSpacingX
          
          currentX = sectionLeft
          seatCol = 1
          
          for (let seatInBlock = 0; seatInBlock < bestSeatCount; seatInBlock++) {
            const seatX = sectionLeft + leftMargin + seatInBlock * (seatWidth + spacingBetweenSeats)
            
            const seatId = `S${sectionIndex + 1}-R${row + 1}-${seatCol}`
            const existingState = existingSeatsMap[seatId]
            
            newSeats.push({
              id: seatId,
              x: seatX,
              y: rowY,
              width: seatWidth,
              height: seatLength,
              occupied: existingState ? existingState.occupied : Math.random() > 0.7,
              vip: existingState ? existingState.vip : false,
              section: section.name,
              row: row + 1,
              col: seatCol,
              guestId: existingState ? existingState.guestId : null,
              guestNumber: existingState ? existingState.guestNumber : null,
              guestName: existingState ? existingState.guestName : null,
              guestUnit: existingState ? existingState.guestUnit : null,
              assignedSection: existingState ? existingState.assignedSection : null,
              sectionColor: existingState ? existingState.sectionColor : null,
              isSelected: existingState ? existingState.isSelected : false
            })
            
            seatCol++
          }
          
          currentX = sectionLeft + leftMargin + bestSeatCount * seatWidth + (bestSeatCount - 1) * spacingBetweenSeats
        } else if (numBlocks === 1 && bestSeatCount === 1) {
          // 单区块单座位：居中或左对齐
          const seatX = sectionLeft
          
          const seatId = `S${sectionIndex + 1}-R${row + 1}-1`
          const existingState = existingSeatsMap[seatId]
          
          newSeats.push({
            id: seatId,
            x: seatX,
            y: rowY,
            width: seatWidth,
            height: seatLength,
            occupied: existingState ? existingState.occupied : Math.random() > 0.7,
            vip: existingState ? existingState.vip : false,
            section: section.name,
            row: row + 1,
            col: 1,
            guestId: existingState ? existingState.guestId : null,
            guestNumber: existingState ? existingState.guestNumber : null,
            guestName: existingState ? existingState.guestName : null,
            guestUnit: existingState ? existingState.guestUnit : null,
            assignedSection: existingState ? existingState.assignedSection : null,
            sectionColor: existingState ? existingState.sectionColor : null,
            isSelected: existingState ? existingState.isSelected : false
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
  
  // 绘制会议室背景（轻拟物风格）
  const roomWidthPxScaled = roomWidthPx * finalScale
  const roomLengthPxScaled = roomLengthPx * finalScale
  
  // 创建会议室背景渐变
  const roomGradient = ctx.createLinearGradient(roomStartX, roomStartY, roomStartX, roomStartY + roomLengthPxScaled)
  roomGradient.addColorStop(0, '#F8FAFC')
  roomGradient.addColorStop(0.5, '#F1F5F9')
  roomGradient.addColorStop(1, '#E2E8F0')
  
  ctx.fillStyle = roomGradient
  ctx.fillRect(roomStartX, roomStartY, roomWidthPxScaled, roomLengthPxScaled)
  
  // 绘制会议室边框（轻拟物风格）
  ctx.strokeStyle = '#CBD5E1'
  ctx.lineWidth = 3
  ctx.strokeRect(roomStartX, roomStartY, roomWidthPxScaled, roomLengthPxScaled)
  
  // 添加内阴影效果
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1
  ctx.strokeRect(roomStartX + 1, roomStartY + 1, roomWidthPxScaled - 2, roomLengthPxScaled - 2)
  
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
    
    // 创建舞台渐变（轻拟物风格）
    const stageGradient = ctx.createLinearGradient(stageX, stageY, stageX, stageY + stageLength)
    stageGradient.addColorStop(0, 'rgba(255, 152, 0, 0.4)')
    stageGradient.addColorStop(0.5, 'rgba(255, 152, 0, 0.5)')
    stageGradient.addColorStop(1, 'rgba(255, 152, 0, 0.3)')
    
    ctx.fillStyle = stageGradient
    ctx.fillRect(stageX, stageY, stageWidth, stageLength)
    
    // 舞台边框（外阴影）
    ctx.strokeStyle = '#F57C00'
    ctx.lineWidth = 2.5
    ctx.strokeRect(stageX, stageY, stageWidth, stageLength)
    
    // 舞台边框（内高光）
    ctx.strokeStyle = '#FFB74D'
    ctx.lineWidth = 1
    ctx.strokeRect(stageX + 1, stageY + 1, stageWidth - 2, stageLength - 2)
    
    // 舞台文字
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 16px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
    ctx.shadowBlur = 3
    ctx.shadowOffsetX = 1
    ctx.shadowOffsetY = 1
    ctx.fillText('舞台', stageX + stageWidth / 2, stageY + stageLength / 2)
    ctx.shadowColor = 'transparent'
  }
  
  // 绘制所有座位
  const totalSeats = seats.value.length
  const shouldDrawText = totalSeats < 1000  // 座位过多时不绘制文字
  
  seats.value.forEach(seat => {
    // 获取座位颜色
    const colors = getSeatColor(seat)
    
    // 创建座位渐变
    const seatGradient = ctx.createLinearGradient(seat.x, seat.y, seat.x, seat.y + seat.height)
    seatGradient.addColorStop(0, colors.light)
    seatGradient.addColorStop(0.5, colors.base)
    seatGradient.addColorStop(1, colors.dark)
    
    ctx.fillStyle = seatGradient
    ctx.fillRect(seat.x, seat.y, seat.width, seat.height)
    
    // 座位边框（外阴影）
    ctx.strokeStyle = colors.dark
    ctx.lineWidth = 1.5
    ctx.strokeRect(seat.x, seat.y, seat.width, seat.height)
    
    // 座位边框（内高光）
    ctx.strokeStyle = colors.light
    ctx.lineWidth = 0.5
    ctx.strokeRect(seat.x + 1, seat.y + 1, seat.width - 2, seat.height - 2)
    
    // 选中状态高亮
    if (seat.id === selectedSeatId.value) {
      ctx.strokeStyle = '#FF9800'
      ctx.lineWidth = 3
      ctx.strokeRect(seat.x - 2, seat.y - 2, seat.width + 4, seat.height + 4)
    }
    
    // 只在座位数量不多或座位足够大时绘制文本
    if (shouldDrawText && seat.width > 15) {
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 11px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
      ctx.shadowBlur = 2
      ctx.shadowOffsetX = 1
      ctx.shadowOffsetY = 1
      
      // 显示嘉宾编号或座位号
      const displayText = seat.guestNumber || seat.col.toString()
      ctx.fillText(displayText, seat.x + seat.width / 2, seat.y + seat.height / 2)
      ctx.shadowColor = 'transparent'
    }
  })
  
  // 绘制座位拖拽预览效果
  if (isDraggingSeat.value && dragSourceSeatId.value) {
    const sourceSeat = seats.value.find(seat => seat.id === dragSourceSeatId.value)
    if (sourceSeat) {
      // 绘制拖拽连接线
      ctx.beginPath()
      ctx.moveTo(sourceSeat.x + sourceSeat.width / 2, sourceSeat.y + sourceSeat.height / 2)
      ctx.lineTo(dragPosition.value.x, dragPosition.value.y)
      ctx.strokeStyle = 'rgba(33, 150, 243, 0.7)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 3])
      ctx.stroke()
      ctx.setLineDash([])
      
      // 绘制拖拽预览座位（半透明）
      const previewSize = Math.max(sourceSeat.width, sourceSeat.height) * 0.9
      const previewX = dragPosition.value.x - previewSize / 2
      const previewY = dragPosition.value.y - previewSize / 2
      
      // 座位渐变
      const colors = getSeatColor(sourceSeat)
      const previewGradient = ctx.createLinearGradient(previewX, previewY, previewX, previewY + previewSize)
      previewGradient.addColorStop(0, colors.light.replace(')', ', 0.7)').replace('rgb', 'rgba'))
      previewGradient.addColorStop(0.5, colors.base.replace(')', ', 0.7)').replace('rgb', 'rgba'))
      previewGradient.addColorStop(1, colors.dark.replace(')', ', 0.7)').replace('rgb', 'rgba'))
      
      ctx.fillStyle = previewGradient
      ctx.fillRect(previewX, previewY, previewSize, previewSize)
      
      // 预览座位边框
      ctx.strokeStyle = colors.dark.replace(')', ', 0.8)').replace('rgb', 'rgba')
      ctx.lineWidth = 2
      ctx.strokeRect(previewX, previewY, previewSize, previewSize)
      
      // 预览座位内边框
      ctx.strokeStyle = colors.light.replace(')', ', 0.9)').replace('rgb', 'rgba')
      ctx.lineWidth = 1
      ctx.strokeRect(previewX + 1, previewY + 1, previewSize - 2, previewSize - 2)
      
      // 显示嘉宾编号
      if (sourceSeat.guestNumber) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.font = 'bold 14px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
        ctx.shadowBlur = 3
        ctx.fillText(sourceSeat.guestNumber, previewX + previewSize / 2, previewY + previewSize / 2)
        ctx.shadowColor = 'transparent'
      }
    }
  }
  
  ctx.strokeStyle = '#337ecc'
  ctx.lineWidth = 1.2
  ctx.setLineDash([6, 4])
  
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
    
    // 分区背景渐变（轻拟物风格）
    const sectionGradient = ctx.createLinearGradient(sectionLeft, currentY, sectionLeft, currentY + sectionHeight)
    sectionGradient.addColorStop(0, 'rgba(144, 202, 249, 0.08)')
    sectionGradient.addColorStop(0.5, 'rgba(144, 202, 249, 0.12)')
    sectionGradient.addColorStop(1, 'rgba(144, 202, 249, 0.05)')
    
    ctx.fillStyle = sectionGradient
    ctx.fillRect(sectionLeft, currentY, sectionWidth, sectionHeight)
    
    // 分区边框（外阴影）
    ctx.strokeStyle = '#64B5F6'
    ctx.lineWidth = 1.5
    ctx.strokeRect(sectionLeft, currentY, sectionWidth, sectionHeight)
    
    // 分区边框（内高光）
    ctx.strokeStyle = '#90CAF9'
    ctx.lineWidth = 0.5
    ctx.strokeRect(sectionLeft + 1, currentY + 1, sectionWidth - 2, sectionHeight - 2)
    
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
    seat.guestId = null
    seat.guestNumber = null
    seat.guestName = null
    seat.guestUnit = null
    seat.assignedSection = null
    seat.sectionColor = null
  })
  guests.value = []
  sectionColors.value = {}
  selectedSeatId.value = null
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
  const { x: mouseX, y: mouseY } = getCanvasMousePosition(event)
  
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
  
  // 限制偏移量范围
  clampOffsets()
  
  // 重新生成座位布局
  generateSeats()
}

/**
 * 处理鼠标按下事件，开始画布拖拽或座位交互
 * @param {MouseEvent} event - 鼠标事件对象
 */
function handleMouseDown(event) {
  event.preventDefault()
  
  const canvas = canvasRef.value
  if (!canvas) return
  
  const { x: mouseX, y: mouseY } = getCanvasMousePosition(event)
  
  // 查找点击的座位
  const clickedSeat = seats.value.find(seat => 
    mouseX >= seat.x && mouseX <= seat.x + seat.width &&
    mouseY >= seat.y && mouseY <= seat.y + seat.height
  )
  
  if (clickedSeat) {
    // 点击座位，处理座位点击
    if (event.shiftKey && clickedSeat.guestId) {
      // Shift+点击：开始座位拖拽
      dragSourceSeatId.value = clickedSeat.id
      isDraggingSeat.value = true
    } else {
      // 普通点击：切换选中状态
      if (selectedSeatId.value === clickedSeat.id) {
        selectedSeatId.value = null
      } else {
        selectedSeatId.value = clickedSeat.id
      }
      drawSeats()
    }
  } else {
    // 点击空白区域，开始画布拖拽
    isDragging.value = true
    lastMouseX.value = event.clientX
    lastMouseY.value = event.clientY
  }
}

/**
 * 处理鼠标移动事件，实现画布拖拽或座位拖拽
 * 计算鼠标移动距离并更新画布偏移量或处理座位拖拽
 * @param {MouseEvent} event - 鼠标事件对象
 */
function handleMouseMove(event) {
  if (isDragging.value) {
    // 处理画布拖拽
    event.preventDefault()
    
    const deltaX = event.clientX - lastMouseX.value
    const deltaY = event.clientY - lastMouseY.value
    
    offsetX.value += deltaX
    offsetY.value += deltaY
    
    // 限制偏移量范围
    clampOffsets()
    
    lastMouseX.value = event.clientX
    lastMouseY.value = event.clientY
    
    generateSeats()
  } else if (isDraggingSeat.value) {
    // 处理座位拖拽（视觉反馈）
    event.preventDefault()
    
    const canvas = canvasRef.value
    if (!canvas) return
    
    const { x: mouseX, y: mouseY } = getCanvasMousePosition(event)
    
    // 更新拖拽位置，用于视觉反馈
    dragPosition.value = { x: mouseX, y: mouseY }
    
    // 触发重绘以显示拖拽效果
    drawSeats()
  }
}

/**
 * 处理鼠标释放事件，结束画布拖拽或座位拖拽
 * @param {MouseEvent} event - 鼠标事件对象
 */
function handleMouseUp(event) {
  event.preventDefault()
  
  if (isDraggingSeat.value && dragSourceSeatId.value) {
    // 处理座位拖拽结束
    const canvas = canvasRef.value
    if (!canvas) return
    
    const { x: mouseX, y: mouseY } = getCanvasMousePosition(event)
    
    // 查找目标座位
    const targetSeat = seats.value.find(seat => 
      mouseX >= seat.x && mouseX <= seat.x + seat.width &&
      mouseY >= seat.y && mouseY <= seat.y + seat.height
    )
    
    if (targetSeat && targetSeat.id !== dragSourceSeatId.value) {
      // 交换嘉宾信息
      const sourceSeat = seats.value.find(s => s.id === dragSourceSeatId.value)
      if (sourceSeat) {
        // 交换嘉宾信息
        const tempGuestId = sourceSeat.guestId
        const tempGuestNumber = sourceSeat.guestNumber
        const tempGuestName = sourceSeat.guestName
        const tempGuestUnit = sourceSeat.guestUnit
        const tempAssignedSection = sourceSeat.assignedSection
        const tempSectionColor = sourceSeat.sectionColor
        
        sourceSeat.guestId = targetSeat.guestId
        sourceSeat.guestNumber = targetSeat.guestNumber
        sourceSeat.guestName = targetSeat.guestName
        sourceSeat.guestUnit = targetSeat.guestUnit
        sourceSeat.assignedSection = targetSeat.assignedSection
        sourceSeat.sectionColor = targetSeat.sectionColor
        
        targetSeat.guestId = tempGuestId
        targetSeat.guestNumber = tempGuestNumber
        targetSeat.guestName = tempGuestName
        targetSeat.guestUnit = tempGuestUnit
        targetSeat.assignedSection = tempAssignedSection
        targetSeat.sectionColor = tempSectionColor
        
        // 更新嘉宾的座位ID
        if (sourceSeat.guestId) {
          const sourceGuest = guests.value.find(g => g.id === sourceSeat.guestId)
          if (sourceGuest) sourceGuest.seatId = sourceSeat.id
        }
        
        if (targetSeat.guestId) {
          const targetGuest = guests.value.find(g => g.id === targetSeat.guestId)
          if (targetGuest) targetGuest.seatId = targetSeat.id
        }
      }
    }
    
    // 重置拖拽状态
    isDraggingSeat.value = false
    dragSourceSeatId.value = null
    dragPosition.value = { x: 0, y: 0 }
    drawSeats()
  }
  
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

/**
 * 处理Excel文件上传
 * @param {Event} event - 文件上传事件
 */
async function handleFileUpload(event) {
  const file = event.target.files[0]
  if (!file) return
  
  try {
    const data = await parseExcelData(file)
    guests.value = data
    generateSectionColors()
    assignGuestsToSeats()
    drawSeats()
  } catch (error) {
    console.error('文件解析失败:', error)
    alert('文件解析失败，请检查文件格式和内容')
  }
  
  // 重置文件输入，允许重复上传相同文件
  event.target.value = ''
}

/**
 * 解析Excel文件数据
 * @param {File} file - Excel文件对象
 * @returns {Array} - 嘉宾数据数组
 */
function parseExcelData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        // 验证必要字段
        const guestsData = jsonData.map((row, index) => {
          const number = row['编号'] || row['number'] || row['Number'] || `GUEST${index + 1}`
          const section = row['座位分区'] || row['section'] || row['Section'] || '未分配'
          
          if (!number || !section) {
            throw new Error(`第${index + 1}行缺少必要字段：编号或座位分区`)
          }
          
          return {
            id: `G${index + 1}`,
            number: String(number),
            name: row['姓名'] || row['name'] || row['Name'] || '',
            unit: row['工作单位'] || row['unit'] || row['Unit'] || row['工作单位'] || '',
            assignedSection: String(section),
            seatId: null
          }
        })
        
        resolve(guestsData)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }
    
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 生成分区颜色映射
 * 为每个分区分配一个唯一的颜色
 */
function generateSectionColors() {
  const colors = [
    '#90CAF9', '#A5D6A7', '#FFE082', '#EF9A9A', '#CE93D8',
    '#80DEEA', '#FFCC80', '#F48FB1', '#81D4FA', '#C5E1A5',
    '#B39DDB', '#FFAB91', '#80CBC4', '#E6EE9C', '#9FA8DA'
  ]
  
  const uniqueSections = [...new Set(guests.value.map(g => g.assignedSection))]
  
  sectionColors.value = {}
  uniqueSections.forEach((section, index) => {
    sectionColors.value[section] = colors[index % colors.length]
  })
}

/**
 * 分配嘉宾到座位
 * 按照分区信息将嘉宾安排到对应分区的座位上
 * 如果某个分区座位不足，多出的嘉宾安排到下一个分区
 */
function assignGuestsToSeats() {
  // 清空之前的分配
  seats.value.forEach(seat => {
    seat.guestId = null
    seat.guestNumber = null
    seat.guestName = null
    seat.guestUnit = null
    seat.assignedSection = null
    seat.sectionColor = null
  })
  
  // 重置嘉宾的座位ID
  guests.value.forEach(guest => {
    guest.seatId = null
  })
  
  // 按分区分组嘉宾
  const guestsBySection = {}
  guests.value.forEach(guest => {
    if (!guestsBySection[guest.assignedSection]) {
      guestsBySection[guest.assignedSection] = []
    }
    guestsBySection[guest.assignedSection].push(guest)
  })
  
  // 获取分区列表（按配置中的顺序）
  const sectionNames = props.seatSections.map(s => s.name)
  
  // 收集所有未分配的嘉宾
  let unassignedGuests = [...guests.value]
  
  // 按分区顺序分配座位
  for (let sectionIndex = 0; sectionIndex < sectionNames.length; sectionIndex++) {
    const currentSection = sectionNames[sectionIndex]
    const sectionSeats = seats.value.filter(seat => seat.section === currentSection)
    
    // 找出属于当前分区且未分配的嘉宾
    const sectionGuests = unassignedGuests.filter(guest => guest.assignedSection === currentSection)
    
    // 如果没有更多未分配的嘉宾，退出
    if (unassignedGuests.length === 0) break
    
    // 如果当前分区没有嘉宾，但有未分配的嘉宾，这些嘉宾属于其他分区
    // 在这种情况下，我们分配其他分区的嘉宾到当前分区的座位
    const guestsToAssign = sectionGuests.length > 0 ? sectionGuests : 
                          // 如果没有当前分区的嘉宾，分配第一个未分配的嘉宾
                          [unassignedGuests[0]]
    
    // 分配尽可能多的嘉宾到当前分区的座位
    const seatsToAssign = Math.min(sectionSeats.length, guestsToAssign.length)
    
    for (let i = 0; i < seatsToAssign; i++) {
      const seat = sectionSeats[i]
      const guest = guestsToAssign[i]
      
      seat.guestId = guest.id
      seat.guestNumber = guest.number
      seat.guestName = guest.name
      seat.guestUnit = guest.unit
      seat.assignedSection = guest.assignedSection  // 保持原始分区
      seat.sectionColor = sectionColors.value[guest.assignedSection]  // 使用原始分区颜色
      guest.seatId = seat.id
      
      // 从未分配列表中移除
      const guestIndex = unassignedGuests.findIndex(g => g.id === guest.id)
      if (guestIndex !== -1) {
        unassignedGuests.splice(guestIndex, 1)
      }
    }
    
    // 如果当前分区座位不足，剩余嘉宾将在下一个分区继续分配
    // （他们已经在unassignedGuests中，循环会继续处理）
  }
  
  // 如果还有未分配的嘉宾（座位总数不足），记录警告
  if (unassignedGuests.length > 0) {
    console.warn(`${unassignedGuests.length} 位嘉宾未能分配到座位`)
  }
}

/**
 * 获取座位颜色
 * @param {Object} seat - 座位对象
 * @returns {Object} - 包含颜色信息的对象
 */
function getSeatColor(seat) {
  if (seat.guestId) {
    // 有嘉宾的座位，使用分区颜色
    const baseColor = seat.sectionColor || '#409eff'
    return {
      base: baseColor,
      dark: adjustColor(baseColor, -20),
      light: adjustColor(baseColor, 20)
    }
  } else {
    // 未安排嘉宾的座位，使用柔和的浅蓝色
    return {
      base: '#E3F2FD',
      dark: '#BBDEFB',
      light: '#F1F8FF'
    }
  }
}

/**
 * 调整颜色亮度
 * @param {string} hex - 十六进制颜色
 * @param {number} percent - 调整百分比（正数为变亮，负数为变暗）
 * @returns {string} - 调整后的颜色
 */
function adjustColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16)
  const amt = Math.round(2.55 * percent)
  const R = (num >> 16) + amt
  const G = ((num >> 8) & 0x00FF) + amt
  const B = (num & 0x0000FF) + amt
  
  return '#' + (
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1)
}

/**
 * 处理座位点击事件
 * @param {MouseEvent} event - 鼠标事件
 */
function handleSeatClick(event) {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const { x: mouseX, y: mouseY } = getCanvasMousePosition(event)
  
  // 查找点击的座位
  const clickedSeat = seats.value.find(seat => 
    mouseX >= seat.x && mouseX <= seat.x + seat.width &&
    mouseY >= seat.y && mouseY <= seat.y + seat.height
  )
  
  if (clickedSeat) {
    if (selectedSeatId.value === clickedSeat.id) {
      // 取消选中
      selectedSeatId.value = null
    } else {
      // 选中新座位
      selectedSeatId.value = clickedSeat.id
    }
    drawSeats()
  }
}

/**
 * 处理座位拖拽开始
 * @param {MouseEvent} event - 鼠标事件
 */
function handleSeatDragStart(event) {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const { x: mouseX, y: mouseY } = getCanvasMousePosition(event)
  
  // 查找拖拽的座位
  const draggedSeat = seats.value.find(seat => 
    mouseX >= seat.x && mouseX <= seat.x + seat.width &&
    mouseY >= seat.y && mouseY <= seat.y + seat.height
  )
  
  if (draggedSeat && draggedSeat.guestId) {
    dragSourceSeatId.value = draggedSeat.id
    isDraggingSeat.value = true
  }
}

/**
 * 处理座位拖拽结束
 * @param {MouseEvent} event - 鼠标事件
 */
function handleSeatDragEnd(event) {
  if (!isDraggingSeat.value || !dragSourceSeatId.value) return
  
  const canvas = canvasRef.value
  if (!canvas) return
  
  const { x: mouseX, y: mouseY } = getCanvasMousePosition(event)
  
  // 查找目标座位
  const targetSeat = seats.value.find(seat => 
    mouseX >= seat.x && mouseX <= seat.x + seat.width &&
    mouseY >= seat.y && mouseY <= seat.y + seat.height
  )
  
  if (targetSeat && targetSeat.id !== dragSourceSeatId.value) {
    dragTargetSeatId.value = targetSeat.id
    swapGuestSeats()
  }
  
  // 重置拖拽状态
  isDraggingSeat.value = false
  dragSourceSeatId.value = null
  dragTargetSeatId.value = null
}

/**
 * 交换两个座位上的嘉宾信息
 */
function swapGuestSeats() {
  const sourceSeat = seats.value.find(s => s.id === dragSourceSeatId.value)
  const targetSeat = seats.value.find(s => s.id === dragTargetSeatId.value)
  
  if (!sourceSeat || !targetSeat) return
  
  // 交换嘉宾信息
  const tempGuestId = sourceSeat.guestId
  const tempGuestNumber = sourceSeat.guestNumber
  const tempGuestName = sourceSeat.guestName
  const tempGuestUnit = sourceSeat.guestUnit
  const tempAssignedSection = sourceSeat.assignedSection
  const tempSectionColor = sourceSeat.sectionColor
  
  sourceSeat.guestId = targetSeat.guestId
  sourceSeat.guestNumber = targetSeat.guestNumber
  sourceSeat.guestName = targetSeat.guestName
  sourceSeat.guestUnit = targetSeat.guestUnit
  sourceSeat.assignedSection = targetSeat.assignedSection
  sourceSeat.sectionColor = targetSeat.sectionColor
  
  targetSeat.guestId = tempGuestId
  targetSeat.guestNumber = tempGuestNumber
  targetSeat.guestName = tempGuestName
  targetSeat.guestUnit = tempGuestUnit
  targetSeat.assignedSection = tempAssignedSection
  targetSeat.sectionColor = tempSectionColor
  
  // 更新嘉宾的座位ID
  if (sourceSeat.guestId) {
    const sourceGuest = guests.value.find(g => g.id === sourceSeat.guestId)
    if (sourceGuest) sourceGuest.seatId = sourceSeat.id
  }
  
  if (targetSeat.guestId) {
    const targetGuest = guests.value.find(g => g.id === targetSeat.guestId)
    if (targetGuest) targetGuest.seatId = targetSeat.id
  }
  
  drawSeats()
}

/**
 * 获取当前选中的座位
 * @returns {Object|null} - 选中的座位对象或null
 */
function getSelectedSeat() {
  if (!selectedSeatId.value) return null
  return seats.value.find(seat => seat.id === selectedSeatId.value)
}

/**
 * 触发文件输入框点击事件
 * 安全地访问DOM元素，避免在模板中直接使用document
 */
function triggerFileInput() {
  // 使用nextTick确保DOM已更新
  nextTick(() => {
    // 安全检查：确保在浏览器环境中
    if (typeof document !== 'undefined') {
      const fileInput = document.getElementById('guest-file-input')
      if (fileInput) {
        fileInput.click()
      }
    }
  })
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
        
        <!-- 嘉宾信息上传 -->
        <div class="file-upload-wrapper">
          <input 
            type="file" 
            id="guest-file-input"
            accept=".xlsx,.xls"
            @change="handleFileUpload"
            style="display: none"
          />
          <button @click="triggerFileInput" class="upload-button">
            📄 上传嘉宾名单
          </button>
        </div>
      </div>
    </div>
    
    <div class="canvas-container">
      <canvas 
        ref="canvasRef"
        class="seat-canvas"
      ></canvas>
      
      <!-- 嘉宾信息面板（悬浮在左上角） -->
      <div v-if="selectedSeatId" class="guest-info-panel floating-panel">
        <h3>嘉宾信息</h3>
        <div class="guest-info-content">
          <div v-if="getSelectedSeat()?.guestId" class="guest-details">
            <p><strong>编号：</strong>{{ getSelectedSeat()?.guestNumber }}</p>
            <p><strong>姓名：</strong>{{ getSelectedSeat()?.guestName || '未填写' }}</p>
            <p><strong>工作单位：</strong>{{ getSelectedSeat()?.guestUnit || '未填写' }}</p>
            <p><strong>分配分区：</strong>{{ getSelectedSeat()?.assignedSection }}</p>
            <p><strong>座位位置：</strong>分区 {{ getSelectedSeat()?.section }}，第 {{ getSelectedSeat()?.row }} 排，第 {{ getSelectedSeat()?.col }} 列</p>
          </div>
          <div v-else class="empty-seat">
            <p>此座位暂无嘉宾</p>
            <p>座位位置：分区 {{ getSelectedSeat()?.section }}，第 {{ getSelectedSeat()?.row }} 排，第 {{ getSelectedSeat()?.col }} 列</p>
          </div>
        </div>
        <button @click="selectedSeatId = null" class="close-button">关闭</button>
      </div>
      
      <div class="legend">
        <div class="legend-item">
          <span class="color-box available"></span>
          <span>空座位</span>
        </div>
        <div class="legend-item">
          <span class="color-box section"></span>
          <span>分区边界</span>
        </div>
      </div>
    </div>
    
    <div class="instructions">
      <p>提示：点击座位可以查看嘉宾信息，拖拽有嘉宾的座位可以交换位置</p>

    </div>
  </div>
</template>

<style scoped>
.floor-plan {
  background: var(--neumorphism-bg);
  padding: 25px;
  border-radius: var(--neumorphism-radius-lg);
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 8px 8px 16px var(--neumorphism-shadow-dark),
              -8px -8px 16px var(--neumorphism-shadow-light);
}

.floor-plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  padding-bottom: 20px;
  border-bottom: 2px solid rgba(64, 158, 255, 0.2);
}

.floor-plan-header h2 {
  margin: 0;
  color: #2c3e50;
  font-size: 24px;
  font-weight: 700;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
}

.controls {
  display: flex;
  gap: 12px;
}

.controls button {
  padding: 12px 20px;
  background: var(--neumorphism-bg);
  color: var(--neumorphism-primary);
  border: none;
  border-radius: var(--neumorphism-radius-sm);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 4px 4px 8px var(--neumorphism-shadow-dark),
              -4px -4px 8px var(--neumorphism-shadow-light);
}

.controls button:hover {
  box-shadow: 6px 6px 12px var(--neumorphism-shadow-dark),
              -6px -6px 12px var(--neumorphism-shadow-light);
  color: var(--neumorphism-primary-dark);
}

.controls button:active {
  box-shadow: inset 2px 2px 4px var(--neumorphism-shadow-dark),
              inset -2px -2px 4px var(--neumorphism-shadow-light);
}

.canvas-container {
  flex: 1;
  position: relative;
  background: var(--neumorphism-bg);
  border-radius: var(--neumorphism-radius);
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 0;
  padding: 20px;
  box-shadow: inset 4px 4px 8px var(--neumorphism-shadow-dark),
              inset -4px -4px 8px var(--neumorphism-shadow-light);
}

.seat-canvas {
  background: var(--neumorphism-bg);
  border-radius: var(--neumorphism-radius-sm);
  max-width: 100%;
  max-height: 100%;
  box-shadow: 4px 4px 8px var(--neumorphism-shadow-dark),
              -4px -4px 8px var(--neumorphism-shadow-light);
}

.legend {
  position: absolute;
  bottom: 30px;
  left: 30px;
  background: var(--neumorphism-bg);
  padding: 18px 24px;
  border-radius: var(--neumorphism-radius);
  box-shadow: 6px 6px 12px var(--neumorphism-shadow-dark),
              -6px -6px 12px var(--neumorphism-shadow-light);
  display: flex;
  gap: 20px;
  z-index: 10;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
  color: #555;
}

.color-box {
  width: 22px;
  height: 22px;
  border-radius: var(--neumorphism-radius-sm);
  box-shadow: 3px 3px 6px var(--neumorphism-shadow-dark),
              -3px -3px 6px var(--neumorphism-shadow-light);
}

.color-box.available {
  background: #d4ebff;
}

.color-box.occupied {
  background: #d4ebff;
}

.color-box.section {
  background: var(--neumorphism-primary);
  opacity: 0.5;
}

.instructions {
  margin-top: 25px;
  padding: 18px 24px;
  background: var(--neumorphism-bg);
  border-radius: var(--neumorphism-radius);
  border-left: 5px solid var(--neumorphism-primary);
  font-size: 14px;
  color: #666;
  font-weight: 500;
  box-shadow: 4px 4px 8px var(--neumorphism-shadow-dark),
              -4px -4px 8px var(--neumorphism-shadow-light);
}

/* 上传按钮样式 */
.file-upload-wrapper {
  display: inline-block;
}

.upload-button {
  padding: 12px 20px;
  background: var(--neumorphism-bg);
  color: var(--neumorphism-warning);
  border: none;
  border-radius: var(--neumorphism-radius-sm);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 4px 4px 8px var(--neumorphism-shadow-dark),
              -4px -4px 8px var(--neumorphism-shadow-light);
}

.upload-button:hover {
  box-shadow: 6px 6px 12px var(--neumorphism-shadow-dark),
              -6px -6px 12px var(--neumorphism-shadow-light);
  color: #e6a23c;
}

.upload-button:active {
  box-shadow: inset 2px 2px 4px var(--neumorphism-shadow-dark),
              inset -2px -2px 4px var(--neumorphism-shadow-light);
}

/* 嘉宾信息面板样式 */
.guest-info-panel {
  margin-top: 20px;
  padding: 20px;
  background: var(--neumorphism-bg);
  border-radius: var(--neumorphism-radius);
  box-shadow: 4px 4px 8px var(--neumorphism-shadow-dark),
              -4px -4px 8px var(--neumorphism-shadow-light);
  border-top: 5px solid var(--neumorphism-primary);
}

/* 悬浮面板样式（显示在画布左上角） */
.guest-info-panel.floating-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 100;
  margin-top: 0;
  width: 320px;
  max-width: calc(100% - 40px);
}

.guest-info-panel h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #2c3e50;
  font-size: 18px;
  font-weight: 600;
  border-bottom: 2px solid rgba(64, 158, 255, 0.2);
  padding-bottom: 10px;
}

.guest-info-content {
  margin-bottom: 15px;
}

.guest-details p,
.empty-seat p {
  margin: 8px 0;
  color: #555;
  font-size: 14px;
}

.guest-details strong,
.empty-seat strong {
  color: #333;
  min-width: 80px;
  display: inline-block;
}

.close-button {
  padding: 10px 18px;
  background: var(--neumorphism-bg);
  color: var(--neumorphism-primary);
  border: none;
  border-radius: var(--neumorphism-radius-sm);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 3px 3px 6px var(--neumorphism-shadow-dark),
              -3px -3px 6px var(--neumorphism-shadow-light);
}

.close-button:hover {
  box-shadow: 4px 4px 8px var(--neumorphism-shadow-dark),
              -4px -4px 8px var(--neumorphism-shadow-light);
  color: var(--neumorphism-primary-dark);
}

.close-button:active {
  box-shadow: inset 2px 2px 4px var(--neumorphism-shadow-dark),
              inset -2px -2px 4px var(--neumorphism-shadow-light);
}

/* 拖拽提示 */
.drag-hint {
  font-size: 12px;
  color: #888;
  margin-top: 10px;
  font-style: italic;
}
</style>