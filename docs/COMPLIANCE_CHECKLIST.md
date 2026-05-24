# Compliance Checklist — Matching Platform

## GDPR Compliance

| Requirement | Status | Implementation |
|---|---|---|
| Right to Access (Art. 15) | ✅ | `exportUserData()` endpoint |
| Right to Erasure (Art. 17) | ✅ | `deleteUserData()` cascade |
| Data Portability (Art. 20) | ✅ | JSON export via Cloud Function |
| Consent Management (Art. 7) | ✅ | `recordConsent()` with audit log |
| Breach Notification 72h (Art. 33) | ✅ | SECURITY_RUNBOOK.md procedure |
| Privacy by Design (Art. 25) | ✅ | Encryption helpers, minimal data |
| Data Retention Limits | ✅ | `enforceRetentionPolicy()` scheduled |
| Encryption at Rest | ✅ | Firestore encryption (Google-managed) |
| Encryption in Transit | ✅ | HTTPS/TLS 1.3 enforced by Firebase |
| Age Verification (18+) | ✅ | Security Rules + validator |

## CCPA Compliance

| Requirement | Status | Implementation |
|---|---|---|
| Right to Know | ✅ | `exportUserData()` |
| Right to Delete | ✅ | `deleteUserData()` |
| Right to Opt-Out | ✅ | `recordConsent()` + notification settings |
| Non-Discrimination | ✅ | Feature availability not tied to privacy choices |
| Privacy Notice | ⚠️ | Requires legal team to draft and display |

## Security Audit Template

### Authentication
- [ ] All endpoints require Firebase Auth token
- [ ] Email verification enforced for writes
- [ ] Rate limiting on login (10 failed attempts → lockout)
- [ ] Password complexity requirements enforced
- [ ] Session revocation on logout works

### Data Access Control
- [ ] Users cannot read other users' private data
- [ ] Messages only visible to conversation participants
- [ ] Matches only visible to match participants
- [ ] Private teams not accessible to non-members
- [ ] user_limits only writable by Cloud Functions

### Input Validation
- [ ] All text fields have max length enforced
- [ ] Email format validated on registration
- [ ] Age >= 18 enforced in rules and validators
- [ ] Attachment size limits enforced (10MB)
- [ ] No SQL-equivalent injection vectors in queries

### Encryption & Key Management
- [ ] Sensitive fields encrypted at application level
- [ ] Encryption keys stored in Cloud KMS (not in code)
- [ ] Key rotation schedule defined (quarterly)
- [ ] TLS 1.3 minimum enforced
- [ ] No secrets in source code or environment variables

### Audit & Monitoring
- [ ] All auth events logged
- [ ] Security alerts configured in Firestore
- [ ] Alert notifications routed to on-call team
- [ ] Audit logs retained 90 days minimum
- [ ] GDPR deletion logs retained 7 years (legal requirement)

### GDPR Operational
- [ ] Data export tested and verified complete
- [ ] Deletion cascade tested (messages anonymized, posts archived)
- [ ] Consent records stored per user
- [ ] DPA (Data Processing Agreement) signed with Firebase/Google
- [ ] Privacy Policy updated and visible in app
