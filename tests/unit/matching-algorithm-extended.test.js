'use strict';

/**
 * Unit tests for the matching algorithm.
 * Run with: npm test agent-04/algorithm-tests.js
 * Requires Jest.
 */

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
} = require('./matching-algorithm');

describe('calculateInterestOverlap (Jaccard similarity)', () => {
  test('full overlap returns 1.0', () => {
    expect(calculateInterestOverlap(['a', 'b'], ['a', 'b'])).toBe(1.0);
  });
  test('no overlap returns 0.0', () => {
    expect(calculateInterestOverlap(['a', 'b'], ['c', 'd'])).toBe(0.0);
  });
  test('partial overlap returns correct fraction', () => {
    // [sports, travel] / [sports, cooking, travel, music] = 2/4 = 0.5
    expect(calculateInterestOverlap(['sports', 'cooking', 'travel'], ['sports', 'music', 'travel'])).toBe(0.5);
  });
  test('one empty array returns 0', () => {
    expect(calculateInterestOverlap(['a'], [])).toBe(0);
  });
  test('both empty returns 0.5 (neutral)', () => {
    expect(calculateInterestOverlap([], [])).toBe(0.5);
  });
  test('case insensitive', () => {
    expect(calculateInterestOverlap(['Sports'], ['sports'])).toBe(1.0);
  });
  test('null inputs return 0.5', () => {
    expect(calculateInterestOverlap(null, null)).toBe(0.5);
  });
  test('single shared interest', () => {
    expect(calculateInterestOverlap(['a'], ['a', 'b'])).toBeCloseTo(0.5);
  });
});

describe('haversineKm', () => {
  test('same location returns 0', () => {
    const loc = { latitude: 40.7128, longitude: -74.0060 };
    expect(haversineKm(loc, loc)).toBe(0);
  });
  test('NYC to Brooklyn is approximately 7km', () => {
    const nyc = { latitude: 40.7128, longitude: -74.0060 };
    const brooklyn = { latitude: 40.6782, longitude: -73.9442 };
    expect(haversineKm(nyc, brooklyn)).toBeGreaterThan(5);
    expect(haversineKm(nyc, brooklyn)).toBeLessThan(12);
  });
  test('NYC to London is approximately 5500km', () => {
    const nyc = { latitude: 40.7128, longitude: -74.0060 };
    const london = { latitude: 51.5074, longitude: -0.1278 };
    expect(haversineKm(nyc, london)).toBeGreaterThan(5000);
    expect(haversineKm(nyc, london)).toBeLessThan(6000);
  });
});

describe('calculateDistanceScore', () => {
  const loc1 = { latitude: 40.7128, longitude: -74.0060 }; // NYC

  test('same location returns 1.0', () => {
    expect(calculateDistanceScore(loc1, loc1, 15)).toBe(1.0);
  });
  test('beyond max distance returns 0', () => {
    const farLoc = { latitude: 51.5074, longitude: -0.1278 }; // London
    expect(calculateDistanceScore(loc1, farLoc, 15)).toBe(0);
  });
  test('no location returns 0.5 (neutral)', () => {
    expect(calculateDistanceScore(null, loc1, 15)).toBe(0.5);
    expect(calculateDistanceScore(loc1, null, 15)).toBe(0.5);
  });
  test('score decreases with distance', () => {
    const near = { latitude: 40.72, longitude: -74.01 };
    const far = { latitude: 40.60, longitude: -73.90 };
    const nearScore = calculateDistanceScore(loc1, near, 50);
    const farScore = calculateDistanceScore(loc1, far, 50);
    expect(nearScore).toBeGreaterThan(farScore);
  });
});

describe('calculateAgeScore', () => {
  test('same age returns 1.0', () => {
    expect(calculateAgeScore(28, 28, 10)).toBe(1.0);
  });
  test('null ages return 0.5 (neutral)', () => {
    expect(calculateAgeScore(null, 28, 10)).toBe(0.5);
    expect(calculateAgeScore(28, null, 10)).toBe(0.5);
  });
  test('beyond max difference returns 0', () => {
    expect(calculateAgeScore(20, 35, 10)).toBe(0);
  });
  test('5 year difference within 10 year range', () => {
    const score = calculateAgeScore(25, 30, 10);
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThan(1.0);
  });
  test('small difference has high score', () => {
    expect(calculateAgeScore(28, 29, 10)).toBeGreaterThan(0.9);
  });
});

