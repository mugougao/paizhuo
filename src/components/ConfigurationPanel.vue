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
  background: var(--neumorphism-bg);
  padding: 30px;
  height: 100%;
  overflow-y: auto;
}

.configuration-panel h2 {
  margin-top: 0;
  margin-bottom: 30px;
  color: #2c3e50;
  font-size: 24px;
  font-weight: 700;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
  padding-bottom: 15px;
  border-bottom: 2px solid rgba(64, 158, 255, 0.2);
}

.section {
  margin-bottom: 30px;
  padding: 25px;
  background: var(--neumorphism-bg);
  border-radius: var(--neumorphism-radius);
  box-shadow: 6px 6px 12px var(--neumorphism-shadow-dark),
              -6px -6px 12px var(--neumorphism-shadow-light);
  border-left: 5px solid var(--neumorphism-primary);
  transition: box-shadow 0.3s ease;
}

.section:hover {
  box-shadow: 8px 8px 16px var(--neumorphism-shadow-dark),
              -8px -8px 16px var(--neumorphism-shadow-light);
}

.section h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #2c3e50;
  font-size: 20px;
  font-weight: 600;
}

.section h4 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #555;
  font-size: 17px;
  font-weight: 600;
}

.seat-section h4 {
  margin: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.collapse-button {
  background: var(--neumorphism-bg);
  border: none;
  font-size: 14px;
  cursor: pointer;
  padding: 8px 12px;
  color: #666;
  border-radius: var(--neumorphism-radius-sm);
  box-shadow: 3px 3px 6px var(--neumorphism-shadow-dark),
              -3px -3px 6px var(--neumorphism-shadow-light);
  transition: all 0.3s ease;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.collapse-button:hover {
  box-shadow: 4px 4px 8px var(--neumorphism-shadow-dark),
              -4px -4px 8px var(--neumorphism-shadow-light);
}

.collapse-button:active {
  box-shadow: inset 2px 2px 4px var(--neumorphism-shadow-dark),
              inset -2px -2px 4px var(--neumorphism-shadow-light);
}

.form-item {
  margin-bottom: 20px;
}

.form-item label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #555;
  font-size: 14px;
  white-space: nowrap;
}

.form-item input[type="text"],
.form-item input[type="number"],
.form-item select {
  width: 100%;
  padding: 14px 16px;
  background: var(--neumorphism-bg);
  border: none;
  border-radius: var(--neumorphism-radius-sm);
  box-shadow: inset 3px 3px 6px var(--neumorphism-shadow-dark),
              inset -3px -3px 6px var(--neumorphism-shadow-light);
  font-size: 14px;
  box-sizing: border-box;
  transition: all 0.3s ease;
}

.form-item input:focus,
.form-item select:focus {
  outline: none;
  box-shadow: inset 4px 4px 8px var(--neumorphism-shadow-dark),
              inset -4px -4px 8px var(--neumorphism-shadow-light);
}

.form-item input[type="checkbox"] {
  margin-right: 10px;
  width: 18px;
  height: 18px;
  accent-color: var(--neumorphism-primary);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 20px;
}

.seat-section {
  margin-bottom: 25px;
  padding: 20px;
  background: var(--neumorphism-bg);
  border-radius: var(--neumorphism-radius);
  box-shadow: 4px 4px 8px var(--neumorphism-shadow-dark),
              -4px -4px 8px var(--neumorphism-shadow-light);
  transition: all 0.3s ease;
}

.seat-section:hover {
  box-shadow: 6px 6px 12px var(--neumorphism-shadow-dark),
              -6px -6px 12px var(--neumorphism-shadow-light);
}

.seat-section:last-child {
  margin-bottom: 0;
}

.add-button {
  padding: 12px 20px;
  background: var(--neumorphism-success);
  color: white;
  border: none;
  border-radius: var(--neumorphism-radius-sm);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 4px 4px 8px rgba(82, 196, 26, 0.3),
              -4px -4px 8px rgba(255, 255, 255, 0.8);
}

.add-button:hover {
  background: #389e0d;
  box-shadow: 6px 6px 12px rgba(82, 196, 26, 0.4),
              -6px -6px 12px rgba(255, 255, 255, 0.9);
}

.remove-button {
  padding: 10px 18px;
  background: var(--neumorphism-error);
  color: white;
  border: none;
  border-radius: var(--neumorphism-radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 4px 4px 8px rgba(255, 77, 79, 0.3),
              -4px -4px 8px rgba(255, 255, 255, 0.8);
}

.remove-button:hover {
  background: #d9363e;
  box-shadow: 6px 6px 12px rgba(255, 77, 79, 0.4),
              -6px -6px 12px rgba(255, 255, 255, 0.9);
}

.save-button {
  width: 100%;
  padding: 18px;
  background: var(--neumorphism-primary);
  color: white;
  border: none;
  border-radius: var(--neumorphism-radius);
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  margin-top: 30px;
  transition: all 0.3s ease;
  box-shadow: 6px 6px 12px rgba(64, 158, 255, 0.3),
              -6px -6px 12px rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.save-button:hover {
  background: var(--neumorphism-primary-dark);
  box-shadow: 8px 8px 16px rgba(64, 158, 255, 0.4),
              -8px -8px 16px rgba(255, 255, 255, 0.9);
}

.save-button:active {
  box-shadow: inset 3px 3px 6px rgba(0, 0, 0, 0.2),
              inset -3px -3px 6px rgba(255, 255, 255, 0.8);
}

.compact-grid {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.compact-grid .form-item {
  margin-bottom: 0;
}

.inline-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.inline-group.three-columns {
  grid-template-columns: 1fr 1fr 1fr;
}

.form-item.full-width {
  width: 100%;
}

@media (max-width: 768px) {
  .configuration-panel {
    padding: 20px;
  }
  
  .section {
    padding: 20px;
  }
  
  .inline-group {
    grid-template-columns: 1fr;
  }
  
  .inline-group.three-columns {
    grid-template-columns: 1fr;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>