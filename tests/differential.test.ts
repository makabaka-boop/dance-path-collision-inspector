import { describe, expect, it } from 'vitest';
import {
  analyzeChoreography,
  analyzeOverlap,
  overlappingSegmentPairs,
} from '../src/geometry/geometry';
import { fEq, fLte, fSub, fr, fToNumber } from '../src/geometry/fraction';
import { validateChoreography } from '../src/choreography/validation';
import type { Choreography, Dancer, Waypoint } from '../src/geometry/types';

function dancer(name: string, radius: number, pts: Array<[number, number, number]>,
               color = '#000'): Dancer {
  const waypoints: Waypoint[] = pts.map(([t, x, y]) => ({ t, x, y }));
  return { id: name, name, color, radius, waypoints };
}

/**
 * 小样本枚举分段对拍：
 *  - 对拍一：双指针重叠枚举 vs 朴素双层 for 枚举（独立实现）。
 *  - 对拍二：精确分数最小值 vs 双精度稠密采样（每段 20 000 点）的最小值，
 *    含发生时刻与逐整数帧分类。
 *  - 对拍三：内置三人样例逐对检查。
 */

// 确定性伪随机，保证测试可复现。
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function randomDancer(rng: () => number, name: string, color: string): Dancer {
  const n = 2 + Math.floor(rng() * 5); // 2..6 路点（小样本）
  const waypoints: Waypoint[] = [];
  let t = Math.floor(rng() * 6);
  for (let i = 0; i < n; i++) {
    t = i === 0 ? t : t + 1 + Math.floor(rng() * 9);
    waypoints.push({
      t,
      x: Math.floor(rng() * 21) - 10,
      y: Math.floor(rng() * 21) - 10,
    });
  }
  return {
    id: name,
    name,
    color,
    radius: Math.floor(rng() * 4),
    waypoints,
  };
}

interface RefOverlap {
  ai: number;
  bi: number;
  start: number;
  end: number;
}

/** 朴素 O(nm) 枚举：独立于生产代码的双指针实现。 */
function referenceOverlaps(a: Dancer, b: Dancer): RefOverlap[] {
  const out: RefOverlap[] = [];
  for (let ai = 0; ai + 1 < a.waypoints.length; ai++) {
    for (let bi = 0; bi + 1 < b.waypoints.length; bi++) {
      const start = Math.max(a.waypoints[ai].t, b.waypoints[bi].t);
      const end = Math.min(a.waypoints[ai + 1].t, b.waypoints[bi + 1].t);
      if (start <= end) out.push({ ai, bi, start, end });
    }
  }
  return out;
}

function pos(w0: Waypoint, w1: Waypoint, t: number) {
  const lambda = (t - w0.t) / (w1.t - w0.t);
  return {
    x: w0.x + lambda * (w1.x - w0.x),
    y: w0.y + lambda * (w1.y - w0.y),
  };
}

/** 双精度稠密采样参考：在一段重叠上均匀取 steps+1 个时刻。 */
function sampledMin(a: Dancer, b: Dancer, ai: number, bi: number,
                  start: number, end: number, steps = 20000) {
  const aw0 = a.waypoints[ai];
  const aw1 = a.waypoints[ai + 1];
  const bw0 = b.waypoints[bi];
  const bw1 = b.waypoints[bi + 1];
  let best = Infinity;
  let bestT = start;
  for (let k = 0; k <= steps; k++) {
    const t = start + ((end - start) * k) / steps;
    const pa = pos(aw0, aw1, t);
    const pb = pos(bw0, bw1, t);
    const d2 = (pa.x - pb.x) ** 2 + (pa.y - pb.y) ** 2;
    if (d2 < best) {
      best = d2;
      bestT = t;
    }
  }
  return { best, bestT };
}

