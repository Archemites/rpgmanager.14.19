# GEMINI.md - Antigravity Agent Rules

Guidelines for the Antigravity Agent when working with code in this repository.

## Behavioral Constraints & Directives

- **NO YAPPING:** Never write unnecessary explanations or verbose prose UNLESS explicitly requested.
- **NO UNASKED TESTS:** Never run tests, background test suites, or boots unless specifically instructed by the user.

---

## Project Overview

**tabletopmaprenderer** is a browser-based tactical RPG map application with a retro CRT aesthetic featuring a split-window architecture:

- Game Master (GM) interface with full editing controls.
- Player-view interface for remote display synchronization.

**Stack & Build:**

- No build steps, no bundler, no external APIs/dependencies (only Google Fonts VT323).
- Plain `<script>` tags across modular vanilla JS files interacting via a global `window.RPG` namespace.

---

## ⚠️ MANDATORY RULE: READ ARCHITECTURE.md FIRST

**Before making ANY code change or answering structural questions, always read `ARCHITECTURE.md` first, specifically the section covering the targeted files.**

- Files communicate purely via plain `<script>` load order and `window.RPG`.
- Incorrect cross-file calls or load order cause silent `undefined` runtime errors.
- **Dead/Stale directories:** Do NOT edit or wire files under `js/core/*` or `js/render/*` (these are legacy/dead files).
- Always verify boundaries and dependencies in `ARCHITECTURE.md` before applying edits.

---

## High-Level Architecture Reference

- **GM Interface (`index.html` + `js/gm/*`):** Full control, map import, token management, scenes, walls, fog of war, combat tracker.
- **Player Interface (`player.html` + `js/player/*`):** Read-only view synced via `window.postMessage` (dual monitors); runs real vision/fog raycasting + exploration memory.
- **Shared (`js/shared/*`):** Camera math, token rendering, photo cache, bar drawing, vision reach formula.

*Refer to `ARCHITECTURE.md` for exact script ordering, data models (`state`, `allTokens`, `scenes`), sync payloads, and sub-system specifics.*
