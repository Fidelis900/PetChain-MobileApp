# Security Scanning Setup Guide

This guide explains how to set up and configure automated dependency vulnerability scanning for PetChain.

## Overview

The security scanning system consists of three main components:

1. **npm audit** — Built-in Node.js dependency vulnerability scanner
2. **Snyk** — Advanced vulnerability detection with threat intelligence
3. **Dependabot** — Automated dependency updates and patch creation

## Prerequisites

- GitHub repository with Actions enabled
- Node.js 20+ installed locally
- npm 10+ installed locally

## Setup Instructions

### 1. Enable GitHub Actions

Ensure GitHub Actions is enabled in your repository:

1. Go to **Settings** → **Actions** → **General**
2. Select **Allow all actions and reusable workflows**
3. Click **Save**

### 2. Configure Snyk Integration (Optional but Recommended)

Snyk provides advanced vulnerability scanning beyond npm audit.

#### Step 1: Create Snyk Account

1. Visit [snyk.io](https://snyk.io)
2. Sign up with GitHub account
3. Authorize Snyk to access your repositories

#### Step 2: Get Snyk API Token

1. Go to [Snyk Settings](https://app.snyk.io/account/settings)
2. Click **Auth Token**
3. Copy your token

#### Step 3: Add GitHub Secret

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `SNYK_TOKEN`
4. Value: Paste your Snyk token
5. Click **Add secret**

#### Step 4: Enable Snyk GitHub Integration (Optional)

1. In Snyk, go to **Integrations** → **GitHub**
2. Click **Connect**
3. Authorize Snyk to access your repository
4. This enables automatic PR creation for vulnerabilities

### 3. Configure Dependabot

Dependabot is already configured in `.github/dependabot.yml`. It will:

- Check for npm package updates weekly (Mondays at 3 AM UTC)
- Check for GitHub Actions updates weekly (Mondays at 4 AM UTC)
- Create PRs for available updates
- Assign PRs to `DogStark` (update as needed)

To customize:

1. Edit `.github/dependabot.yml`
2. Update `reviewers` and `assignees` with your GitHub usernames
3. Adjust `schedule.time` if needed
4. Commit and push changes

### 4. Configure Branch Protection

To enforce security checks before merging:

1. Go to **Settings** → **Branches** → **Branch protection rules**
2. Click **Add rule**
3. Branch name pattern: `main`
4. Enable:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
5. Select required status checks:
   - `npm audit — Dependency Vulnerabilities`
   - `Lint, Format & Typecheck`
   - `Unit & Integration Tests`
6. Click **Create**

### 5. Local Development Setup

#### Run Security Checks Locally

```bash
# Check for vulnerabilities
npm run audit

# Check for high severity vulnerabilities only
npm run audit:high

# Automatically fix vulnerabilities
npm run audit:fix

# Force major version updates (use with caution)
npm run audit:fix:force

# Run full security check (audit + lint + typecheck)
npm run security:check
```

#### Pre-commit Hook

The project uses Husky for pre-commit hooks. Security checks are automatically run before commits.

To manually run pre-commit checks:

```bash
npm run prepare
```

## Workflows

### security-audit.yml

Runs on every PR and daily on main branch.

**Triggers:**
- Push to main, master, develop
- Pull requests to main, master, develop
- Daily at 2 AM UTC

**Jobs:**
1. **npm-audit** — Runs npm audit and blocks PRs with critical/high vulnerabilities
2. **snyk-scan** — Runs Snyk scan (if SNYK_TOKEN is configured)
3. **security-report** — Generates and uploads security report

**Output:**
- Comments on PRs with vulnerability summary
- Blocks PRs with critical or high severity vulnerabilities
- Uploads reports as artifacts

### security-patches.yml

Automatically creates PRs for available security patches.

**Triggers:**
- Daily at 3 AM UTC
- Manual trigger via workflow_dispatch

**Jobs:**
1. **check-patches** — Checks for available updates
2. **create-patch-pr** — Creates PR with npm audit fix applied

**Output:**
- Auto-creates PR with security patches
- Includes detailed commit message
- Labels PR with `security`, `dependencies`, `automated`

### dependabot.yml

Automated dependency updates.

**Triggers:**
- Weekly on Mondays at 3 AM UTC (npm)
- Weekly on Mondays at 4 AM UTC (GitHub Actions)

**Output:**
- Creates PRs for available updates
- Assigns to configured reviewers
- Includes changelog in PR description

## Handling Vulnerabilities

### When a Vulnerability is Detected

1. **Review** — Check the PR comment with vulnerability details
2. **Assess** — Determine if it affects your code
3. **Fix** — Update the package or find alternative
4. **Test** — Run full test suite
5. **Merge** — Once CI passes and review is approved

### If No Patch is Available

1. **Document** — Add to SECURITY.md under "Accepted Risks"
2. **Mitigate** — Implement compensating controls
3. **Monitor** — Check for patches regularly
4. **Review** — Re-evaluate quarterly

### Forcing Updates

If you need to force a major version update:

```bash
npm audit fix --force
```

**⚠️ Warning:** This may introduce breaking changes. Always test thoroughly.

## Monitoring & Reporting

### View Security Reports

1. Go to **Actions** → **Security — Dependency Audit & Vulnerability Scanning**
2. Click the latest run
3. Download artifacts:
   - `npm-audit-report.json` — Detailed npm audit results
   - `snyk-report.json` — Snyk scan results
   - `security-report.md` — Summary report

### Weekly Security Report

The team receives a weekly security report via:

1. **GitHub Issues** — Automated issue creation with summary
2. **Email** — If configured in GitHub notifications
3. **Slack** — If integrated with GitHub

To set up Slack notifications:

1. Go to **Settings** → **Integrations & services**
2. Add GitHub Slack integration
3. Configure channel for security notifications

## Troubleshooting

### Snyk Scan Fails

**Issue:** `SNYK_TOKEN not found`

**Solution:**
1. Verify `SNYK_TOKEN` is added to GitHub Secrets
2. Check token is valid in Snyk dashboard
3. Ensure token has correct permissions

### npm audit Reports False Positives

**Issue:** Vulnerability reported but not applicable

**Solution:**
1. Check vulnerability details in npm audit report
2. Verify it doesn't affect your code path
3. Document as accepted risk in SECURITY.md
4. Consider using `npm audit --ignore` for known false positives

### Dependabot PRs Not Creating

**Issue:** No PRs created by Dependabot

**Solution:**
1. Check `.github/dependabot.yml` syntax
2. Verify Dependabot is enabled in repository settings
3. Check GitHub Actions is enabled
4. Wait for next scheduled run (Mondays at 3 AM UTC)

### Branch Protection Blocking Merges

**Issue:** PR blocked due to security checks

**Solution:**
1. Review security report in PR comments
2. Fix vulnerabilities: `npm audit fix`
3. Commit and push changes
4. Wait for CI to re-run
5. If still blocked, review with security team

## Best Practices

1. **Review Dependencies** — Regularly review `package.json` for unused packages
2. **Keep Updated** — Merge Dependabot PRs promptly
3. **Test Thoroughly** — Always run full test suite after updates
4. **Document Risks** — Keep SECURITY.md updated with accepted risks
5. **Monitor Alerts** — Check GitHub security alerts weekly
6. **Communicate** — Notify team of critical vulnerabilities

## Additional Resources

- [npm audit Documentation](https://docs.npmjs.com/cli/v10/commands/npm-audit)
- [Snyk Documentation](https://docs.snyk.io/)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [OWASP Dependency Check](https://owasp.org/www-project-dependency-check/)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)

## Support

For security-related questions or issues:

1. Check this guide and SECURITY.md
2. Review GitHub Actions logs
3. Contact security@petchain.app
4. Open an issue with `security` label

---

**Last Updated:** May 28, 2026
**Maintained By:** PetChain Security Team
