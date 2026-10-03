use tauri::Manager;

#[tauri::command]
fn finish_close(window: tauri::WebviewWindow) -> Result<(), String> {
  if window.label() != "main" {
    return Err("Only the local reader window may finish its own close request".into());
  }
  // The shared UI has finished its normal per-document save/discard workflow.
  // Destroy avoids generating another CloseRequested event.
  window.destroy().map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // One window-close command only; no filesystem, shell, network or logging plugins.
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![finish_close])
    .on_window_event(|window, event| {
      if window.label() == "main" {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
          api.prevent_close();
          if let Some(webview) = window.app_handle().get_webview_window("main") {
            // Fail closed if the frontend is unavailable; no document data crosses IPC.
            let _ = webview.eval("window.dispatchEvent(new Event('folio-native-close-request'))");
          }
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("Folio could not initialize its application window");
}
