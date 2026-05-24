# API Reference — Matching Platform

All endpoints are Firebase Cloud Functions (HTTPS Callable).
Authentication: Firebase ID token in `Authorization: Bearer {token}` header.

---

## Authentication Module

### createUser
Creates a new user account.

**Request:**
```json
{ "email": "user@example.com", "password": "Secure1!", "username": "myusername" }
```
**Response:**
```json
{ "uid": "abc123", "email": "user@example.com", "username": "myusername" }
```
**Errors:** `INVALID_INPUT`, `ALREADY_EXISTS`

---

### updateUserProfile
Updates profile fields. Requires auth.

**Request:**
```json
{ "displayName": "John", "bio": "Love sports", "interests": ["sports", "travel"], "age": 28 }
```
**Response:** `{}`

---

### deleteUserAccount
GDPR-compliant account deletion. Cascades to all user data.

**Response:** `{}`
**Side effects:** Deletes Auth account, anonymizes messages, archives posts, removes from matches/teams.

---

## Matching Module

### getMatchingSuggestions
Returns ranked compatibility suggestions.

**Request:** `{ "limit": 10 }`

**Response:**
```json
{
  "suggestions": [
    {
      "user_id": "user_456",
      "displayName": "Jane Doe",
      "age": 26,
      "interests": ["sports", "travel"],
      "compatibility_score": 0.78,
      "distance_km": 3.2
    }
  ]
}
```
**Rate limit:** 10/day (Free), 100/day (Premium), unlimited (VIP)

---

### createMatch
Initiates a match with another user.

**Request:** `{ "targetUserId": "user_456", "matchType": "algorithm" }`
**Response:** `{ "matchId": "match_789" }`
**Errors:** `RATE_LIMIT_EXCEEDED`, `ALREADY_EXISTS`

---

### respondToMatch
Accepts or rejects a match.

**Request:** `{ "matchId": "match_789", "response": "accept" }`
**Response:**
```json
{
  "status": "mutual_match",
  "conversationId": "conv_101"
}
```

---

### getMatchHistory
Returns paginated match history.

**Request:** `{ "limit": 20, "startAfter": "match_789" }`
**Response:** `{ "matches": [...], "nextCursor": "match_001" }`

---

## Messaging Module

### sendMessage
Sends a message in a conversation.

**Request:**
```json
{
  "conversationId": "conv_101",
  "text": "Hey, how are you?",
  "attachments": []
}
```
**Response:** `{ "messageId": "msg_456" }`

---

### getConversations
Returns all conversations for the authenticated user.

**Response:**
```json
{
  "conversations": [
    {
      "id": "conv_101",
      "participant1_id": "user_123",
      "participant2_id": "user_456",
      "last_message_text": "Hey!",
      "unread_count_p2": 2
    }
  ]
}
```

---

### getMessages
Returns paginated messages in a conversation.

**Request:** `{ "conversationId": "conv_101", "limit": 50 }`
**Response:** `{ "messages": [...], "nextCursor": "msg_001" }`

---

### markAsRead
Marks all messages in a conversation as read.

**Request:** `{ "conversationId": "conv_101" }`

---

### deleteMessage
Soft-deletes a message (sender only).

**Request:** `{ "messageId": "msg_456", "conversationId": "conv_101" }`

---

## Community Module

### createPost
Creates a community post.

**Request:**
```json
{
  "title": "Morning run in Central Park",
  "description": "5km easy jog",
  "activityType": "sports",
  "tags": ["running", "nyc"],
  "visibility": "public"
}
```
**Response:** `{ "postId": "post_789" }`
**Rate limit:** 10/day (Free), 50/day (Premium+)

---

### getPostFeed
Returns ranked public post feed.

**Request:** `{ "filters": { "activityType": "sports" }, "limit": 20 }`
**Response:** `{ "posts": [...], "nextCursor": "post_001" }`

---

### likePost
Toggles like on a post (add if not liked, remove if liked).

**Request:** `{ "postId": "post_789" }`

---

### commentOnPost
Adds a comment to a post.

**Request:** `{ "postId": "post_789", "text": "Great run!" }`
**Response:** `{ "commentId": "comment_123" }`

---

## Teams Module

### createTeam
Creates a team. Requires Premium or VIP subscription.

**Request:**
```json
{
  "name": "Weekend Runners",
  "description": "Running group",
  "privacyType": "public"
}
```
**Response:** `{ "teamId": "team_123" }`
**Rate limit:** 0 (Free), 3/month (Premium), unlimited (VIP)

---

### inviteToTeam
Invites a user to join a team. Owner/admin only.

**Request:** `{ "teamId": "team_123", "invitedUserId": "user_456" }`
**Response:** `{ "inviteId": "invite_789" }`

---

### acceptTeamInvite
Accepts a team invitation.

**Request:** `{ "teamId": "team_123", "inviteId": "invite_789" }`

---

## Subscription Module

### checkSubscriptionLimits
Returns current usage and limits for a feature.

**Request:** `{ "feature": "matches" }`
**Response:** `{ "allowed": true, "remaining": 8 }`

---

### upgradeSubscription
Upgrades user to premium or VIP tier.

**Request:** `{ "tier": "premium", "paymentId": "pay_stripe_123" }`

---

## Error Codes

| Code | HTTP | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `PERMISSION_DENIED` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `ALREADY_EXISTS` | 409 | Resource already exists |
| `INVALID_INPUT` | 400 | Invalid request parameters |
| `RATE_LIMIT_EXCEEDED` | 429 | Daily/hourly limit reached |
| `SUBSCRIPTION_REQUIRED` | 403 | Feature requires higher tier |
| `INTERNAL_ERROR` | 500 | Server error |
