<script setup>
// Vue响应式API
import { ref } from 'vue'

// 导入子组件
import ConfigurationPanel from './components/ConfigurationPanel.vue'
import FloorPlan from './components/FloorPlan.vue'

// 会议名称响应式变量，默认值为"大型会议"
const meetingName = ref('大型会议')

/**
 * 获取默认会议时间（明天上午9点）
 * 用于初始化会议时间选择器
 * @returns {string} - ISO格式的日期时间字符串（YYYY-MM-DDThh:mm）
 */
function getDefaultMeetingTime() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)
  return tomorrow.toISOString().slice(0, 16)
}

// 会议时间响应式变量，使用默认值初始化
const meetingTime = ref(getDefaultMeetingTime())

// 会议室设置响应式对象
// @param {number} length - 会议室长度（米），默认20
// @param {number} width - 会议室宽度（米），默认15
const roomSettings = ref({
  length: 20,
  width: 15
})

// 舞台设置响应式对象
// @param {boolean} exists - 是否存在舞台，默认true
// @param {number} length - 舞台长度（米），默认3
// @param {number} width - 舞台宽度（米），默认8
// @param {string} direction - 舞台朝向，默认'north'（北）
const stageSettings = ref({
  exists: true,
  length: 3,
  width: 8,
  direction: 'north'
})

// 座位分区设置响应式数组，默认包含一个分区
// 每个分区对象包含以下属性：
// @param {number} id - 分区唯一标识符
// @param {string} name - 分区名称
// @param {number} leftWallDistance - 与左墙的间距（米）
// @param {number} rightWallDistance - 与右墙的间距（米）
// @param {number} previousSectionDistance - 与前一个分区的间距（米）
// @param {number} rows - 分区内的座位排数
// @param {number} maxContinuousSeats - 最大连续座位数（超出生成过道）
// @param {number} seatLeftRightSpacing - 座位左右间距（米）
// @param {number} seatFrontBackSpacing - 座位前后间距（米）
// @param {number} seatLength - 座位长度（米）
// @param {number} seatWidth - 座位宽度（米）
// @param {number} aisleWidth - 过道宽度（米）
const seatSections = ref([
  {
    id: 1,
    name: '分区1',
    leftWallDistance: 1,
    rightWallDistance: 1,
    previousSectionDistance: 2,
    rows: 5,
    maxContinuousSeats: 10,
    seatLeftRightSpacing: 0.8,
    seatFrontBackSpacing: 1,
    seatLength: 0.5,
    seatWidth: 0.5,
    aisleWidth: 1.2
  }
])

/**
 * 格式化会议时间显示
 * 将ISO格式的时间字符串转换为中文格式的日期时间
 * @param {string} isoString - ISO格式的日期时间字符串
 * @returns {string} - 格式化后的中文日期时间字符串
 */
function formatMeetingTime(isoString) {
  const date = new Date(isoString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

/**
 * 更新会议名称
 * @param {string} newName - 新的会议名称
 */
function updateMeetingName(newName) {
  meetingName.value = newName
}

/**
 * 更新会议时间
 * @param {string} newTime - 新的会议时间（ISO格式）
 */
function updateMeetingTime(newTime) {
  meetingTime.value = newTime
}

/**
 * 处理配置保存事件
 * 接收子组件传递的配置数据并更新本地状态
 * @param {Object} configData - 配置数据对象
 * @param {Object} configData.roomSettings - 会议室设置
 * @param {Object} configData.stageSettings - 舞台设置
 * @param {Array} configData.seatSections - 座位分区设置数组
 */
function handleSaveConfiguration(configData) {
  roomSettings.value = configData.roomSettings
  stageSettings.value = configData.stageSettings
  seatSections.value = configData.seatSections
}
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>大型会议座位排布系统</h1>
      <div class="header-info">
        <span class="meeting-info">会议：{{ meetingName }}</span>
        <span class="time-info">时间：{{ formatMeetingTime(meetingTime) }}</span>
      </div>
    </header>
    
    <main class="app-main">
      <div class="layout-grid">
        <div class="left-panel">
          <ConfigurationPanel 
            :meetingName="meetingName"
            :meetingTime="meetingTime"
            @update:meetingName="updateMeetingName"
            @update:meetingTime="updateMeetingTime"
            @save-configuration="handleSaveConfiguration"
          />
        </div>
        <div class="right-panel">
          <FloorPlan 
            :roomSettings="roomSettings"
            :stageSettings="stageSettings"
            :seatSections="seatSections"
          />
        </div>
      </div>
    </main>
    
    <footer class="app-footer">
      <p>© 2025 大型会议座位排布系统 | 版本 1.0.0 | 技术支持：技术部</p>
    </footer>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: #f5f7fa;
  color: #333;
}

.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background-color: white;
  padding: 16px 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 100;
}

.app-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
}

.header-info {
  display: flex;
  gap: 20px;
  font-size: 14px;
  color: #666;
}

.meeting-info {
  padding: 4px 12px;
  background-color: #f0f9ff;
  border-radius: 4px;
  border-left: 3px solid #409eff;
}

.time-info {
  padding: 4px 12px;
  background-color: #fff7e6;
  border-radius: 4px;
  border-left: 3px solid #fa8c16;
}

.app-main {
  flex: 1;
  overflow: auto;
}

.layout-grid {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 12px;
  height: 100%;
  max-height: calc(100vh - 140px);
}

.left-panel, .right-panel {
  height: 100%;
}

.left-panel {
  padding: 16px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
}

@media (max-width: 1200px) {
  .layout-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
}

.app-footer {
  background-color: white;
  padding: 16px 24px;
  text-align: center;
  font-size: 14px;
  color: #888;
  border-top: 1px solid #eee;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
}
</style>
