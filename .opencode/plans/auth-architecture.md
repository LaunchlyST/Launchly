# Authentication Architecture — Implementation Plan

## Goal
Integrate authentication into every protected area: Sign In, Sign Up, Forgot Password, Email Verification, Google Login, User Sessions, Protected Routes, Role Permissions. No UI redesign — work within existing patterns.

---

## Architecture

```
editor-engine/auth/
  authEngine.js              ← central auth state, login/logout/signup/reset flows
  sessionManager.js          ← session persistence, token lifecycle, auto-refresh
  routeGuard.js              ← protected route definitions, access checks per area
  rolePermissions.js         ← RBAC: roles → permissions → feature gates
  providers/
    authProvider.js          ← abstract provider interface
    localAuthProvider.js     ← mock/local auth (localStorage-backed)
    googleAuthProvider.js    ← Google OAuth stub (architecture only)
```

### Flow

```
User clicks "Export"
  → routeGuard.checkAccess("export", userRole)
    → rolePermissions.hasPermission(role, "export:write")
      → if not authenticated → show sign-in modal
      → if authenticated but no permission → show upgrade toast
      → if authorized → proceed
```

---

## File-by-File Plan

### 1. `editor-engine/auth/authEngine.js`

Central auth orchestrator. Manages user state, login/logout/signup/reset flows.

```js
import { createId } from "../types/editorTypes.js";
import { createSession, validateSession, destroySession } from "./sessionManager.js";

export const AUTH_EVENTS = Object.freeze({
  SIGNED_IN: "auth:signed-in",
  SIGNED_OUT: "auth:signed-out",
  SIGN_UP: "auth:sign-up",
  PASSWORD_RESET: "auth:password-reset",
  EMAIL_VERIFIED: "auth:email-verified",
  SESSION_EXPIRED: "auth:session-expired",
  ROLE_CHANGED: "auth:role-changed",
});

export const AUTH_STATES = Object.freeze({
  UNAUTHENTICATED: "unauthenticated",
  AUTHENTICATED: "authenticated",
  LOADING: "loading",
  EMAIL_UNVERIFIED: "email_unverified",
});

export function createAuthState() {
  return {
    status: AUTH_STATES.UNAUTHENTICATED,
    user: null,
    session: null,
    error: null,
    loading: false,
    pendingVerificationEmail: null,
    passwordResetEmail: null,
  };
}

export function createAuthUser(data = {}) {
  return {
    id: createId("user"),
    email: data.email ?? "",
    name: data.name ?? "",
    avatar: data.avatar ?? null,
    role: data.role ?? "editor",
    emailVerified: data.emailVerified ?? false,
    provider: data.provider ?? "local",
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };
}

// Core auth methods (called by EditorCore)
export function authenticateUser(state, user, session) {
  return {
    ...state,
    status: user.emailVerified ? AUTH_STATES.AUTHENTICATED : AUTH_STATES.EMAIL_UNVERIFIED,
    user: { ...user, lastLoginAt: new Date().toISOString() },
    session,
    error: null,
    loading: false,
  };
}

export function deauthenticateUser(state) {
  return { ...state, status: AUTH_STATES.UNAUTHENTICATED, user: null, session: null, error: null };
}

export function setAuthLoading(state, loading) {
  return { ...state, loading };
}

export function setAuthError(state, error) {
  return { ...state, error, loading: false };
}

export function is_authenticated(state) {
  return state.status === AUTH_STATES.AUTHENTICATED;
}

export function is_email_verified(state) {
  return state.user?.emailVerified === true;
}

export function get_user_role(state) {
  return state.user?.role ?? "viewer";
}
```

### 2. `editor-engine/auth/sessionManager.js`

Session persistence and lifecycle.

