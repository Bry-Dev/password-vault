# GitHub repository security setup

These settings live in GitHub's repository configuration, not in this
repo's files, so they must be enabled manually after (or before) making the
repository public. This is a one-time checklist for the repository owner.

## Settings → Code security

Enable what's available for your plan (all of these are free for public
repositories):

- **Dependency graph** — on
- **Dependabot alerts** — on
- **Dependabot security updates** — on (opens PRs for vulnerable
  dependencies; combined with `.github/dependabot.yml` for routine updates)
- **Secret scanning** — on
- **Secret scanning push protection** — on (blocks pushes that contain
  obvious secrets before they land in history)
- **Code scanning (CodeQL)** — add the default CodeQL setup for
  JavaScript/TypeScript. Free for public repos.
- **Private vulnerability reporting** — on. This lets people report
  vulnerabilities privately via Security → "Report a vulnerability" instead
  of a public issue, matching the process described in
  [SECURITY.md](../SECURITY.md).

## Settings → Rules → Rulesets

Create a ruleset targeting the `main` branch:

- Require a pull request before merging
- Require status checks to pass (select the CI job from
  `.github/workflows/ci.yml`)
- Require conversation resolution before merging
- Block force pushes
- Restrict deletions (block branch deletion)

**For a solo maintainer:** do not require another person's approval yet —
there's no one else to approve. Leave "required approvals" at 0, or don't
enable the approval requirement at all.

**Once there are additional maintainers**, come back and add:

- Require 1 approving review
- Dismiss stale approvals when new commits are pushed
- Require review from Code Owners for paths covered by
  `.github/CODEOWNERS` (the crypto/vault/storage/backup services)

## Plan-dependent notes

- Secret scanning, push protection, and CodeQL are free for public
  repositories on any GitHub plan. For private repositories they require
  GitHub Advanced Security, which is a paid add-on outside GitHub Free.
- Rulesets are available on GitHub Free for public repositories. Some
  advanced ruleset conditions are plan-gated for private repositories.
- Private vulnerability reporting is available on public repositories on
  all plans.

## Not covered here

Repository visibility (public/private), collaborator/team access, and
branch protection on any branch other than `main` are left to your
judgment and aren't prescribed by this checklist.