describe('calculateActivityBonus', () => {
  test('no shared activities returns 0', () => {
    expect(calculateActivityBonus(['a', 'b'], ['c', 'd'])).toBe(0);
  });
  test('shared activities return bonus', () => {
    expect(calculateActivityBonus(['sports', 'cooking'], ['sports', 'cooking'])).toBeGreaterThan(0);
  });
  test('capped at 0.15', () => {
    const many = Array.from({ length: 20 }, (_, i) => `activity_${i}`);
    expect(calculateActivityBonus(many, many)).toBeLessThanOrEqual(0.15);
  });
  test('empty arrays return 0', () => {
    expect(calculateActivityBonus([], ['a'])).toBe(0);
  });
});

describe('calculateEngagementBonus', () => {
  test('no logins returns 0', () => {
    expect(calculateEngagementBonus(0, 0)).toBe(0);
  });
  test('both highly active returns max bonus', () => {
    const bonus = calculateEngagementBonus(30, 30);
    expect(bonus).toBeGreaterThan(0.05);
  });
  test('capped at 0.10', () => {
    expect(calculateEngagementBonus(100, 100)).toBeLessThanOrEqual(0.10);
  });
});

describe('computeCompatibilityScore', () => {
  const user1 = {
    interests: ['sports', 'cooking', 'travel'],
    location: { latitude: 40.7128, longitude: -74.0060 },
    age: 28,
    logins_30d: 20,
  };

  test('identical users score near 1.0', () => {
    const { score } = computeCompatibilityScore(user1, { ...user1, age: 29 }, { maxDistanceKm: 50, maxAgeDifference: 10 });
    expect(score).toBeGreaterThan(0.8);
  });

  test('incompatible users score below threshold', () => {
    const user2 = {
      interests: ['gaming', 'reading'],
      location: { latitude: 51.5, longitude: 0 }, // London
      age: 50,
      logins_30d: 1,
    };
    const { score } = computeCompatibilityScore(user1, user2, { maxDistanceKm: 15, maxAgeDifference: 5 });
    expect(score).toBeLessThan(MINIMUM_MATCH_THRESHOLD);
  });

  test('returns score between 0 and 1', () => {
    const user2 = { interests: ['sports'], location: { latitude: 40.72, longitude: -74.0 }, age: 30, logins_30d: 5 };
    const { score } = computeCompatibilityScore(user1, user2);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  test('breakdown sums to approximate score', () => {
    const user2 = { interests: ['sports', 'travel'], location: { latitude: 40.72, longitude: -74.0 }, age: 30, logins_30d: 15 };
    const { score, breakdown } = computeCompatibilityScore(user1, user2, { maxDistanceKm: 50, maxAgeDifference: 10 });
    const approx = breakdown.interest_overlap * 0.5 + breakdown.distance_score * 0.3 + breakdown.age_score * 0.2;
    expect(Math.abs(score - (approx + breakdown.activity_bonus + breakdown.engagement_bonus))).toBeLessThan(0.01);
  });
});

describe('applyDiversityFilter', () => {
  test('limits same-top-interest suggestions to 2', () => {
    const suggestions = [
      { interests: ['sports'], compatibility_score: 0.9 },
      { interests: ['sports'], compatibility_score: 0.85 },
      { interests: ['sports'], compatibility_score: 0.80 },
      { interests: ['cooking'], compatibility_score: 0.75 },
    ];
    const filtered = applyDiversityFilter(suggestions);
    const sportsCount = filtered.filter(s => s.interests[0] === 'sports').length;
    expect(sportsCount).toBeLessThanOrEqual(2);
    expect(filtered.length).toBe(3);
  });
});

describe('MINIMUM_MATCH_THRESHOLD', () => {
  test('threshold is 0.25', () => {
    expect(MINIMUM_MATCH_THRESHOLD).toBe(0.25);
  });
});