```js
import { createId } from "../types/editorTypes.js";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours before expiry

export function createSession(userId, options = {}) {
  return {
    id: createId("session"),
    userId,
    token: generateToken(),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + (options.durationMs ?? SESSION_DURATION_MS)).toISOString(),
    lastActivityAt: new Date().toISOString(),
    provider: options.provider ?? "local",
    device: options.device ?? "browser",
  };
}

export function validateSession(session) {
  if (!session) return false;
  if (!session.token) return false;
  if (new Date(session.expiresAt) < new Date()) return false;
  return true;
}

export function isSessionRefreshNeeded(session) {
  if (!session) return false;
  const expiresAt = new Date(session.expiresAt);
  const threshold = new Date(Date.now() + SESSION_REFRESH_THRESHOLD_MS);
  return expiresAt < threshold;
}

export function refreshSession(session) {
  return {
    ...session,
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
    lastActivityAt: new Date().toISOString(),
  };
}

export function destroySession(session) {
  return { ...session, expiresAt: new Date(0).toISOString(), token: null };
}

export function persistSession(session) {
  try { localStorage.setItem("launchly.auth.session", JSON.stringify(session)); } catch {}
}

export function loadPersistedSession() {
  try { return JSON.parse(localStorage.getItem("launchly.auth.session") || "null"); } catch { return null; }
}

export function clearPersistedSession() {
  try { localStorage.removeItem("launchly.auth.session"); } catch {}
}

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
```

### 3. `editor-engine/auth/rolePermissions.js`

Role-based access control.

```js
export const ROLES = Object.freeze({
  viewer: {
    id: "viewer",
    name: "Viewer",
    description: "View projects and timelines. No editing.",
    level: 0,
    permissions: [
      "timeline:read", "media:read", "preview:read", "export:read",
      "project:read", "settings:read",
    ],
  },
  editor: {
    id: "editor",
    name: "Editor",
    description: "Edit timelines, clips, and effects.",
    level: 1,
    permissions: [
      "timeline:read", "timeline:write",
      "media:read", "media:write",
      "preview:read", "preview:write",
      "export:read", "export:write",
      "ai:read", "ai:write",
      "text:read", "text:write",
      "audio:read", "audio:write",
      "effects:read", "effects:write",
      "project:read", "project:write",
      "settings:read",
    ],
  },
  producer: {
    id: "producer",
    name: "Producer",
    description: "Manage projects, export, and plugins.",
    level: 2,
    permissions: [
      "timeline:read", "timeline:write",
      "media:read", "media:write",
      "preview:read", "preview:write",
      "export:read", "export:write",
      "ai:read", "ai:write",
      "text:read", "text:write",
      "audio:read", "audio:write",
      "effects:read", "effects:write",
      "project:read", "project:write",
      "plugins:read", "plugins:write",
      "sync:read", "sync:write",
      "billing:read",
      "settings:read", "settings:write",
    ],
  },
  admin: {
    id: "admin",
    name: "Admin",
    description: "Full access to everything including billing and user management.",
    level: 3,
    permissions: [
      "timeline:read", "timeline:write",
      "media:read", "media:write",
      "preview:read", "preview:write",
      "export:read", "export:write",
      "ai:read", "ai:write",
      "text:read", "text:write",
      "audio:read", "audio:write",
      "effects:read", "effects:write",
      "project:read", "project:write",
      "plugins:read", "plugins:write",
      "sync:read", "sync:write",
      "billing:read", "billing:write",
      "users:read", "users:write",
      "settings:read", "settings:write",
    ],
  },
});

export const PROTECTED_AREAS = Object.freeze({
  export: { permission: "export:write", minRole: "editor" },
  aiTools: { permission: "ai:write", minRole: "editor" },
  effects: { permission: "effects:write", minRole: "editor" },
  plugins: { permission: "plugins:write", minRole: "producer" },
  sync: { permission: "sync:write", minRole: "producer" },
  billing: { permission: "billing:read", minRole: "producer" },
  settings: { permission: "settings:write", minRole: "editor" },
  userManagement: { permission: "users:read", minRole: "admin" },
});

export function hasPermission(roleId, permission) {
  const role = ROLES[roleId];
  if (!role) return false;
  return role.permissions.includes(permission);
}

export function hasMinimumRole(userRole, requiredRole) {
  const user = ROLES[userRole];
  const required = ROLES[requiredRole];
  if (!user || !required) return false;
  return user.level >= required.level;
}

export function canAccessArea(userRole, areaKey) {
  const area = PROTECTED_AREAS[areaKey];
  if (!area) return true;
  return hasMinimumRole(userRole, area.minRole);
}

export function getRolePermissions(roleId) {
  return ROLES[roleId]?.permissions ?? [];
}

export function getRestrictedAreas(userRole) {
  return Object.entries(PROTECTED_AREAS)
    .filter(([_, area]) => !hasMinimumRole(userRole, area.minRole))
    .map(([key]) => key);
}
```

