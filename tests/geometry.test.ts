import { describe, expect, it } from 'vitest';
import {
  analyzeChoreography,
  analyzeOverlap,
  overlappingSegmentPairs,
} from '../src/geometry/geometry';
import { fr, fEq } from '../src/geometry/fraction';
import type { Choreography, Dancer, Waypoint } from '../src/geometry/types';

type Pt = [t: number, x: number, y: number];

function dancer(name: string, radius: number, pts: Pt[], color = '#000'): Dancer {
  const waypoints: Waypoint[] = pts.map(([t, x, y]) => ({ t, x, y }));
  return { id: name, name, color, radius, waypoints };
}

function onlyPair(c: Choreography) {
  const result = analyzeChoreography(c);
  expect(result.reports).toHaveLength(1);
  return result.reports[0];
}

describe('精确冲突判定几何', () => {
  it('正对反向相遇：中点 d²=0，整数时刻', () => {
    const c: Choreography = {
      dancers: [
        dancer('A', 1, [[0, -10, 0], [10, 10, 0]]),
        dancer('B', 1, [[0, 10, 0], [10, -10, 0]]),
      ],
    };
    const report = onlyPair(c);
    expect(report.collisions).toHaveLength(1);
    const hit = report.collisions[0];
    expect(hit.minDistSq).toEqual(fr(0));
    expect(hit.tMin).toEqual(fr(5));
  });

  it('反向相遇发生在分数时刻 t=16/3，位置精确', () => {
    // A: x = -10 + 3t；B: x = 10 - 3t/4，相遇于 -10+3t = 10-3t/4 → t=16/3, x=6
    const c: Choreography = {
      dancers: [
        dancer('A', 0, [[0, -10, 0], [10, 20, 0]]),
        dancer('B', 0, [[0, 10, 0], [20, -5, 0]]),
      ],
    };
    const hit = onlyPair(c).collisions[0];
    expect(hit.tMin).toEqual(fr(16, 3));
    expect(hit.minDistSq).toEqual(fr(0));
    expect(hit.posA.x).toEqual(fr(6));
    expect(hit.posB.x).toEqual(fr(6));
  });

  it('擦边相切：d² 恰好等于 (r₁+r₂)²，且最近点落在整数帧之间', () => {
    // A 沿 y=0 以 4 单位/秒运动；B 沿 y=5 以 5/2 单位/秒运动至 t=8 后静止。
    // 相对 x = 8 - 3s/2，最近点 s = 16/3，d² = 25 = (3+2)² —— 等号成立即冲突。
    const c: Choreography = {
      dancers: [
        dancer('A', 3, [[0, -20, 0], [10, 20, 0]]),
        dancer('B', 2, [[0, -12, 5], [8, 8, 5], [16, 8, 5]]),
      ],
    };
    const report = onlyPair(c);
    expect(report.collisions).toHaveLength(1);
    const hit = report.collisions[0];
    expect(hit.tMin).toEqual(fr(16, 3));
    expect(hit.minDistSq).toEqual(fr(25));

    // 逐帧（整数时刻）截图会漏掉：整数帧上的最小值为 25.25 > 25。
    const frameMin = Math.min(
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((t) => {
        const ax = -20 + 4 * t;
        const bx = -12 + 2.5 * Math.min(t, 8);
        const by = 5;
        return (ax - bx) ** 2 + by * by;
      }),
    );
    expect(frameMin).toBeCloseTo(25.25, 10);
    expect(frameMin).toBeGreaterThan(25);
  });

  it('同样轨迹但半径和为 4：擦边但不接触，无冲突', () => {
    const c: Choreography = {
      dancers: [
        dancer('A', 2, [[0, -20, 0], [10, 20, 0]]),
        dancer('B', 2, [[0, -12, 5], [8, 8, 5]]),
      ],
    };
    const [a, b] = c.dancers;
    const overlaps = [...overlappingSegmentPairs(a, 0, b, 1)];
    expect(overlaps).toHaveLength(1);
    const detail = analyzeOverlap(a, b, overlaps[0]);
    expect(fEq(detail.minDistSq, fr(25))).toBe(true);
    expect(onlyPair(c).collisions).toHaveLength(0);
  });

  it('端点相接：零长度时间重叠（一段终点恰为另一段起点）也被枚举', () => {
    // A 在 t=3 到达 (0,0) 后停留；B 在 t=3 从 (3,0) 出发。
    // A0=[0,3] 与 B0=[3,9] 的重叠退化为瞬时 [3,3]，半径和 3 → d²=9 接触。
    const c: Choreography = {
      dancers: [
        dancer('A', 1, [[0, -8, 0], [3, 0, 0], [8, 0, 0]]),
        dancer('B', 2, [[3, 3, 0], [9, 3, 0]]),
      ],
    };
    const report = onlyPair(c);
    // 零长度对 (A0,B0) 与随后的 (A1,B0) 各报一次，均在 t=3。
    expect(report.collisions).toHaveLength(2);
    for (const hit of report.collisions) {
      expect(hit.minDistSq).toEqual(fr(9));
      expect(hit.tMin).toEqual(fr(3));
    }
    const zeroLength = report.collisions.filter((h) => fEq(h.start, h.end));
    expect(zeroLength).toHaveLength(1);
  });

  it('等速平行：距离恒定，最近时刻取重叠区间起点', () => {
    const c: Choreography = {
      dancers: [
        dancer('A', 0, [[0, -10, 0], [10, 0, 0]]),
        dancer('B', 0, [[0, -5, 0], [10, 5, 0]]),
      ],
    };
    const [a, b] = c.dancers;
    const overlap = [...overlappingSegmentPairs(a, 0, b, 1)][0];
    const detail = analyzeOverlap(a, b, overlap);
    expect(detail.minDistSq).toEqual(fr(25));
    expect(detail.tMin).toEqual(fr(0));
  });

  it('相对速度顶点被夹到重叠区间端点（逐段而非全程处理）', () => {
    // 右端点夹断：零点在 t=40/3，但重叠只到 t=10 → tMin=10, d²=25。
    const c1: Choreography = {
      dancers: [
        dancer('A', 0, [[0, 0, 0], [10, 10, 0]]),
        dancer('B', 0, [[0, 20, 0], [10, 15, 0]]),
      ],
    };
    let [a, b] = c1.dancers;
    let overlap = [...overlappingSegmentPairs(a, 0, b, 1)][0];
    let detail = analyzeOverlap(a, b, overlap);
    expect(detail.tMin).toEqual(fr(10));
    expect(detail.minDistSq).toEqual(fr(25));

    // 左端点夹断：相对距离全程增大 → tMin=0, d²=225。
    const c2: Choreography = {
      dancers: [
        dancer('A', 0, [[0, 15, 0], [10, 25, 0]]),
        dancer('B', 0, [[0, 0, 0], [10, 0, 0]]),
      ],
    };
    [a, b] = c2.dancers;
    overlap = [...overlappingSegmentPairs(a, 0, b, 1)][0];
    detail = analyzeOverlap(a, b, overlap);
    expect(detail.tMin).toEqual(fr(0));
    expect(detail.minDistSq).toEqual(fr(225));
  });

  it('版本号随结果透传，供 Worker 结果丢弃逻辑使用', () => {
    const c: Choreography = {
      dancers: [
        dancer('A', 1, [[0, 0, 0], [10, 10, 0]]),
        dancer('B', 1, [[0, 10, 0], [10, 0, 0]]),
      ],
    };
    expect(analyzeChoreography(c, 7).version).toBe(7);
  });
});
