'use strict';

const {
  calculateInterestOverlap,
  calculateDistanceScore,
  calculateAgeScore,
  calculateActivityBonus,
  calculateEngagementBonus,
  computeCompatibilityScore,
  applyDiversityFilter,
  MINIMUM_MATCH_THRESHOLD,
  haversineKm,
} = require('../../agent-04/matching-algorithm');

describe('Interest Overlap (Jaccard)', () => {
  test('perfect overlap = 1.0', () => expect(calculateInterestOverlap(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1.0));
  test('no overlap = 0.0', () => expect(calculateInterestOverlap(['a'], ['b'])).toBe(0.0));
  test('50% overlap', () => expect(calculateInterestOverlap(['sports', 'cooking', 'travel'], ['sports', 'music', 'travel'])).toBe(0.5));
  test('both empty = 0.5 neutral', () => expect(calculateInterestOverlap([], [])).toBe(0.5));
  test('one empty = 0', () => expect(calculateInterestOverlap(['a'], [])).toBe(0));
  test('null both = 0.5', () => expect(calculateInterestOverlap(null, null)).toBe(0.5));
  test('case insensitive', () => expect(calculateInterestOverlap(['SPORTS'], ['sports'])).toBe(1.0));
  test('single item overlap', () => expect(calculateInterestOverlap(['a'], ['a', 'b'])).toBeCloseTo(0.5));
  test('large arrays', () => {
    const a = Array.from({ length: 20 }, (_, i) => `item${i}`);
    const b = Array.from({ length: 20 }, (_, i) => `item${i + 10}`);
    const result = calculateInterestOverlap(a, b);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });
});

describe('Haversine Distance', () => {
  test('same point = 0', () => {
    const loc = { latitude: 40.7128, longitude: -74.006 };
    expect(haversineKm(loc, loc)).toBe(0);
  });
  test('NYC to Brooklyn ~7km', () => {
    const nyc = { latitude: 40.7128, longitude: -74.006 };
    const brooklyn = { latitude: 40.6782, longitude: -73.9442 };
    const dist = haversineKm(nyc, brooklyn);
    expect(dist).toBeGreaterThan(5);
    expect(dist).toBeLessThan(12);
  });
  test('distance is symmetric', () => {
    const a = { latitude: 40, longitude: -74 };
    const b = { latitude: 41, longitude: -73 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 3);
  });
});

describe('Distance Score', () => {
  const nyc = { latitude: 40.7128, longitude: -74.006 };
  test('same location = 1.0', () => expect(calculateDistanceScore(nyc, nyc, 15)).toBe(1.0));
  test('null location = 0.5 neutral', () => {
    expect(calculateDistanceScore(null, nyc)).toBe(0.5);
    expect(calculateDistanceScore(nyc, null)).toBe(0.5);
  });
  test('beyond max distance = 0', () => {
    const london = { latitude: 51.5, longitude: -0.1 };
    expect(calculateDistanceScore(nyc, london, 15)).toBe(0);
  });
  test('score decreases as distance increases', () => {
    const near = { latitude: 40.72, longitude: -74.01 };
    const far = { latitude: 40.60, longitude: -73.90 };
    expect(calculateDistanceScore(nyc, near, 50)).toBeGreaterThan(calculateDistanceScore(nyc, far, 50));
  });
});

describe('Age Score', () => {
  test('same age = 1.0', () => expect(calculateAgeScore(28, 28, 10)).toBe(1.0));
  test('null age = 0.5 neutral', () => {
    expect(calculateAgeScore(null, 28)).toBe(0.5);
    expect(calculateAgeScore(28, null)).toBe(0.5);
  });
  test('beyond max difference = 0', () => expect(calculateAgeScore(20, 35, 10)).toBe(0));
  test('1-year diff has high score', () => expect(calculateAgeScore(28, 29, 10)).toBeGreaterThan(0.9));
  test('score is between 0 and 1', () => {
    const score = calculateAgeScore(25, 30, 10);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('Activity Bonus', () => {
  test('no shared = 0', () => expect(calculateActivityBonus(['a'], ['b'])).toBe(0));
  test('empty arrays = 0', () => expect(calculateActivityBonus([], [])).toBe(0));
  test('capped at 0.15', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `a${i}`);
    expect(calculateActivityBonus(ids, ids)).toBeLessThanOrEqual(0.15);
  });
  test('single shared activity = 0.05', () => expect(calculateActivityBonus(['x'], ['x', 'y'])).toBe(0.05));
});

describe('Engagement Bonus', () => {
  test('both inactive = 0', () => expect(calculateEngagementBonus(0, 0)).toBe(0));
  test('capped at 0.10', () => expect(calculateEngagementBonus(100, 100)).toBeLessThanOrEqual(0.10));
  test('mutual high activity > single active', () => {
    const both = calculateEngagementBonus(30, 30);
    const one = calculateEngagementBonus(30, 0);
    expect(both).toBeGreaterThan(one);
  });
});

describe('Full Compatibility Score', () => {
  const perfect = { interests: ['a', 'b'], location: { latitude: 40.7, longitude: -74 }, age: 28, logins_30d: 30 };
  test('identical profiles score high', () => {
    const { score } = computeCompatibilityScore(perfect, perfect, { maxDistanceKm: 50, maxAgeDifference: 10 });
    expect(score).toBeGreaterThan(0.8);
  });
  test('incompatible profiles score below threshold', () => {
    const bad = { interests: ['z'], location: { latitude: 51.5, longitude: 0 }, age: 60, logins_30d: 0 };
    const { score } = computeCompatibilityScore(perfect, bad, { maxDistanceKm: 15, maxAgeDifference: 5 });
    expect(score).toBeLessThan(MINIMUM_MATCH_THRESHOLD);
  });
  test('score always between 0 and 1', () => {
    const user2 = { interests: ['a'], location: { latitude: 40.72, longitude: -74 }, age: 30, logins_30d: 5 };
    const { score } = computeCompatibilityScore(perfect, user2);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
  test('breakdown fields present', () => {
    const { breakdown } = computeCompatibilityScore(perfect, { ...perfect, age: 30 });
    expect(breakdown).toHaveProperty('interest_overlap');
    expect(breakdown).toHaveProperty('distance_score');
    expect(breakdown).toHaveProperty('age_score');
    expect(breakdown).toHaveProperty('activity_bonus');
    expect(breakdown).toHaveProperty('engagement_bonus');
  });
});

describe('Diversity Filter', () => {
  test('allows max 2 per top interest', () => {
    const input = [
      { interests: ['sports'], compatibility_score: 0.9 },
      { interests: ['sports'], compatibility_score: 0.85 },
      { interests: ['sports'], compatibility_score: 0.80 },
    ];
    const result = applyDiversityFilter(input);
    expect(result.filter(r => r.interests[0] === 'sports')).toHaveLength(2);
  });
  test('preserves order within group', () => {
    const input = [
      { interests: ['x'], compatibility_score: 0.9 },
      { interests: ['y'], compatibility_score: 0.8 },
    ];
    expect(applyDiversityFilter(input)).toHaveLength(2);
  });
});

describe('MINIMUM_MATCH_THRESHOLD', () => {
  test('is 0.25', () => expect(MINIMUM_MATCH_THRESHOLD).toBe(0.25));
});
