mod native_save;
mod save_copy;

use save_copy::SaveManager;
use std::sync::Arc;
use tauri::{Manager, RunEvent, State, webview::PageLoadEvent};

#[tauri::command]
fn finish_close(
    window: tauri::WebviewWindow,
    saves: State<'_, Arc<SaveManager>>,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Only the local reader window may finish its own close request".into());
    }
    saves.begin_close()?;
    // The shared UI has finished its normal per-document save/discard workflow.
    // Destroy avoids generating another CloseRequested event.
    window.destroy().map_err(|error| {
        saves.close_failed();
        error.to_string()
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Native dialogs run in Rust. The frontend gets no plugin filesystem/dialog permission.
    tauri::Builder::default()
        .manage(Arc::new(SaveManager::default()))
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            finish_close,
            native_save::begin_pdf_save,
            native_save::append_pdf_save,
            native_save::finish_pdf_save,
            native_save::cancel_pdf_save
        ])
        .on_page_load(|webview, payload| {
            if webview.label() == "main" && payload.event() == PageLoadEvent::Started {
                webview.state::<Arc<SaveManager>>().invalidate();
            }
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    if let Some(webview) = window.app_handle().get_webview_window("main") {
                        // Fail closed if the frontend is unavailable; no document data crosses IPC.
                        let _ = webview
                            .eval("window.dispatchEvent(new Event('folio-native-close-request'))");
                    }
                }
                if let tauri::WindowEvent::Destroyed = event {
                    window.state::<Arc<SaveManager>>().invalidate();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("Folio could not initialize its application window")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                app.state::<Arc<SaveManager>>().invalidate();
            }
        });
}
