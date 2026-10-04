# Monitor connections

The existing two-panel Monitor layout is retained. Window and AI connection
states are independent. Messages require both a live capture and a verified AI
connection. A provider error or limit disables sending until reconnection.

## Window preview

`getDisplayMedia` supplies a real MediaStream to the mounted video via
`srcObject`. The video is visible while initializing, with autoplay, muted and
playsInline enabled. Metadata triggers playback; only decoded video dimensions
and playable data establish Connected. Track ending, playback failure, unmount,
late picker results and missing frames are handled explicitly. Muted tracks
show a warning. Stopping sharing cancels outstanding Monitor work.

## Backend AI path

Deploy the frontend and subscription Worker together. The existing Supabase
`monitor_provider_keys` migration and `MONITOR_ENCRYPTION_KEY` (base64 of 32
random bytes) are required. API keys are validated with the provider, encrypted
with AES-GCM and stored per authenticated user. No model request from Monitor
uses a frontend/localStorage API key.

- POST `/api/monitor/providers/:provider`: validate and encrypt a new API key.
- POST `/api/monitor/providers/:provider/verify`: revalidate a saved connection.
- GET `/api/monitor/providers`: return verified, non-secret connection metadata.
- POST `/api/monitor/chat`: send the live frame, conversation and selected model
  using that user's stored key. Returns text, provider, connection type and model.
- Existing `/api/monitor/agent/tasks` and device pairing are reused for real
  computer control. A project is not required for screen tasks. Without a paired
  agent, chat can explain the shared window but cannot click or type.

Provider errors include `PROVIDER_LIMITED`, `PROVIDER_AUTH_ERROR`, or
`PROVIDER_ERROR`, with provider and connection type. Real HTTP 429 responses and
recognized provider quota/credit errors yield Limited. API limits are labelled
as API limits. The subscription warning is reserved for a backend-reported
subscription connection; there is no fabricated usage counter.

## Subscription support (checked 2026-10-02)

This installation has no registered subscription authorization integration.
Subscription choices therefore show **Subscription connection not supported —
connect API instead**, with a button into the existing API-key flow. Opening a
provider website never authorizes anything.

OpenAI now documents ChatGPT plan usage for eligible integrations, including
open-source clients and selected commercial/private partners. A general website
must not assume eligibility or repurpose a first-party client ID. Before enabling
this for Launchly, obtain its approved registration and implement its registered
OAuth/PKCE callback, server-side token exchange/storage and authorized inference
contract. Identity-only login does not grant model usage.

- https://developers.openai.com/siwc/quickstart
- https://code.claude.com/docs/en/legal-and-compliance#authentication-and-credential-use

Anthropic's documented third-party API path uses API keys, not collected Claude
subscription credentials. Running the unmodified Claude Code product is a
different integration from this website's direct model requests.

## Validation

Targeted frontend and Worker tests cover real-stream attachment, metadata/play
ordering, cancellation, late events, encrypted storage, credential verification,
selected-provider routing, revoked keys, actual upstream rate/quota responses,
asynchronous agent-task errors and API fallback. Run:

```
npx vitest run src/pages/dashboard/__tests__/MonitorPanel.test.tsx src/pages/dashboard/__tests__/MonitorBackend.test.ts src/pages/dashboard/__tests__/CodingConnectionModal.test.tsx
npm --prefix subscription-backend/worker test
npm run build
```

A local Chromium smoke test used the actual Screen Capture API to capture a
separate browser tab at 1280×800. Captured pixels changed from green to red with
the source; closing the source ended sharing. The AI half of that browser test
used mocked backend responses. Live paid provider inference and deployment have
not been exercised with a user's credentials.
