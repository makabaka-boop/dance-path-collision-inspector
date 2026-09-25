<script setup lang="ts">
import type { Choreography, Dancer, Waypoint } from '../geometry/types';
import { validateChoreography, type ValidationIssue } from '../choreography/validation';

const props = defineProps<{
  modelValue: Choreography;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: Choreography): void;
}>();

const PALETTE = ['#e5484d', '#3e63dd', '#2e9e5b', '#d97706',
  '#8e4ec6', '#0e9384', '#e93d82', '#6b7280'];

function patch(next: Choreography) {
  emit('update:modelValue', next);
}

function setField<K extends 'name' | 'color' | 'radius'>(
  di: number,
  key: K,
  value: Dancer[K],
) {
  const next = structuredClone(props.modelValue);
  next.dancers[di][key] = value;
  patch(next);
}

function setWaypoint(di: number, wi: number, key: keyof Waypoint, raw: string) {
  const next = structuredClone(props.modelValue);
  next.dancers[di].waypoints[wi][key] = Number(raw);
  patch(next);
}

function addWaypoint(di: number) {
  const next = structuredClone(props.modelValue);
  const wps = next.dancers[di].waypoints;
  const last = wps[wps.length - 1];
  if (wps.length >= 25) return;
  wps.push({
    t: Math.min(600, last.t + 10),
    x: last.x,
    y: last.y,
  });
  patch(next);
}

function removeWaypoint(di: number, wi: number) {
  const next = structuredClone(props.modelValue);
  if (next.dancers[di].waypoints.length <= 2) return;
  next.dancers[di].waypoints.splice(wi, 1);
  patch(next);
}

function addDancer() {
  if (props.modelValue.dancers.length >= 8) return;
  const next = structuredClone(props.modelValue);
  const idx = next.dancers.length;
  next.dancers.push({
    id: `d${Date.now()}`,
    name: `舞者${idx + 1}`,
    color: PALETTE[idx % PALETTE.length],
    radius: 1,
    waypoints: [
      { t: 0, x: 0, y: 0 },
      { t: 10, x: 10, y: 10 },
    ],
  });
  patch(next);
}

function removeDancer(di: number) {
  const next = structuredClone(props.modelValue);
  if (next.dancers.length <= 2) return;
  next.dancers.splice(di, 1);
  patch(next);
}

function issuesFor(di: number, wi?: number): ValidationIssue[] {
  return validateChoreography(props.modelValue).filter(
    (i) => i.dancerIndex === di && (wi === undefined || i.waypointIndex === wi),
  );
}

const globalIssues = () =>
  validateChoreography(props.modelValue).filter((i) => i.dancerIndex === undefined);
</script>

<template>
  <div class="editor">
    <p v-for="(g, i) in globalIssues()" :key="i" class="issue global">{{ g.message }}</p>

    <div v-for="(d, di) in modelValue.dancers" :key="d.id" class="dancer"
         :style="{ borderTopColor: d.color }">
      <div class="d-head">
        <input
          class="name"
          :value="d.name"
          @input="setField(di, 'name', ($event.target as HTMLInputElement).value)"
        />
        <input
          type="color"
          class="color"
          :value="d.color"
          @input="setField(di, 'color', ($event.target as HTMLInputElement).value)"
        />
        <label class="radius">
          r
          <input
            type="number" min="0" step="1"
            :value="d.radius"
            @input="setField(di, 'radius', Number(($event.target as HTMLInputElement).value))"
          />
        </label>
        <button type="button" class="rm" @click="removeDancer(di)"
                :disabled="modelValue.dancers.length <= 2">删除舞者</button>
      </div>

      <p v-for="iss in issuesFor(di).filter((i) => i.waypointIndex === undefined)"
         :key="iss.message" class="issue">{{ iss.message }}</p>

      <table class="wp-table">
        <thead>
          <tr><th></th><th>t</th><th>x</th><th>y</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="(w, wi) in d.waypoints" :key="wi"
              :class="{ bad: issuesFor(di, wi).length > 0 }">
            <td class="idx">#{{ wi }}</td>
            <td><input type="number" min="0" max="600" step="1" :value="w.t"
                       @input="setWaypoint(di, wi, 't', ($event.target as HTMLInputElement).value)" /></td>
            <td><input type="number" min="-100" max="100" step="1" :value="w.x"
                       @input="setWaypoint(di, wi, 'x', ($event.target as HTMLInputElement).value)" /></td>
            <td><input type="number" min="-100" max="100" step="1" :value="w.y"
                       @input="setWaypoint(di, wi, 'y', ($event.target as HTMLInputElement).value)" /></td>
            <td>
              <button type="button" class="rm small"
                      :disabled="d.waypoints.length <= 2"
                      @click="removeWaypoint(di, wi)">×</button>
            </td>
          </tr>
        </tbody>
      </table>
      <button type="button" class="add-wp"
              :disabled="d.waypoints.length >= 25"
              @click="addWaypoint(di)">+ 路点</button>
    </div>

    <button type="button" class="add-dancer"
            :disabled="modelValue.dancers.length >= 8"
            @click="addDancer">+ 添加舞者（{{ modelValue.dancers.length }}/8）</button>
  </div>
</template>

<style scoped>
.editor { font-size: 13px; }
.dancer {
  background: #fff;
  border: 1px solid #e7e3d8;
  border-top: 4px solid #888;
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 10px;
}
.d-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.name {
  font-weight: 600;
  border: 1px solid #d6d2c4;
  border-radius: 4px;
  padding: 3px 6px;
  width: 90px;
}
.color { width: 34px; height: 28px; padding: 0; border: none; background: none; }
.radius { display: flex; align-items: center; gap: 4px; color: #666; }
.radius input { width: 52px; }
button.rm {
  margin-left: auto;
  border: 1px solid #d6d2c4;
  background: #faf8f2;
  border-radius: 5px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 12px;
  color: #b91c1c;
}
button:disabled { opacity: 0.4; cursor: not-allowed; }
.wp-table {
  border-collapse: collapse;
  width: 100%;
}
.wp-table th {
  text-align: left;
  color: #999;
  font-weight: normal;
  font-size: 12px;
  padding: 0 4px 2px;
}
.wp-table input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 2px 4px;
  font-variant-numeric: tabular-nums;
  background: transparent;
}
.wp-table input:focus { border-color: #999; background: #fff; outline: none; }
.wp-table tr.bad input { background: #fee2e2; }
.idx { color: #aaa; width: 26px; }
.rm.small { width: 22px; height: 22px; padding: 0; margin: 0; }
.add-wp, .add-dancer {
  border: 1px dashed #b5b0a0;
  background: transparent;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  color: #555;
  margin-top: 6px;
}
.add-dancer { width: 100%; padding: 8px; }
.issue {
  color: #b91c1c;
  margin: 2px 0;
  font-size: 12px;
}
.issue.global { font-size: 13px; }
</style>
