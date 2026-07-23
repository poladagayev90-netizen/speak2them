---
name: firestore-rules-guard
description: Keep firestore.rules and indexes correct when adding or changing a Firestore collection/field in SpeakLab. Use whenever a read/write touches a new collection, field, or query.
---

# SpeakLab Firestore rules guard

`firestore.rules` ends with a catch-all `match /{document=**} { allow read, write: if false; }` — **any collection without an explicit `match` is fully denied.** Add a collection ⇒ add a rule, or the client silently gets permission-denied.

## Helpers already defined
`isSignedIn()`, `isAdmin()` (uid == admin), `isOwnDoc(userId)`, `isNotChangingPremiumFields()`, `isNotCreatingPremiumFields()`.

## Invariants that protect money/trial — do not weaken
- **`users/{userId}`**: create/update forbid premium fields from the client (`isNotCreating/ChangingPremiumFields`). `isPremium`, `subscriptionPlan`, `cohortStatus`, `freeAccessUntil` must remain server-only — the trial gate (`isTrialExpired`) trusts them. Delete is admin-only.
- **Server-written analysis** (`callAnalysis`, `analysisQueue`, per-user analysis docs): clients get `create`/`read` at most; `allow update, delete: if false`. Keep it that way.
- **UGC / Play compliance**: `users/{uid}/blocked/{peerId}` owner-only (doc existence = block); `reports` client-create-only, admin-read. Don't open these up.
- Subcollections need their own nested `match` (e.g. `fcmTokens`, `blocked`, `chats/{id}/messages`, `wordHistory/{uid}/words`).

## Practical checklist for a new collection
1. Add a `match /<col>/{id}` block with the tightest `allow` that works.
2. Ownership by uid → use `isOwnDoc` or compare `request.auth.uid` to a field.
3. If a Cloud Function is the only writer, give the client `read` only (or `create` with `hasOnly([...])` field allow-listing, like `waitlist`).
4. New composite query? Add it to `firestore.indexes.json`.
5. Deploy: `npx firebase-tools deploy --only firestore:rules,firestore:indexes --project speak2them-64f2b`.

Test the change against real prod via the `verify` skill — there is no emulator setup.
