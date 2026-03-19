#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]
// #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_global_shortcut::{Builder, Code, GlobalShortcutExt, Shortcut, ShortcutState}; // ✅ REQUIRED

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_media::init())
        .plugin(
            Builder::new()
                .with_handler(|app, shortcut, event| {
                    let window = app.get_webview_window("main").unwrap();

                    if event.state == ShortcutState::Pressed {
                        match shortcut.key {
                            Code::MediaPlayPause => {
                                let _ = window.emit("media-play-pause", {});
                            }
                            Code::MediaTrackNext => {
                                let _ = window.emit("media-next", {});
                            }
                            Code::MediaTrackPrevious => {
                                let _ = window.emit("media-prev", {});
                            }
                            _ => {}
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            let script = include_str!(".././preload.js");

            let window = tauri::webview::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::External("https://listen.tidal.com".parse().unwrap()),
            )
            .title("Tidal")
            .inner_size(1200.0, 800.0) // ✅ width, height
            .position(100.0, 100.0) // ✅ x, y
            .resizable(true)
            .initialization_script(script)
            .build()?;

            let shortcuts = app.global_shortcut();

            // ✅ Correct media key registration
            shortcuts.register(Shortcut::new(None, Code::MediaPlayPause))?;
            shortcuts.register(Shortcut::new(None, Code::MediaTrackNext))?;
            shortcuts.register(Shortcut::new(None, Code::MediaTrackPrevious))?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Error while opening Tidal");
}
