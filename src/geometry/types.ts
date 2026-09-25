/** Domain types for stage trajectory collision checking. */

import type { Fraction } from './fraction';

export interface Waypoint {
  /** Integer time tick, strictly increasing within a dancer. */
  t: number;
  /** Integer stage coordinates, |x|, |y| <= 100. */
  x: number;
  y: number;
}

export interface Dancer {
  id: string;
  name: string;
  color: string;
  /** Non-negative integer safety radius. */
  radius: number;
  /** 2..25 waypoints with strictly increasing integer times in [0, 600]. */
  waypoints: Waypoint[];
}

export interface Choreography {
  dancers: Dancer[];
}

/** Indexes a straight motion segment: waypoints[k] -> waypoints[k + 1]. */
export interface SegmentRef {
  dancerIndex: number;
  segmentIndex: number;
}

export interface SegmentOverlap {
  a: SegmentRef;
  b: SegmentRef;
  /** Overlap of the two segments' closed time intervals [start, end]. */
  start: Fraction;
  end: Fraction;
}

export interface Collision extends SegmentOverlap {
  /** Unique id for UI keying / selection. */
  id: string;
  dancerA: number;
  dancerB: number;
  /** Minimum squared relative distance over the overlap (exact fraction). */
  minDistSq: Fraction;
  /** Global time at which the minimum is attained. */
  tMin: Fraction;
  /** Positions of A and B at tMin (exact fractions). */
  posA: PointFrac;
  posB: PointFrac;
  /** Sum of the two safety radii (integer). */
  radiusSum: number;
}

export interface PointFrac {
  x: Fraction;
  y: Fraction;
}

export interface PairReport {
  dancerA: number;
  dancerB: number;
  collisions: Collision[];
  /** Number of overlapping segment pairs examined for this dancer pair. */
  pairsChecked: number;
}

export interface AnalysisResult {
  reports: PairReport[];
  collisions: Collision[];
  pairsChecked: number;
  version: number;
}
