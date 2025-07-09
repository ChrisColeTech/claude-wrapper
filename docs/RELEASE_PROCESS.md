# Release Process

This document outlines the step-by-step process for creating and deploying new releases of Claude Wrapper.

## Pre-Release Checklist

Before starting the release process, ensure all these conditions are met:

- [ ] All new features are complete and tested
- [ ] All known bugs are fixed
- [ ] Documentation is up to date
- [ ] Version numbers are consistent across all package.json files

## Release Steps

### 1. Pre-Release Validation

```bash
# Ensure you're on the main branch and up to date
git checkout main
git pull origin main

# Install dependencies
npm install
cd app && npm install && cd ..

# Run streamlined pre-commit validation
npm run precommit

# Optional: Run additional tests
npm run test:integration
npm run test:e2e
```

**The `precommit` command runs: build, unit tests, linting, and type checking - all must pass before proceeding.**

### 2. Version Update

Update version numbers in both package.json files:

```bash
# Update root package.json version
# Update app/package.json version
# Ensure both versions match
```

### 3. Commit and Push to Main

```bash
# Stage all changes
git add .

# Commit with descriptive message
git commit -m "Release v1.x.x: Brief description of changes

- List major changes
- List bug fixes
- List new features

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to main
git push origin main
```

### 4. Wait for CI to Pass

- Go to GitHub Actions tab
- Wait for all CI checks to pass on main branch
- Verify build succeeds
- Verify all tests pass
- **Do not proceed until CI is green**

### 5. Create Release PR

```bash
# Create and switch to release branch
git checkout -b release-v1.x.x

# Push release branch
git push origin release-v1.x.x
```

Create a Pull Request from `release-v1.x.x` to `release` branch with:

**Title:** `Release v1.x.x`

**Description:**
```markdown
## Release v1.x.x

### New Features
- [ ] List new features

### Bug Fixes  
- [ ] List bug fixes

### Breaking Changes
- [ ] List any breaking changes (if applicable)

### Testing
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All e2e tests passing
- [ ] Manual testing completed

### Documentation
- [ ] README updated
- [ ] API documentation updated
- [ ] Release notes prepared
```

### 6. Merge Release PR

- Review the PR thoroughly
- Ensure all CI checks pass on the release branch
- Merge the PR to `release` branch
- **Delete the release branch after merge**

### 7. Verify Release CI

- Monitor GitHub Actions on `release` branch
- Verify all CI checks pass
- Verify NPM package publishes successfully (if configured)
- Verify any deployment processes complete

### 8. Create GitHub Release

- Go to GitHub Releases page
- Click "Create a new release"
- Tag version: `v1.x.x`
- Target: `release` branch
- Release title: `Claude Wrapper v1.x.x`
- Copy release notes from PR description

### 9. Post-Release Verification

```bash
# Test NPM package installation
npm install -g claude-wrapper@1.x.x

# Test basic functionality
wrapper --help
wrapper --version
```

## Hotfix Process

For critical bug fixes that need immediate release:

1. Create hotfix branch from `release`: `git checkout -b hotfix-v1.x.y release`
2. Make minimal necessary changes
3. Follow steps 1-2 from regular release process
4. Create PR from hotfix branch to both `main` and `release`
5. Merge to both branches
6. Follow steps 7-9 from regular release process

## Version Numbering

We follow [Semantic Versioning (SemVer)](https://semver.org/):

- **MAJOR** (1.x.x): Breaking changes
- **MINOR** (x.1.x): New features, backwards compatible
- **PATCH** (x.x.1): Bug fixes, backwards compatible

## Rollback Process

If a release has critical issues:

1. Immediately revert the merge commit on `release` branch
2. Create hotfix following the hotfix process above
3. Communicate the issue and timeline to users

## Branch Protection

- `main` branch: Requires PR reviews, CI checks must pass
- `release` branch: Requires PR reviews, CI checks must pass
- No direct pushes to protected branches

## CI/CD Configuration

Ensure these GitHub Actions workflows are configured:

- **Continuous Integration**: Runs on all PRs and pushes
- **Publish to NPM**: Runs on pushes to `release` branch
- **Security Scanning**: Runs on schedule and PRs

## Release Notes Template

```markdown
# Claude Wrapper v1.x.x

Released: YYYY-MM-DD

## 🚀 New Features
- Feature 1 description
- Feature 2 description

## 🐛 Bug Fixes
- Bug fix 1 description
- Bug fix 2 description

## 📚 Documentation
- Documentation update 1
- Documentation update 2

## 🧪 Testing
- Test improvement 1
- Test improvement 2

## 💥 Breaking Changes (if any)
- Breaking change 1 with migration instructions
- Breaking change 2 with migration instructions

## 📦 Installation
\`\`\`bash
npm install -g claude-wrapper@1.x.x
\`\`\`

## 🔗 Links
- [Full Changelog](https://github.com/ChrisColeTech/claude-wrapper/compare/v1.x.x-1...v1.x.x)
- [Documentation](https://github.com/ChrisColeTech/claude-wrapper#readme)
```