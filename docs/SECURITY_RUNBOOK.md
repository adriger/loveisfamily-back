# Security Runbook — Matching Platform

## Incident Response Procedures

### P1 — Data Breach Detected
1. **Immediately** disable affected user accounts (`disableUser()`)
2. Revoke all session tokens for affected users (`revokeAllSessions()`)
3. Notify security team within 1 hour
4. Preserve audit logs — do not delete anything
5. **GDPR 72-hour notification** to supervisory authority (Article 33)
6. Notify affected users within 72 hours if high risk (Article 34)
7. Conduct root cause analysis within 48 hours

### P2 — Account Takeover Attempt
1. Check `audit_logs` for `multiple_failed_logins` alerts
2. If >10 failed attempts: block IP via `blockIp(ip, 3600000)` (1 hour)
3. Force password reset for target account
4. Send security notification email to account owner
5. Monitor for 24 hours

### P3 — Suspicious API Activity (Bulk Reads / Data Scraping)
1. Check `security_alerts` collection for `bulk_reads` events
2. Temporarily rate-limit the user account
3. Review accessed resources
4. If confirmed scraping: permanently ban account, block IP range

---

## Password Reset Flow

```
User requests reset
  → POST /api/auth/forgot-password
  → generatePasswordResetLink(email)
  → Firebase sends time-limited link (1 hour)
  → User clicks link → Firebase validates token
  → User sets new password
  → validatePassword() checks complexity
  → isPasswordReused() prevents last-5 reuse
  → storePasswordHistory() updates history
  → revokeAllSessions() invalidates old tokens
  → logAuthEvent(action='password_reset', result='success')
```

---

## Account Recovery Procedure
1. User contacts support with identity proof
2. Support verifies via government ID (KYC)
3. Admin creates new Auth account with same email (old account purged)
4. Data migrated manually from old UID to new UID
5. Log the recovery in `audit_logs` with admin ID

---

## DDoS Mitigation Steps
1. **Detection**: >1000 requests/min from single IP → alert triggered
2. **Immediate**: `blockIp(ip, 3600000)` — 1 hour block
3. **Escalation**: >10 blocked IPs in 5 min → enable Cloud Armor rules
4. **Sustained attack**: Enable Firebase App Check to require valid app attestation
5. **Recovery**: Unblock IPs via admin console after attack subsides

---

## Breach Notification Timeline (GDPR Article 33/34)
- **T+0**: Breach detected / confirmed
- **T+1h**: Internal security team notified
- **T+4h**: Executive team notified, legal team engaged
- **T+24h**: Scope of breach determined
- **T+48h**: Draft supervisory authority notification
- **T+72h**: Submit notification to supervisory authority (MANDATORY)
- **T+96h**: Notify affected users if high-risk breach