### 4. `editor-engine/auth/routeGuard.js`

Protected route definitions and access checks.

```js
import { canAccessArea, hasPermission, hasMinimumRole } from "./rolePermissions.js";
import { is_authenticated, is_email_verified, get_user_role } from "./authEngine.js";

export const ROUTE_DEFINITIONS = Object.freeze({
  "/": { protected: false },
  "/editor": { protected: false },
  "/export": { protected: true, permission: "export:write", minRole: "editor", requireEmailVerification: true },
  "/ai-tools": { protected: true, permission: "ai:write", minRole: "editor" },
  "/plugins": { protected: true, permission: "plugins:write", minRole: "producer" },
  "/sync": { protected: true, permission: "sync:write", minRole: "producer" },
  "/billing": { protected: true, permission: "billing:read", minRole: "producer" },
  "/settings": { protected: true, permission: "settings:write", minRole: "editor" },
  "/settings/admin": { protected: true, permission: "users:read", minRole: "admin" },
  "/settings/billing": { protected: true, permission: "billing:read", minRole: "producer" },
});

export function checkAccess(route, authState, context = {}) {
  const definition = ROUTE_DEFINITIONS[route] ?? { protected: false };
  if (!definition.protected) return { allowed: true, reason: null };

  if (!is_authenticated(authState)) {
    return { allowed: false, reason: "authentication_required", message: "Sign in to access this feature." };
  }

  if (definition.requireEmailVerification && !is_email_verified(authState)) {
    return { allowed: false, reason: "email_unverified", message: "Verify your email to access this feature." };
  }

  const role = get_user_role(authState);
  if (definition.minRole && !hasMinimumRole(role, definition.minRole)) {
    return { allowed: false, reason: "insufficient_role", message: `${definition.minRole} role or higher required.` };
  }

  if (definition.permission && !hasPermission(role, definition.permission)) {
    return { allowed: false, reason: "insufficient_permission", message: `Missing permission: ${definition.permission}` };
  }

  return { allowed: true, reason: null };
}

export function guardFeature(featureKey, authState) {
  const route = `/features/${featureKey}`;
  return checkAccess(route, authState);
}
```

### 5. `editor-engine/auth/providers/authProvider.js`

Abstract auth provider interface.

```js
export const AUTH_PROVIDER_IDS = Object.freeze(["local", "google"]);

export function createAuthProvider(config) {
  return {
    id: config.id,
    name: config.name,
    type: config.type,   // "credentials" | "oauth"
    requiresApiKey: config.requiresApiKey ?? false,
    isConnected: config.isConnected ?? false,
  };
}

// Each provider must implement:
// signIn(credentials) → { user, session }
// signUp(data) → { user, session }
// signOut(session) → void
// resetPassword(email) → { success, message }
// verifyEmail(token) → { success }
// refreshSession(session) → session
// getProfile(userId) → user
```

### 6. `editor-engine/auth/providers/localAuthProvider.js`

Mock/local auth backed by localStorage.

