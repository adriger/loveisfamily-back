'use strict';

const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PREMIUM: 'premium',
  VIP: 'vip',
};

const TIER_LIMITS = {
  [SUBSCRIPTION_TIERS.FREE]: {
    matches_per_day: 10,
    teams_per_month: 0,
    posts_per_day: 10,
    messages_per_hour: 100,
    storage_mb: 5,
    radius_km: 15,
    age_range: 5,
    ads_enabled: true,
    priority_boost: 0,
    price_monthly: 0,
  },
  [SUBSCRIPTION_TIERS.PREMIUM]: {
    matches_per_day: 100,
    teams_per_month: 3,
    posts_per_day: 50,
    messages_per_hour: 500,
    storage_mb: 100,
    radius_km: 50,
    age_range: 10,
    ads_enabled: false,
    priority_boost: 0.05,
    price_monthly: 9.99,
  },
  [SUBSCRIPTION_TIERS.VIP]: {
    matches_per_day: Infinity,
    teams_per_month: Infinity,
    posts_per_day: Infinity,
    messages_per_hour: Infinity,
    storage_mb: 1024,
    radius_km: 100,
    age_range: 15,
    ads_enabled: false,
    priority_boost: 0.10,
    price_monthly: 24.99,
  },
};

const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_INPUT: 'INVALID_INPUT',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
};

const ERROR_MESSAGES = {
  [ERROR_CODES.UNAUTHORIZED]: 'Authentication required',
  [ERROR_CODES.NOT_FOUND]: 'Resource not found',
  [ERROR_CODES.ALREADY_EXISTS]: 'Resource already exists',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded for your subscription tier',
  [ERROR_CODES.INVALID_INPUT]: 'Invalid input parameters',
  [ERROR_CODES.PERMISSION_DENIED]: 'Insufficient permissions',
  [ERROR_CODES.INTERNAL_ERROR]: 'Internal server error',
  [ERROR_CODES.SUBSCRIPTION_REQUIRED]: 'This feature requires a higher subscription tier',
  [ERROR_CODES.TRANSACTION_FAILED]: 'Transaction failed, please retry',
};

const MATCH_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  MUTUAL_MATCH: 'mutual_match',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
};

const MATCH_TYPES = {
  INSTANT: 'instant',
  ALGORITHM: 'algorithm',
};

const POST_VISIBILITY = {
  PUBLIC: 'public',
  FOLLOWERS: 'followers',
  PRIVATE: 'private',
};

const TEAM_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
};

const ACTIVITY_TYPES = {
  SPORTS: 'sports',
  SOCIAL: 'social',
  HOBBY: 'hobby',
};

const FUNCTION_CONFIG = {
  TIMEOUT_SECONDS: 540,
  MEMORY: '256MB',
  REGION: 'us-central1',
  MAX_INSTANCES: 100,
  MIN_INSTANCES: 0,
};

const PAGINATION = {
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  MESSAGES_LIMIT: 50,
};

const MATCH_EXPIRY_DAYS = 30;
const MATCH_RESPONSE_DAYS = 7;
const MESSAGE_EDIT_HOURS = 24;
const POST_EDIT_HOURS = 24;
const TOKEN_REFRESH_HOURS = 24;

module.exports = {
  SUBSCRIPTION_TIERS,
  TIER_LIMITS,
  ERROR_CODES,
  ERROR_MESSAGES,
  MATCH_STATUS,
  MATCH_TYPES,
  POST_VISIBILITY,
  TEAM_ROLES,
  ACTIVITY_TYPES,
  FUNCTION_CONFIG,
  PAGINATION,
  MATCH_EXPIRY_DAYS,
  MATCH_RESPONSE_DAYS,
  MESSAGE_EDIT_HOURS,
  POST_EDIT_HOURS,
  TOKEN_REFRESH_HOURS,
};
