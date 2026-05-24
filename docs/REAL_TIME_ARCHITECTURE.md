# Real-Time Architecture — Chat & Messaging

## Data Flow: Message Sending

```
Client (React Native)
    │
    ├─ [Offline?] → queueMessage() → AsyncStorage pending queue
    │
    └─ [Online] → sendMessage(conversationId, senderId, text)
                       │
                       ▼
              Firestore Transaction
              ├─ messages/{convId}/messages/{msgId} ← write new message
              └─ conversations/{convId} ← update last_message_text, unread_count
                       │
                       ▼
              Firestore Listener (recipient's device)
              └─ listenToMessages() fires with new doc
                       │
                       ▼
              push-notifications.js
              └─ sendMessageNotification() → FCM → Recipient device
```

## Offline Sync Flow

```
App goes offline
    │
    ▼
User types message → queueMessage() → pending_messages_{convId} in AsyncStorage
    │
    ▼
Show "Pending..." indicator (optimistic UI with tempId)
    │
Network restored
    │
    ▼
syncOnReconnect(conversationId, sendFn)
    ├─ Process queue in order
    ├─ Exponential backoff on failure (1s, 2s, 4s, 8s, 16s, 30s max)
    └─ dequeueMessage() on success → replace tempId with real messageId
```

## Presence Detection

```
App foreground → setOnline(userId) → /presence/{userId}
App background → setOffline(userId) → /presence/{userId}

Recipient listening → listenToPresence(userId, callback)
    └─ Stale check: if updated_at > 5 min ago → treat as offline

Scheduled cleanup (every 5 min):
    cleanupStalePresence() → sets is_online = false for stale records
```

## Typing Indicators

```
User keystroke → setTyping(convId, userId) → typing_indicators/{userId}
                  expires_at = now + 5000ms

Stop typing / send → clearTyping(convId, userId) → delete doc

Recipient → listenToTyping(convId, currentUserId, onTyping)
    └─ Checks expires_at > now → triggers "User is typing..." UI
```

## Performance Benchmarks (Targets)

| Metric | Target | Strategy |
|---|---|---|
| Message delivery (P99) | <500ms | Firestore real-time listeners |
| Conversation list load | <1s (50 convs) | Composite index + limit(50) |
| Read receipt update | <2s | Batch update on scroll |
| Notification delivery | <3s | FCM high priority |
| Offline queue sync | <5s | Sequential with backoff |
| Typing indicator lag | <200ms | Direct Firestore write |

## Scaling Recommendations

- At 500k messages/day: Single Firestore region is sufficient
- At 5M messages/day: Enable Firestore multi-region (nam5 or eur3)
- At 10M messages/day: Consider partitioning conversations by month
- FCM batch sending: Use `messaging.sendMulticast()` for >500 recipients
- Presence at scale: Use Realtime Database instead of Firestore (cheaper for high-frequency writes)
