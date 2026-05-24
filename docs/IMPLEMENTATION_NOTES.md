# Implementation Notes — Agent 01: API Backend Architect

## Architecture Decisions

### Serverless Cloud Functions
All business logic lives in Firebase Cloud Functions (HTTPS Callable). This avoids maintaining servers, scales automatically, and integrates natively with Firebase Auth context.

### Firestore Data Model
Collections are designed for read-heavy access patterns:
- **Denormalization**: `last_message_text` and `last_message_timestamp` are duplicated in `conversations` to avoid expensive subcollection queries for the inbox screen.
- **user_limits**: Stored as a separate collection (not a subcollection of `users`) so Cloud Functions can write to it with minimal reads on the users document.
- **match_cache**: Pre-computation reduces P99 latency for suggestion queries to <200ms.

### Transaction Strategy
All multi-document writes (match acceptance → conversation creation, like → counter update) use Firestore transactions to prevent partial writes. The `runTransaction` pattern includes retry logic built into the Firestore SDK.

### Freemium Enforcement
Limits are checked at the Cloud Function level before any Firestore writes, using `checkSubscriptionLimits`. This is defense-in-depth alongside Firestore Security Rules.

---

## Database Indexing Strategy

| Query | Index | Rationale |
|---|---|---|
| Users by age range | `subscription_type + age` (composite) | Matching algorithm candidate pool |
| Conversations by user | `participant1_id + last_message_timestamp DESC` | Inbox sorted by recency |
| Messages in conversation | `timestamp DESC` (single) | Message stream pagination |
| Posts by visibility + date | `visibility + created_at DESC` | Public feed |
| Matches by user | `user1_id + created_at DESC` | Match history |

All composite indexes must be created in `firestore.indexes.json` before deployment.

---

## Performance Considerations

- **Match suggestions cache** (TTL: 24h Free, 6h Premium, 2h VIP): pre-computed nightly for active users
- **Pagination**: All list endpoints use cursor-based pagination (`startAfter`) — never offset-based, which degrades at scale
- **Batch writes**: Use `db.batch()` for multi-document creates (user registration creates 3 documents in one batch)
- **Cold starts**: Keep dependencies minimal in each function file; avoid top-level async initialization

---

## Future Scaling Recommendations

1. **Sharding `user_limits`**: At >100k writes/sec, shard the counter documents into sub-documents and aggregate with scheduled functions
2. **Move matching to dedicated service**: At 1.5M users, extract matching algorithm to a Cloud Run service with persistent in-memory geo-index
3. **Message archival**: After 2 years, move old messages to Cloud Storage (Firestore costs scale linearly)
4. **Read replicas**: Enable multi-region Firestore for sub-50ms reads globally
5. **CDN for media**: Route all photoURL / attachment reads through Firebase Hosting CDN, not direct Storage URLs
