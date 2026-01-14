# Project Learnings Log

This file is appended by each agent after completing a task.
Key insights, gotchas, and patterns discovered during implementation.

Use this knowledge to avoid repeating mistakes and build on what works.

---

<!-- Agents: Append your learnings below this line -->
<!-- Format:
## <task-id>

- Key insight or decision made
- Gotcha or pitfall discovered
- Pattern that worked well
- Anything the next agent should know
-->

## update-package-name

- The `bin` field in package.json already had the correct structure: `{ "math": "./index.ts" }` - the key becomes the binary name, the value is the entry point
- The shebang `#!/usr/bin/env bun` was already present at line 1 of index.ts
- Changing package name to scoped `@cephalization/math` only requires updating the `name` field - the `bin` field key stays as `math` to keep the CLI command name
- Pre-existing test failure in `src/loop.test.ts` for "Skipping git branch creation" message - unrelated to package configuration changes

## add-files-field

- The `files` field in package.json uses an array of glob patterns to specify what gets included in the npm package
- Placed the `files` field after `bin` to keep package metadata grouped logically
- The glob pattern `src/**/*.ts` ensures all TypeScript source files are included for consumers who want to inspect the source
- Pre-existing test failure still present - documented by previous agent, unrelated to this change

## init-changesets

- Use `bunx @changesets/cli init` not `bunx changeset init` - the package name is `@changesets/cli`, not `changeset`
- Changesets defaults to `"access": "restricted"` which won't work for scoped packages intended for public npm registry
- Must change to `"access": "public"` in `.changeset/config.json` for scoped packages like `@cephalization/math`
- The init creates two files: `config.json` (configuration) and `README.md` (documentation for contributors)
- Pre-existing test failure (1 fail, 86 pass) is unrelated to changesets setup - documented by previous agents

## add-changeset-release-workflow

- The `changesets/action@v1` handles both creating "Version Packages" PRs and publishing to npm
- Use `bunx changeset publish` and `bunx changeset version` for the publish and version commands to use bun
- The workflow needs both `GITHUB_TOKEN` (for creating PRs) and `NPM_TOKEN` (for publishing) secrets
- Added `concurrency` setting to prevent parallel runs on the same branch which could cause race conditions
- The `oven-sh/setup-bun@v2` action sets up Bun in GitHub Actions - use v2 for latest features
- Pre-existing test failure (1 fail, 86 pass) still present - unrelated to workflow changes
