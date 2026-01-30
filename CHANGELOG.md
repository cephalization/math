# @cephalization/math

## 1.0.0

### Major Changes

- 0e8724f: feat: Migrate math task management to `dex`

  This is a breaking change and a complete refactor to how tasks are managed within math.

  We now leverage the excellent [dex](https://dex.rip) CLI tool for LLM native but human friendly task management.

  It has slightly more overhead than a simple markdown document, but it provides stronger ergonmics and skills to the LLM.

  `math` will prompt you to migrate any current TODO.md documents you have in flight, or you can finish your current work before migrating.

## 0.4.0

### Minor Changes

- 4216057: feat: Move todo directory to .math, migrate files

### Patch Changes

- 57b25a0: documentation

## 0.3.2

### Patch Changes

- 7343771: feat: Include more guidelines in template prompts

## 0.3.1

### Patch Changes

- 3046da1: docs: Update README

## 0.3.0

### Minor Changes

- 216668c: fix: Include assets during publish

## 0.2.0

### Minor Changes

- 8ba12d1: feat: Publishing
