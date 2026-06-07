---
name: Admin Panel Routing
description: How the hidden /admin route is wired in App.tsx to bypass Telegram auth
---

The admin panel is at `/admin` and must NOT be inside the `AuthGate` component or any route that requires Telegram login.

**Pattern (in App.tsx > AuthGate function):**
```tsx
// Check admin BEFORE loading state and before user check
if (location === "/admin" || location.startsWith("/admin/")) {
  return <AdminPage />;
}
```

**Why:** AuthGate redirects unauthenticated users to LoginPage (Telegram). Admin uses its own username/password auth via sessionStorage token, completely independent of user auth.

**How to apply:** Any time admin route or similar "hidden bypass" route is added, intercept at the top of AuthGate before the loading spinner and user check.
