# Getting Started — Matching Platform Backend

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+ or **yarn** 1.22+
- **Firebase CLI** 12+: `npm install -g firebase-tools`
- **Java 11+** (required for Firebase Emulator Suite)
- A Firebase project (see "Firebase Project Setup" below)

---

## Local Development Setup

### 1. Clone and Install

```bash
git clone https://github.com/your-org/matching-platform.git
cd matching-platform
npm install
```

### 2. Firebase CLI Login

```bash
firebase login
firebase use --add   # Select your Firebase project
```

### 3. Environment Variables

Create `.env.local` at the project root:

```env
FIREBASE_PROJECT_ID=your-project-id
APP_DEEP_LINK_URL=https://app.yourapp.com
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
```

> ⚠️ Never commit `.env.local` — it is git-ignored.

### 4. Start Firebase Emulator Suite

```bash
firebase emulators:start --only firestore,auth,functions
```

Emulator UI: http://localhost:4000
Firestore: http://localhost:8080
Auth: http://localhost:9099

### 5. Seed Test Data

```bash
node scripts/seed-database.js
```

This creates sample users, matches, and conversations in the Firestore emulator.

### 6. Running Tests

```bash
npm test                    # All tests
npm run test:unit           # Unit tests only (no emulator)
npm run test:integration    # Integration tests (emulator required)
npm run test:coverage       # With coverage report
```

---

## Firebase Project Setup

### Create a New Project

1. Go to https://console.firebase.google.com
2. Click **Add project** → name it → disable Google Analytics (optional)
3. Select **Blaze (pay-as-you-go)** plan — required for Cloud Functions

### Enable Services

```bash
# Enable Firestore
firebase firestore:databases:create --location=us-central1

# Deploy security rules
firebase deploy --only firestore:rules

# Deploy indexes
firebase deploy --only firestore:indexes

# Deploy Cloud Functions (first deploy takes several minutes)
firebase deploy --only functions
```

### Configure Authentication

In Firebase Console → Authentication → Sign-in methods, enable:
- Email/Password
- Phone
- Google (add OAuth client ID)
- Apple (configure App ID and Service ID)

---

## Running Cloud Functions Locally

```bash
# Start the functions emulator alone
firebase emulators:start --only functions

# Invoke a specific function (example)
curl -X POST http://localhost:5001/your-project/us-central1/createUser \
  -H 'Content-Type: application/json' \
  -d '{"data": {"email": "test@example.com", "password": "Test1234!", "username": "testuser"}}'
```

---

## Debugging

### Cloud Functions Logs
```bash
firebase functions:log
# Or follow live:
firebase functions:log --follow
```

### Firestore Emulator UI
Open http://localhost:4000 → Firestore tab to browse documents in real-time.

### Common Issues

| Problem | Solution |
|---|---|
| `EADDRINUSE: port 8080` | Kill existing emulator: `lsof -ti:8080 \| xargs kill` |
| `firebase: command not found` | Run `npm install -g firebase-tools` |
| Functions timeout locally | Increase `TEST_TIMEOUT` in `jest.config.js` |
| Auth emulator not connecting | Ensure `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099` is set |

---

## Adding a New Cloud Function

1. Create the handler in the relevant `functions/` module (e.g., `agent-01/functions/auth.js`)
2. Export it from `agent-01/cloud-functions-index.js`
3. Add unit tests in `agent-05/unit/`
4. Update `API_REFERENCE.md` with the new endpoint
5. Deploy: `firebase deploy --only functions:functionName`
