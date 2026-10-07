//! Narrow IPC wrappers. The frontend supplies bytes and integrity metadata, never disk paths.
use crate::save_copy::{MAX_CHUNK_BYTES, SaveManager, SaveReceipt, SaveTicket};
use std::sync::Arc;
use tauri::{
    Manager, State, WebviewWindow,
    ipc::{InvokeBody, Request},
};
use tauri_plugin_dialog::{DialogExt, FilePath};

fn reader_window(window: &WebviewWindow) -> Result<(), String> {
    if window.label() == "main" {
        Ok(())
    } else {
        Err("Only the local reader window may save its PDF copy.".into())
    }
}

#[tauri::command]
pub async fn begin_pdf_save(
    window: WebviewWindow,
    state: State<'_, Arc<SaveManager>>,
    filename: String,
    byte_length: u64,
    sha256: String,
) -> Result<Option<SaveTicket>, String> {
    reader_window(&window)?;
    let manager = Arc::clone(state.inner());
    let selection = manager.select(filename, byte_length, sha256)?;
    let token = selection.token.clone();
    let (sender, mut receiver) = tauri::async_runtime::channel(1);
    window
        .app_handle()
        .dialog()
        .file()
        .set_parent(&window)
        .set_title("Save a new PDF copy — Folio")
        .set_file_name(&selection.filename)
        .add_filter("PDF document", &["pdf"])
        .save_file(move |path| {
            let _ = sender.blocking_send(path);
        });
    let Some(path) = receiver.recv().await else {
        manager.abandon_selection(&token);
        return Err("The Save As dialog could not finish. Your edits remain open.".into());
    };
    let path = match path {
        Some(FilePath::Path(path)) => Some(path),
        None => None,
        Some(FilePath::Url(_)) => {
            manager.abandon_selection(&token);
            return Err("Choose a local folder for your new PDF copy.".into());
        }
    };
    let cleanup = Arc::clone(&manager);
    tauri::async_runtime::spawn_blocking(move || manager.selected(selection, path))
        .await
        .map_err(|_| {
            cleanup.abandon_selection(&token);
            "The Save As task could not finish. Your edits remain open.".to_string()
        })?
}

#[tauri::command]
pub async fn append_pdf_save(
    window: WebviewWindow,
    state: State<'_, Arc<SaveManager>>,
    request: Request<'_>,
) -> Result<u64, String> {
    reader_window(&window)?;
    let manager = Arc::clone(state.inner());
    let token = request
        .headers()
        .get("x-folio-save-token")
        .and_then(|value| value.to_str().ok())
        .ok_or("The PDF save token header is missing.")?
        .to_owned();
    let offset = request
        .headers()
        .get("x-folio-save-offset")
        .and_then(|value| value.to_str().ok())
        .filter(|value| {
            !value.is_empty() && value.len() <= 20 && value.bytes().all(|c| c.is_ascii_digit())
        })
        .and_then(|value| value.parse::<u64>().ok())
        .ok_or_else(|| {
            let error = "The PDF save offset header is invalid.";
            match manager.cancel(&token) {
                Ok(()) => error.into(),
                Err(cleanup) => format!("{error} {cleanup}"),
            }
        })?;
    let InvokeBody::Raw(bytes) = request.body() else {
        manager.cancel(&token)?;
        return Err("PDF save chunks must use binary IPC.".into());
    };
    if bytes.is_empty() || bytes.len() > MAX_CHUNK_BYTES {
        manager.cancel(&token)?;
        return Err("The PDF save chunk is empty or exceeds 1 MiB.".into());
    }
    let bytes = bytes.clone();
    let cleanup = Arc::clone(&manager);
    let cleanup_token = token.clone();
    tauri::async_runtime::spawn_blocking(move || manager.append(&token, offset, &bytes))
        .await
        .map_err(|_| {
            let _ = cleanup.cancel(&cleanup_token);
            "The PDF write task could not finish. Your edits remain open.".to_string()
        })?
}

#[tauri::command]
pub async fn finish_pdf_save(
    window: WebviewWindow,
    state: State<'_, Arc<SaveManager>>,
    token: String,
) -> Result<SaveReceipt, String> {
    reader_window(&window)?;
    let manager = Arc::clone(state.inner());
    let cleanup = Arc::clone(&manager);
    let cleanup_token = token.clone();
    tauri::async_runtime::spawn_blocking(move || manager.finish(&token))
        .await
        .map_err(|_| {
            let _ = cleanup.cancel(&cleanup_token);
            "The PDF verification task could not finish. Your edits remain open.".to_string()
        })?
}

#[tauri::command]
pub fn cancel_pdf_save(
    window: WebviewWindow,
    state: State<'_, Arc<SaveManager>>,
    token: String,
) -> Result<(), String> {
    reader_window(&window)?;
    state.cancel(&token)
}
