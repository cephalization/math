---
"@cephalization/math": major
---

feat: Migrate math task management to `dex`

This is a breaking change and a complete refactor to how tasks are managed within math.

We now leverage the excellent [dex](https://dex.rip) CLI tool for LLM native but human friendly task management.

It has slightly more overhead than a simple markdown document, but it provides stronger ergonmics and skills to the LLM.

`math` will prompt you to migrate any current TODO.md documents you have in flight, or you can finish your current work before migrating.
