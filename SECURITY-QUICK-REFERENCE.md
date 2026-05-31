# 🔒 Security Scanning — Quick Reference

Fast lookup guide for common security tasks.

## Commands

```bash
# Check for vulnerabilities
npm run audit

# Check for high severity only
npm run audit:high

# Fix vulnerabilities automatically
npm run audit:fix

# Force major version updates (use with caution)
npm run audit:fix:force

# Run full security check
npm run security:check
```

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| security-audit.yml | Every PR, daily on main | npm audit + Snyk scanning |
| security-patches.yml | Daily at 3 AM UTC | Auto-create PRs for patches |
| dependabot.yml | Mondays at 3 AM UTC | Weekly dependency updates |
| ci.yml | Every PR and push | Lint, tests, security check |

## PR Blocking

PRs are blocked if:
- ❌ Critical severity vulnerabilities found
- ❌ High severity vulnerabilities found

**Fix:** Run `npm audit fix` and commit changes

## Severity Levels

| Level | CVSS | Action | Timeline |
|-------|------|--------|----------|
| Critical | 9.0-10.0 | ❌ Block PR | Immediate |
| High | 7.0-8.9 | ❌ Block PR | 24 hours |
| Moderate | 4.0-6.9 | ✅ Allow | 2 weeks |
| Low | 0.1-3.9 | ✅ Allow | Regular updates |

## Common Issues

### PR Blocked by Security Check

```bash
# 1. Check what's wrong
npm run audit:high

# 2. Fix vulnerabilities
npm audit fix

# 3. Commit and push
git add package.json package-lock.json
git commit -m "chore: fix security vulnerabilities"
git push
```

### Snyk Scan Fails

1. Check `SNYK_TOKEN` is set in GitHub Secrets
2. Verify token is valid at snyk.io
3. Check token has correct permissions

### Dependabot PR Not Creating

1. Wait for next scheduled run (Mondays 3 AM UTC)
2. Check `.github/dependabot.yml` syntax
3. Verify Dependabot is enabled in repository

### False Positive Vulnerability

1. Review vulnerability details
2. Verify it doesn't affect your code
3. Document in `docs/SECURITY.md` as accepted risk

## Files

| File | Purpose |
|------|---------|
| `.github/workflows/security-audit.yml` | npm audit + Snyk |
| `.github/workflows/security-patches.yml` | Auto patch creation |
| `.github/dependabot.yml` | Dependency updates |
| `docs/SECURITY.md` | Security policies |
| `docs/SECURITY-SETUP.md` | Setup guide |
| `.github/SECURITY-WORKFLOWS.md` | Workflow details |

## Secrets

| Secret | Purpose | Where |
|--------|---------|-------|
| `SNYK_TOKEN` | Snyk API auth | Settings → Secrets |

## Monitoring

- **GitHub Actions** — View workflow runs and logs
- **Artifacts** — Download security reports (30-90 day retention)
- **PR Comments** — Automatic vulnerability summaries
- **Slack** — Optional notifications (if configured)

## Documentation

- 📖 [SECURITY.md](docs/SECURITY.md) — Policies
- 📖 [SECURITY-SETUP.md](docs/SECURITY-SETUP.md) — Setup
- 📖 [SECURITY-WORKFLOWS.md](.github/SECURITY-WORKFLOWS.md) — Workflows
- 📖 [SECURITY-README.md](.github/SECURITY-README.md) — Overview
- 📖 [IMPLEMENTATION-SUMMARY.md](IMPLEMENTATION-SUMMARY.md) — Full details

## Support

- 📧 Email: security@petchain.app
- 🐛 Issues: Use `security` label
- 📋 Templates: `.github/ISSUE_TEMPLATE/`

## Checklist for Developers

Before committing:

- [ ] Run `npm run security:check`
- [ ] No hardcoded secrets
- [ ] All inputs validated
- [ ] Database queries parameterized
- [ ] Auth/authz checks in place
- [ ] No sensitive data in logs
- [ ] Dependencies up-to-date

---

**Last Updated:** May 28, 2026
