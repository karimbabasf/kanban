# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Shipped inside a Tauri 2 window on macOS. The UI is web, but Mac conventions bind: Cmd shortcuts, the traffic-light titlebar region, a native menu bar, no browser chrome.

## Stack

Tauri 2 Mac app (Karim's choice, 2026-11-22). Delegated details: Vite + React + TypeScript frontend, Rust backend with rusqlite writing one SQLite file in the app data dir. A browser build with a localStorage adapter exists only for development and screenshots.

## Users

Karim, alone, on his Mac. He plans builds, study loops and life tasks on it many times a day, mostly between other work, mostly from the keyboard.

## Product Purpose

A personal kanban board that never slows him down. Success: he captures a task in under 2 seconds from anywhere in the app, moves it across columns without touching the mouse, and trusts that nothing is lost on quit or crash.

## Positioning

Keyboard-first speed. Every action (add, edit, move, reorder, delete, undo, search, switch board) has a key and lands in under 100 ms. Trello, Linear and Notion boards are mouse-first or account-first; this one is local, instant and his.

## Operating Context

Used on a MacBook, often half-screen beside an editor or terminal. Sessions are short: glance, add, move, close. Some planning sessions are long: rearranging a whole board. No network, no accounts.

## Capabilities and Constraints

- Multiple boards, each with ordered columns and ordered cards.
- A card has a title, optional notes, optional due date, optional label color. Nothing else in v1.
- Drag and drop with mouse and trackpad, plus full keyboard movement.
- Undo and redo for every change.
- Search across cards on the current board.
- Data: SQLite in the app data dir, written on every change, atomic per change.
- Undecided: sync between devices, export, agents touching the board. Not in v1.

## Evidence on Hand

None. No real board data exists; demo data on first run is labeled as sample content and can be cleared.

## Product Principles

1. The keyboard is the primary input; the mouse is a courtesy.
2. Instant beats clever: no spinners, no network, no confirm dialogs (undo instead).
3. One screen, one board: everything happens on the board itself.
4. Nothing is lost: every change is on disk before the next one.

## Accessibility & Inclusion

Full keyboard operation is the product, so focus must always be visible and logical. WCAG 2.2 AA contrast. Respect reduced motion.