describe('小样本枚举分段对拍', () => {
  const SEEDS = 30;

  for (let seed = 1; seed <= SEEDS; seed++) {
    it(`随机样例 #${seed}：枚举、最小值、时刻与逐帧分类对拍`, () => {
      const rng = makeRng(seed * 7919 + 13);
      const a = randomDancer(rng, 'A', '#f00');
      const b = randomDancer(rng, 'B', '#00f');
      const choreography: Choreography = { dancers: [a, b] };

      // 数据本身必须合法。
      expect(validateChoreography(choreography)).toEqual([]);

      // 对拍一：两种独立的重叠枚举给出完全一致的线段对（顺序无关，
      // 扫描线按时间推进，朴素双层循环按索引推进）。
      const fast = [...overlappingSegmentPairs(a, 0, b, 1)];
      const slow = referenceOverlaps(a, b);
      const key = (x: [number, number]) => `${x[0]}-${x[1]}`;
      const fastKeys = fast.map((o) => [o.a.segmentIndex, o.b.segmentIndex] as [number, number]);
      expect([...fastKeys].sort().map(key)).toEqual(
        slow.map((o) => [o.ai, o.bi] as [number, number]).sort().map(key),
      );
      const slowByKey = new Map(slow.map((o) => [key([o.ai, o.bi]), o]));
      for (const overlap of fast) {
        const ref = slowByKey.get(key([overlap.a.segmentIndex, overlap.b.segmentIndex]))!;
        expect(fToNumber(overlap.start)).toBeCloseTo(ref.start, 12);
        expect(fToNumber(overlap.end)).toBeCloseTo(ref.end, 12);
      }

      // 对拍二：精确最小值/时刻 vs 双精度稠密采样。
      let globalExactMin: ReturnType<typeof fr> | null = null;
      for (const overlap of fast) {        const exact = analyzeOverlap(a, b, overlap);
        const ref = sampledMin(
          a, b,
          overlap.a.segmentIndex, overlap.b.segmentIndex,
          fToNumber(overlap.start), fToNumber(overlap.end),
        );
        const exactNum = fToNumber(exact.minDistSq);
        // 容差按坐标量级缩放（d² 最大约 2e5，double 噪声约 1e-8）。
        expect(Math.abs(exactNum - ref.best)).toBeLessThan(1e-6);
        // 采样到的最近时刻与精确时刻吻合（网格误差 5e-5 以内）。
        const span = fToNumber(fSub(overlap.end, overlap.start));
        expect(Math.abs(fToNumber(exact.tMin) - ref.bestT))
          .toBeLessThan((span / 20000) + 1e-9);

        if (globalExactMin === null || fLte(exact.minDistSq, globalExactMin)) {
          globalExactMin = exact.minDistSq;
        }
      }

      // 对拍三：整整数 tick 逐帧分类。采样 0..600 上的精确即时判定，
      // 与整段分析结论（存在/不存在冲突）对拍。
      const report = analyzeChoreography(choreography).reports[0];
      const rs = a.radius + b.radius;
      let frameContact = false;
      for (let t = 0; t <= 600; t++) {
        const detail = (() => {
          // 只在某段重叠覆盖该 tick 时考察。
          const covered = slow.some((o) => o.start <= t && t <= o.end);
          if (!covered) return undefined;
          const segAt = (d: Dancer) =>
            d.waypoints.findIndex(
              (_, i) => i + 1 < d.waypoints.length
                && d.waypoints[i].t <= t && t <= d.waypoints[i + 1].t,
            );
          const ai = segAt(a);
          const bi = segAt(b);
          if (ai < 0 || bi < 0) return undefined;
          const pa = pos(a.waypoints[ai], a.waypoints[ai + 1], t);
          const pb = pos(b.waypoints[bi], b.waypoints[bi + 1], t);
          return { d2: (pa.x - pb.x) ** 2 + (pa.y - pb.y) ** 2 };
        })();
        if (detail && detail.d2 <= rs * rs + 1e-9) frameContact = true;
      }

      // 帧间冲突（精确）可以在逐帧上看不到；但逐帧看到接触时精确法必报。
      if (frameContact) {
        expect(report.collisions.length).toBeGreaterThan(0);
      }
      // 无重叠 ⇒ 必然无冲突；有重叠且无冲突 ⇒ 全局精确最小值严格大于阈值。
      if (report.collisions.length === 0 && globalExactMin !== null) {
        expect(fToNumber(globalExactMin)).toBeGreaterThan(rs * rs);
      }
      if (slow.length === 0) {
        expect(report.collisions).toHaveLength(0);
      }
    });
  }

  it('帧间冲突演示：整数逐帧采样漏报，精确分数法报出', () => {
    // A 沿 y=0 以 4 单位/秒运动；B 沿 y=5 以 5/2 单位/秒运动至 t=8 后静止。
    const a = dancer('A', 3, [[0, -20, 0], [10, 20, 0]]);
    const b = dancer('B', 2, [[0, -12, 5], [8, 8, 5], [16, 8, 5]]);
    const rs = a.radius + b.radius; // 5，阈值 d² = 25

    // 整数帧 0..8 上的逐帧判定：每一帧都严格大于阈值 → 逐帧法漏报。
    for (let t = 0; t <= 8; t++) {
      const ai = a.waypoints.findIndex(
        (_, i) => a.waypoints[i].t <= t && t <= a.waypoints[i + 1].t,
      );
      const bi = b.waypoints.findIndex(
        (_, i) => b.waypoints[i].t <= t && t <= b.waypoints[i + 1].t,
      );
      const pa = pos(a.waypoints[ai], a.waypoints[ai + 1], t);
      const pb = pos(b.waypoints[bi], b.waypoints[bi + 1], t);
      const d2 = (pa.x - pb.x) ** 2 + (pa.y - pb.y) ** 2;
      expect(d2).toBeGreaterThan(rs * rs);
    }

    // 精确法在 t = 16/3 报出 d² = 25 ≤ 25（等号即冲突）。
    const report = analyzeChoreography({ dancers: [a, b] }).reports[0];
    expect(report.collisions).toHaveLength(1);
    expect(report.collisions[0].tMin).toEqual(fr(16, 3));
    expect(report.collisions[0].minDistSq).toEqual(fr(25));
  });

  it('内置三人样例：A×B 在 t=4 正对相遇，C×A 在 t=16/3 擦边 d²=16', async () => {
    const { sampleChoreography } = await import('../src/data/sample');
    expect(validateChoreography(sampleChoreography)).toEqual([]);
    const result = analyzeChoreography(sampleChoreography);
    expect(result.reports).toHaveLength(3);

    const ab = result.reports.find((r) => r.dancerA === 0 && r.dancerB === 1)!;
    expect(ab.collisions.length).toBeGreaterThan(0);
    expect(ab.collisions[0].tMin).toEqual(fr(4));
    expect(ab.collisions[0].minDistSq).toEqual(fr(0));

    const ac = result.reports.find((r) => r.dancerA === 0 && r.dancerB === 2)!;
    const graze = ac.collisions.find((c) => fEq(c.tMin, fr(16, 3)));
    expect(graze).toBeDefined();
    expect(graze!.minDistSq).toEqual(fr(16));

    // 采样器独立验证 16/3 的最小值。
    const a = sampleChoreography.dancers[0];
    const c = sampleChoreography.dancers[2];
    const ref = sampledMin(a, c, 0, 0, 0, 8);
    expect(ref.best).toBeCloseTo(16, 6);
    expect(Math.abs(ref.bestT - 16 / 3)).toBeLessThan(1e-3);
  });

  it('半径平方与阈值比较用分数：接触边界包含等号', () => {
    // d² 恒为 25/4，半径和 = 5/2 由整数半径凑不出，改用 d²=25, rs=5。
    const choreography: Choreography = {
      dancers: [
        {
          id: 'a', name: 'A', color: '#000', radius: 2,
          waypoints: [{ t: 0, x: 0, y: 0 }, { t: 5, x: 5, y: 0 }],
        },
        {
          id: 'b', name: 'B', color: '#000', radius: 3,
          waypoints: [{ t: 0, x: 0, y: 5 }, { t: 5, x: 5, y: 5 }],
        },
      ],
    };
    const report = analyzeChoreography(choreography).reports[0];
    expect(report.collisions).toHaveLength(1);
    expect(fEq(fSub(report.collisions[0].minDistSq, fr(25)), fr(0))).toBe(true);
  });
});