```js
import { createAuthProvider } from "./authProvider.js";
import { createAuthUser } from "../authEngine.js";
import { createSession } from "../sessionManager.js";
import { createId } from "../../types/editorTypes.js";

const USERS_KEY = "launchly.auth.users";

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); } catch { return []; }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function createLocalAuthProvider() {
  return {
    ...createAuthProvider({ id: "local", name: "Local Account", type: "credentials" }),

    signIn({ email, password }) {
      const users = loadUsers();
      const found = users.find((u) => u.email === email && u.password === password);
      if (!found) return { user: null, session: null, error: "Invalid email or password." };
      const user = { ...found, password: undefined, lastLoginAt: new Date().toISOString() };
      const session = createSession(user.id, { provider: "local" });
      return { user, session, error: null };
    },

    signUp({ email, password, name }) {
      const users = loadUsers();
      if (users.find((u) => u.email === email)) return { user: null, session: null, error: "An account with this email already exists." };
      const user = createAuthUser({ email, name, provider: "local", role: "editor" });
      users.push({ ...user, password });
      saveUsers(users);
      const session = createSession(user.id, { provider: "local" });
      return { user, session, error: null };
    },

    signOut(session) { /* no-op for local */ },

    resetPassword(email) {
      const users = loadUsers();
      const found = users.find((u) => u.email === email);
      if (!found) return { success: false, message: "No account found with this email." };
      return { success: true, message: "Password reset link sent (simulated)." };
    },

    verifyEmail(token) {
      // In local mode, all emails are auto-verified
      return { success: true, message: "Email verified." };
    },

    getProfile(userId) {
      const users = loadUsers();
      const found = users.find((u) => u.id === userId);
      return found ? { ...found, password: undefined } : null;
    },

    updateProfile(userId, patch) {
      const users = loadUsers();
      const idx = users.findIndex((u) => u.id === userId);
      if (idx === -1) return null;
      users[idx] = { ...users[idx], ...patch };
      saveUsers(users);
      return { ...users[idx], password: undefined };
    },
  };
}
```

### 7. `editor-engine/auth/providers/googleAuthProvider.js`

Google OAuth stub.

```js
import { createAuthProvider } from "./authProvider.js";

export function createGoogleAuthProvider() {
  return {
    ...createAuthProvider({ id: "google", name: "Google", type: "oauth" }),

    signIn() {
      // Stub: creates a mock Google user
      // When connected: redirect to Google OAuth consent screen
      const user = {
        id: "user_google_mock",
        email: "user@gmail.com",
        name: "Google User",
        avatar: null,
        role: "editor",
        emailVerified: true,
        provider: "google",
        createdAt: new Date().toISOString(),
      };
      return { user, session: null, error: null, message: "Google OAuth stub. Connect real OAuth to use." };
    },

    signUp() { return this.signIn(); },

    signOut() { /* revoke Google token when connected */ },

    resetPassword() {
      return { success: true, message: "Google accounts use Google's password reset." };
    },

    verifyEmail() {
      return { success: true, message: "Google emails are pre-verified." };
    },

    getProfile() { return null; },
  };
}
```

### 8. Update `editor-engine/core/editorCore.js`

Add auth state and methods.

**New state field** (in `createDefaultState`):
```js
auth: createAuthState(),
```

**New import**:
```js
import { createAuthState, authenticateUser, deauthenticateUser, setAuthLoading, setAuthError, AUTH_EVENTS } from "../auth/authEngine.js";
import { createLocalAuthProvider } from "../auth/providers/localAuthProvider.js";
import { createGoogleAuthProvider } from "../auth/providers/googleAuthProvider.js";
import { checkAccess } from "../auth/routeGuard.js";
import { hasMinimumRole, getRestrictedAreas, PROTECTED_AREAS } from "../auth/rolePermissions.js";
```

**New methods on EditorCore**:
```js
// Authentication
signIn(email, password, providerId = "local") → { success, user, error }
signUp(email, password, name, providerId = "local") → { success, user, error }
signOut() → void
resetPassword(email) → { success, message }
verifyEmail(token) → { success }
signInWithGoogle() → { success, user, error }
loadSession() → session | null

// Authorization
isAuthenticated() → boolean
hasRole(roleId) → boolean
canAccess(featureKey) → { allowed, reason, message }
getRestrictedAreas() → string[]

// Session
refreshSession() → session | null
getSession() → session | null

// Profile
updateProfile(patch) → user | null
getUser() → user | null
```

