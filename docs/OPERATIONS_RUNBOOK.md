# Operations Runbook — Matching Platform

## Monitoring Dashboard

Key metrics to watch (Firebase Console + Google Cloud Monitoring):

| Metric | Warning | Critical | Dashboard |
|---|---|---|---|
| Cloud Function P99 latency | >300ms | >800ms | Firebase Performance |
| Cloud Function error rate | >0.5% | >2% | Cloud Monitoring |
| Firestore reads/second | >50k | >80k | Firebase Usage |
| Active connections | >5k | >8k | Firebase Realtime |
| Auth failures/minute | >50 | >200 | Audit Logs |

---

## Common Issues and Solutions

### "Function timeout" errors

**Symptoms**: Functions logs show `Function execution took too long`
**Solution**:
1. Check Firestore queries — missing indexes cause full collection scans
2. Check `firebase deploy --only firestore:indexes`
3. Increase function timeout in `FUNCTION_CONFIG.TIMEOUT_SECONDS` if needed

### "Quota exceeded" for Firestore

**Symptoms**: `RESOURCE_EXHAUSTED` errors in logs
**Solution**:
1. Check Firebase Console → Firestore → Usage tab
2. Identify high-read collections (usually `match_cache` or `posts`)
3. Increase cache TTL or implement pagination for problematic queries
4. Consider upgrading Firestore to higher tier

### Users not receiving push notifications

**Symptoms**: FCM logs show success but user reports no notification
**Solution**:
1. Check user's device FCM token is not expired (> 30 days)
2. Check notification settings: `canSendNotification()` may be blocking
3. Check quiet hours setting — user may have 10PM-8AM quiet hours
4. Check app has notification permissions on device

### High rate of failed logins (potential attack)

**Symptoms**: `security_alerts` collection shows `multiple_failed_logins`
**Solution**:
1. Run `isIpBlocked()` for the attacking IP
2. If not blocked: `blockIp(ip, 3600000)` (1 hour)
3. Monitor `audit_logs` for continuation
4. If sustained (>30 min): Enable Firebase App Check

---

## Database Maintenance

### Clean Up Old Match Cache

Scheduled (weekly):
```javascript
// Purge match_cache older than 7 days
const old = await db.collection('match_cache')
  .where('generated_at', '<', sevenDaysAgo).get();
```

### Archive Old Messages (2 Year Retention)

Called by `enforceRetentionPolicy()` — schedule monthly:
```bash
firebase functions:call enforceRetentionPolicy
```

### Cleanup Stale FCM Tokens

Called by `cleanupExpiredTokens()` — schedule weekly:
```bash
firebase functions:call cleanupExpiredTokens
```

### Cleanup Audit Logs (90 Day Retention)

Called by `cleanupOldLogs()` — schedule weekly:
```bash
firebase functions:call cleanupAuditLogs
```

---

## Cost Optimization

| Resource | Cost Driver | Optimization |
|---|---|---|
| Firestore reads | Feed queries, suggestion generation | Cache results in `match_cache` |
| Cloud Functions invocations | Per-message triggers | Batch multiple events |
| FCM | Not billed | No action needed |
| Cloud Storage | Media uploads | Compress on client before upload |
| Auth | 10k/month free | No action for MVP |

**Monthly cost estimate at 50k users:**
- Firestore: ~$50-150 (reads/writes)
- Cloud Functions: ~$20-50
- Total: ~$70-200/month

---

## Scaling Procedures

### Scaling to 500k Users

1. Enable Firestore multi-region (nam5)
2. Increase Cloud Functions `MIN_INSTANCES` to 5 for hot functions
3. Enable suggestion cache precomputation for top 10k active users
4. Add composite index for location-based queries

### Scaling to 1.5M Users

1. Move matching algorithm to Cloud Run (persistent memory for geo-index)
2. Use Firebase Realtime Database for presence (cheaper at high write frequency)
3. Implement message archival to Cloud Storage after 2 years
4. Add read replicas

---

## Incident Response

### P1 — Service Down

1. Check Firebase Console → Status page (status.firebase.google.com)
2. Check Cloud Functions logs for errors
3. Run `firebase functions:list` to confirm deployed versions
4. If Firebase outage: notify users via status page, wait for resolution
5. Post-incident: write incident report in 48h

### P2 — Performance Degradation

1. Check Cloud Monitoring latency dashboard
2. Identify high-latency function
3. Check Firestore index usage (missing indexes = full scans)
4. Check Cloud Functions cold starts (increase `MIN_INSTANCES`)
5. Check `match_cache` hit rate — may need precomputation
