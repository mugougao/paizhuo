<script setup>
import { ref } from 'vue'

// 会议名称的双向绑定模型，默认值为"大型会议"
const meetingName = defineModel('meetingName', { default: '大型会议' })

// 会议时间的双向绑定模型，默认值为空字符串
const meetingTime = defineModel('meetingTime', { default: '' })

// 定义组件事件，用于保存配置时触发
const emit = defineEmits(['save-configuration'])

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
// @param {Array} directions - 舞台朝向选项数组
const stageSettings = ref({
  exists: true,
  length: 3,
  width: 8,
  direction: 'north',
  directions: [
    { label: '北', value: 'north' },
    { label: '东', value: 'east' },
    { label: '南', value: 'south' },
    { label: '西', value: 'west' }
  ]
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
// @param {boolean} collapsed - 分区面板是否折叠
const seatSections = ref([
  {
    id: 1,
    name: '分区1',
    leftWallDistance: 1,
    rightWallDistance: 1,
    previousSectionDistance: 2,
    rows: 5,
    maxContinuousSeats: 10,
    seatLeftRightSpacing: 0,
    seatFrontBackSpacing: 1,
    seatLength: 0.5,
    seatWidth: 0.5,
    aisleWidth: 1.2,
    collapsed: false
  }
])

/**
 * 添加新的座位分区
 * 基于最后一个分区的设置创建新分区，保持一致的配置
 * 自动生成分区ID和名称
 */
function addSeatSection() {
  const lastSection = seatSections.value[seatSections.value.length - 1]
  seatSections.value.push({
    id: seatSections.value.length + 1,
    name: `分区${seatSections.value.length + 1}`,
    leftWallDistance: lastSection.leftWallDistance,
    rightWallDistance: lastSection.rightWallDistance,
    previousSectionDistance: 1,
    rows: 5,
    maxContinuousSeats: 10,
    seatLeftRightSpacing: 0,
    seatFrontBackSpacing: 1,
    seatLength: 0.5,
    seatWidth: 0.5,
    aisleWidth: 1.2,
    collapsed: false
  })
}

/**
 * 切换分区面板的折叠状态
 * @param {number} index - 分区在数组中的索引
 */
function toggleSectionCollapse(index) {
  seatSections.value[index].collapsed = !seatSections.value[index].collapsed
}

/**
 * 删除指定的座位分区
 * 防止删除最后一个分区，确保至少保留一个分区
 * @param {number} index - 要删除的分区在数组中的索引
 */
function removeSeatSection(index) {
  if (seatSections.value.length > 1) {
    seatSections.value.splice(index, 1)
  }
}

/**
 * 获取当前日期时间，格式化为datetime-local输入框所需的格式
 * @returns {string} - 格式为"YYYY-MM-DDThh:mm"的日期时间字符串
 */
function getCurrentDateTime() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * 保存当前配置并触发保存事件
 * 收集所有配置数据，输出到控制台，并通过事件传递给父组件
 */
function saveConfiguration() {
  const configData = { 
    meetingName: meetingName.value, 
    meetingTime: meetingTime.value,
    roomSettings: roomSettings.value,
    stageSettings: stageSettings.value,
    seatSections: seatSections.value
  }
  console.log('保存配置:', configData)
  emit('save-configuration', configData)
}
</script>

<template>
  <div class="configuration-panel">
    <h2>会议配置</h2>
    
    <div class="form-item">
      <label>会议名称</label>
      <input v-model="meetingName" type="text" placeholder="请输入会议名称" />
    </div>
    
    <div class="form-item">
      <label>会议时间</label>
      <input v-model="meetingTime" type="datetime-local" :min="getCurrentDateTime()" />
    </div>
    
    <div class="section">
      <h3>会议室设置</h3>
      <div class="form-grid">
        <div class="form-item">
          <label>会议室长度 (米)</label>
          <input v-model.number="roomSettings.length" type="number" min="1" max="100" step="0.1" />
        </div>
        <div class="form-item">
          <label>会议室宽度 (米)</label>
          <input v-model.number="roomSettings.width" type="number" min="1" max="100" step="0.1" />
        </div>
      </div>
    </div>
    
    <div class="section">
      <h3>舞台设置</h3>
      <div class="form-item">
        <label>
          <input v-model="stageSettings.exists" type="checkbox" />
          存在舞台
        </label>
      </div>
      
      <div v-if="stageSettings.exists" class="form-grid">
        <div class="form-item">
          <label>舞台长度 (米)</label>
          <input v-model.number="stageSettings.length" type="number" min="0.5" max="20" step="0.1" />
        </div>
        <div class="form-item">
          <label>舞台宽度 (米)</label>
          <input v-model.number="stageSettings.width" type="number" min="0.5" max="20" step="0.1" />
        </div>
        <div class="form-item">
          <label>舞台朝向</label>
          <select v-model="stageSettings.direction">
            <option v-for="direction in stageSettings.directions" :key="direction.value" :value="direction.value">
              {{ direction.label }}
            </option>
          </select>
        </div>
      </div>
    </div>
    
    <div class="section">
      <div class="section-header">
        <h3>座位分区设置</h3>
        <button @click="addSeatSection" class="add-button">+ 新增分区</button>
      </div>
      
      <div v-for="(section, index) in seatSections" :key="section.id" class="seat-section">
        <div class="section-header">
          <div class="section-title">
            <button @click="toggleSectionCollapse(index)" class="collapse-button">
              {{ section.collapsed ? '▶' : '▼' }}
            </button>
            <h4>{{ section.name }}</h4>
          </div>
          <div class="section-actions">
            <button v-if="seatSections.length > 1" @click="removeSeatSection(index)" class="remove-button">删除</button>
          </div>
        </div>
        
        <div v-if="!section.collapsed" class="compact-grid">
          <div class="form-item full-width">
            <label>分区名称</label>
            <input v-model="section.name" type="text" placeholder="请输入分区名称" />
          </div>
          
          <div class="inline-group">
            <div class="form-item">
              <label>左墙间距 (米)</label>
              <input v-model.number="section.leftWallDistance" type="number" min="0" max="20" step="0.1" />
            </div>
            <div class="form-item">
              <label>右墙间距 (米)</label>
              <input v-model.number="section.rightWallDistance" type="number" min="0" max="20" step="0.1" />
            </div>
          </div>
          
          <div class="inline-group three-columns">
            <div class="form-item">
              <label>前分区间距</label>
              <input v-model.number="section.previousSectionDistance" type="number" min="0" max="20" step="0.1" />
            </div>
            <div class="form-item">
              <label>座位排数</label>
              <input v-model.number="section.rows" type="number" min="1" max="50" />
            </div>
            <div class="form-item">
              <label>最大连续座位</label>
              <input v-model.number="section.maxContinuousSeats" type="number" min="1" max="100" />
            </div>
          </div>
          
          <div class="inline-group">
            <div class="form-item">
              <label>座位左右间距</label>
              <input v-model.number="section.seatLeftRightSpacing" type="number" min="0.1" max="2" step="0.1" />
            </div>
            <div class="form-item">
              <label>座位前后间距</label>
              <input v-model.number="section.seatFrontBackSpacing" type="number" min="0.1" max="2" step="0.1" />
            </div>
          </div>
          
          <div class="inline-group">
            <div class="form-item">
              <label>座位长度</label>
              <input v-model.number="section.seatLength" type="number" min="0.1" max="2" step="0.1" />
            </div>
            <div class="form-item">
              <label>座位宽度</label>
              <input v-model.number="section.seatWidth" type="number" min="0.1" max="2" step="0.1" />
            </div>
          </div>
          
          <div class="form-item full-width">
            <label>过道宽度</label>
            <input v-model.number="section.aisleWidth" type="number" min="0.5" max="3" step="0.1" />
          </div>
        </div>
      </div>
    </div>
    
    <button @click="saveConfiguration" class="save-button">保存配置</button>
  </div>
</template>

<style scoped>
.configuration-panel {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  height: 100%;
  overflow-y: auto;
}

.configuration-panel h2 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.section {
  margin-bottom: 30px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #409eff;
}

.section h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #2c3e50;
  font-size: 18px;
}

.section h4 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #555;
  font-size: 16px;
}

