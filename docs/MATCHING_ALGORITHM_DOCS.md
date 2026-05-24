# Matching Algorithm Documentation

## Overview

The matching algorithm scores user compatibility using a weighted multi-factor formula. The score ranges from 0.0 to 1.0. Suggestions below 0.25 are filtered out.

## Scoring Formula

```
final_score = (interest_overlap × 0.50)
            + (distance_score × 0.30)
            + (age_score × 0.20)
            + activity_bonus (0–0.15)
            + engagement_bonus (0–0.10)
            + subscription_boost (0 or 0.05–0.10)

capped at 1.0
```

## Factor Details

### 1. Interest Overlap (50% weight)
Uses Jaccard similarity: `|A ∩ B| / |A ∪ B|`

| Example | Score |
|---|---|
| User1: [sports, cooking, travel], User2: [sports, music, travel] | 0.50 |
| User1: [sports, cooking], User2: [sports, cooking] | 1.00 |
| User1: [sports], User2: [cooking] | 0.00 |
| Both empty | 0.50 (neutral) |

### 2. Distance Proximity (30% weight)
`score = max(0, 1 - distance_km / max_distance_km)`

Max distance by tier:
- **Free**: 15 km
- **Premium**: 50 km
- **VIP**: 100 km

If either user has no location → 0.5 (neutral)

### 3. Age Compatibility (20% weight)
`score = max(0, 1 - |age1 - age2| / 20)`

Age range by tier:
- **Free**: ±5 years (filter) — score 0 if >10 year diff
- **Premium**: ±10 years
- **VIP**: ±15 years

If either user has no age → 0.5 (neutral)

### 4. Activity Bonus (0–0.15)
`+0.05 per shared activity participation`, capped at 0.15.

### 5. Engagement Bonus (0–0.10)
Formula: `(logins1/30 × logins2/30) × 0.05`
Mutual high engagement (>70% daily) adds additional +0.05 bonus.

### 6. Subscription Boost
VIP users get a **+0.10** boost in others' suggestion rankings.
Premium users get a **+0.05** boost.

---

## Pipeline Stages

```
1. Candidate Pool (Firestore query)
   └── Filters: age range, active users (<7 days), not already matched
   └── Limit: 500 candidates per query

2. Batch Scoring (100 candidates/batch)
   └── computeCompatibilityScore() for each candidate
   └── Filter out scores < 0.25

3. Ranking & Diversity
   └── Sort by compatibility_score DESC
   └── applyDiversityFilter() — max 2 per top interest

4. Cache
   └── Top 100 stored in match_cache/{userId}
   └── TTL: 24h (Free), 6h (Premium), 2h (VIP)
```

---

## Performance Benchmarks

| Operation | Target | Notes |
|---|---|---|
| Single score computation | <1ms | Pure math, no I/O |
| Batch score 100 candidates | <50ms | CPU-bound |
| Full pipeline (500 candidates) | <500ms P99 | With cache hit: <50ms |
| Cache hit rate | >80% | Active users |

---

## Customization Guide

To adjust weights for different markets:
1. Edit `computeCompatibilityScore()` in `matching-algorithm.js`
2. Adjust the multipliers (0.50, 0.30, 0.20)
3. The sum of base weights must equal 1.0 (bonuses are additive)

To change tier radius/age limits:
- Edit `TIER_LIMITS` in `agent-01/utils/constants.js`

---

## ML Enhancement Roadmap (Phase 2)

1. **Preference learning**: Track accept/reject history per user → adjust weights
2. **Collaborative filtering**: If User A and User B both liked User C → boost A↔B
3. **Real-time feedback**: CTR per suggestion slot → reorder based on position bias
4. **Content-based signals**: NLP on bio text for latent interest extraction
