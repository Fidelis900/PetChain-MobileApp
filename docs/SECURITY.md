# PetChain Security Posture

This document describes the security controls implemented in the PetChain backend and the procedures for ongoing security maintenance.

---

## 1. Security Headers

All HTTP responses are hardened with [Helmet.js](https://helmetjs.github.io/) (`backend/middleware/securityHeaders.ts`).

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | `default-src 'none'; script-src 'self'; ...` | Restrict resource origins; mitigate XSS |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS; enable HSTS preload list (production) |
| `X-Frame-Options` | `DENY` (via `frameAncestors 'none'`) | Prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME-type sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Restrict browser features |
| `X-Powered-By` | *(removed)* | Hide framework fingerprint |

### Content Security Policy

The CSP follows a **deny-by-default** strategy:

```
default-src 'none';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https://cdn.petchain.app;
font-src 'self';
connect-src 'self' https://api.petchain.app https://staging.petchain.app;
media-src 'self';
object-src 'none';
frame-src 'none';
frame-ancestors 'none';
form-action 'self';
base-uri 'self';
upgrade-insecure-requests;   (production only)
```

To add a trusted third-party origin, set the `ALLOWED_ORIGINS` environment variable (comma-separated):

```bash
ALLOWED_ORIGINS=https://partner.example.com,https://cdn.example.com
```

### HSTS Pre-loading

HSTS is enabled only in `production` (`NODE_ENV=production`). Before submitting to the HSTS preload list:

1. Confirm the `max-age` has been live for ≥ 18 weeks.
2. Verify `includeSubDomains` is appropriate for all sub-domains.
3. Submit at [hstspreload.org](https://hstspreload.org).

---

## 2. Input Sanitization

All request bodies, query strings, and route parameters are sanitized by `backend/middleware/sanitize.ts` before they reach route handlers:

- **XSS stripping** — HTML tags and `on*` / `javascript:` / `data:` attribute patterns are removed.
- **SQL injection detection** — Requests containing SQL keywords or injection operators are rejected with `400 INVALID_INPUT`.
- **Length truncation** — Individual string fields are capped at `MAX_INPUT_LENGTH` (10 000 chars).

### Field-level Whitelisting

Route handlers that accept structured identifiers should additionally validate with `inputWhitelist` from `backend/middleware/securityHeaders.ts`:

```ts
import { isWhitelisted } from '../middleware/securityHeaders';

if (!isWhitelisted('uuid', req.params.petId)) {
  return sendError(res, 400, 'INVALID_INPUT', 'petId must be a valid UUID');
}
```

Available rules: `name`, `email`, `uuid`, `date`, `positiveInt`, `identifier`.

---

## 3. Parameterized Query Audit

All database access **must** use parameterized queries. The following patterns are prohibited:

```ts
// PROHIBITED — string concatenation
db.query(`SELECT * FROM pets WHERE id = '${id}'`);

// REQUIRED — parameterized
db.query('SELECT * FROM pets WHERE id = $1', [id]);
```

The repository layer in `backend/src/repositories/` enforces this via the pg `Pool` / `PoolClient` API with positional parameters (`$1`, `$2`, …). Any new repository method must follow the same pattern.

---

## 4. Authentication & Authorization

- **JWT** tokens are verified on every protected route via `backend/middleware/auth.ts`.
- Tokens are signed with `config.app.jwtSecret`; this secret must be ≥ 32 random bytes in production.
- Role-based access control (RBAC) is enforced via `authorizeRoles(...)` middleware.
- Passwords are hashed with **bcrypt** (cost factor ≥ 12).

---

## 5. OWASP ZAP Scanning

Run ZAP against a local instance before each release:

```bash
# Start the backend
NODE_ENV=development tsx backend/server/index.ts &

# Active scan (replace <port> as needed)
docker run --rm --network host \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-full-scan.py \
  -t http://localhost:3000 \
  -r zap-report.html \
  -l WARN
```

**Acceptance criteria:** zero High findings, zero Medium findings in the ZAP HTML report before merging to `main`.

Findings and remediations are tracked in the GitHub Security Advisories section of this repository.

---

## 6. Dependency Auditing & Vulnerability Scanning

### Automated Scanning

The project uses multiple layers of automated dependency vulnerability scanning:

#### npm audit
- Runs on every PR and daily on main branch
- Blocks PRs with critical or high severity vulnerabilities
- Generates detailed vulnerability reports

```bash
npm audit --audit-level=high
```

#### Snyk Integration
- Advanced vulnerability scanning with threat intelligence
- Detects vulnerabilities in transitive dependencies
- Provides remediation guidance
- Requires `SNYK_TOKEN` secret in GitHub

#### Dependabot
- Automated dependency updates (weekly)
- Automatic PR creation for available patches
- Configured in `.github/dependabot.yml`
- Covers npm packages and GitHub Actions

### Security Patch Process

1. **Automated Detection**: Dependabot and npm audit detect vulnerabilities
2. **Patch Creation**: Security patches workflow auto-creates PRs with fixes
3. **Review & Test**: Team reviews changes and runs full test suite
4. **Merge**: Once CI passes and review is approved, merge to main
5. **Deploy**: Changes are automatically deployed via CD pipeline

### Manual Audit

Run locally to check for vulnerabilities:

```bash
# Check for vulnerabilities
npm audit

# Automatically fix vulnerabilities
npm audit fix

# Force major version updates (use with caution)
npm audit fix --force
```

### Handling Vulnerabilities

**Critical or High Severity:**
- Must be fixed immediately
- PRs with unresolved critical/high vulnerabilities are blocked
- If no patch is available, consider alternative packages

**Moderate Severity:**
- Should be addressed within 2 weeks
- Plan updates during regular maintenance windows

**Low Severity:**
- Address during regular dependency updates
- Document any accepted risks

### Accepted Risks

If a vulnerability cannot be fixed (e.g., no patch available, breaking changes), document it:

```markdown
## Accepted Risk: [CVE-XXXX-XXXXX]

**Package:** [package-name]
**Severity:** [Critical/High/Moderate]
**Reason:** [Explanation of why risk is accepted]
**Mitigation:** [Compensating controls]
**Review Date:** [Date for re-evaluation]
```

---

## 7. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `development` / `staging` / `production` |
| `JWT_SECRET` | Yes | ≥ 32 random bytes, base64-encoded |
| `QR_SIGNING_SECRET` | Yes | ≥ 32 random bytes for HMAC QR signing |
| `ALLOWED_ORIGINS` | No | Extra CSP `connect-src` origins (comma-separated) |
| `SNYK_TOKEN` | No | Snyk API token for vulnerability scanning |

See `.env.example` for the full list.

---

## 8. CI/CD Security

### Workflows

- **security-audit.yml** — Runs npm audit and Snyk on every PR and daily
- **security-patches.yml** — Auto-creates PRs for available security patches
- **ci.yml** — Lint, typecheck, and tests on every PR
- **deploy.yml** — Production build and deployment

### Branch Protection

Main branch requires:
- ✅ All CI checks pass (lint, tests, security audit)
- ✅ No critical or high severity vulnerabilities
- ✅ Code review approval
- ✅ Up-to-date with base branch

---

## 9. Reporting a Vulnerability

Please report security vulnerabilities via GitHub's private vulnerability reporting tool or by e-mailing **security@petchain.app**. Do not open public issues for security problems.

### Responsible Disclosure

- Allow 90 days for a fix before public disclosure
- Provide detailed reproduction steps
- Include affected versions
- Suggest remediation if possible

---

## 10. Security Checklist for Developers

Before committing code:

- [ ] No hardcoded secrets or credentials
- [ ] All user inputs are validated and sanitized
- [ ] Database queries use parameterized statements
- [ ] Authentication/authorization checks are in place
- [ ] Error messages don't leak sensitive information
- [ ] Dependencies are up-to-date and vulnerability-free
- [ ] No console.log statements with sensitive data
- [ ] HTTPS is enforced in production
- [ ] Security headers are properly configured

---

## 11. Security Incident Response

In case of a security incident:

1. **Assess** — Determine scope and severity
2. **Contain** — Limit exposure and prevent further damage
3. **Eradicate** — Remove the vulnerability or malicious code
4. **Recover** — Restore systems to normal operation
5. **Review** — Conduct post-incident analysis
6. **Communicate** — Notify affected users if necessary

Contact: security@petchain.app
