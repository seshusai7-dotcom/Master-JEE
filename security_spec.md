# Security Specification — MASTER JEE Class 11 Physics

## 1. Data Invariants
1. **Owner Isolation**: A user's profile (`/users/{userId}`) and all nested subcollections (`attempts`, `notes`, `flashcards`) may only be read or written by that authenticated, email-verified user (`request.auth.uid == userId`) or an authorized Academic Administrator (`isAdmin()`).
2. **No Self-Promoted Roles**: A standard student cannot create or update `/users/{userId}` with `role == 'admin'`, nor create a document in `/admins/{userId}`.
3. **Master Gate on Subcollections**: Every subcollection operation under `/users/{userId}/...` verifies parent user document existence via `exists(/databases/$(database)/documents/users/$(userId))`.
4. **Published Content Gate**: Students may only read `/managedContent/{contentId}` when `workflowStatus == 'PUBLISH'`. Drafts (`GENERATE`, `VALIDATE`, `TEACHER_REVIEW`, `APPROVE`) are restricted to `isAdmin()`.
5. **Immutable Audit Fields**: `uid`, `userId`, `authorId`, and `createdAt` cannot be modified after creation. All `createdAt` and `updatedAt` timestamps must equal `request.time`.
6. **Strict Schema & Size Guards**: Every document ID matches `^[a-zA-Z0-9_\\-]+$` (max 128 chars), every string has explicit `.size()` bounds, and every create/update enforces exact key allowlists (`hasAll` + `hasOnly` / `affectedKeys().hasOnly`).
7. **Syllabus Hierarchy Integrity**: `/syllabus/{chapterId}`, `/syllabus/{chapterId}/topics/{topicId}`, and `/syllabus/{chapterId}/topics/{topicId}/subtopics/{subtopicId}` are strictly writable only by `isAdmin()`, require Master Gate parent checks (`exists(...)` or `existsAfter(...)` during atomic batch seeding), enforce bounded arrays (`targetLevels.size() <= 3`, `keyConcepts.size() <= 10`), and restrict reads (`get`, `list`) to verified authenticated users or admins.

## 2. Dirty Dozen Adversarial Payloads
1. Unauthenticated read of `/users/u1` or `/syllabus/ch1`.
2. Authenticated user `u2` reading `/users/u1` (PII leak attempt).
3. User `u1` creating `/users/u1` with `role: 'admin'` (Privilege escalation).
4. User `u1` updating `/users/u1` to change `role` from `'student'` to `'admin'`.
5. User `u1` creating `/users/u1` with extra shadow field `isPro: true`.
6. User `u1` writing `/users/u1/attempts/a1` with `userId: 'u2'` (Identity spoofing).
7. User `u1` writing `/users/u1/notes/n1` with a 10KB `body` exceeding maxLength 4000 (Resource poisoning).
8. User `u1` writing `/users/u1/notes/n1` with client-forged `createdAt` not equal to `request.time`.
9. User `u1` writing `/managedContent/c1` or `/syllabus/ch1` without admin privilege.
10. Unverified email user claiming admin email `seshusai7@gmail.com` (`email_verified: false`).
11. Student reading draft `/managedContent/c1` where `workflowStatus == 'TEACHER_REVIEW'`.
12. User `u1` importing unverified question into `/questionBank/q1` without admin privilege, or orphaned subtopic `/syllabus/missing/topics/t1/subtopics/s1`.
