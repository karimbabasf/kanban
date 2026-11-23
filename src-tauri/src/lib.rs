mod db;

use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager};

struct Db(Mutex<rusqlite::Connection>);

#[tauri::command]
fn load_data(db: tauri::State<Db>) -> Result<db::Rows, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    db::load(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn apply_changes(db: tauri::State<Db>, changes: db::Changes) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    db::apply(&mut conn, &changes).map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let conn = db::open(&dir.join("kanban.db"))?;
            app.manage(Db(Mutex::new(conn)));

            // The stock Edit menu sends Cmd Z to the web view's text undo, so the board never saw it.
            // These items hand Undo and Redo to the page, which decides between board and text undo.
            let h = app.handle();
            let undo = MenuItem::with_id(h, "undo", "Undo", true, Some("CmdOrCtrl+Z"))?;
            let redo = MenuItem::with_id(h, "redo", "Redo", true, Some("CmdOrCtrl+Shift+Z"))?;
            let app_menu = SubmenuBuilder::new(h, "Kanban")
                .about(None)
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;
            let edit = SubmenuBuilder::new(h, "Edit")
                .item(&undo)
                .item(&redo)
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;
            let view = SubmenuBuilder::new(h, "View").fullscreen().build()?;
            let window = SubmenuBuilder::new(h, "Window").minimize().maximize().separator().close_window().build()?;
            app.set_menu(MenuBuilder::new(h).items(&[&app_menu, &edit, &view, &window]).build()?)?;
            app.on_menu_event(|app, event| {
                let id = event.id().as_ref();
                if id == "undo" || id == "redo" {
                    let _ = app.emit("menu", id);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![load_data, apply_changes])
        .run(tauri::generate_context!())
        .expect("error while running Kanban");
}
