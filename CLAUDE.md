# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
- **NO YAPPING** Never write unnecessary explications, UNLESS the user asks for it.
**tabletopmaprenderer** is a browser-based tactical RPG map application with a retro CRT aesthetic. It features a split-window architecture: a game master (GM) interface with full editing controls and a player-view interface for remote display synchronization.

The application has **no build process, dependencies, or external APIs** (only loads Google Fonts for VT323) — plain `<script>` tags across multiple modular JS files (see below), no bundler.

## ⚠️ ALWAYS READ ARCHITECTURE.md FIRST

**Before making ANY change to this codebase — even a small one — read
[ARCHITECTURE.md](ARCHITECTURE.md) first, specifically the section covering
the file(s) you're about to touch.** This project is split into many small
per-feature files with no bundler and no `import`/`export` — files talk to
each other through plain `<script>` load order and a global `window.RPG`
namespace. Getting the load order or a cross-file call wrong produces silent
`undefined` bugs, not build errors. ARCHITECTURE.md documents:
- the exact directory layout and what each file owns,
- the required `<script>` load order and *why* it's ordered that way,
- known forward-reference hazards between files,
- which files are **dead/stale** (`js/core/*`, `js/render/*`) and must not be
  edited under the assumption they're wired up — they aren't.

This rule applies whether you're fixing a bug, adding a feature, or just
answering a question about how something works. Re-read the relevant section
even if you think you already know the answer — the module boundaries move as
the app evolves, and ARCHITECTURE.md is kept in sync with reality; your
memory of a previous session is not guaranteed to be.

## Architecture

The full module-by-module breakdown, state shape, sync protocol, and
subsystem details (fog of war/vision raycasting, scenes, walls, combat,
photo cropping, etc.) live in **[ARCHITECTURE.md](ARCHITECTURE.md)** — this
section only covers the high-level shape; do not duplicate detail here that
belongs there.

### Two-Window System
- **index.html** (+ `js/gm/*`): GM master interface — full control, editing tools, map import, token management, scenes, fog of war, walls, combat tracking
- **player.html** (+ `js/player/*`): Player view — read-only display synchronized via `window.postMessage` to a separate browser window (for dual-monitor setups); owns the real vision/fog-of-war raycasting + exploration-memory engine
- **js/shared/***: camera math, photo cache, bar drawing, basic map/token rendering, vision-reach formula — used by both windows

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for: full directory layout, required `<script>` load order (and why), the `state`/`allTokens`/`scenes` shapes, the sync protocol payload, scene-switching semantics, the wall-occlusion/exploration-memory system, and per-subsystem notes (tokens, combat, camera, photo cropping, walls). Debugging tips and "common task" recipes are also there, not duplicated here.

- **NO YAPPING** Never write unnecessary explications, UNLESS the user asks for it.
- **NO RUNNING UNASKED TESTS** Never run unnecessary tests or boots, UNLESS the user asks for it.
