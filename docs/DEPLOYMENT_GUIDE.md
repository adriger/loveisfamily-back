# Deployment Guide — Matching Platform

## Pre-Deployment Checklist

- [ ] All tests pass (`npm test`)
- [ ] Coverage ≥ 85% (`npm run test:coverage`)
- [ ] Security Rules reviewed and tested
- [ ] Composite indexes created in `firestore.indexes.json`
- [ ] Environment variables set in Firebase project
- [ ] GDPR Privacy Policy URL updated in app
- [ ] `.env` files NOT committed to git

---

## Staging Deployment

### 1. Deploy to Staging Project

```bash
firebase use staging
firebase deploy --only functions,firestore:rules,firestore:indexes
```

### 2. Run Integration Tests Against Staging

```bash
FIREBASE_PROJECT_ID=your-staging-project npm run test:integration
```

### 3. Manual Testing Checklist

- [ ] User registration and login
- [ ] Profile update
- [ ] Get matching suggestions (all 3 tiers)
- [ ] Create match → accept → mutual match → conversation created
- [ ] Send and receive messages
- [ ] Push notification received on device
- [ ] Create post → feed shows post
- [ ] Like and comment on post
- [ ] Create team (Premium user)
- [ ] Invite and accept team member
- [ ] GDPR data export
- [ ] GDPR account deletion

### 4. Load Test Staging

```bash
npm run test:load
# Verify P99 response times < 500ms
```

---

## Production Deployment

### Blue-Green Strategy

We maintain two Firebase projects: `prod-blue` and `prod-green`. Traffic alternates between them at deployment time.

```bash
# Current: prod-blue serving live traffic
# Deploy to prod-green (idle)
firebase use prod-green
firebase deploy

# Run smoke tests against prod-green
./scripts/smoke-test.sh prod-green

# If tests pass: swap DNS/CDN to prod-green
# Previous prod-blue remains on standby for 24h rollback window
```

### Deployment Steps

```bash
firebase use production
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### Post-Deployment Verification

```bash
# Check function health
firebase functions:log --only createUser | tail -20

# Invoke health check
curl https://us-central1-your-project.cloudfunctions.net/healthCheck
```

---

## Rollback Procedure

### Functions Rollback (< 5 minutes)

```bash
# List recent deployments
firebase functions:list

# Rollback to previous version using blue-green:
# 1. Switch DNS back to standby project (prod-blue)
# 2. Verify traffic on prod-blue
# 3. Investigate prod-green failure
```

### Firestore Rules Rollback

Security rules are versioned in git. To rollback:

```bash
git revert HEAD  # Revert the rules commit
firebase deploy --only firestore:rules
```

---

## Environment Variables in Firebase

Set secrets securely using Firebase Functions config:

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set STRIPE_SECRET_KEY
```

Access in Cloud Functions:
```javascript
const apiKey = process.env.ANTHROPIC_API_KEY;
```

---

## Monitoring Setup

### Cloud Logging Alerts

Create alerts in Google Cloud Console → Logging → Log-based Alerts:

1. **Function errors**: Filter `severity=ERROR resource.type=cloud_function`
2. **Auth failures**: Filter `jsonPayload.action="login_failed" AND count>5`
3. **Rate limit spikes**: Filter `jsonPayload.type="rate_limit_exceeded"`

### Firebase Performance Monitoring

Enable in Firebase Console → Performance:
- Custom traces for `getMatchingSuggestions`
- Monitor P99 latency

### Uptime Monitoring

Add Cloud Monitoring uptime checks for the health check endpoint:
```
https://us-central1-your-project.cloudfunctions.net/healthCheck
Check interval: 1 minute
Alert: after 2 failures
```
