fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "finish_close",
            "begin_pdf_save",
            "append_pdf_save",
            "finish_pdf_save",
            "cancel_pdf_save",
        ]),
    ))
    .expect("Folio build configuration failed");
}
