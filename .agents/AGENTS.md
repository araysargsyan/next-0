# Antigravity Workspace Rules & Guidelines

This document outlines the strict collaboration conventions, coding standards, and IDE safety rules required for this workspace.

---

## 📝 1. Markdown & IDE Safety (WebStorm/PhpStorm)

To maintain a zero-warning IDE status and ensure clean Markdown parsing:
* **JSX/TSX Code Blocks**: Always use the ` ```tsx ` language identifier (never ` ```typescript `) for code blocks containing HTML/JSX elements.
* **Ambient Method Signatures**: Never write raw, standalone class method signatures in TypeScript code blocks. Wrap them in a declaration block (e.g., `interface AuthService { ... }`) and omit implementation details like the `async` modifier.
* **Relative File Links**: Never use absolute `file:///` URLs. Always use relative markdown paths (e.g., `./src/lib/auth/README.md`) to link internally.

---

## 🤝 2. Collaboration & Development Alignment

* **Design Alignment First**: Никогда не писать, не изменять и не удалять код без предварительного обсуждения. Сначала предложить архитектурный план простым текстом, получить явное согласие пользователя, и только потом приступать к изменениям кода. Это железное правило касается ЛЮБЫХ правок: исправления багов, восстановления удаленных файлов, редактирования документации и даже мелких доработок. Сначала — согласованный текстовый план, затем — вызов инструментов.
* **No Auto-Committing**: Automatically staging or committing changes is strictly prohibited. Execute Git operations (`git add`, `git commit`) *only* upon direct user request (e.g., *"commit"* or *"lets commit"*). Do not ask or prompt the user for commits; wait until the user explicitly issues the command.
* **Codebase Language Integrity**: Keep the codebase 100% in English. No Russian words (Cyrillic or transliterated Latin-Russian) are permitted in code, comments, log messages, documentation, or configuration files.
* **Exhaustive Directory Analysis**: Whenever instructed to study, analyze, or check the `.agents` directory, the agent must read every file permitted by the **Current Scope Exclusions** rule below (e.g. `FORMY_STATE_SESSION.md`, `NEXT_16_RESOURCES.md`), not just `AGENTS.md`, to ensure full contextual alignment.
* **Current Scope Exclusions**: The active development focus is split into two independent sessions — Formy and AuthSDK. These session files are **strictly scoped** and must never be read outside their respective context:
  * **Formy task in progress** → `AUTH_SDK_SESSION_LOG.md` **MUST NOT be opened, read, or referenced** under any circumstances. Opening it is a rule violation even as part of an `.agents` directory analysis.
  * **AuthSDK task in progress** → `FORMY_STATE_SESSION.md` **MUST NOT be opened, read, or referenced** under any circumstances.
  * `FORMY_STATE_SESSION_OLD.md` is an **archived history file** and **MUST NOT be opened, read, or referenced** under any circumstances, regardless of the active session. It is never relevant.
  * `AGENTS.md` and `NEXT_16_RESOURCES.md` are **always required reading** regardless of the active session.

---

## 🚀 3. Commands, Testing & Database Standards

* **No Autonomous Command/Script Execution**: Do not execute test, build, lint, or type-check scripts (e.g., `npm run test`, `npm run test:e2e`, `npm run type-check`, `npm run lint`, `npm run build`) autonomously. Instead, ask the user to run these commands locally and report the results back.
* **Test Directory Isolation**:
  * **Unit Tests (`*.spec.ts`)**: Place strictly inside `src/` under a module's dedicated `tests/` subdirectory (e.g., `src/modules/user/tests/`).
  * **E2E Tests (`*.e2e-spec.ts`)**: Place strictly inside the root `tests/` directory, organized by module folders (e.g., `tests/auth/`).
* **Database Teardown Cleanup**: Every test that performs database write operations must include a robust `finally {}` block for targeted data cleanup (e.g., deleting test users by email) to prevent pool hangs or DB pollution.
* **Clean Terminal Logs**: Inside tests, use `process.stdout.write()` instead of `console.log()` to prevent Jest from polluting the CLI output with redundant stack trace lines.

---

## 💻 4. Configuration Standards

* **Unified Jest Configuration**: Consolidate all test configurations (unit and E2E) inside the single root `jest.config.js` utilizing Jest Projects.
* **TypeScript Exclusions**: Exclude test directories in the root `tsconfig.json` using the `exclude` array without creating duplicate build configs.

---

## 💬 5. Communication & Language Preferences

* **Conciseness**: Keep all responses concise, structured, and focused directly on the technical task.
* **Language Matching**: Always reply in the same language the user is writing in. If the user writes in English — reply in English. If the user writes in Russian (Cyrillic or transliterated Latin, e.g., *"prodaljay"*, *"dava commit"*) — reply in **standard Russian (Cyrillic)**.

---

## 💾 6. Git Commit Message Conventions

Tailor the detail and length of commit messages based on the scope of changes:
* **Small/Simple Changes**: Keep the message extremely short and simple (e.g., `test: add test:unit and test:e2e scripts`, `docs: readme file fixes`).
* **Large/Complex Changes**: Write a conventional commit starting with a short type/scope header, followed by a bulleted description detailing the changes and impacted subsystems.

---

## 🎨 7. Coding & Import Standards

* **Explicit React Imports**: Always import React types, hooks, and utilities directly from `"react"` (e.g., `import { useState, SubmitEvent, InputEvent, ReactNode } from "react"`). Do not use the global `React` namespace (like `React.useState`, `React.ReactNode`, `React.SubmitEvent`) for either types or runtime code.
* **React 19 Event Typing**:
  * For `onSubmit` event handlers, use `SubmitEvent<HTMLFormElement>` (imported from `"react"`) instead of `FormEvent`.
  * For `onInput` event handlers, use `InputEvent<HTMLFormElement>` (imported from `"react"`) instead of `FormEvent`. Using `FormEvent` for `onInput` will cause compilation errors in React 19 due to native `InputEventHandler` requirements.
* **No `MutableRefObject`**: Never use `MutableRefObject` from `"react"`. In React 19, `RefObject` is mutable by default (its `.current` property is mutable). Always use `RefObject` for all refs.

