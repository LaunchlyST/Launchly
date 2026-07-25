# Launchly — Pre-Launch Checklist

> **Status:** Pre-launch
> **Scope:** All production environments
> **Last updated:** 2026-07-22

---

## 1. Authentication

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 1.1 | User registration flow (email + password) | Auth | ☐ | Verify email confirmation required |
| 1.2 | Login flow with persistent session | Auth | ☐ | Session token storage in httpOnly cookie |
| 1.3 | Password reset (email link) | Auth | ☐ | Token expires in 1 hour |
| 1.4 | Password strength requirements | Auth | ☐ | Min 8 chars, 1 uppercase, 1 number |
| 1.5 | Session timeout (idle) | Auth | ☐ | 30 min idle timeout, warn at 25 min |
| 1.6 | Session refresh on activity | Auth | ☐ | Silent token refresh |
| 1.7 | Logout (clears session + local data) | Auth | ☐ | Server-side session invalidation |
| 1.8 | OAuth providers (Google, GitHub) | Auth | ☐ | If applicable |
| 1.9 | Two-factor authentication (TOTP) | Auth | ☐ | Optional, QR code setup |
| 1.10 | Account lockout after failed attempts | Auth | ☐ | 5 attempts → 15 min lockout |
| 1.11 | Email verification enforcement | Auth | ☐ | Block unverified emails from editing |
| 1.12 | Session token rotation | Auth | ☐ | Rotate on each request |

## 2. Payments

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 2.1 | Stripe integration (checkout + billing) | Payments | ☐ | Use Stripe Checkout for new subscriptions |
| 2.2 | Pricing page with all tiers | Payments | ☐ | Free, Pro, Team plans |
| 2.3 | Subscription management (upgrade/downgrade) | Payments | ☐ | Prorated billing |
| 2.4 | Payment method management (add/remove cards) | Payments | ☐ | Stripe Customer Portal |
| 2.5 | Invoice generation and email | Payments | ☐ | PDF invoices via Stripe |
| 2.6 | Tax calculation (VAT, sales tax) | Payments | ☐ | Stripe Tax or similar |
| 2.7 | Trial period (if applicable) | Payments | ☐ | 7-day free trial |
| 2.8 | Grace period for failed payments | Payments | ☐ | 3 days before suspension |
| 2.9 | Webhook handling (payment success/failure) | Payments | ☐ | Verify webhook signatures |
| 2.10 | Refund policy documented | Payments | ☐ | 7-day money-back guarantee |
| 2.11 | Currency support | Payments | ☐ | USD, EUR, GBP minimum |
| 2.12 | PCI compliance verification | Payments | ☐ | SAQ-A via Stripe Checkout |

## 3. AI Providers

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 3.1 | API key management (secure storage) | AI | ☐ | Server-side, never in client |
| 3.2 | Rate limiting per user | AI | ☐ | e.g., 100 calls/day for free tier |
| 3.3 | Cost tracking and alerts | AI | ☐ | Budget alerts at 80% usage |
| 3.4 | Fallback providers | AI | ☐ | OpenAI → Anthropic → local |
| 3.5 | Usage quotas by plan | AI | ☐ | Free: 100, Pro: 1000, Team: 10000 |
| 3.6 | Error handling for provider failures | AI | ☐ | Graceful degradation |
| 3.7 | Prompt injection protection | AI | ☐ | Sanitize user prompts |
| 3.8 | Content moderation for AI output | AI | ☐ | Filter harmful content |
| 3.9 | AI usage analytics | AI | ☐ | Track popular tools, costs |
| 3.10 | Local-only mode (no external API) | AI | ☐ | For privacy-focused users |

