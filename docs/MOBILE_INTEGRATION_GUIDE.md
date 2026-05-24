# Mobile Integration Guide — Matching Platform

## React Native Setup

### Installation

```bash
npm install firebase @react-native-firebase/app @react-native-firebase/auth \
  @react-native-firebase/firestore @react-native-firebase/messaging \
  @react-native-async-storage/async-storage
```

### Initialize Firebase

```javascript
// App.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const app = initializeApp({
  apiKey: 'your-api-key',
  projectId: 'your-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '12345',
  appId: '1:12345:web:abcdef',
});

export const db = getFirestore(app);
export const auth = getAuth(app);
```

---

## Authentication Flow

### Register User

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';
const functions = getFunctions();

const createUser = httpsCallable(functions, 'createUser');

async function register(email, password, username) {
  try {
    const result = await createUser({ email, password, username });
    console.log('Created user:', result.data.uid);
  } catch (error) {
    console.error('Registration failed:', error.message);
  }
}
```

### Login

```javascript
import { signInWithEmailAndPassword } from 'firebase/auth';

async function login(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const token = await credential.user.getIdToken();
  // Token automatically sent with all httpsCallable requests
}
```

### Logout

```javascript
import { signOut } from 'firebase/auth';
await signOut(auth);
```

---

## Real-time Message Listener

```javascript
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';

function subscribeToMessages(conversationId, callback) {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    where('is_deleted', '==', false),
    orderBy('timestamp', 'desc'),
    limit(50)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => doc.data()).reverse();
    callback(messages);
  });

  return unsubscribe; // Call on component unmount
}

// Usage in React Native component
useEffect(() => {
  const unsub = subscribeToMessages(conversationId, setMessages);
  return () => unsub(); // Cleanup on unmount
}, [conversationId]);
```

---

## FCM Push Notifications (React Native Firebase)

```javascript
import messaging from '@react-native-firebase/messaging';

async function setupPushNotifications(userId) {
  // Request permission
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) return;

  // Get token and save to Firestore
  const token = await messaging().getToken();
  const deviceId = await DeviceInfo.getUniqueId();

  await db.collection('users').doc(userId)
    .collection('devices').doc(deviceId).set({
      device_id: deviceId,
      platform: Platform.OS,
      fcm_token: token,
      last_used_at: new Date(),
    }, { merge: true });

  // Handle token refresh
  messaging().onTokenRefresh(async (newToken) => {
    await db.collection('users').doc(userId)
      .collection('devices').doc(deviceId)
      .update({ fcm_token: newToken, last_used_at: new Date() });
  });

  // Handle foreground notifications
  messaging().onMessage(async remoteMessage => {
    console.log('Notification received:', remoteMessage.notification);
    // Show in-app notification
  });
}
```

---

## Offline Sync Configuration

Enable Firestore offline persistence:

```javascript
import { enableIndexedDbPersistence } from 'firebase/firestore';

// Call once during app initialization
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('Multiple tabs open — persistence enabled in first tab only');
  }
});
```

For pending messages (React Native):

```javascript
import { queueMessage, syncOnReconnect } from './offline-service';
import NetInfo from '@react-native-community/netinfo';

// On network state change
NetInfo.addEventListener(state => {
  if (state.isConnected) {
    syncOnReconnect(currentConversationId, sendMessageFn);
  }
});

// On send (when online, send directly; when offline, queue)
async function handleSend(text) {
  const { isConnected } = await NetInfo.fetch();
  if (isConnected) {
    await sendMessage(conversationId, currentUserId, text);
  } else {
    const tempId = await queueMessage(conversationId, { text, senderId: currentUserId });
    // Add optimistic message to UI with tempId
  }
}
```

---

## Error Handling Patterns

```javascript
import { FirebaseFunctionsTypes } from '@react-native-firebase/functions';

async function callFunction(name, data) {
  try {
    const fn = functions().httpsCallable(name);
    const result = await fn(data);
    return result.data;
  } catch (error) {
    const code = error?.details?.code || error?.code;
    switch (code) {
      case 'RATE_LIMIT_EXCEEDED':
        Alert.alert('Limit reached', 'Upgrade to Premium for more matches');
        break;
      case 'SUBSCRIPTION_REQUIRED':
        Alert.alert('Premium required', 'This feature requires Premium or VIP');
        break;
      case 'UNAUTHORIZED':
        // Re-authenticate user
        break;
      default:
        Alert.alert('Error', error.message);
    }
    throw error;
  }
}
```

---

## Best Practices

1. **Detach listeners on unmount** — always call `unsubscribe()` in `useEffect` cleanup
2. **Limit query size** — always use `.limit(50)` or smaller on listeners
3. **Use pagination** — pass `startAfter` cursor for loading more results
4. **Battery optimization** — debounce presence updates (max 1/30s)
5. **Token refresh** — handle `onTokenRefresh` to keep FCM tokens fresh
6. **Offline first** — show optimistic UI immediately, sync in background