.seat-section h4 {
  margin: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.collapse-button {
  background: none;
  border: none;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  color: #666;
  border-radius: 3px;
}

.collapse-button:hover {
  background-color: #f0f0f0;
}

.form-item {
  margin-bottom: 16px;
}

.form-item label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #555;
}

.form-item input[type="text"],
.form-item input[type="number"],
.form-item select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-item input:focus,
.form-item select:focus {
  outline: none;
  border-color: #409eff;
}

.form-item input[type="checkbox"] {
  margin-right: 8px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.seat-section {
  margin-bottom: 20px;
  padding: 12px;
  background-color: white;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.seat-section:last-child {
  margin-bottom: 0;
}

.add-button {
  padding: 6px 12px;
  background-color: #52c41a;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.add-button:hover {
  background-color: #389e0d;
}

.remove-button {
  padding: 4px 10px;
  background-color: #ff4d4f;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.remove-button:hover {
  background-color: #d9363e;
}

.save-button {
  width: 100%;
  padding: 12px;
  background-color: #409eff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  margin-top: 20px;
  transition: background-color 0.2s;
}

.save-button:hover {
  background-color: #337ecc;
}

.compact-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.compact-grid .form-item {
  margin-bottom: 0;
}

.inline-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.inline-group.three-columns {
  grid-template-columns: 1fr 1fr 1fr;
}

.form-item.full-width {
  width: 100%;
}

@media (max-width: 768px) {
  .inline-group {
    grid-template-columns: 1fr;
  }
  
  .inline-group.three-columns {
    grid-template-columns: 1fr;
  }
}
</style>