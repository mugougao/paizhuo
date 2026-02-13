<script setup lang="ts">
import { createLoading, type ICreateLoading } from "@/utils/createLoading.ts";
import wdpMap from "@/utils/WdpMap/wdpMap.ts";

defineOptions({ name: "RenderConfigPopup", inheritAttrs: false });

const emit = defineEmits<{
  (e: "close"): void;
  (e: "submit", config: { sceneUrl: string; sceneOrder: string }): void;
}>();

const visible = defineModel<boolean>("visible", { default: false });
const props = defineProps<{
  initialConfig?: { sceneUrl: string; sceneOrder: string };
}>();

const formData = reactive({
  sceneUrl: "",
  sceneOrder: "",
});

let loading: ICreateLoading | null = null;

watch(() => visible.value, (val) => {
  if (val && props.initialConfig) {
    formData.sceneUrl = props.initialConfig.sceneUrl;
    formData.sceneOrder = props.initialConfig.sceneOrder;
  }
}, { immediate: true });

function handleClose() {
  visible.value = false;
  emit("close");
}

async function handleSubmit() {
  if (!formData.sceneUrl.trim() || !formData.sceneOrder.trim()) {
    window.$message?.error?.("请填写渲染地址和渲染口令");
    return;
  }
  
  visible.value = false;
  emit("submit", { ...formData });
  
  // 开始加载三维场景
  loading = createLoading({ tip: "三维场景加载中，请等待...", size: "large" });
  
  try {
    await wdpMap.render("player", formData.sceneUrl, formData.sceneOrder);
    (window as any).__wdpMap__ = wdpMap;
    
    // 监听场景创建完成（只关闭loading，相机设置由父页面处理）
    wdpMap.onCreated(() => {
      loading?.close();
    });
    
    wdpMap.onError(() => {
      loading?.close();
    });
    
  } catch (error) {
    loading?.close();
    window.$message?.error?.("三维场景加载失败");
    console.error("三维场景加载失败:", error);
  }
}
</script>

<template>
  <DragPopup
    v-model:visible="visible" title="三维场景配置"
    :width="400" :top="100" :left="240"
    @close="handleClose">
    <div class="p-4 space-y-4">
      <div class="space-y-2">
        <label class="block text-white/80 text-sm">渲染地址 (sceneUrl)</label>
        <AInput
          v-model:value="formData.sceneUrl"
          placeholder="请输入渲染地址，如：http://10.108.76.203:8890/service"
          class="w-full"
          size="large"
          allow-clear />
      </div>
      <div class="space-y-2">
        <label class="block text-white/80 text-sm">渲染口令 (sceneOrder)</label>
        <AInput
          v-model:value="formData.sceneOrder"
          placeholder="请输入渲染口令，如：331ff3ceea96acf192b0d0c126fd6ad0"
          class="w-full"
          size="large"
          allow-clear />
      </div>
      <div class="flex justify-end gap-2 pt-4">
        <AButton size="large" @click="handleClose">取消</AButton>
        <AButton type="primary" size="large" @click="handleSubmit">确定并启动三维场景</AButton>
      </div>
    </div>
  </DragPopup>
</template>

<style scoped lang="scss">
</style>