## 4. Export

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 4.1 | Real video encoding pipeline | Engineering | ☐ | MediaRecorder API or FFmpeg.wasm |
| 4.2 | File download (Blob URL) | Engineering | ☐ | Trigger `<a download>` |
| 4.3 | Export progress tracking | Engineering | ☐ | Real progress, not simulated |
| 4.4 | Format validation (codec/format matrix) | Engineering | ☐ | ProRes only in MOV, etc. |
| 4.5 | Export cancel functionality | Engineering | ☐ | AbortController |
| 4.6 | Export queue management | Engineering | ☐ | Multiple exports in queue |
| 4.7 | Export history (recent exports) | Engineering | ☐ | Persist to localStorage |
| 4.8 | File size estimation | Engineering | ☐ | Before export starts |
| 4.9 | Export quality presets | Engineering | ☐ | Low/Medium/High/Custom |
| 4.10 | Background export (tab close safe) | Engineering | ☐ | Service worker or web worker |

## 5. Projects

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 5.1 | Create new project | Engineering | ☐ | With name, description |
| 5.2 | Save project (auto + manual) | Engineering | ☐ | IndexedDB + localStorage |
| 5.3 | Load project from storage | Engineering | ☐ | Full state restoration |
| 5.4 | Delete project (with confirmation) | Engineering | ☐ | Move to trash, then purge |
| 5.5 | Project version history | Engineering | ☐ | Max 30 versions |
| 5.6 | Restore from version history | Engineering | ☐ | Creates recovery point |
| 5.7 | Project sharing (invite collaborators) | Engineering | ☐ | If multi-user |
| 5.8 | Project import/export (.launchly file) | Engineering | ☐ | Serialize/deserialize |
| 5.9 | Project templates | Engineering | ☐ | Starter templates |
| 5.10 | Project search and filter | Engineering | ☐ | By name, date, tags |
| 5.11 | Project folders and organization | Engineering | ☐ | Folder hierarchy |
| 5.12 | Project duplicate | Engineering | ☐ | Copy with new ID |

## 6. Storage

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 6.1 | localStorage quota monitoring | Engineering | ☐ | Warn at 80% capacity |
| 6.2 | IndexedDB storage management | Engineering | ☐ | Schema versioning |
| 6.3 | Storage cleanup policies | Engineering | ☐ | Remove old exports, temp files |
| 6.4 | Offline mode (cache assets) | Engineering | ☐ | Service worker caching |
| 6.5 | Cloud storage integration | Engineering | ☐ | If sync is implemented |
| 6.6 | Storage quota display | Engineering | ☐ | In settings panel |
| 6.7 | Export file cleanup | Engineering | ☐ | Remove downloaded files after X days |
| 6.8 | Backup to cloud (auto) | Engineering | ☐ | If sync is implemented |
| 6.9 | Storage encryption (if sensitive) | Engineering | ☐ | Encrypt project data |
| 6.10 | Migration from localStorage to IndexedDB | Engineering | ☐ | For large projects |

## 7. Security

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 7.1 | XSS prevention (escapeHtml on all innerHTML) | Security | ☐ | Fix 13+ unescaped injection points |
| 7.2 | Remove `window.launchlyEditor` global | Security | ☐ | Critical exposure |
| 7.3 | Content Security Policy (CSP) header | Security | ☐ | `default-src 'self'` |
| 7.4 | X-Content-Type-Options: nosniff | Security | ☐ | Server config |
| 7.5 | X-Frame-Options: DENY | Security | ☐ | Prevent clickjacking |
| 7.6 | Strict-Transport-Security (HSTS) | Security | ☐ | Max-age >= 31536000 |
| 7.7 | Input validation (all numeric inputs) | Security | ☐ | Clamp, validate, sanitize |
| 7.8 | JSON.parse try/catch (all locations) | Security | ☐ | Fix 2 unprotected calls |
| 7.9 | Dependency vulnerability scan | Security | ☐ | `npm audit` / Snyk |
| 7.10 | Session token security | Security | ☐ | httpOnly, Secure, SameSite |
| 7.11 | CSRF protection | Security | ☐ | Anti-CSRF tokens |
| 7.12 | Rate limiting on auth endpoints | Security | ☐ | Prevent brute force |
| 7.13 | Security headers audit | Security | ☐ | Use securityheaders.com |
| 7.14 | Penetration testing | Security | ☐ | External audit |

