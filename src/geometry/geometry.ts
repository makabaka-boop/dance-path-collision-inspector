/**
 * Exact segment-based collision analysis.
 *
 * Each dancer moves at constant velocity between consecutive waypoints.
 * For every pair of dancers we enumerate pairs of motion segments whose
 * closed time intervals overlap, and on each overlap we minimise the
 * squared relative distance. Both the minimum and the time at which it
 * occurs are computed with integer / rational arithmetic only — there is
 * no frame sampling and no pixel-space involvement.
 */

import {
  Fraction,
  ZERO,
  fAdd,
  fDiv,
  fEq,
  fLt,
  fLte,
  fMax,
  fMin,
  fMul,
  fNeg,
  fSub,
  fr,
} from './fraction';
import type {
  AnalysisResult,
  Choreography,
  Collision,
  Dancer,
  PairReport,
  PointFrac,
  SegmentOverlap,
  SegmentRef,
  Waypoint,
} from './types';

interface SegmentView {
  ref: SegmentRef;
  w0: Waypoint;
  w1: Waypoint;
  t0: Fraction;
  t1: Fraction;
}

function segmentsOf(dancerIndex: number, dancer: Dancer): SegmentView[] {
  const out: SegmentView[] = [];
  for (let i = 0; i + 1 < dancer.waypoints.length; i++) {
    const w0 = dancer.waypoints[i];
    const w1 = dancer.waypoints[i + 1];
    out.push({
      ref: { dancerIndex, segmentIndex: i },
      w0,
      w1,
      t0: fr(w0.t),
      t1: fr(w1.t),
    });
  }
  return out;
}

/**
 * Enumerate overlapping segment pairs in chronological order.
 *
 * Overlaps are closed intervals: when segment A ends at the same tick at
 * which B starts (zero-length overlap), the shared instant is still
 * examined so that two dancers arriving at the same tick can be reported
 * as touching at an endpoint.
 */
export function* overlappingSegmentPairs(
  a: Dancer,
  ai: number,
  b: Dancer,
  bi: number,
): Generator<SegmentOverlap> {
  const sa = segmentsOf(ai, a);
  const sb = segmentsOf(bi, b);
  let i = 0;
  let j = 0;
  while (i < sa.length && j < sb.length) {
    const left = fMax(sa[i].t0, sb[j].t0);
    const right = fMin(sa[i].t1, sb[j].t1);
    if (fLte(left, right)) {
      yield { a: sa[i].ref, b: sb[j].ref, start: left, end: right };
    }
    if (fLt(sa[i].t1, sb[j].t1)) {
      i += 1;
    } else if (fLt(sb[j].t1, sa[i].t1)) {
      j += 1;
    } else {
      // 同一 tick 结束：双进会越过该 tick 上才开始的零长度重叠，
      // 这里显式补查两侧（(i+1,j) 与 (i,j+1)），闭区间保证端点相接可报。
      const tick = sa[i].t1;
      if (i + 1 < sa.length && fEq(sa[i + 1].t0, tick)) {
        yield { a: sa[i + 1].ref, b: sb[j].ref, start: tick, end: tick };
      }
      if (j + 1 < sb.length && fEq(sb[j + 1].t0, tick)) {
        yield { a: sa[i].ref, b: sb[j + 1].ref, start: tick, end: tick };
      }
      i += 1;
      j += 1;
    }
  }
}

/** Position along one segment at global time t (must lie inside it). */
export function positionAtSegment(
  dancer: Dancer,
  ref: SegmentRef,
  t: Fraction,
): PointFrac {
  const w0 = dancer.waypoints[ref.segmentIndex];
  const w1 = dancer.waypoints[ref.segmentIndex + 1];
  const t0 = fr(w0.t);
  const t1 = fr(w1.t);
  const lambda = fDiv(fSub(t, t0), fSub(t1, t0));
  return {
    x: fAdd(fr(w0.x), fMul(lambda, fr(w1.x - w0.x))),
    y: fAdd(fr(w0.y), fMul(lambda, fr(w1.y - w0.y))),
  };
}

/** Exact position at global time t, or undefined outside the dancer's span. */
export function positionAt(dancer: Dancer, t: Fraction): PointFrac | undefined {
  const wps = dancer.waypoints;
  if (fLt(t, fr(wps[0].t)) || fLt(fr(wps[wps.length - 1].t), t)) {
    return undefined;
  }
  for (let i = 0; i + 1 < wps.length; i++) {
    if (fLte(fr(wps[i].t), t) && fLte(t, fr(wps[i + 1].t))) {
      return positionAtSegment(dancer, { dancerIndex: -1, segmentIndex: i }, t);
    }
  }
  return undefined;
}

interface RelativeMotion {
  /** r(s) = r0 + v * s, where s = t - overlap.start. */
  x0: Fraction;
  y0: Fraction;
  vx: Fraction;
  vy: Fraction;
}