**Updated `runAiTool`**:
```js
runAiTool(toolId, instruction = this.state.aiCommand) {
  const access = this.canAccess("aiTools");
  if (!access.allowed) return { error: access.message };
  // ... existing logic
}
```

**Updated export methods** — add access check:
```js
exportProject() {
  const access = this.canAccess("export");
  if (!access.allowed) return { error: access.message };
  // ... existing logic
}
```

### 9. Update `editor-engine/constants/editorConstants.js`

Add auth domain:
```js
export const EDITOR_DOMAINS = Object.freeze({
  // ... existing
  auth: "auth",
});

export const AUTH_ROLES = Object.freeze(["viewer", "editor", "producer", "admin"]);
```

### 10. Update `editor-engine/index.js`

Add new exports:
```js
export * from "./auth/authEngine.js";
export * from "./auth/sessionManager.js";
export * from "./auth/routeGuard.js";
export * from "./auth/rolePermissions.js";
export * from "./auth/providers/authProvider.js";
export * from "./auth/providers/localAuthProvider.js";
export * from "./auth/providers/googleAuthProvider.js";
```

### 11. Update `index.html`

Add auth UI elements (minimal, no redesign — just modal shells in existing patterns):

```html
<!-- Auth modals (toggled by JS) -->
<div class="auth-backdrop" data-auth-backdrop hidden>
  <section class="auth-modal glass-panel" role="dialog" aria-modal="true">
    <!-- Sign In -->
    <div class="auth-form" data-auth-signin hidden>
      <h3>Sign In</h3>
      <input data-auth-email type="email" placeholder="Email" />
      <input data-auth-password type="password" placeholder="Password" />
      <button data-auth-action="signin">Sign In</button>
      <button data-auth-action="google">Continue with Google</button>
      <button data-auth-action="forgot">Forgot password?</button>
      <button data-auth-action="switch-to-signup">Create account</button>
    </div>
    <!-- Sign Up -->
    <div class="auth-form" data-auth-signup hidden>
      <h3>Create Account</h3>
      <input data-auth-name type="text" placeholder="Name" />
      <input data-auth-email type="email" placeholder="Email" />
      <input data-auth-password type="password" placeholder="Password" />
      <button data-auth-action="signup">Create Account</button>
      <button data-auth-action="google">Continue with Google</button>
      <button data-auth-action="switch-to-signin">Already have an account?</button>
    </div>
    <!-- Forgot Password -->
    <div class="auth-form" data-auth-forgot hidden>
      <h3>Reset Password</h3>
      <input data-auth-email type="email" placeholder="Email" />
      <button data-auth-action="reset">Send Reset Link</button>
      <button data-auth-action="switch-to-signin">Back to Sign In</button>
    </div>
    <!-- Email Verification -->
    <div class="auth-form" data-auth-verify hidden>
      <h3>Verify Email</h3>
      <p>Check your email for a verification link.</p>
      <button data-auth-action="verify-simulate">Simulate Verification</button>
      <button data-auth-action="resend">Resend Email</button>
    </div>
    <!-- Error display -->
    <div class="auth-error" data-auth-error hidden></div>
    <!-- Close -->
    <button data-auth-close aria-label="Close">✕</button>
  </section>
</div>

<!-- Auth status in profile area -->
<!-- The existing profile-avatar button gets auth-aware behavior -->
```

Update the profile button to be auth-aware:
```html
<!-- Line 43 - update existing profile button -->
<button class="profile-avatar tooltip" aria-label="User profile" data-tooltip="Profile" data-auth-avatar></button>
```

### 12. Update `app.js`

Wire auth modals, guards, and session management.

**Auth state initialization** (after `settings` init):
```js
const STORAGE_KEY_AUTH = "launchly.auth.session";
let authState = createAuthState();
// Try to restore session on load
const savedSession = loadPersistedSession();
if (savedSession && validateSession(savedSession)) {
  // Session valid — authenticate silently
  const user = localAuthProvider.getProfile(savedSession.userId);
  if (user) authState = authenticateUser(authState, user, savedSession);
}
```

