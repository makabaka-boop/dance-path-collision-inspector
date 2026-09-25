<script setup lang="ts">
import type { AnalysisResult, Choreography, Collision } from '../geometry/types';
import { fToFixed, fToString } from '../geometry/fraction';

const props = defineProps<{
  result: AnalysisResult;
  choreography: Choreography;
  selectedId: string | null;
}>();

const emit = defineEmits<{ (e: 'select', c: Collision): void }>();

function dancerName(i: number) {
  return props.choreography.dancers[i]?.name ?? `#${i + 1}`;
}
function dancerColor(i: number) {
  return props.choreography.dancers[i]?.color ?? '#888';
}

function segLabel(c: Collision) {
  return `A段${c.a.segmentIndex}–B段${c.b.segmentIndex}`;
}
</script>

<template>
  <div class="report">
    <div class="summary">
      共检查 <strong>{{ result.pairsChecked }}</strong> 对重叠线段，发现
      <strong :class="{ bad: result.collisions.length > 0 }">
        {{ result.collisions.length }}
      </strong>
      处冲突
      <span class="version">（分析版本 v{{ result.version }}）</span>
    </div>

    <div v-for="r in result.reports" :key="`${r.dancerA}-${r.dancerB}`" class="pair">
      <h3>
        <span class="dot" :style="{ background: dancerColor(r.dancerA) }" />
        {{ dancerName(r.dancerA) }}
        <span class="vs">×</span>
        <span class="dot" :style="{ background: dancerColor(r.dancerB) }" />
        {{ dancerName(r.dancerB) }}
        <span class="meta">检查 {{ r.pairsChecked }} 对线段</span>
      </h3>

      <p v-if="r.collisions.length === 0" class="clear">✓ 无冲突</p>

      <ul v-else class="collisions">
        <li
          v-for="c in r.collisions"
          :key="c.id"
          :class="{ active: c.id === selectedId }"
          @click="emit('select', c)"
        >
          <div class="line1">
            <span class="seg">{{ segLabel(c) }}</span>
            <span class="dist">
              min d² =
              <strong>{{ fToString(c.minDistSq) }}</strong>
              <em>(≈ {{ fToFixed(c.minDistSq, 4) }})</em>
            </span>
          </div>
          <div class="line2">
            半径和 = {{ c.radiusSum }}，冲突阈值 d² ≤ {{ c.radiusSum * c.radiusSum }}
          </div>
          <div class="line2">
            最小距离时刻 t =
            <strong>{{ fToString(c.tMin) }}</strong>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.report {
  font-size: 13px;
}
.summary {
  padding: 8px 10px;
  background: #f7f6f2;
  border-radius: 8px;
  margin-bottom: 10px;
}
.summary .bad { color: #c2410c; }
.version { color: #999; font-size: 12px; }
.pair {
  border: 1px solid #e7e3d8;
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 8px;
  background: #fff;
}
h3 {
  margin: 0 0 6px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.vs { color: #999; font-weight: normal; }
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.meta {
  margin-left: auto;
  font-size: 12px;
  color: #999;
  font-weight: normal;
}
.clear { margin: 4px 0; color: #2e9e5b; }
.collisions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.collisions li {
  border: 1px solid #e7e3d8;
  border-left: 4px solid #f59e0b;
  border-radius: 6px;
  padding: 6px 8px;
  cursor: pointer;
  background: #fffdf7;
}
.collisions li:hover { background: #fef6e4; }
.collisions li.active {
  border-left-color: #dc2626;
  background: #fee2e2;
}
.line1 {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.seg { font-weight: 600; }
.dist { font-variant-numeric: tabular-nums; }
.dist em { color: #888; font-style: normal; font-size: 12px; }
.line2 { color: #555; margin-top: 2px; font-variant-numeric: tabular-nums; }
</style>