/**
 * Minimum of the quadratic |r(s)|^2 over a closed rational interval.
 *
 * |r(s)|^2 = (v.v) s^2 + 2 (r0.v) s + (r0.r0). The unconstrained vertex
 * s* = -(r0.v)/(v.v) is clamped to [0, end - start]. When v.v = 0 (equal
 * velocity vectors) the distance is constant on the interval.
 */
function minimizeSquaredDistance(
  m: RelativeMotion,
  overlap: SegmentOverlap,
): { tMin: Fraction; distSq: Fraction } {
  const vv = fAdd(fMul(m.vx, m.vx), fMul(m.vy, m.vy));

  const evalAt = (s: Fraction): Fraction => {
    const rx = fAdd(m.x0, fMul(m.vx, s));
    const ry = fAdd(m.y0, fMul(m.vy, s));
    return fAdd(fMul(rx, rx), fMul(ry, ry));
  };

  if (fEq(vv, ZERO)) {
    return { tMin: overlap.start, distSq: evalAt(ZERO) };
  }

  const dot = fAdd(fMul(m.x0, m.vx), fMul(m.y0, m.vy));
  const sStar = fDiv(fNeg(dot), vv);
  const span = fSub(overlap.end, overlap.start);
  const sClamped = fMax(ZERO, fMin(span, sStar));
  return {
    tMin: fAdd(overlap.start, sClamped),
    distSq: evalAt(sClamped),
  };
}

function relativeVelocity(dancer: Dancer, segmentIndex: number) {
  const w0 = dancer.waypoints[segmentIndex];
  const w1 = dancer.waypoints[segmentIndex + 1];
  const dt = w1.t - w0.t;
  return {
    vx: fr(w1.x - w0.x, dt),
    vy: fr(w1.y - w0.y, dt),
  };
}

/** Exact minimum squared distance and contact time for one segment overlap. */
export function analyzeOverlap(
  a: Dancer,
  b: Dancer,
  overlap: SegmentOverlap,
): { minDistSq: Fraction; tMin: Fraction } {
  const pa = positionAtSegment(a, overlap.a, overlap.start);
  const pb = positionAtSegment(b, overlap.b, overlap.start);
  const va = relativeVelocity(a, overlap.a.segmentIndex);
  const vb = relativeVelocity(b, overlap.b.segmentIndex);
  const motion: RelativeMotion = {
    x0: fSub(pa.x, pb.x),
    y0: fSub(pa.y, pb.y),
    vx: fSub(va.vx, vb.vx),
    vy: fSub(va.vy, vb.vy),
  };
  const { tMin, distSq } = minimizeSquaredDistance(motion, overlap);
  return { minDistSq: distSq, tMin };
}

/** Full exact analysis: every dancer pair, every overlapping segment pair. */
export function analyzeChoreography(
  choreography: Choreography,
  version = 0,
): AnalysisResult {
  const dancers = choreography.dancers;
  const reports: PairReport[] = [];
  const collisions: Collision[] = [];
  let pairsChecked = 0;

  for (let i = 0; i < dancers.length; i++) {
    for (let j = i + 1; j < dancers.length; j++) {
      const a = dancers[i];
      const b = dancers[j];
      const pairCollisions: Collision[] = [];
      let pairChecked = 0;

      for (const overlap of overlappingSegmentPairs(a, i, b, j)) {
        pairChecked += 1;
        const { minDistSq, tMin } = analyzeOverlap(a, b, overlap);
        const radiusSum = fr(a.radius + b.radius);
        if (fLte(minDistSq, fMul(radiusSum, radiusSum))) {
          const collision: Collision = {
            ...overlap,
            id: `${i}-${j}:${overlap.a.segmentIndex}-${overlap.b.segmentIndex}`,
            dancerA: i,
            dancerB: j,
            minDistSq,
            tMin,
            posA: positionAtSegment(a, overlap.a, tMin),
            posB: positionAtSegment(b, overlap.b, tMin),
            radiusSum: a.radius + b.radius,
          };
          pairCollisions.push(collision);
          collisions.push(collision);
        }
      }

      pairsChecked += pairChecked;
      reports.push({
        dancerA: i,
        dancerB: j,
        collisions: pairCollisions,
        pairsChecked: pairChecked,
      });
    }
  }

  return { reports, collisions, pairsChecked, version };
}

/** Distance check at one exact time; undefined if either dancer is idle. */
export function collideAt(
  a: Dancer,
  b: Dancer,
  t: Fraction,
): { distSq: Fraction; contact: boolean } | undefined {
  const pa = positionAt(a, t);
  const pb = positionAt(b, t);
  if (!pa || !pb) return undefined;
  const dx = fSub(pa.x, pb.x);
  const dy = fSub(pa.y, pb.y);
  const distSq = fAdd(fMul(dx, dx), fMul(dy, dy));
  const radiusSum = fr(a.radius + b.radius);
  return {
    distSq,
    contact: fLte(distSq, fMul(radiusSum, radiusSum)),
  };
}