**Auth modal handlers**:
```js
// Open auth modal (triggered by guard)
function openAuthModal(form = "signin") {
  document.querySelector("[data-auth-backdrop]").hidden = false;
  document.querySelectorAll(".auth-form").forEach((f) => f.hidden = true);
  document.querySelector(`[data-auth-${form}]`).hidden = false;
}

function closeAuthModal() {
  document.querySelector("[data-auth-backdrop]").hidden = true;
}

// Sign In
document.querySelector("[data-auth-action='signin']")?.addEventListener("click", () => {
  const email = document.querySelector("[data-auth-signin] [data-auth-email]").value;
  const password = document.querySelector("[data-auth-signin] [data-auth-password]").value;
  const result = editor.signIn(email, password);
  if (result.error) { showAuthError(result.error); return; }
  closeAuthModal();
  renderAll();
});

// Sign Up
document.querySelector("[data-auth-action='signup']")?.addEventListener("click", () => {
  const name = document.querySelector("[data-auth-signup] [data-auth-name]").value;
  const email = document.querySelector("[data-auth-signup] [data-auth-email]").value;
  const password = document.querySelector("[data-auth-signup] [data-auth-password]").value;
  const result = editor.signUp(email, password, name);
  if (result.error) { showAuthError(result.error); return; }
  closeAuthModal();
  renderAll();
});

// Google
document.querySelector("[data-auth-action='google']")?.addEventListener("click", () => {
  const result = editor.signInWithGoogle();
  closeAuthModal();
  renderAll();
});

// Forgot password
document.querySelector("[data-auth-action='forgot']")?.addEventListener("click", () => {
  const email = document.querySelector("[data-auth-forgot] [data-auth-email]").value;
  editor.resetPassword(email);
  showToast("Reset link sent (simulated).");
});

// Sign out
document.querySelector("[data-auth-signout]")?.addEventListener("click", () => {
  editor.signOut();
  renderAll();
  showToast("Signed out.");
});
```

**Guard integration** — wrap protected action handlers:
```js
// Example: Export button
function handleExport() {
  const access = editor.canAccess("export");
  if (!access.allowed) { openAuthModal("signin"); showToast(access.message); return; }
  // ... existing export logic
}

// Example: AI tool run
function handleAiToolRun(toolId) {
  const access = editor.canAccess("aiTools");
  if (!access.allowed) { openAuthModal("signin"); showToast(access.message); return; }
  // ... existing AI tool logic
}

// Example: Plugin install
function handlePluginInstall(pluginId) {
  const access = editor.canAccess("plugins");
  if (!access.allowed) { openAuthModal("signin"); showToast(access.message); return; }
  // ... existing plugin logic
}
```

**Profile area auth awareness**:
```js
function renderProfileAvatar() {
  const avatar = document.querySelector("[data-auth-avatar]");
  if (!avatar) return;
  if (editor.isAuthenticated()) {
    const user = editor.getUser();
    avatar.textContent = (user.name || user.email).split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
    avatar.dataset.tooltip = `${user.name} (${user.role})`;
  } else {
    avatar.textContent = "G";
    avatar.dataset.tooltip = "Sign In";
    avatar.addEventListener("click", () => openAuthModal("signin"), { once: true });
  }
}
```

**Session auto-refresh**:
```js
setInterval(() => {
  if (editor.isAuthenticated()) editor.refreshSession();
}, 60 * 60 * 1000); // hourly
```

**Settings — Account section update**:
```js
account: `
  <div class="settings-section-head"><strong>Account</strong><span>${editor.isAuthenticated() ? `Signed in as ${editor.getUser().email}` : "Not signed in."}</span></div>
  <div class="settings-grid">
    ${editor.isAuthenticated() ? `
      ${settingsField("Name", "accountName", '<input data-setting value="' + (editor.getUser().name ?? settings.accountName) + '" />')}
      ${settingsField("Email", "accountEmail", '<span>' + editor.getUser().email + '</span>')}
      ${settingsField("Role", "accountRole", '<span>' + editor.getUser().role + '</span>')}
      ${settingsField("Email Status", "emailVerified", '<span>' + (editor.getUser().emailVerified ? '✓ Verified' : 'Unverified') + '</span>')}
      <button data-auth-signout class="settings-signout-btn">Sign Out</button>
    ` : `
      <button data-auth-action="signin" class="settings-signin-btn">Sign In</button>
      <button data-auth-action="signup" class="settings-signup-btn">Create Account</button>
    `}
  </div>`,
```