## 8. Privacy

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 8.1 | Privacy Policy published | Legal | ☐ | GDPR, CCPA compliant |
| 8.2 | Data Processing Agreement (DPA) | Legal | ☐ | For EU users |
| 8.3 | User data export (GDPR Article 20) | Engineering | ☐ | JSON export of all user data |
| 8.4 | Account deletion (GDPR Article 17) | Engineering | ☐ | Complete data purge |
| 8.5 | Data retention policy | Legal | ☐ | Define retention periods |
| 8.6 | Cookie consent management | Engineering | ☐ | Granular consent |
| 8.7 | Analytics opt-out | Engineering | ☐ | Respect Do Not Track |
| 8.8 | Third-party data processor list | Legal | ☐ | Stripe, analytics, etc. |
| 8.9 | Privacy notice in app | Legal | ☐ | Link in footer |
| 8.10 | Age verification (COPPA) | Legal | ☐ | Block under-13 users |

## 9. Terms

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 9.1 | Terms of Service published | Legal | ☐ | Cover usage, liability, IP |
| 9.2 | Acceptable Use Policy | Legal | ☐ | Prohibited content |
| 9.3 | Refund policy documented | Legal | ☐ | In ToS |
| 9.4 | Disclaimer of warranties | Legal | ☐ | In ToS |
| 9.5 | Limitation of liability | Legal | ☐ | In ToS |
| 9.6 | Governing law and jurisdiction | Legal | ☐ | Specify in ToS |
| 9.7 | Terms acceptance on signup | Legal | ☐ | Checkbox required |
| 9.8 | Terms update notification | Legal | ☐ | Email + in-app |

## 10. Cookie Banner

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 10.1 | Cookie consent banner displayed | Engineering | ☐ | On first visit |
| 10.2 | Cookie categories (essential/analytics/marketing) | Engineering | ☐ | Granular consent |
| 10.3 | Accept/Reject all buttons | Engineering | ☐ | Clear choices |
| 10.4 | Cookie policy link | Engineering | ☐ | Detailed cookie list |
| 10.5 | Consent preference center | Engineering | ☐ | Change preferences anytime |
| 10.6 | Consent log (audit trail) | Engineering | ☐ | Store consent records |
| 10.7 | Google Analytics opt-out | Engineering | ☐ | Respect analytics consent |
| 10.8 | Third-party cookie disclosure | Engineering | ☐ | Stripe, analytics |

## 11. Analytics

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 11.1 | Event tracking plan defined | Product | ☐ | Key events: signup, export, project create |
| 11.2 | Page view tracking | Engineering | ☐ | With consent |
| 11.3 | User behavior funnel tracking | Engineering | ☐ | Signup → project → export |
| 11.4 | Error tracking integration | Engineering | ☐ | Sentry, LogRocket |
| 11.5 | Performance metrics (Core Web Vitals) | Engineering | ☐ | LCP, FID, CLS |
| 11.6 | Feature usage analytics | Engineering | ☐ | Which tools are popular |
| 11.7 | Cohort analysis setup | Engineering | ☐ | Retention tracking |
| 11.8 | Analytics data retention policy | Engineering | ☐ | 25 months max |
| 11.9 | PII exclusion in analytics | Engineering | ☐ | No emails, names in events |
| 11.10 | Analytics opt-out mechanism | Engineering | ☐ | Respect consent |

## 12. Error Logging

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 12.1 | Client-side error capture | Engineering | ☐ | `window.onerror`, `unhandledrejection` |
| 12.2 | Server-side error logging | Engineering | ☐ | Structured logs |
| 12.3 | Error alerting (critical errors) | Engineering | ☐ | Slack/email alerts |
| 12.4 | Error rate monitoring | Engineering | ☐ | Alert at >1% error rate |
| 12.5 | Stack trace capture | Engineering | ☐ | Source maps for minified JS |
| 12.6 | User context in errors | Engineering | ☐ | User ID, plan, actions |
| 12.7 | Error deduplication | Engineering | ☐ | Group similar errors |
| 12.8 | Sensitive data redaction | Engineering | ☐ | No passwords, tokens in logs |
| 12.9 | Error log retention policy | Engineering | ☐ | 90 days |
| 12.10 | Error log search interface | Engineering | ☐ | For debugging |

