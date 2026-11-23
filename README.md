# Kanban

A personal, keyboard-first kanban board for macOS. Tauri 2 app: React + TypeScript UI, Rust backend, one SQLite file at `~/Library/Application Support/com.karimbaba.kanban/kanban.db`.

## Run

```sh
npm install
npm run tauri dev                         # the Mac app with hot reload
npm run tauri build -- --bundles app      # src-tauri/target/release/bundle/macos/Kanban.app
npm run dev                               # browser build on :1420, data in localStorage (for screenshots)
```

Press `?` in the app for every shortcut.

## Test

```sh
npm test                    # model: moves, undo diffs, deletes
cd src-tauri && cargo test  # SQLite: upsert, load, delete, migrations
npx tsc --noEmit
```
