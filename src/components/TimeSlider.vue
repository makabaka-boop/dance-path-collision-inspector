<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import type { Collision } from '../geometry/types';
import { fToCentiseconds } from '../geometry/fraction';

const props = defineProps<{
  modelValue: number; // centiseconds
  maxCs: number;
  playing: boolean;
  collisions: Collision[];
  selectedId: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: number): void;
  (e: 'update:playing', v: boolean): void;
  (e: 'pick-collision', c: Collision): void;
}>();

const trackRef = ref<HTMLDivElement | null>(null);
const SPEED = 40; // simulation seconds per real second

let raf = 0;
let lastTs = 0;

function frame(ts: number) {
  if (!props.playing) return;
  if (!lastTs) lastTs = ts;
  const dt = (ts - lastTs) / 1000;
  lastTs = ts;
  let next = props.modelValue + Math.round(dt * SPEED * 100);
  if (next > props.maxCs) next = 0;
  emit('update:modelValue', next);
  raf = requestAnimationFrame(frame);
}

watch(
  () => props.playing,
  (playing) => {
    cancelAnimationFrame(raf);
    lastTs = 0;
    if (playing) raf = requestAnimationFrame(frame);
  },
);

onBeforeUnmount(() => cancelAnimationFrame(raf));

function onInput(e: Event) {
  emit('update:modelValue', Number((e.target as HTMLInputElement).value));
}

function pct(cs: number) {
  if (props.maxCs === 0) return '0%';
  return `${(cs / props.maxCs) * 100}%`;
}

const ticks = () =>
  props.collisions.map((c) => ({
    c,
    cs: fToCentiseconds(c.tMin),
  }));

function jumpTo(e: MouseEvent, c: Collision) {
  e.stopPropagation();
  emit('update:modelValue', fToCentiseconds(c.tMin));
  emit('pick-collision', c);
}

function fmt(cs: number) {
  const s = cs / 100;
  return `${s.toFixed(2)}s`;
}
</script>

<template>
  <div class="slider-card">
    <div class="row">
      <button class="play" type="button"
              @click="emit('update:playing', !playing)">
        {{ playing ? '⏸ 暂停' : '▶ 播放' }}
      </button>
      <div class="time-readout">
        t = <strong>{{ fmt(modelValue) }}</strong>
      </div>
      <button class="play ghost" type="button"
              @click="emit('update:modelValue', 0)">⏮ 归零</button>
    </div>
    <div ref="trackRef" class="track-wrap">
      <input
        class="track"
        type="range"
        min="0"
        :max="maxCs"
        step="1"
        :value="modelValue"
        @input="onInput"
        aria-label="时间滑块（百分之一秒）"
      />
      <div class="ticks">
        <button
          v-for="{ c, cs } in ticks()"
          :key="c.id"
          type="button"
          class="tick"
          :class="{ active: c.id === selectedId }"
          :style="{ left: pct(cs) }"
          :title="`冲突时刻 ≈ ${fmt(cs)}（点击定位见证）`"
          @click="jumpTo($event, c)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.slider-card {
  background: #fff;
  border: 1px solid #e3e0d6;
  border-radius: 10px;
  padding: 12px 16px 8px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.play {
  border: 1px solid #c9c4b4;
  background: #f7f6f2;
  border-radius: 6px;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 13px;
}
.play:hover { background: #efece2; }
.play.ghost { color: #666; }
.time-readout {
  font-variant-numeric: tabular-nums;
  font-size: 14px;
  color: #333;
}
.track-wrap { position: relative; padding-bottom: 14px; }
.track {
  width: 100%;
  margin: 0;
}
.ticks {
  position: relative;
  height: 10px;
  margin-top: -6px;
}
.tick {
  position: absolute;
  width: 9px;
  height: 9px;
  padding: 0;
  border-radius: 50%;
  border: 1.5px solid #7c2d12;
  background: #f59e0b;
  transform: translateX(-50%);
  cursor: pointer;
  top: 0;
}
.tick.active {
  background: #dc2626;
  border-color: #111;
  transform: translateX(-50%) scale(1.35);
}
</style>
