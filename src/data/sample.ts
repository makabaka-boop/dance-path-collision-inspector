import type { Choreography } from '../geometry/types';

/**
 * Three-dancer demo over the empty warehouse floor.
 *
 * - A (red)  and B (blue)  meet head-on exactly at the origin at t = 4.
 * - C (green) grazes A fractionally: closest at t = 16/3 with d^2 = 16.
 *   The witness deliberately falls between integer frames, which a
 *   per-frame screenshot strategy would miss.
 */
export const sampleChoreography: Choreography = {
  dancers: [
    {
      id: 'a',
      name: 'A',
      color: '#e5484d',
      radius: 2,
      waypoints: [
        { t: 0, x: -20, y: 0 },
        { t: 8, x: 20, y: 0 },
        { t: 16, x: 20, y: 0 },
      ],
    },
    {
      id: 'b',
      name: 'B',
      color: '#3e63dd',
      radius: 2,
      waypoints: [
        { t: 0, x: 0, y: 20 },
        { t: 8, x: 0, y: -20 },
        { t: 16, x: 0, y: -20 },
      ],
    },
    {
      id: 'c',
      name: 'C',
      color: '#2e9e5b',
      radius: 3,
      waypoints: [
        { t: 0, x: -4, y: 4 },
        { t: 8, x: 12, y: 4 },
        { t: 16, x: 12, y: -16 },
      ],
    },
  ],
};
