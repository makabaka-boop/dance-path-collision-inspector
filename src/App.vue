<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Choreography, Collision } from './geometry/types';
import { sampleChoreography } from './data/sample';
import { fToCentiseconds } from './geometry/fraction';
import { useAnalysis, useTimeBounds } from './composables/useAnalysis';
import { isValidChoreography } from './choreography/validation';
import StageView from './components/StageView.vue';
import TimeSlider from './components/TimeSlider.vue';
import CollisionList from './components/CollisionList.vue';
import DancerEditor from './components/DancerEditor.vue';

const choreography = ref<Choreography>(structuredClone(sampleChoreography));
const { result, computing, workerAlive, version, analyze } = useAnalysis();

const timeCs = ref(0);
const playing = ref(false);
const selectedId = ref<string | null>(null);
const tab = ref<'report' | 'editor'>('report');

const timeBounds = useTimeBounds(choreography);
const maxCs = computed(() => Math.max(1, timeBounds.value * 100));
const valid = computed(() => isValidChoreography(choreography.value));

const selected = computed<Collision | null>(() => {
  if (!result.value || !selectedId.value) return null;
  return result.value.collisions.find((c) => c.id === selectedId.value) ?? null;
});

/**
 * Every edit schedules a fresh analysis stamped with a new version.
 * The worker discards replies carrying an older version, so geometry
 * produced before the edit can never appear on stage.
 */
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  choreography,
  () => {
    selectedId.value = null;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => analyze(choreography.value), 120);
  },
  { deep: true },
);

// initial analysis
analyze(choreography.value);

function selectCollision(c: Collision) {
  selectedId.value = c.id;
  timeCs.value = fToCentiseconds(c.tMin);
  playing.value = false;
  tab.value = 'report';
}

// If geometry changed while a selection existed, clear it when results arrive.
watch(result, () => {
  if (selectedId.value && !result.value?.collisions.some((c) => c.id === selectedId.value)) {
    selectedId.value = null;
  }
});
</script>

<template>
  <div class="page">
    <header>
      <h1>舞台轨迹检查</h1>
      <p class="subtitle">
        空仓库排练标记 · 线段匀速插值 · 相对距离平方最小值按分数精确求解
      </p>
      <p class="status">
        <span class="badge" :class="valid ? 'ok' : 'bad'">
          {{ valid ? '数据合法' : '数据非法：暂停分析' }}
        </span>
        <span class="badge" :class="workerAlive ? 'ok' : 'warn'">
          {{ workerAlive ? 'Web Worker' : '主线程回退' }}
        </span>
        <span class="badge">版本 v{{ version }}</span>
        <span v-if="computing" class="badge computing">计算中…</span>
      </p>
    </header>

    <main class="layout">
      <section class="stage-panel">
        <StageView
          :choreography="choreography"
          :time-cs="timeCs"
          :selected="selected"
          :collisions="result?.collisions ?? []"
          @pick-collision="selectCollision"
        />
        <TimeSlider
          v-model="timeCs"
          v-model:playing="playing"
          :max-cs="maxCs"
          :collisions="result?.collisions ?? []"
          :selected-id="selectedId"
          @pick-collision="selectCollision"
        />
      </section>

      <aside class="side-panel">
        <nav class="tabs">
          <button :class="{ active: tab === 'report' }"
                  @click="tab = 'report'">逐对结果</button>
          <button :class="{ active: tab === 'editor' }"
                  @click="tab = 'editor'">编排编辑</button>
        </nav>

        <div v-show="tab === 'report'" class="tab-body">
          <CollisionList
            v-if="result"
            :result="result"
            :choreography="choreography"
            :selected-id="selectedId"
            @select="selectCollision"
          />
          <p v-else class="empty">
            {{ valid ? '等待首版分析结果…' : '请先修正编排数据。' }}
          </p>
        </div>

        <div v-show="tab === 'editor'" class="tab-body editor-body">
          <DancerEditor v-model="choreography" />
        </div>
      </aside>
    </main>

    <footer>
      位置在相邻路点间匀速变化；冲突判定 d² ≤ (r₁+r₂)² 与最小距离发生时刻均用整数 / 分数运算，
      不以逐帧采样或 SVG 像素近似。
    </footer>
  </div>
</template>

<style scoped>
.page {
  max-width: 1180px;
  margin: 0 auto;
  padding: 20px 24px 40px;
}
header h1 { margin: 0; font-size: 22px; }
.subtitle { margin: 4px 0 8px; color: #666; font-size: 13px; }
.status { display: flex; gap: 8px; margin: 0 0 14px; }
.badge {
  font-size: 12px;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid #d6d2c4;
  color: #555;
  background: #f7f6f2;
}
.badge.ok { color: #166534; border-color: #bbf7d0; background: #f0fdf4; }
.badge.bad { color: #991b1b; border-color: #fecaca; background: #fef2f2; }
.badge.warn { color: #92400e; border-color: #fde68a; background: #fffbeb; }
.badge.computing { color: #1d4ed8; border-color: #bfdbfe; background: #eff6ff; }
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 1fr);
  gap: 18px;
}
.side-panel {
  background: #f7f6f2;
  border: 1px solid #e3e0d6;
  border-radius: 10px;
  padding: 10px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}
.tabs { display: flex; gap: 6px; margin-bottom: 10px; }
.tabs button {
  flex: 1;
  border: 1px solid #c9c4b4;
  background: #fff;
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
  font-size: 13px;
}
.tabs button.active { background: #1f2937; color: #fff; border-color: #1f2937; }
.tab-body { overflow-y: auto; }
.editor-body { background: transparent; }
.empty { color: #888; font-size: 13px; padding: 12px; }
footer {
  margin-top: 18px;
  color: #999;
  font-size: 12px;
  border-top: 1px solid #ece9df;
  padding-top: 10px;
}
@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .side-panel { max-height: none; }
}
</style>
