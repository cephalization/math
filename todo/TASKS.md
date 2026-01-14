# Project Tasks

Task tracker for multi-agent development.
Each agent picks the next pending task, implements it, and marks it complete.

## How to Use

1. Find the first task with `status: pending` where ALL dependencies have `status: complete`
2. Change that task's status to `in_progress`
3. Implement the task
4. Write and run tests
5. Change the task's status to `complete`
6. Append learnings to LEARNINGS.md
7. Commit with message: `feat: <task-id> - <description>`
8. EXIT

## Task Statuses

- `pending` - Not started
- `in_progress` - Currently being worked on
- `complete` - Done and committed

---

## Phase 1: Package Configuration

### update-package-name

- content: Update package.json to use scoped name `@cephalization/math` while keeping the binary name as `math`. Ensure the `bin` field points to `./index.ts` and the shebang `#!/usr/bin/env bun` is present in index.ts (already there, just verify).
- status: complete
- dependencies: none

### add-files-field

- content: Add a `files` field to package.json specifying which files to include in the published package: `["index.ts", "src/**/*.ts", "README.md"]`. This ensures only necessary files are published.
- status: complete
- dependencies: update-package-name

---

## Phase 2: Changesets Setup

### init-changesets

- content: Initialize changesets by running `bunx changeset init`. This creates a `.changeset` directory with config.json and README.md. Ensure the config uses `"access": "public"` for the scoped package.
- status: complete
- dependencies: add-files-field

### add-changeset-release-workflow

- content: Create `.github/workflows/release.yml` that uses changesets/action to create "Version Packages" PRs and publish to npm on merge to main. Use `NPM_TOKEN` secret for authentication. Set up with bun for package installation.
- status: complete
- dependencies: init-changesets

---

## Phase 3: CI Workflow

### add-ci-workflow

- content: Create `.github/workflows/ci.yml` that runs on all PRs and pushes. Jobs should: 1) Install dependencies with `bun install`, 2) Run typechecking with `bun run typecheck`, 3) Run tests with `bun test`. Use ubuntu-latest and setup-bun action.
- status: complete
- dependencies: none

---

## Phase 4: Documentation

### update-readme-installation

- content: Update README.md installation section to show npm installation methods: 1) `bunx @cephalization/math <command>` (recommended for one-off usage), 2) `bun install -g @cephalization/math` (global install). Keep the existing clone/link instructions for development.
- status: pending
- dependencies: update-package-name

### update-readme-bun-requirement

- content: Add a prominent "Requirements" section near the top of README.md stating that Bun is required to run this tool (not Node.js). Link to bun.sh for installation instructions. Explain why Bun is needed (TypeScript execution, shebang).
- status: pending
- dependencies: update-readme-installation

---
