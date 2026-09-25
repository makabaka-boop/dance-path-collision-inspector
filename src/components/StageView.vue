<script setup lang="ts">
import { computed } from 'vue';
import type { Choreography, Collision } from '../geometry/types';
import { positionAt } from '../geometry/geometry';
import { fToCentiseconds, fToNumber, fr } from '../geometry/fraction';

const props = defineProps<{
  choreography: Choreography;
  timeCs: number;
  selected: Collision | null;
  collisions: Collision[];
}>();

const SIZE = 560;
const PAD = 24;
const COORD_MAX = 100;
const scale = (SIZE - 2 * PAD) / (2 * COORD_MAX);
const cx = (x: number) => SIZE / 2 + x * scale;
const cy = (y: number) => SIZE / 2 - y * scale;

const currentTime = computed(() => fr(props.timeCs, 100));

interface Marker {
  x: number;
  y: number;
  color: string;
  radius: number;
  name: string;
  moving: boolean;
}

const markers = computed<Marker[]>(() => {
  const t = currentTime.value;
  return props.choreography.dancers.map((d) => {
    const p = positionAt(d, t);
    return {
      x: p ? fToNumber(p.x) : d.waypoints[d.waypoints.length - 1].x,
      y: p ? fToNumber(p.y) : d.waypoints[d.waypoints.length - 1].y,
      color: d.color,
      radius: d.radius,
      name: d.name,
      moving: Boolean(p),
    };
  });
});

/** Full polyline points for each dancer's trajectory. */
const trails = computed(() =>
  props.choreography.dancers.map((d) => ({
    color: d.color,
    name: d.name,
    points: d.waypoints.map((w) => `${cx(w.x)},${cy(w.y)}`).join(' '),
  })),
);

/** Waypoint dots. */
const waypointDots = computed(() =>
  props.choreography.dancers.flatMap((d, di) =>
    d.waypoints.map((w, wi) => ({
      key: `${di}-${wi}`,
      x: cx(w.x),
      y: cy(w.y),
      color: d.color,
      t: w.t,
    })),
  ),
);

/** The two segments participating in the selected collision. */
const selectedSegments = computed(() => {
  const c = props.selected;
  if (!c) return [];
  return [c.a, c.b].map((ref) => {
    const d = props.choreography.dancers[ref.dancerIndex];
    const w0 = d.waypoints[ref.segmentIndex];
    const w1 = d.waypoints[ref.segmentIndex + 1];
    return {
      key: `${ref.dancerIndex}-${ref.segmentIndex}`,
      color: d.color,
      x1: cx(w0.x),
      y1: cy(w0.y),
      x2: cx(w1.x),
      y2: cy(w1.y),
    };
  });
});

/** Exact witness positions at the collision minimum (fractional). */
const witness = computed(() => {
  const c = props.selected;
  if (!c) return null;
  const a = props.choreography.dancers[c.dancerA];
  const b = props.choreography.dancers[c.dancerB];
  return {
    x1: cx(fToNumber(c.posA.x)),
    y1: cy(fToNumber(c.posA.y)),
    x2: cx(fToNumber(c.posB.x)),
    y2: cy(fToNumber(c.posB.y)),
    colorA: a.color,
    colorB: b.color,
    atCurrentTime: fToCentiseconds(c.tMin) === props.timeCs,
  };
});

const collisionTicks = computed(() =>
  props.collisions.map((c) => ({
    id: c.id,
    x: cx(fToNumber(c.posA.x)),
    y: cy(fToNumber(c.posA.y)),
    selected: c.id === props.selected?.id,
  })),
);

defineEmits<{ (e: 'pick-collision', c: Collision): void }>();
</script>