### 13. Update `styles.css`

Add auth modal styles (minimal — follows existing glass-panel pattern):

```css
.auth-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.auth-modal {
  width: min(400px, 90vw);
  padding: 28px;
  position: relative;
}

.auth-form {
  display: grid;
  gap: 12px;
}

.auth-form h3 { margin: 0 0 8px; }

.auth-form input {
  padding: 10px 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--soft);
  font-size: 13px;
}

.auth-form button {
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--soft);
  font-weight: 700;
  cursor: pointer;
}

.auth-form button[data-auth-action="google"] {
  background: rgba(66, 133, 244, 0.15);
  border-color: rgba(66, 133, 244, 0.3);
}

.auth-error {
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255, 100, 100, 0.15);
  color: #ff8888;
  font-size: 12px;
}

.auth-modal [data-auth-close] {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  color: var(--muted);
  font-size: 18px;
  cursor: pointer;
}

.settings-signout-btn {
  grid-column: 1 / -1;
  padding: 10px;
  border: 1px solid rgba(255, 100, 100, 0.2);
  border-radius: 10px;
  background: rgba(255, 100, 100, 0.1);
  color: #ff8888;
  font-weight: 700;
  cursor: pointer;
}
```

---

## Protected Areas — Guard Map

| Area | File | Guard Method | Min Role |
|------|------|-------------|----------|
| Export button | `app.js` handleExport() | `editor.canAccess("export")` | editor |
| AI tool run | `app.js` handleAiToolRun() | `editor.canAccess("aiTools")` | editor |
| Effect apply | `app.js` effect handlers | `editor.canAccess("effects")` | editor |
| Plugin install | `app.js` plugin handlers | `editor.canAccess("plugins")` | producer |
| Cloud sync | `app.js` sync handlers | `editor.canAccess("sync")` | producer |
| Billing view | `app.js` billing handlers | `editor.canAccess("billing")` | producer |
| Admin settings | `app.js` settings | `editor.canAccess("userManagement")` | admin |
| Settings write | `app.js` settings | `editor.canAccess("settings")` | editor |

## Data Shape — Complete Auth State

```js
{
  auth: {
    status: "unauthenticated" | "authenticated" | "loading" | "email_unverified",
    user: {
      id, email, name, avatar, role, emailVerified, provider, createdAt, lastLoginAt
    },
    session: {
      id, userId, token, createdAt, expiresAt, lastActivityAt, provider, device
    },
    error: string | null,
    loading: boolean,
    pendingVerificationEmail: string | null,
    passwordResetEmail: string | null,
  }
}
```

---

## What This Does NOT Do
- No real backend auth server
- No JWT signing/verification (token is opaque string)
- No OAuth redirect flow (Google is stubbed)
- No email sending (all "simulated")
- No password hashing (stored as plaintext in localStorage for local provider)
- No CSRF protection
- No rate limiting

## What This DOES Do
- Complete auth state model with user, session, and status
- Sign In / Sign Up / Forgot Password / Email Verification flows
- Google OAuth provider stub (architecture ready for real OAuth)
- Session persistence with expiry and auto-refresh
- Role-based access control (viewer → editor → producer → admin)
- Route guard system mapping features to required roles/permissions
- Auth modals integrated into existing UI patterns (no redesign)
- Profile area shows auth status and triggers sign-in when unauthenticated
- Every protected feature (export, AI, effects, plugins, sync, billing, admin) checks auth before execution
- Session lifecycle: create, validate, refresh, destroy, persist, restore
- Foundation for future Stripe + backend integration