## 13. Crash Reporting

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 13.1 | Session replay (if applicable) | Engineering | ☐ | LogRocket, FullStory |
| 13.2 | Crash rate monitoring | Engineering | ☐ | Alert at >0.5% crash rate |
| 13.3 | User impact analysis | Engineering | ☐ | How many users affected |
| 13.4 | Automatic issue creation | Engineering | ☐ | Jira/GitHub from crashes |
| 13.5 | Release health dashboard | Engineering | ☐ | Per-version crash rates |
| 13.6 | Breadcrumb trail | Engineering | ☐ | Actions before crash |
| 13.7 | Crash reporting opt-out | Engineering | ☐ | Respect privacy consent |

## 14. Monitoring

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 14.1 | Uptime monitoring | DevOps | ☐ | 99.9% SLA target |
| 14.2 | Response time monitoring | DevOps | ☐ | <200ms for API |
| 14.3 | Database performance monitoring | DevOps | ☐ | Query times, connections |
| 14.4 | CDN performance monitoring | DevOps | ☐ | Cache hit rates |
| 14.5 | Memory/CPU usage monitoring | DevOps | ☐ | Alert at 80% |
| 14.6 | Disk space monitoring | DevOps | ☐ | Alert at 85% |
| 14.7 | SSL certificate expiration | DevOps | ☐ | Alert 30 days before expiry |
| 14.8 | Third-party service health | DevOps | ☐ | Stripe, AI providers |
| 14.9 | Custom application metrics | DevOps | ☐ | Active users, projects |
| 14.10 | Dashboard for all metrics | DevOps | ☐ | Grafana, Datadog |

## 15. CDN

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 15.1 | Static asset CDN configured | DevOps | ☐ | CloudFront, Cloudflare |
| 15.2 | Cache headers set (static assets) | DevOps | ☐ | 1 year for hashed files |
| 15.3 | Cache invalidation on deploy | DevOps | ☐ | Auto-invalidate |
| 15.4 | Edge locations configured | DevOps | ☐ | Global coverage |
| 15.5 | CDN failover configured | DevOps | ☐ | Fallback to origin |
| 15.6 | Compression (gzip/brotli) | DevOps | ☐ | For all text assets |
| 15.7 | Image optimization | DevOps | ☐ | WebP, responsive images |
| 15.8 | CDN security (WAF) | DevOps | ☐ | Block common attacks |
| 15.9 | CDN cost monitoring | DevOps | ☐ | Budget alerts |
| 15.10 | Origin shield configured | DevOps | ☐ | Reduce origin load |

## 16. Deployment

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 16.1 | CI/CD pipeline configured | DevOps | ☐ | GitHub Actions, GitLab CI |
| 16.2 | Staging environment | DevOps | ☐ | Mirror of production |
| 16.3 | Production deployment script | DevOps | ☐ | Automated, repeatable |
| 16.4 | Rollback procedure | DevOps | ☐ | One-click rollback |
| 16.5 | Blue-green deployment | DevOps | ☐ | Zero-downtime deploys |
| 16.6 | Health checks configured | DevOps | ☐ | Pre-flight checks |
| 16.7 | Database migration system | DevOps | ☐ | Versioned migrations |
| 16.8 | Feature flags system | DevOps | ☐ | Toggle features safely |
| 16.9 | Deploy notifications | DevOps | ☐ | Slack on deploy |
| 16.10 | Post-deploy smoke tests | DevOps | ☐ | Verify critical paths |