<template>
  <svg
    class="stage"
    :viewBox="`0 0 ${SIZE} ${SIZE}`"
    role="img"
    aria-label="舞台轨迹图"
  >
    <!-- empty warehouse floor -->
    <rect x="0" y="0" :width="SIZE" :height="SIZE" class="floor" />
    <g class="grid">
      <line
        v-for="g in [-100, -50, 50, 100]"
        :key="`v${g}`"
        :x1="cx(g)" :x2="cx(g)" y1="0" :y2="SIZE"
      />
      <line
        v-for="g in [-100, -50, 50, 100]"
        :key="`h${g}`"
        :y1="cy(g)" :y2="cy(g)" x1="0" :x2="SIZE"
      />
      <line :x1="0" :x2="SIZE" :y1="cy(0)" :y2="cy(0)" class="axis" />
      <line :y1="0" :y2="SIZE" :x1="cx(0)" :x2="cx(0)" class="axis" />
    </g>

    <!-- trajectories -->
    <g class="trails">
      <polyline
        v-for="t in trails"
        :key="t.name"
        :points="t.points"
        :stroke="t.color"
      />
    </g>

    <!-- highlighted colliding segments -->
    <g class="selected-segments">
      <line
        v-for="s in selectedSegments"
        :key="s.key"
        :x1="s.x1" :y1="s.y1" :x2="s.x2" :y2="s.y2"
        :stroke="s.color"
      />
    </g>

    <!-- waypoints -->
    <g class="waypoints">
      <circle
        v-for="w in waypointDots"
        :id="w.key"
        :key="w.key"
        :cx="w.x" :cy="w.y" r="2.6"
        :fill="w.color"
      >
        <title>t={{ w.t }}</title>
      </circle>
    </g>

    <!-- collision witnesses (minimum point of each colliding overlap) -->
    <g class="collision-ticks">
      <g
        v-for="tick in collisionTicks"
        :key="tick.id"
        class="tick"
        :class="{ active: tick.selected }"
        @click.stop="$emit('pick-collision', collisions.find((c) => c.id === tick.id)!)"
      >
        <circle :cx="tick.x" :cy="tick.y" r="9" />
        <path
          :transform="`translate(${tick.x} ${tick.y})`"
          d="M0,-5 L1.5,-1.8 L5,-1.5 L2.4,0.9 L3.2,4.4 L0,2.6 L-3.2,4.4 L-2.4,0.9 L-5,-1.5 L-1.5,-1.8 Z"
        />
      </g>
    </g>

    <!-- witness line between the two dancers at the selected minimum -->
    <g v-if="witness" class="witness">
      <line :x1="witness.x1" :y1="witness.y1" :x2="witness.x2" :y2="witness.y2"
            :class="{ dashed: !witness.atCurrentTime }" />
      <circle :cx="witness.x1" :cy="witness.y1" r="4" :fill="witness.colorA"
              stroke="#111" stroke-width="1.2" />
      <circle :cx="witness.x2" :cy="witness.y2" r="4" :fill="witness.colorB"
              stroke="#111" stroke-width="1.2" />
    </g>

    <!-- live dancers at slider time -->
    <g class="dancers">
      <g v-for="(m, i) in markers" :key="i">
        <circle
          :cx="m.x" :cy="m.y"
          :r="Math.max(2.5, m.radius * scale)"
          :fill="m.color"
          fill-opacity="0.18"
          :stroke="m.color"
          stroke-width="1.4"
          :stroke-dasharray="m.moving ? undefined : '3 3'"
        />
        <circle :cx="m.x" :cy="m.y" r="3" :fill="m.color" stroke="#111" stroke-width="1" />
        <text :x="m.x + 8" :y="m.y - 8" class="label">{{ m.name }}</text>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.stage {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 10px;
}
.floor { fill: #f7f6f2; }
.grid line {
  stroke: #e3e0d6;
  stroke-width: 1;
}
.grid .axis { stroke: #c9c4b4; }
.trails polyline {
  fill: none;
  stroke-width: 2;
  stroke-opacity: 0.55;
}
.selected-segments line {
  stroke-width: 6;
  stroke-opacity: 0.28;
  stroke-linecap: round;
}
.collision-ticks .tick { cursor: pointer; }
.collision-ticks .tick circle {
  fill: transparent;
}
.collision-ticks .tick path {
  fill: #d97706;
  stroke: #7c2d12;
  stroke-width: 0.6;
}
.collision-ticks .tick.active path {
  fill: #f59e0b;
  stroke: #111;
  stroke-width: 0.8;
}
.witness line {
  stroke: #111;
  stroke-width: 1.6;
}
.witness line.dashed {
  stroke-dasharray: 4 3;
  stroke-opacity: 0.55;
}
.label {
  font-size: 12px;
  fill: #333;
}
</style>
