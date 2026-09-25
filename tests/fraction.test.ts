import { describe, expect, it } from 'vitest';
import {
  fAdd,
  fDiv,
  fEq,
  fFloor,
  fGt,
  fLt,
  fMul,
  fNeg,
  fSub,
  fToCentiseconds,
  fToFixed,
  fToString,
  fr,
} from '../src/geometry/fraction';

describe('Fraction 精确有理数运算', () => {
  it('构造时约分并归一化分母符号', () => {
    expect(fr(6, 4)).toEqual({ num: 3n, den: 2n });
    expect(fr(-6, 4)).toEqual({ num: -3n, den: 2n });
    expect(fr(6, -4)).toEqual({ num: -3n, den: 2n });
    expect(fr(-6, -4)).toEqual({ num: 3n, den: 2n });
    expect(fr(0, 7)).toEqual({ num: 0n, den: 1n });
  });

  it('零分母报错', () => {
    expect(() => fr(1, 0)).toThrow();
  });

  it('加减乘除', () => {
    const a = fr(1, 3);
    const b = fr(1, 6);
    expect(fAdd(a, b)).toEqual(fr(1, 2));
    expect(fSub(a, b)).toEqual(fr(1, 6));
    expect(fMul(a, b)).toEqual(fr(1, 18));
    expect(fDiv(a, b)).toEqual(fr(2, 1));
    expect(fNeg(a)).toEqual(fr(-1, 3));
  });

  it('比较：浮点不可分辨的有理数可精确分辨', () => {
    // 这些值在 double 中都会退化为 0.1，BigInt 分数比较仍然精确。
    const x = fr(3n * 10n ** 20n + 1n, 10n ** 21n); // 0.3000...1
    const y = fr(3, 10); // 0.3
    expect(fLt(y, x)).toBe(true);
    expect(fGt(x, y)).toBe(true);
    expect(fEq(x, x)).toBe(true);
    expect(fEq(fr(2, 4), fr(3, 6))).toBe(true);
  });

  it('fFloor 对负数向负无穷取整', () => {
    expect(fFloor(fr(16, 3))).toBe(5n);
    expect(fFloor(fr(-16, 3))).toBe(-6n);
    expect(fFloor(fr(-6, 3))).toBe(-2n);
  });

  it('fToCentiseconds 四舍五入', () => {
    expect(fToCentiseconds(fr(16, 3))).toBe(533); // 5.333...
    expect(fToCentiseconds(fr(0))).toBe(0);
    expect(fToCentiseconds(fr(600))).toBe(60000);
  });

  it('fToString 带分数形式', () => {
    expect(fToString(fr(16, 3))).toBe('5 1/3');
    expect(fToString(fr(4))).toBe('4');
    expect(fToString(fr(-7, 3))).toBe('-3 2/3');
  });

  it('fToFixed 十进制舍入', () => {
    expect(fToFixed(fr(3000, 11), 2)).toBe('272.73');
    expect(fToFixed(fr(-1, 3), 4)).toBe('-0.3333');
    expect(fToFixed(fr(16), 2)).toBe('16.00');
  });
});