## 17. Backups

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 17.1 | Database backup schedule | DevOps | ☐ | Daily full, hourly incremental |
| 17.2 | File storage backup | DevOps | ☐ | User uploads, exports |
| 17.3 | Backup encryption | DevOps | ☐ | At rest |
| 17.4 | Backup retention policy | DevOps | ☐ | 30 days daily, 12 months monthly |
| 17.5 | Backup restore testing | DevOps | ☐ | Monthly restore drills |
| 17.6 | Cross-region backup | DevOps | ☐ | Disaster recovery |
| 17.7 | Backup integrity verification | DevOps | ☐ | Checksum validation |
| 17.8 | Backup alerting | DevOps | ☐ | Failed backup alerts |
| 17.9 | RTO/RPO defined | DevOps | ☐ | RTO: 4 hours, RPO: 1 hour |
| 17.10 | Disaster recovery plan | DevOps | ☐ | Documented procedures |

## 18. Environment Variables

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 18.1 | Secrets management (Vault, etc.) | DevOps | ☐ | No secrets in code |
| 18.2 | Environment separation | DevOps | ☐ | dev/staging/prod |
| 18.3 | Config validation on startup | DevOps | ☐ | Fail fast on missing config |
| 18.4 | Secret rotation procedure | DevOps | ☐ | Documented |
| 18.5 | No secrets in git history | DevOps | ☐ | git-secrets or trufflehog |
| 18.6 | Environment-specific configs | DevOps | ☐ | No hardcoded URLs |
| 18.7 | Secret injection at runtime | DevOps | ☐ | Never in container image |
| 18.8 | Config change audit log | DevOps | ☐ | Track config changes |
| 18.9 | Default values for non-sensitive config | DevOps | ☐ | In code |
| 18.10 | Config documentation | DevOps | ☐ | All env vars documented |

## 19. Rate Limits

| # | Task | Owner | Status | Notes |
|---|------|-------|--------|-------|
| 19.1 | API rate limiting | Engineering | ☐ | 100 req/min per user |
| 19.2 | Auth endpoint rate limiting | Engineering | ☐ | 5 attempts/min |
| 19.3 | Export rate limiting | Engineering | ☐ | 5 exports/hour free tier |
| 19.4 | AI API rate limiting | Engineering | ☐ | Per plan tier |
| 19.5 | Upload rate limiting | Engineering | ☐ | 100MB/min |
| 19.6 | Rate limit headers (Retry-After) | Engineering | ☐ | Standard HTTP headers |
| 19.7 | Rate limit bypass for premium | Engineering | ☐ | Higher limits |
| 19.8 | Rate limit monitoring | Engineering | ☐ | Alert on abuse patterns |
| 19.9 | Client-side rate limit handling | Engineering | ☐ | Show friendly errors |
| 19.10 | DDoS protection | DevOps | ☐ | Cloudflare, AWS Shield |

---

## Pre-Launch Priority Matrix

| Priority | Items | Must be done before launch |
|----------|-------|---------------------------|
| **P0 — Critical** | 1.1-1.3, 2.1-2.3, 3.1-3.2, 4.1-4.4, 5.1-5.3, 7.1-7.8, 8.1-8.2, 9.1-9.3, 12.1-12.4 | Without these, the app is non-functional or insecure |
| **P1 — High** | 1.4-1.6, 2.4-2.6, 3.3-3.4, 4.5-4.6, 5.4-5.6, 6.1-6.2, 7.9-7.14, 8.3-8.5, 10.1-10.3, 11.1-11.4, 13.1-13.2, 14.1-14.4, 15.1-15.3, 16.1-16.4, 17.1-17.2, 18.1-18.3, 19.1-19.3 | Without these, the app is risky or incomplete |
| **P2 — Medium** | All remaining items | Can be done post-launch with monitoring |

## Launch Readiness Gate

Before flipping the "launch" switch, all **P0** items must be complete, and at least 80% of **P1** items must be complete. The remaining **P2** items must have a post-launch timeline.
