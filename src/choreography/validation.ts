import type { Choreography, Dancer } from '../geometry/types';

export interface ValidationIssue {
  dancerIndex?: number;
  waypointIndex?: number;
  message: string;
}

const MIN_DANCERS = 2;
const MAX_DANCERS = 8;
const MIN_WAYPOINTS = 2;
const MAX_WAYPOINTS = 25;
const MIN_TIME = 0;
const MAX_TIME = 600;
const MAX_COORD = 100;

export const LIMITS = {
  MIN_DANCERS,
  MAX_DANCERS,
  MIN_WAYPOINTS,
  MAX_WAYPOINTS,
  MIN_TIME,
  MAX_TIME,
  MAX_COORD,
};

function isSafeInteger32(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

/** Validate every constraint from the choreography specification. */
export function validateChoreography(c: Choreography): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!Array.isArray(c.dancers)) {
    issues.push({ message: '编排数据缺少舞者列表' });
    return issues;
  }

  if (c.dancers.length < MIN_DANCERS || c.dancers.length > MAX_DANCERS) {
    issues.push({
      message: `舞者人数必须在 ${MIN_DANCERS} 至 ${MAX_DANCERS} 之间（当前 ${c.dancers.length}）`,
    });
  }

  c.dancers.forEach((dancer, di) => {
    validateDancer(dancer, di, issues);
  });

  return issues;
}

function validateDancer(
  dancer: Dancer,
  di: number,
  issues: ValidationIssue[],
): void {
  const label = `舞者 ${di + 1}`;

  if (!dancer.name?.trim()) {
    issues.push({ dancerIndex: di, message: `${label}：名称不能为空` });
  }

  if (!isSafeInteger32(dancer.radius) || dancer.radius < 0) {
    issues.push({
      dancerIndex: di,
      message: `${label}：安全半径必须是非负整数`,
    });
  }

  const wps = dancer.waypoints;
  if (!Array.isArray(wps) || wps.length < MIN_WAYPOINTS || wps.length > MAX_WAYPOINTS) {
    const count = Array.isArray(wps) ? wps.length : 0;
    issues.push({
      dancerIndex: di,
      message: `${label}：路点数必须在 ${MIN_WAYPOINTS} 至 ${MAX_WAYPOINTS} 之间（当前 ${count}）`,
    });
    return;
  }

  let prevT: number | null = null;
  wps.forEach((wp, wi) => {
    const where = `${label} 路点 ${wi + 1}`;
    if (!isSafeInteger32(wp.t) || wp.t < MIN_TIME || wp.t > MAX_TIME) {
      issues.push({
        dancerIndex: di,
        waypointIndex: wi,
        message: `${where}：时间必须是 ${MIN_TIME} 至 ${MAX_TIME} 的整数`,
      });
    } else if (prevT !== null && wp.t <= prevT) {
      issues.push({
        dancerIndex: di,
        waypointIndex: wi,
        message: `${where}：时间必须严格递增（上一点 t=${prevT}）`,
      });
    }
    prevT = isSafeInteger32(wp.t) ? wp.t : prevT;

    if (!isSafeInteger32(wp.x) || Math.abs(wp.x) > MAX_COORD) {
      issues.push({
        dancerIndex: di,
        waypointIndex: wi,
        message: `${where}：x 坐标必须是绝对值不超过 ${MAX_COORD} 的整数`,
      });
    }
    if (!isSafeInteger32(wp.y) || Math.abs(wp.y) > MAX_COORD) {
      issues.push({
        dancerIndex: di,
        waypointIndex: wi,
        message: `${where}：y 坐标必须是绝对值不超过 ${MAX_COORD} 的整数`,
      });
    }
  });
}

export function isValidChoreography(c: Choreography): boolean {
  return validateChoreography(c).length === 0;
}
