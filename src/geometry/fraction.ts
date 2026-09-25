/**
 * Exact rational arithmetic. Every Fraction is stored as a reduced
 * numerator/denominator pair with a strictly positive denominator, so
 * comparison, addition and multiplication never lose precision.
 *
 * BigInt is used throughout: waypoint coordinates, times and radii are
 * integers, and segment interpolation ratios are rational, therefore the
 * minimum squared relative distance and its time are exact rationals.
 */

export type Fraction = {
  readonly num: bigint;
  readonly den: bigint; // always > 0
};

function bigintAbs(x: bigint): bigint {
  return x < 0n ? -x : x;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = bigintAbs(a);
  let y = bigintAbs(b);
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
  return x === 0n ? 1n : x;
}

/** Build a fraction from integer numerator/denominator (bigint or number). */
export function fr(num: bigint | number, den: bigint | number = 1n): Fraction {
  let n = BigInt(num);
  let d = BigInt(den);
  if (d === 0n) throw new Error('fraction with zero denominator');
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  if (n === 0n) return { num: 0n, den: 1n };
  const g = gcd(n, d);
  return { num: n / g, den: d / g };
}

export const ZERO: Fraction = { num: 0n, den: 1n };
export const ONE: Fraction = { num: 1n, den: 1n };

export function fAdd(a: Fraction, b: Fraction): Fraction {
  return fr(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function fSub(a: Fraction, b: Fraction): Fraction {
  return fr(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function fMul(a: Fraction, b: Fraction): Fraction {
  return fr(a.num * b.num, a.den * b.den);
}

export function fDiv(a: Fraction, b: Fraction): Fraction {
  if (b.num === 0n) throw new Error('division by zero fraction');
  return fr(a.num * b.den, a.den * b.num);
}

export function fNeg(a: Fraction): Fraction {
  return { num: -a.num, den: a.den };
}

export function fAbs(a: Fraction): Fraction {
  return a.num < 0n ? { num: -a.num, den: a.den } : a;
}

export function fMin(a: Fraction, b: Fraction): Fraction {
  return fLt(a, b) ? a : b;
}

export function fMax(a: Fraction, b: Fraction): Fraction {
  return fGt(a, b) ? a : b;
}

export function fEq(a: Fraction, b: Fraction): boolean {
  return a.num * b.den === b.num * a.den;
}

export function fLt(a: Fraction, b: Fraction): boolean {
  return a.num * b.den < b.num * a.den;
}

export function fGt(a: Fraction, b: Fraction): boolean {
  return a.num * b.den > b.num * a.den;
}

export function fLte(a: Fraction, b: Fraction): boolean {
  return a.num * b.den <= b.num * a.den;
}

export function fGte(a: Fraction, b: Fraction): boolean {
  return a.num * b.den >= b.num * a.den;
}

export function fMin3(a: Fraction, b: Fraction, c: Fraction): Fraction {
  return fMin(fMin(a, b), c);
}

export function fMax3(a: Fraction, b: Fraction, c: Fraction): Fraction {
  return fMax(fMax(a, b), c);
}

/** floor(a/b) for bigints; denominator must be positive. */
export function floorDiv(num: bigint, den: bigint): bigint {
  const q = num / den;
  const r = num % den;
  if (r !== 0n && (num < 0n) !== (den < 0n)) return q - 1n;
  return q;
}

/** Greatest integer t with t <= x. */
export function fFloor(x: Fraction): bigint {
  return floorDiv(x.num, x.den);
}

/** Closest centisecond marker to x, rounded half up (123.456 -> 12346). */
export function fToCentiseconds(x: Fraction): number {
  const scaled = x.num * 100n;
  let q = scaled / x.den;
  const r = scaled % x.den;
  if (2n * r >= x.den) q += 1n;
  return Number(q);
}

export function fToNumber(x: Fraction): number {
  return Number(x.num) / Number(x.den);
}

/** "123 7/11" style rendering for exact times. */
export function fToString(x: Fraction): string {
  if (x.den === 1n) return x.num.toString();
  const whole = fFloor(x);
  if (whole === 0n) return `${x.num}/${x.den}`;
  const rem = x.num - whole * x.den;
  return `${whole} ${rem}/${x.den}`;
}

/** Signed fixed-point rendering, e.g. 3000/11 -> "272.73". */
export function fToFixed(x: Fraction, digits: number): string {
  const scale = 10n ** BigInt(digits);
  const scaled = x.num * scale;
  let q = scaled / x.den;
  const r = scaled % x.den;
  const ar = r < 0n ? -r : r;
  if (2n * ar >= x.den) q += x.num < 0n ? -1n : 1n;
  const neg = q < 0n;
  const digitsStr = (neg ? -q : q).toString().padStart(digits + 1, '0');
  const intPart = digitsStr.slice(0, digitsStr.length - digits);
  const fracPart = digitsStr.slice(-digits);
  return `${neg ? '-' : ''}${intPart}.${fracPart}`;
}
