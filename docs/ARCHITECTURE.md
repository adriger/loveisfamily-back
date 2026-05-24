# Architecture — Matching Platform Backend

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT APPS                              │
│   iOS (Swift/RN)    Android (Kotlin/RN)    Web (React)          │
└────────────────────────────┬────────────────────────────────────┘
                             │ Firebase SDK
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FIREBASE SERVICES                             │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Firebase     │  │  Firestore   │  │  Cloud Functions     │  │
│  │ Auth         │  │  (NoSQL DB)  │  │  (Serverless Logic)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Cloud       │  │  Firebase    │  │  Cloud               │  │
│  │  Storage     │  │  Messaging   │  │  Logging             │  │
│  │  (Media)     │  │  (FCM)       │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Cloud Functions Architecture

Functions are organized into 6 modules:

```
cloud-functions/
├── index.js              ← exports all functions
├── functions/
│   ├── auth.js           ← createUser, updateProfile, deleteAccount
│   ├── matching.js       ← getSuggestions, createMatch, respondToMatch
│   ├── messaging.js      ← sendMessage, getMessages, markAsRead
│   ├── community.js      ← createPost, feed, likes, comments
│   ├── teams.js          ← createTeam, invite, accept
│   └── freemium.js       ← checkLimits, upgrade subscription
└── utils/
    ├── validators.js     ← input validation helpers
    └── constants.js      ← tier limits, error codes
```

All functions are HTTPS Callable, invoked via the Firebase SDK with authenticated context.

## Authentication Flow

```
User Opens App
    │
    ├─ New User → createUser(email, password, username)
    │                └─ Firebase Auth creates user
    │                └─ Cloud Function creates Firestore documents
    │                └─ Custom claims set (subscription_type: 'free')
    │
    └─ Returning User → signInWithEmailAndPassword()
                         └─ Firebase Auth validates credentials
                         └─ Returns ID token (24h validity)
                         └─ Custom claims embedded in token
                         └─ Client uses token for all subsequent calls
```

## Matching Algorithm Flow

```
User requests suggestions
    │
    ├─ Cache hit? → Return cached suggestions (<50ms)
    │
    └─ Cache miss:
           │
           ▼
    Query candidate pool (Firestore)
    - Filter: age range, active users, not already matched
    - Limit: 500 candidates
           │
           ▼
    Batch scoring (100/batch)
    - Interest overlap (Jaccard, 50%)
    - Distance score (Haversine, 30%)
    - Age compatibility (20%)
    - Activity + engagement bonuses
           │
           ▼
    Filter: score < 0.25 discarded
    Sort: descending by score
    Diversity filter: max 2 per top interest
           │
           ▼
    Store in match_cache/{userId} (TTL: 24h/6h/2h by tier)
    Return top N suggestions
```

## Real-time Data Flow (Messaging)

```
Sender sends message
    │
    ▼
Firestore Transaction:
  - Write to /conversations/{id}/messages/{msgId}
  - Update /conversations/{id}.last_message_* and unread_count
    │
    ▼
Recipient's Firestore listener fires (< 500ms)
  - UI updates in real-time
    │
    ▼
Cloud Function trigger (Firestore onWrite):
  - Send FCM push notification to recipient's devices
```

## Security Architecture

```
Client Request
    │
    ▼
Firebase Auth token validation (automatic)
    │
    ▼
Firestore Security Rules (enforced server-side)
  - Authentication check
  - Resource ownership check
  - Field-level validation
  - Subscription tier enforcement
    │
    ▼
Cloud Function (business logic)
  - Rate limit check
  - Input validation
  - Subscription limit check
  - Firestore operations
```

## Subscription Tier Architecture

```
Tier Check on Every Feature Action:
    │
    ├─ 1. Firebase Auth custom claims (client-side fast check)
    ├─ 2. Cloud Function checkSubscriptionLimits() (server-side)
    ├─ 3. Firestore Security Rules (database-level enforcement)
    └─ 4. user_limits counter (atomic increment)
```

## Scalability

| Users | Architecture |
|---|---|
| 0–100k | Single-region Firestore, default Cloud Functions |
| 100k–500k | Composite indexes tuned, match_cache populated, CDN for assets |
| 500k–1.5M | Multi-region Firestore, dedicated matching Cloud Run service |
| 1.5M+ | Database sharding, Realtime Database for presence, ML-based matching |
