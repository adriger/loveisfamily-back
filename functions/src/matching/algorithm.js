'use strict';

/**
 * Core compatibility scoring algorithm.
 * Weights: Interest overlap 50%, Distance proximity 30%, Age compatibility 20%.
 * Bonuses: Activity overlap +0-15%, Engagement +0-10%.
 */

const DEFAULT_MAX_DISTANCE_KM = 15;

/**
 * Calculates the Jaccard similarity between two interest arrays.
 * Score = |A ∩ B| / |A ∪ B|
 * @param {string[]} interests1
 * @param {string[]} interests2
 * @returns {number} 0.0 - 1.0
 */
function calculateInterestOverlap(interests1, interests2) {
  if (!interests1?.length && !interests2?.length) return 0.5; // Both empty — neutral
  if (!interests1?.length || !interests2?.length) return 0;

  const set1 = new Set(interests1.map(i => i.toLowerCase().trim()));
  const set2 = new Set(interests2.map(i => i.toLowerCase().trim()));

  const intersection = [...set1].filter(i => set2.has(i)).length;
  const union = new Set([...set1, ...set2]).size;

  return union === 0 ? 0 : intersection / union;
}

/**
 * Calculates the Haversine distance between two geo-points.
 * @param {{ latitude: number, longitude: number }} loc1
 * @param {{ latitude: number, longitude: number }} loc2
 * @returns {number} Distance in kilometers
 */
function haversineKm(loc1, loc2) {
  const R = 6371;
  const dLat = toRad(loc2.latitude - loc1.latitude);
  const dLon = toRad(loc2.longitude - loc1.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(loc1.latitude)) *
    Math.cos(toRad(loc2.latitude)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(degrees) { return degrees * (Math.PI / 180); }

/**
 * Calculates distance-based compatibility score.
 * Score = 1 - (distance / maxDistance), clamped to [0, 1].
 * Returns 0.5 if either user has no location.
 * @param {{ latitude: number, longitude: number } | null} loc1
 * @param {{ latitude: number, longitude: number } | null} loc2
 * @param {number} maxDistanceKm
 * @returns {number} 0.0 - 1.0
 */
function calculateDistanceScore(loc1, loc2, maxDistanceKm = DEFAULT_MAX_DISTANCE_KM) {
  if (!loc1 || !loc2) return 0.5; // Unknown location — neutral score

  const distance = haversineKm(loc1, loc2);
  if (distance > maxDistanceKm) return 0; // Outside radius — filtered out

  return Math.max(0, 1 - distance / maxDistanceKm);
}

/**
 * Calculates age compatibility score.
 * Score = 1 - (|age1 - age2| / 20), clamped to [0, 1].
 * Returns 0.5 if either user has no age set.
 * @param {number | null} age1
 * @param {number | null} age2
 * @param {number} maxAgeDifference
 * @returns {number} 0.0 - 1.0
 */
function calculateAgeScore(age1, age2, maxAgeDifference = 10) {
  if (!age1 || !age2) return 0.5; // Unknown age — neutral score

  const diff = Math.abs(age1 - age2);
  if (diff > maxAgeDifference) return 0; // Outside acceptable range

  return Math.max(0, 1 - diff / 20);
}

/**
 * Calculates activity-based bonus score.
 * +0.05 per shared activity participation, +0.03 per shared activity type.
 * Capped at 0.15.
 * @param {string[]} activities1 - Post tags / activity IDs for user1
 * @param {string[]} activities2
 * @returns {number} 0.0 - 0.15
 */
function calculateActivityBonus(activities1, activities2) {
  if (!activities1?.length || !activities2?.length) return 0;

  const set1 = new Set(activities1);
  const set2 = new Set(activities2);
  const sharedCount = [...set1].filter(a => set2.has(a)).length;

  return Math.min(0.15, sharedCount * 0.05);
}

/**
 * Calculates engagement signal bonus.
 * Active users get matched with active users.
 * @param {number} logins1 - Login count in last 30 days
 * @param {number} logins2
 * @returns {number} 0.0 - 0.10
 */
function calculateEngagementBonus(logins1 = 0, logins2 = 0) {
  const engagement1 = Math.min(1, logins1 / 30);
  const engagement2 = Math.min(1, logins2 / 30);
  const base = (engagement1 * engagement2) * 0.05;
  const mutualBonus = engagement1 > 0.7 && engagement2 > 0.7 ? 0.05 : 0;
  return Math.min(0.10, base + mutualBonus);
}

/**
 * Computes the final compatibility score between two users.
 * @param {object} user1 - { interests, location, age, logins_30d, subscription_type }
 * @param {object} user2
 * @param {object} options - { maxDistanceKm, maxAgeDifference, subscriptionBoost }
 * @returns {{ score: number, breakdown: object }}
 */
function computeCompatibilityScore(user1, user2, options = {}) {
  const {
    maxDistanceKm = DEFAULT_MAX_DISTANCE_KM,
    maxAgeDifference = 10,
    subscriptionBoost = 0,
  } = options;

  const interestScore = calculateInterestOverlap(user1.interests, user2.interests);
  const distanceScore = calculateDistanceScore(user1.location, user2.location, maxDistanceKm);
  const ageScore = calculateAgeScore(user1.age, user2.age, maxAgeDifference);
  const activityBonus = calculateActivityBonus(user1.activity_ids, user2.activity_ids);
  const engagementBonus = calculateEngagementBonus(user1.logins_30d, user2.logins_30d);

  const rawScore = (interestScore * 0.50) +
    (distanceScore * 0.30) +
    (ageScore * 0.20) +
    activityBonus +
    engagementBonus +
    subscriptionBoost;

  const finalScore = Math.min(1.0, Math.max(0, rawScore));

  return {
    score: Math.round(finalScore * 1000) / 1000,
    breakdown: {
      interest_overlap: Math.round(interestScore * 100) / 100,
      distance_score: Math.round(distanceScore * 100) / 100,
      age_score: Math.round(ageScore * 100) / 100,
      activity_bonus: activityBonus,
      engagement_bonus: engagementBonus,
      subscription_boost: subscriptionBoost,
    },
  };
}

/**
 * Minimum score threshold — candidates below this are filtered out.
 */
const MINIMUM_MATCH_THRESHOLD = 0.25;

/**
 * Applies diversity filter — no more than 2 users with same top interest.
 * @param {Array} suggestions - Scored suggestion objects
 * @returns {Array} Filtered suggestions
 */
function applyDiversityFilter(suggestions) {
  const interestCount = {};
  return suggestions.filter(s => {
    const topInterest = s.interests?.[0] || 'none';
    const count = interestCount[topInterest] || 0;
    if (count >= 2) return false;
    interestCount[topInterest] = count + 1;
    return true;
  });
}

module.exports = {
  calculateInterestOverlap,
  haversineKm,
  calculateDistanceScore,
  calculateAgeScore,
  calculateActivityBonus,
  calculateEngagementBonus,
  computeCompatibilityScore,
  applyDiversityFilter,
  MINIMUM_MATCH_THRESHOLD,
};
