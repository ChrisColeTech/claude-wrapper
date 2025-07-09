# Release Process Documentation

This document outlines the correct sequence for releasing new versions of the Claude Wrapper project.

## Prerequisites

- All changes must be tested and validated
- All tests must pass
- Code must be linted and type-checked

## Release Steps

### 1. Pre-Release Validation

**ALWAYS run precommit validation before creating any release:**

```bash
npm run precommit
```

This will run:
- `npm run build` - TypeScript compilation
- `npm run test:unit` - All unit tests (896+ tests)
- `npm run lint` - ESLint validation
- `npm run typecheck` - TypeScript type checking

### 2. Create Release Branch

Create a new release branch from the **current release branch** (not main):

```bash
# First, ensure you're on the latest release branch
git checkout release
git pull origin release

# Create new release branch
git checkout -b release-v1.x.x
```

### 3. Merge Latest Changes

If you have changes on another branch (like hotfix branches), merge them properly:

```bash
# Merge your feature/hotfix branch into the release branch
git merge origin/release  # Get latest release branch changes first
git merge your-feature-branch
```

### 4. Version Bump

Update the version number:

```bash
npm version 1.x.x
```

This will:
- Update `package.json`
- Update `package-lock.json`
- Create a git tag

### 5. Push Release Branch

```bash
git push origin release-v1.x.x
```

### 6. Create Pull Request

Create a PR to the `release` branch (not main):

```bash
gh pr create --title "Release v1.x.x: Brief Description" --body "## Summary
- Feature/fix descriptions
- Technical changes
- Test coverage info

🤖 Generated with [Claude Code](https://claude.ai/code)" --base release
```

### 7. Merge Pull Request

Once CI checks pass:

```bash
gh pr merge <PR_NUMBER> --merge
```

### 8. Verify CI Deployment

The CI will automatically:
- Run all tests
- Build the project
- Publish to NPM
- Create GitHub release

Check the GitHub Actions tab to ensure the deployment succeeds.

### 9. Test Installed Package

Test the published NPM package:

```bash
# Test the installer (global installation)
npx claude-wrapper@latest --version

# Test local installation
npm install -g claude-wrapper@latest
wrapper --version
```

## Important Notes

⚠️ **Critical:** Always merge from the `release` branch into your release-vX.X.X branch before committing, to ensure you have the latest version and dependencies.

⚠️ **Never skip precommit:** Always run `npm run precommit` before creating any release to ensure all tests pass and code is properly validated.

⚠️ **Environment Variables:** The release process has been updated to properly handle environment variable inheritance in daemon processes, ensuring HTTP logging works correctly in both foreground and background modes.

## CI/CD Pipeline

The CI pipeline (`Publish to NPM` workflow) will:

1. Install dependencies
2. Run tests (`npm run test:ci`)
3. Build project (`npm run build`)
4. Bump version (automatic on release branch)
5. Create Git tag
6. Publish to NPM
7. Create GitHub Release

## Troubleshooting

### Test Failures
- Check logs in CI for specific test failures
- Run `npm run test:unit` locally to debug
- Ensure all mocks are properly updated for any API changes

### Build Failures
- Check TypeScript compilation errors
- Run `npm run typecheck` locally
- Ensure all imports and exports are correct

### NPM Publish Failures
- Check NPM authentication
- Verify version number doesn't already exist
- Ensure `dist/` directory contains compiled code

## Version History

This process has been validated with:
- v1.1.6 - Test logging infrastructure fixes
- v1.1.7 - CLI binary execution fixes  
- v1.1.8 - Colored console logging and HTTP logging fixes
- v1.1.9 - Environment inheritance and daemon process improvements