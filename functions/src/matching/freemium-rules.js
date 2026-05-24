'use strict';

const { SUBSCRIPTION_TIERS, TIER_LIMITS } = require('../shared/constants');

/**
 * Returns matching configuration constraints for a given subscription tier.
 * @param {string} tier
 * @returns {object}
 */
function getTierMatchingConfig(tier) {
  const limits = TIER_LIMITS[tier] || TIER_LIMITS[SUBSCRIPTION_TIERS.FREE];
  return {
    suggestions_per_day: limits.matches_per_day,
    radius_km: limits.radius_km,
    age_range: limits.age_range,
    priority_boost: limits.priority_boost,
    refresh_interval_hours: tier === SUBSCRIPTION_TIERS.VIP ? 2 :
                            tier === SUBSCRIPTION_TIERS.PREMIUM ? 6 : 24,
    can_see_premium: tier !== SUBSCRIPTION_TIERS.FREE,
    can_see_vip: tier === SUBSCRIPTION_TIERS.VIP,
    personalized_ranking: tier !== SUBSCRIPTION_TIERS.FREE,
  };
}

/**
 * Applies tier visibility rules to a candidate pool.
 * Free users only see other free users.
 * Premium users see free + premium.
 * VIP users see all tiers.
 * @param {Array} candidates
 * @param {string} requestingTier
 * @returns {Array}
 */
function applyVisibilityRules(candidates, requestingTier) {
  if (requestingTier === SUBSCRIPTION_TIERS.VIP) return candidates;

  if (requestingTier === SUBSCRIPTION_TIERS.PREMIUM) {
    return candidates.filter(c => c.subscription_type !== SUBSCRIPTION_TIERS.VIP);
  }

  // Free tier: only see other free users
  return candidates.filter(c => c.subscription_type === SUBSCRIPTION_TIERS.FREE);
}

/**
 * Applies radius and age range filters based on tier.
 * @param {object} user
 * @param {Array} candidates
 * @param {string} tier
 * @returns {Array}
 */
function applyTierFilters(user, candidates, tier) {
  const config = getTierMatchingConfig(tier);
  const { haversineKm } = require('./matching-algorithm');

  return candidates.filter(candidate => {
    // Age range filter
    if (user.age && candidate.age) {
      if (Math.abs(user.age - candidate.age) > config.age_range) return false;
    }

    // Distance filter
    if (user.location && candidate.location) {
      const dist = haversineKm(user.location, candidate.location);
      if (dist > config.radius_km) return false;
    }

    return true;
  });
}

/**
 * Checks whether a user has reached their daily suggestion limit.
 * @param {number} suggestionsSeenToday
 * @param {string} tier
 * @returns {{ allowed: boolean, remaining: number }}
 */
function checkDailySuggestionLimit(suggestionsSeenToday, tier) {
  const config = getTierMatchingConfig(tier);
  const limit = config.suggestions_per_day;

  if (limit === Infinity) return { allowed: true, remaining: Infinity };
  return {
    allowed: suggestionsSeenToday < limit,
    remaining: Math.max(0, limit - suggestionsSeenToday),
  };
}

/**
 * Applies subscription boost to suggestion scores for premium visibility.
 * VIP users get a +0.10 boost in other users' rankings.
 * @param {Array} suggestions - scored suggestions
 * @param {string} viewerTier - tier of user viewing suggestions
 * @returns {Array}
 */
function applySubscriptionBoost(suggestions, viewerTier) {
  return suggestions.map(s => {
    const candidateTier = s.subscription_type;
    const boost = TIER_LIMITS[candidateTier]?.priority_boost || 0;
    return {
      ...s,
      compatibility_score: Math.min(1.0, s.compatibility_score + boost),
    };
  }).sort((a, b) => b.compatibility_score - a.compatibility_score);
}

module.exports = {
  getTierMatchingConfig,
  applyVisibilityRules,
  applyTierFilters,
  checkDailySuggestionLimit,
  applySubscriptionBoost,
};
