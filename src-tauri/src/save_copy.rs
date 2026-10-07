//! A bounded, single-owner new-copy transaction. PDF semantics stay in the shared reader.
//! No frontend-provided path reaches this module's dialog-facing API.
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File},
    io::{self, Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    sync::{
        Mutex,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
};
use tempfile::NamedTempFile;
use uuid::Uuid;

pub const MAX_SAVE_BYTES: u64 = 256 * 1024 * 1024;
pub const MAX_CHUNK_BYTES: usize = 1024 * 1024;
const CANCELLED: &str = "Saving was cancelled because the reader changed. Your edits remain open.";
type SaveResult<T> = Result<T, String>;

#[derive(Serialize)]
pub struct SaveTicket {
    pub token: String,
    pub filename: String,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SaveReceipt {
    pub filename: String,
    pub byte_length: u64,
    pub sha256: String,
}

pub struct Selection {
    pub token: String,
    pub filename: String,
    generation: u64,
    byte_length: u64,
    sha256: String,
}

struct Transaction {
    token: String,
    generation: u64,
    filename: String,
    destination: PathBuf,
    temporary: NamedTempFile,
    byte_length: u64,
    sha256: String,
    written: u64,
}

#[derive(Default)]
enum Phase {
    #[default]
    Idle,
    Closing,
    Selecting {
        token: String,
        generation: u64,
    },
    Writing(Transaction),
    Working {
        token: String,
        generation: u64,
    },
}

#[derive(Default)]
pub struct SaveManager {
    phase: Mutex<Phase>,
    generation: AtomicU64,
    busy: AtomicBool,
}

impl SaveManager {
    pub fn is_busy(&self) -> bool {
        self.busy.load(Ordering::Acquire)
    }

    /// Reserve before the native picker opens, including while its callback is pending.
    pub fn select(
        &self,
        filename: String,
        byte_length: u64,
        sha256: String,
    ) -> SaveResult<Selection> {
        validate_filename(&filename)?;
        if !(8..=MAX_SAVE_BYTES).contains(&byte_length) {
            return Err("Choose a nonempty PDF copy no larger than 256 MiB.".into());
        }
        if sha256.len() != 64
            || !sha256
                .bytes()
                .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
        {
            return Err("The PDF copy has an invalid integrity checksum.".into());
        }
        let mut phase = self
            .phase
            .lock()
            .map_err(|_| "The save service is unavailable.")?;
        if !matches!(*phase, Phase::Idle) {
            return Err(
                "Finish or cancel the current Save As dialog before saving another copy.".into(),
            );
        }
        let token = Uuid::new_v4().to_string();
        let generation = self.generation.load(Ordering::Acquire);
        *phase = Phase::Selecting {
            token: token.clone(),
            generation,
        };
        self.busy.store(true, Ordering::Release);
        Ok(Selection {
            token,
            filename,
            generation,
            byte_length,
            sha256,
        })
    }

    /// Only the Rust native-dialog callback supplies `destination`.
    pub fn selected(
        &self,
        selection: Selection,
        destination: Option<PathBuf>,
    ) -> SaveResult<Option<SaveTicket>> {
        let result = (|| {
            self.check_selection(&selection)?;
            let Some(destination) = destination else {
                return Ok(None);
            };
            let transaction = Transaction::new(&selection, &destination)?;
            let ticket = SaveTicket {
                token: transaction.token.clone(),
                filename: transaction.filename.clone(),
            };
            let mut phase = self
                .phase
                .lock()
                .map_err(|_| "The save service is unavailable.")?;
            if !selection_matches(&phase, &selection) || !self.current(selection.generation) {
                drop(phase);
                return combine_cleanup(Err(CANCELLED.into()), transaction.close());
            }
            *phase = Phase::Writing(transaction);
            Ok(Some(ticket))
        })();
        if !matches!(result, Ok(Some(_))) {
            self.release(&selection.token);
        }
        result
    }

    pub fn abandon_selection(&self, token: &str) {
        self.release(token);
    }

    fn check_selection(&self, selection: &Selection) -> SaveResult<()> {
        let phase = self
            .phase
            .lock()
            .map_err(|_| "The save service is unavailable.")?;
        if selection_matches(&phase, selection) && self.current(selection.generation) {
            Ok(())
        } else {
            Err(CANCELLED.into())
        }
    }

    pub fn append(&self, token: &str, offset: u64, bytes: &[u8]) -> SaveResult<u64> {
        let mut owned = Some(self.take(token)?);
        let result = (|| {
            let transaction = owned.as_mut().expect("The write owns its transaction");
            if !self.current(transaction.generation) {
                return Err(CANCELLED.into());
            }
            if bytes.is_empty() || bytes.len() > MAX_CHUNK_BYTES {
                return Err("The save chunk is empty or exceeds 1 MiB.".into());
            }
            if offset != transaction.written
                || bytes.len() as u64 > transaction.byte_length - transaction.written
            {
                return Err(
                    "The PDF save chunks arrived out of order or exceeded the declared size."
                        .into(),
                );
            }
            write_chunk(&mut transaction.temporary, bytes)?;
            transaction.written += bytes.len() as u64;
            let written = transaction.written;
            let mut phase = self
                .phase
                .lock()
                .map_err(|_| "The save service is unavailable.")?;
            if !working_matches(&phase, token, transaction.generation)
                || !self.current(transaction.generation)
            {
                return Err(CANCELLED.into());
            }
            *phase = Phase::Writing(owned.take().expect("The write owns its transaction"));
            Ok(written)
        })();
        if result.is_err() {
            let cleanup = owned
                .expect("A failed write retains its transaction")
                .close();
            self.release(token);
            return combine_cleanup(result, cleanup);
        }
        result
    }

    pub fn finish(&self, token: &str) -> SaveResult<SaveReceipt> {
        let transaction = self.take(token)?;
        let generation = transaction.generation;
        let result = transaction.publish(|| self.current(generation));
        self.release(token);
        result
    }

    pub fn cancel(&self, token: &str) -> SaveResult<()> {
        validate_token(token)?;
        let mut phase = self
            .phase
            .lock()
            .map_err(|_| "The save service is unavailable.")?;
        match &*phase {
            Phase::Writing(transaction) if transaction.token == token => {
                let generation = transaction.generation;
                let Phase::Writing(transaction) = std::mem::replace(
                    &mut *phase,
                    Phase::Working {
                        token: token.into(),
                        generation,
                    },
                ) else {
                    unreachable!()
                };
                drop(phase);
                let result = transaction.close();
                self.release(token);
                return result;
            }
            Phase::Working { token: current, .. } | Phase::Selecting { token: current, .. }
                if current == token =>
            {
                self.generation.fetch_add(1, Ordering::AcqRel);
            }
            // Cancellation is idempotent, and an old token cannot cancel a new save.
            _ => {}
        }
        Ok(())
    }

    /// Called on page-load start, window destruction and application exit.
    /// In-flight disk work notices the new generation before offering its result.
    pub fn invalidate(&self) {
        self.generation.fetch_add(1, Ordering::AcqRel);
        if let Ok(mut phase) = self.phase.lock()
            && matches!(*phase, Phase::Writing(_))
        {
            *phase = Phase::Idle;
            self.busy.store(false, Ordering::Release);
        }
        // A native dialog has no public programmatic cancel API. Keep its slot
        // until its callback returns, then reject the stale selection.
    }

    fn current(&self, generation: u64) -> bool {
        self.generation.load(Ordering::Acquire) == generation
    }

    fn take(&self, token: &str) -> SaveResult<Transaction> {
        validate_token(token)?;
        let mut phase = self
            .phase
            .lock()
            .map_err(|_| "The save service is unavailable.")?;
        if !matches!(&*phase, Phase::Writing(transaction) if transaction.token == token) {
            return Err("This PDF save transaction is unavailable or already finished.".into());
        }
        let Phase::Writing(transaction) = std::mem::take(&mut *phase) else {
            unreachable!()
        };
        *phase = Phase::Working {
            token: transaction.token.clone(),
            generation: transaction.generation,
        };
        Ok(transaction)
    }

    fn release(&self, token: &str) {
        if let Ok(mut phase) = self.phase.lock() {
            let matches = match &*phase {
                Phase::Selecting { token: current, .. } | Phase::Working { token: current, .. } => {
                    current == token
                }
                Phase::Writing(transaction) => transaction.token == token,
                Phase::Idle | Phase::Closing => false,
            };
            if matches {
                *phase = Phase::Idle;
                self.busy.store(false, Ordering::Release);
            }
        }
    }

    /// Reserve before destruction so a racing command cannot open a new dialog.
    pub fn begin_close(&self) -> SaveResult<()> {
        if self.is_busy() {
            return Err(
                "Finish or cancel Save As before closing Folio. Your document remains open.".into(),
            );
        }
        let mut phase = self
            .phase
            .lock()
            .map_err(|_| "The save service is unavailable.")?;
        if !matches!(*phase, Phase::Idle) {
            return Err(
                "Folio is finishing another desktop task. Your document remains open.".into(),
            );
        }
        *phase = Phase::Closing;
        Ok(())
    }

    pub fn close_failed(&self) {
        if let Ok(mut phase) = self.phase.lock()
            && matches!(*phase, Phase::Closing)
        {
            *phase = Phase::Idle;
        }
    }
}

fn selection_matches(phase: &Phase, selection: &Selection) -> bool {
    matches!(phase, Phase::Selecting { token, generation } if token == &selection.token && generation == &selection.generation)
}
fn working_matches(phase: &Phase, token: &str, generation: u64) -> bool {
    matches!(phase, Phase::Working { token: current, generation: captured } if current == token && *captured == generation)
}
fn validate_token(token: &str) -> SaveResult<()> {
    if token.len() == 36
        && token.bytes().enumerate().all(|(index, c)| {
            if [8, 13, 18, 23].contains(&index) {
                c == b'-'
            } else {
                c.is_ascii_digit() || (b'a'..=b'f').contains(&c)
            }
        })
    {
        Ok(())
    } else {
        Err("The PDF save token is invalid.".into())
    }
}
fn validate_filename(filename: &str) -> SaveResult<()> {
    if filename.encode_utf16().count() > 255
        || filename.len() < 5
        || !filename.to_ascii_lowercase().ends_with(".pdf")
        || filename
            .chars()
            .any(|c| c.is_control() || "<>:\"/\\|?*".contains(c))
        || filename.trim() != filename
    {
        return Err("Choose a PDF filename without path separators or special characters.".into());
    }
    let base = filename
        .split('.')
        .next()
        .unwrap_or("")
        .trim_end_matches([' ', '.'])
        .to_ascii_uppercase();
    if ["CON", "PRN", "AUX", "NUL"].contains(&base.as_str())
        || ["COM", "LPT"].iter().any(|prefix| {
            base.strip_prefix(prefix).is_some_and(|number| {
                ["1", "2", "3", "4", "5", "6", "7", "8", "9", "¹", "²", "³"].contains(&number)
            })
        })
    {
        return Err("Choose a PDF filename that is not a reserved Windows device name.".into());
    }
    Ok(())
}

fn combine_cleanup<T>(result: SaveResult<T>, cleanup: SaveResult<()>) -> SaveResult<T> {
    match (result, cleanup) {
        (Err(error), Err(cleanup)) => Err(format!("{error} {cleanup}")),
        (Ok(_), Err(cleanup)) => Err(cleanup),
        (result, Ok(())) => result,
    }
}

impl Transaction {
    fn new(selection: &Selection, destination: &Path) -> SaveResult<Self> {
        if !destination.is_absolute() {
            return Err("The Save As dialog did not choose an absolute file location.".into());
        }
        let filename = destination
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or("Choose a valid Unicode PDF filename.")?
            .to_owned();
        validate_filename(&filename)?;
        let parent = destination
            .parent()
            .ok_or("Choose a folder for your PDF copy.")?
            .canonicalize()
            .map_err(|e| disk_error("open the selected folder", e))?;
        let destination = parent.join(&filename);
        match fs::symlink_metadata(&destination) {
            Ok(_) => return Err("A file or folder already has that name. Choose a new name; Folio never overwrites an existing file.".into()),
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Err(e) => return Err(disk_error("check the selected file location", e)),
        }
        let temporary = tempfile::Builder::new()
            .prefix(".folio-save-")
            .suffix(".tmp")
            .tempfile_in(parent)
            .map_err(|e| disk_error("create a temporary file in the selected folder", e))?;
        Ok(Self {
            token: selection.token.clone(),
            generation: selection.generation,
            filename,
            destination,
            temporary,
            byte_length: selection.byte_length,
            sha256: selection.sha256.clone(),
            written: 0,
        })
    }

    fn close(self) -> SaveResult<()> {
        self.temporary
            .close()
            .map_err(|e| disk_error("remove its temporary save file", e))
    }

    fn prepare_publish(&mut self, current: &impl Fn() -> bool) -> SaveResult<()> {
        if self.written != self.byte_length {
            return Err(
                "The PDF copy is incomplete. Nothing was saved to the selected filename.".into(),
            );
        }
        self.temporary
            .as_file()
            .sync_all()
            .map_err(|e| disk_error("flush the PDF copy to disk", e))?;
        verify_disk(
            self.temporary.as_file_mut(),
            self.byte_length,
            &self.sha256,
            current,
        )?;
        if !current() {
            return Err(CANCELLED.into());
        }
        Ok(())
    }

    fn publish(mut self, current: impl Fn() -> bool) -> SaveResult<SaveReceipt> {
        if let Err(error) = self.prepare_publish(&current) {
            return combine_cleanup(Err(error), self.close());
        }
        // This operation never replaces an existing file, including one created
        // after the native picker returned. It uses platform-specific no-clobber
        // publication, rather than a check followed by an overwriting rename.
        let published = match self.temporary.persist_noclobber(&self.destination) {
            Ok(file) => file,
            Err(error) => {
                let original = disk_error(
                    "publish the new PDF copy (choose a new name if it exists)",
                    error.error,
                );
                let cleanup = error
                    .file
                    .close()
                    .map_err(|e| disk_error("remove its temporary save file", e));
                return combine_cleanup(Err(original), cleanup);
            }
        };
        published
            .sync_all()
            .map_err(|e| disk_error("confirm the saved PDF copy on disk", e))?;
        let mut disk = File::open(&self.destination)
            .map_err(|e| disk_error("reopen the saved PDF copy", e))?;
        verify_disk(&mut disk, self.byte_length, &self.sha256, &current)?;
        if !current() {
            return Err(CANCELLED.into());
        }
        Ok(SaveReceipt {
            filename: self.filename,
            byte_length: self.byte_length,
            sha256: self.sha256,
        })
    }
}

fn verify_disk(
    file: &mut File,
    expected_length: u64,
    expected_sha256: &str,
    current: &impl Fn() -> bool,
) -> SaveResult<()> {
    file.seek(SeekFrom::Start(0))
        .map_err(|e| disk_error("read back the PDF copy", e))?;
    if file
        .metadata()
        .map_err(|e| disk_error("check the PDF copy size", e))?
        .len()
        != expected_length
    {
        return Err("The PDF copy on disk has an unexpected size. Your edits remain open.".into());
    }
    let mut digest = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    let mut length = 0;
    let mut header = Vec::with_capacity(1024);
    loop {
        if !current() {
            return Err(CANCELLED.into());
        }
        let count = file
            .read(&mut buffer)
            .map_err(|e| disk_error("read back the PDF copy", e))?;
        if count == 0 {
            break;
        }
        if header.len() < 1024 {
            header.extend_from_slice(&buffer[..count.min(1024 - header.len())]);
        }
        length += count as u64;
        if length > expected_length {
            return Err("The PDF copy changed during disk verification.".into());
        }
        digest.update(&buffer[..count]);
    }
    if length != expected_length || format!("{:x}", digest.finalize()) != expected_sha256 {
        return Err(
            "The PDF copy on disk failed its integrity check. Your edits remain open.".into(),
        );
    }
    if !header.windows(5).any(|bytes| bytes == b"%PDF-") {
        return Err("The saved bytes do not contain a PDF header. Your edits remain open.".into());
    }
    Ok(())
}

fn disk_error(action: &str, error: io::Error) -> String {
    // ErrorKind explains the failure without leaking document paths or contents.
    let reason = match error.kind() {
        io::ErrorKind::PermissionDenied => {
            "Permission was denied. Check access to the selected folder."
        }
        io::ErrorKind::AlreadyExists => {
            "That filename already exists. Choose a new name; existing files are unchanged."
        }
        io::ErrorKind::StorageFull => "The disk is full. Free space or choose another folder.",
        io::ErrorKind::NotFound => "The selected folder or file is no longer available.",
        _ => "The disk operation failed. Check the selected drive and folder.",
    };
    format!("Folio could not {action}. {reason} Your edits remain open.")
}

fn write_chunk(writer: &mut impl Write, bytes: &[u8]) -> SaveResult<()> {
    writer
        .write_all(bytes)
        .map_err(|e| disk_error("write the temporary PDF copy", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn pdf() -> Vec<u8> {
        b"%PDF-1.7\nsynthetic local test bytes\n%%EOF\n".to_vec()
    }
    fn sha(bytes: &[u8]) -> String {
        format!("{:x}", Sha256::digest(bytes))
    }
    fn start_ticket(manager: &SaveManager, dir: &TempDir, bytes: &[u8], name: &str) -> SaveTicket {
        let selection = manager
            .select(name.into(), bytes.len() as u64, sha(bytes))
            .unwrap();
        manager
            .selected(selection, Some(dir.path().join(name)))
            .unwrap()
            .unwrap()
    }
    fn entries(dir: &TempDir) -> usize {
        fs::read_dir(dir.path()).unwrap().count()
    }

    #[test]
    fn unicode_copy_returns_exact_disk_receipt_and_original_is_untouched() {
        let dir = tempfile::tempdir().unwrap();
        let manager = SaveManager::default();
        let bytes = pdf();
        let original = dir.path().join("original.pdf");
        fs::write(&original, b"existing original").unwrap();
        let ticket = start_ticket(&manager, &dir, &bytes, "読書 café-folio.pdf");
        assert!(manager.is_busy());
        assert_eq!(manager.append(&ticket.token, 0, &bytes[..8]).unwrap(), 8);
        manager.append(&ticket.token, 8, &bytes[8..]).unwrap();
        assert_eq!(
            manager.finish(&ticket.token).unwrap(),
            SaveReceipt {
                filename: ticket.filename.clone(),
                byte_length: bytes.len() as u64,
                sha256: sha(&bytes)
            }
        );
        assert_eq!(fs::read(dir.path().join(ticket.filename)).unwrap(), bytes);
        assert_eq!(fs::read(original).unwrap(), b"existing original");
        assert_eq!(entries(&dir), 2);
        assert!(!manager.is_busy());
    }

    #[test]
    fn cancelled_picker_releases_slot_and_never_creates_a_file() {
        let manager = SaveManager::default();
        let bytes = pdf();
        let selection = manager
            .select("copy.pdf".into(), bytes.len() as u64, sha(&bytes))
            .unwrap();
        assert!(manager.is_busy());
        assert!(manager.selected(selection, None).unwrap().is_none());
        assert!(!manager.is_busy());
        assert!(
            manager
                .select("next.pdf".into(), bytes.len() as u64, sha(&bytes))
                .is_ok()
        );
    }

    #[test]
    fn competing_picker_is_rejected_until_stale_callback_finishes() {
        let manager = SaveManager::default();
        let dir = tempfile::tempdir().unwrap();
        let bytes = pdf();
        let selection = manager
            .select("copy.pdf".into(), bytes.len() as u64, sha(&bytes))
            .unwrap();
        manager.invalidate();
        assert!(manager.is_busy());
        assert!(
            manager
                .select("other.pdf".into(), bytes.len() as u64, sha(&bytes))
                .is_err()
        );
        assert!(
            manager
                .selected(selection, Some(dir.path().join("copy.pdf")))
                .is_err()
        );
        assert_eq!(entries(&dir), 0);
        assert!(!manager.is_busy());
    }

    #[test]
    fn existing_and_racing_destinations_are_never_overwritten() {
        let manager = SaveManager::default();
        let dir = tempfile::tempdir().unwrap();
        let bytes = pdf();
        let path = dir.path().join("copy.pdf");
        fs::write(&path, b"original").unwrap();
        let selection = manager
            .select("copy.pdf".into(), bytes.len() as u64, sha(&bytes))
            .unwrap();
        assert!(manager.selected(selection, Some(path.clone())).is_err());
        assert!(!manager.is_busy());
        fs::remove_file(&path).unwrap();
        let ticket = start_ticket(&manager, &dir, &bytes, "copy.pdf");
        manager.append(&ticket.token, 0, &bytes).unwrap();
        fs::write(&path, b"concurrent file").unwrap();
        assert!(manager.finish(&ticket.token).is_err());
        assert_eq!(fs::read(path).unwrap(), b"concurrent file");
        assert_eq!(entries(&dir), 1);
        assert!(!manager.is_busy());
    }

    #[test]
    fn incomplete_checksum_invalid_header_and_changed_disk_fail_without_publication() {
        for failure in ["short", "digest", "header", "disk", "length"] {
            let manager = SaveManager::default();
            let dir = tempfile::tempdir().unwrap();
            let bytes = if failure == "header" {
                b"not a PDF document".to_vec()
            } else {
                pdf()
            };
            let digest = if failure == "digest" {
                "0".repeat(64)
            } else {
                sha(&bytes)
            };
            let selection = manager
                .select("copy.pdf".into(), bytes.len() as u64, digest)
                .unwrap();
            let ticket = manager
                .selected(selection, Some(dir.path().join("copy.pdf")))
                .unwrap()
                .unwrap();
            manager
                .append(
                    &ticket.token,
                    0,
                    if failure == "short" {
                        &bytes[..8]
                    } else {
                        &bytes
                    },
                )
                .unwrap();
            if failure == "disk" {
                let mut phase = manager.phase.lock().unwrap();
                let Phase::Writing(transaction) = &mut *phase else {
                    panic!()
                };
                transaction
                    .temporary
                    .as_file_mut()
                    .seek(SeekFrom::Start(10))
                    .unwrap();
                transaction.temporary.write_all(b"X").unwrap();
            }
            if failure == "length" {
                let mut phase = manager.phase.lock().unwrap();
                let Phase::Writing(transaction) = &mut *phase else {
                    panic!()
                };
                transaction
                    .temporary
                    .as_file_mut()
                    .set_len(bytes.len() as u64 - 1)
                    .unwrap();
            }
            assert!(manager.finish(&ticket.token).is_err(), "{failure}");
            assert_eq!(entries(&dir), 0, "{failure}");
            assert!(!manager.is_busy());
        }
    }

    #[test]
    fn invalid_chunk_cleans_staging_but_foreign_tokens_cannot_cancel_correct_save() {
        let manager = SaveManager::default();
        let dir = tempfile::tempdir().unwrap();
        let bytes = pdf();
        let ticket = start_ticket(&manager, &dir, &bytes, "copy.pdf");
        let foreign = Uuid::nil().to_string();
        assert!(manager.append(&foreign, 0, &bytes).is_err());
        manager.cancel(&foreign).unwrap();
        assert!(manager.is_busy());
        assert!(manager.append(&ticket.token, 1, &bytes).is_err());
        assert_eq!(entries(&dir), 0);
        assert!(!manager.is_busy());
    }

    #[test]
    fn explicit_cancel_and_reload_remove_partial_temp_and_reject_old_tokens() {
        for reload in [false, true] {
            let manager = SaveManager::default();
            let dir = tempfile::tempdir().unwrap();
            let bytes = pdf();
            let old = start_ticket(&manager, &dir, &bytes, "copy.pdf");
            manager.append(&old.token, 0, &bytes[..8]).unwrap();
            if reload {
                manager.invalidate();
            } else {
                manager.cancel(&old.token).unwrap();
            }
            assert_eq!(entries(&dir), 0);
            assert!(!manager.is_busy());
            assert!(manager.finish(&old.token).is_err());
            let next = start_ticket(&manager, &dir, &bytes, "next.pdf");
            manager.cancel(&old.token).unwrap();
            manager.append(&next.token, 0, &bytes).unwrap();
            manager.finish(&next.token).unwrap();
            assert_eq!(entries(&dir), 1);
        }
    }

    #[test]
    fn limits_names_and_checksums_are_validated_before_dialog() {
        let manager = SaveManager::default();
        let digest = sha(&pdf());
        for name in [
            "../copy.pdf",
            "C:\\copy.pdf",
            "bad?.pdf",
            "copy.txt",
            ".pdf",
            " copy.pdf",
            "CON.pdf",
            "con.other.pdf",
            "COM1.pdf",
            "LPT³.pdf",
            "copy.pdf:stream.pdf",
        ] {
            assert!(manager.select(name.into(), 10, digest.clone()).is_err());
        }
        for length in [0, MAX_SAVE_BYTES + 1] {
            assert!(
                manager
                    .select("copy.pdf".into(), length, digest.clone())
                    .is_err()
            );
        }
        assert!(
            manager
                .select("copy.pdf".into(), 10, "A".repeat(64))
                .is_err()
        );
        assert!(!manager.is_busy());
        let selection = manager
            .select("copy.pdf".into(), MAX_SAVE_BYTES, digest)
            .unwrap();
        manager.abandon_selection(&selection.token);
    }

    #[test]
    fn chunk_boundary_is_bounded_and_large_supported_output_streams() {
        let manager = SaveManager::default();
        let dir = tempfile::tempdir().unwrap();
        let mut bytes = vec![0u8; MAX_CHUNK_BYTES * 2 + 5];
        bytes[..5].copy_from_slice(b"%PDF-");
        let ticket = start_ticket(&manager, &dir, &bytes, "large.pdf");
        let mut offset = 0;
        for chunk in bytes.chunks(MAX_CHUNK_BYTES) {
            offset = manager.append(&ticket.token, offset, chunk).unwrap();
        }
        assert_eq!(
            manager.finish(&ticket.token).unwrap().byte_length,
            bytes.len() as u64
        );
        let ticket = start_ticket(&manager, &dir, &bytes, "oversized.pdf");
        assert!(
            manager
                .append(&ticket.token, 0, &bytes[..MAX_CHUNK_BYTES + 1])
                .is_err()
        );
        assert_eq!(entries(&dir), 1);
    }

    #[test]
    fn missing_folder_and_invalid_selected_filename_release_slot() {
        for name in ["missing/copy.pdf", "copy.txt"] {
            let manager = SaveManager::default();
            let dir = tempfile::tempdir().unwrap();
            let bytes = pdf();
            let selection = manager
                .select("copy.pdf".into(), bytes.len() as u64, sha(&bytes))
                .unwrap();
            assert!(
                manager
                    .selected(selection, Some(dir.path().join(name)))
                    .is_err()
            );
            assert_eq!(entries(&dir), 0);
            assert!(!manager.is_busy());
        }
    }

    #[test]
    fn disk_errors_do_not_expose_private_paths_and_full_disk_is_actionable() {
        let error = disk_error(
            "save",
            io::Error::new(io::ErrorKind::StorageFull, "C:\\private\\secret.pdf"),
        );
        assert!(error.contains("disk is full"));
        assert!(!error.contains("private"));
        assert!(
            disk_error("save", io::Error::from(io::ErrorKind::PermissionDenied))
                .contains("Permission was denied")
        );
    }

    #[test]
    fn read_only_write_handle_and_write_only_readback_fail_and_remove_temp() {
        for readback in [false, true] {
            let manager = SaveManager::default();
            let dir = tempfile::tempdir().unwrap();
            let bytes = pdf();
            let ticket = start_ticket(&manager, &dir, &bytes, "copy.pdf");
            if readback {
                manager.append(&ticket.token, 0, &bytes).unwrap();
            }
            {
                let mut phase = manager.phase.lock().unwrap();
                let Phase::Writing(transaction) = &mut *phase else {
                    panic!()
                };
                let replacement = if readback {
                    fs::OpenOptions::new()
                        .write(true)
                        .open(transaction.temporary.path())
                        .unwrap()
                } else {
                    File::open(transaction.temporary.path()).unwrap()
                };
                *transaction.temporary.as_file_mut() = replacement;
            }
            let failed = if readback {
                manager.finish(&ticket.token).map(|_| ())
            } else {
                manager.append(&ticket.token, 0, &bytes).map(|_| ())
            };
            assert!(failed.is_err());
            assert_eq!(entries(&dir), 0);
            assert!(!manager.is_busy());
        }
    }

    #[cfg(windows)]
    #[test]
    fn actual_flush_failure_does_not_publish_or_acknowledge_copy() {
        let manager = SaveManager::default();
        let dir = tempfile::tempdir().unwrap();
        let bytes = pdf();
        let ticket = start_ticket(&manager, &dir, &bytes, "copy.pdf");
        manager.append(&ticket.token, 0, &bytes).unwrap();
        {
            let mut phase = manager.phase.lock().unwrap();
            let Phase::Writing(transaction) = &mut *phase else {
                panic!()
            };
            *transaction.temporary.as_file_mut() =
                File::open(transaction.temporary.path()).unwrap();
        }
        assert!(manager.finish(&ticket.token).unwrap_err().contains("flush"));
        assert_eq!(entries(&dir), 0);
        assert!(!manager.is_busy());
    }

    #[test]
    fn partial_disk_full_error_is_reported_after_short_write() {
        struct FullDisk {
            written: Vec<u8>,
        }
        impl Write for FullDisk {
            fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
                if self.written.is_empty() {
                    self.written.extend_from_slice(&bytes[..3]);
                    Ok(3)
                } else {
                    Err(io::Error::from(io::ErrorKind::StorageFull))
                }
            }
            fn flush(&mut self) -> io::Result<()> {
                Ok(())
            }
        }
        let mut disk = FullDisk { written: vec![] };
        assert!(
            write_chunk(&mut disk, &pdf())
                .unwrap_err()
                .contains("disk is full")
        );
        assert_eq!(disk.written, b"%PD");
    }

    #[test]
    fn close_reservation_rejects_save_races_and_failed_close_allows_retry() {
        let manager = SaveManager::default();
        let bytes = pdf();
        let selection = manager
            .select("copy.pdf".into(), bytes.len() as u64, sha(&bytes))
            .unwrap();
        assert!(manager.begin_close().is_err());
        manager.abandon_selection(&selection.token);
        manager.begin_close().unwrap();
        assert!(
            manager
                .select("copy.pdf".into(), bytes.len() as u64, sha(&bytes))
                .is_err()
        );
        manager.close_failed();
        assert!(
            manager
                .select("copy.pdf".into(), bytes.len() as u64, sha(&bytes))
                .is_ok()
        );
    }

    #[test]
    fn cancellation_during_disk_work_defers_close_and_removes_temp_before_release() {
        let manager = SaveManager::default();
        let dir = tempfile::tempdir().unwrap();
        let bytes = pdf();
        let ticket = start_ticket(&manager, &dir, &bytes, "copy.pdf");
        manager.append(&ticket.token, 0, &bytes).unwrap();
        let transaction = manager.take(&ticket.token).unwrap();
        let generation = transaction.generation;
        manager.cancel(&ticket.token).unwrap();
        assert!(manager.begin_close().is_err());
        assert!(transaction.publish(|| manager.current(generation)).is_err());
        manager.release(&ticket.token);
        assert_eq!(entries(&dir), 0);
        assert!(!manager.is_busy());
        manager.begin_close().unwrap();
    }

    #[cfg(windows)]
    #[test]
    fn explicit_cancel_surfaces_real_temporary_delete_failure() {
        use std::os::windows::fs::OpenOptionsExt;
        let manager = SaveManager::default();
        let dir = tempfile::tempdir().unwrap();
        let bytes = pdf();
        let ticket = start_ticket(&manager, &dir, &bytes, "copy.pdf");
        let temp_path = {
            let phase = manager.phase.lock().unwrap();
            let Phase::Writing(transaction) = &*phase else {
                panic!()
            };
            transaction.temporary.path().to_owned()
        };
        // FILE_SHARE_READ | FILE_SHARE_WRITE permits the writer's existing handle
        // but omits FILE_SHARE_DELETE, preventing temporary-file cleanup.
        let blocker = fs::OpenOptions::new()
            .read(true)
            .share_mode(0x1 | 0x2)
            .open(&temp_path)
            .unwrap();
        assert!(
            manager
                .cancel(&ticket.token)
                .unwrap_err()
                .contains("remove its temporary")
        );
        assert!(!manager.is_busy());
        assert!(!dir.path().join("copy.pdf").exists());
        assert!(temp_path.exists());
        drop(blocker);
        fs::remove_file(temp_path).unwrap();
        assert_eq!(entries(&dir), 0);
    }

    #[test]
    fn reader_compatible_leading_bytes_are_preserved_exactly() {
        let manager = SaveManager::default();
        let dir = tempfile::tempdir().unwrap();
        let mut bytes = b"leading bytes\n".to_vec();
        bytes.extend_from_slice(&pdf());
        let ticket = start_ticket(&manager, &dir, &bytes, "copy.pdf");
        manager.append(&ticket.token, 0, &bytes).unwrap();
        manager.finish(&ticket.token).unwrap();
        assert_eq!(fs::read(dir.path().join("copy.pdf")).unwrap(), bytes);
    }

    #[test]
    fn supported_150_mib_roundtrip_uses_one_reusable_chunk_and_exact_disk_digest() {
        let manager = SaveManager::default();
        let dir = tempfile::tempdir().unwrap();
        let mut chunk = vec![0u8; MAX_CHUNK_BYTES];
        chunk[..5].copy_from_slice(b"%PDF-");
        let mut expected = Sha256::new();
        expected.update(&chunk);
        chunk[..5].fill(0);
        for _ in 1..150 {
            expected.update(&chunk);
        }
        let expected = format!("{:x}", expected.finalize());
        let length = 150 * MAX_CHUNK_BYTES as u64;
        let selection = manager
            .select("large.pdf".into(), length, expected.clone())
            .unwrap();
        let ticket = manager
            .selected(selection, Some(dir.path().join("large.pdf")))
            .unwrap()
            .unwrap();
        chunk[..5].copy_from_slice(b"%PDF-");
        manager.append(&ticket.token, 0, &chunk).unwrap();
        chunk[..5].fill(0);
        for index in 1..150 {
            manager
                .append(&ticket.token, index * MAX_CHUNK_BYTES as u64, &chunk)
                .unwrap();
        }
        let receipt = manager.finish(&ticket.token).unwrap();
        assert_eq!(receipt.byte_length, length);
        assert_eq!(receipt.sha256, expected);
        let mut disk = File::open(dir.path().join("large.pdf")).unwrap();
        assert_eq!(disk.metadata().unwrap().len(), length);
        let mut digest = Sha256::new();
        loop {
            let count = disk.read(&mut chunk).unwrap();
            if count == 0 {
                break;
            }
            digest.update(&chunk[..count]);
        }
        assert_eq!(format!("{:x}", digest.finalize()), expected);
        assert_eq!(entries(&dir), 1);
        assert!(!manager.is_busy());
    }
}
