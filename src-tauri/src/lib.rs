#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // This wrapper embeds the same web application. No native commands, filesystem,
  // shell, network, opener, updater or document-content logging plugins are enabled.
  tauri::Builder::default()
    .run(tauri::generate_context!())
    .expect("Folio could not initialize its application window");
}
