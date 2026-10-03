"""Exercise the real release extractor with small, synthetic hostile ZIP inputs."""
import pathlib
import struct
import subprocess
import sys
import tempfile
import unittest
import warnings
import zipfile


PROJECT = pathlib.Path(__file__).resolve().parents[2]
EXTRACTOR = PROJECT / "scripts" / "unpack-release.py"
PAYLOAD = {
    "Folio-0.1.0-Windows-x64-Setup.exe": b"MZ synthetic installer fixture\x00\x01",
    "Folio-0.1.0-Third-Party-Notices.zip": b"opaque synthetic notice archive",
    "SHA256SUMS.txt": b"synthetic checksum fixture\n",
    "release-provenance.json": b'{"synthetic":true}\n',
}


class ReleaseExtractionTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="folio-release-test-")
        self.root = pathlib.Path(self.temporary.name).resolve()
        # Cleanup owns only the fresh directory created above, never a user path.
        self.assertEqual(self.root.parent, pathlib.Path(tempfile.gettempdir()).resolve())
        self.addCleanup(self.temporary.cleanup)
        self.archive = self.root / "payload.zip"
        self.output = self.root / "output"

    def archive_entries(self, entries=None):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)  # intentional duplicate member test
            with zipfile.ZipFile(self.archive, "w", compression=zipfile.ZIP_STORED) as bundle:
                for name, data in (PAYLOAD.items() if entries is None else entries):
                    bundle.writestr(name, data)

    def extract(self):
        return subprocess.run(
            [sys.executable, str(EXTRACTOR), str(self.archive), str(self.output)],
            cwd=PROJECT, capture_output=True, text=True, timeout=10, check=False,
        )

    def rejected(self, message):
        result = self.extract()
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn(message, result.stderr)
        return result

    def assert_no_payload_extracted(self):
        self.assertTrue(not self.output.exists() or not list(self.output.iterdir()))

    def test_exact_four_flat_files_extract_without_changing_bytes(self):
        self.archive_entries()
        result = self.extract()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual({path.name for path in self.output.iterdir()}, set(PAYLOAD))
        for name, expected in PAYLOAD.items():
            with self.subTest(name=name):
                path = self.output / name
                self.assertTrue(path.is_file())
                self.assertFalse(path.is_symlink())
                self.assertEqual(path.read_bytes(), expected)

    def test_missing_required_member_is_rejected_before_extraction(self):
        self.archive_entries(list(PAYLOAD.items())[:-1])
        self.rejected("Unexpected release archive entries")
        self.assert_no_payload_extracted()

    def test_unexpected_traversal_absolute_and_nested_members_are_rejected(self):
        outside = self.root / "outside.txt"
        outside.write_bytes(b"preserve unrelated existing file")
        hostile_names = (
            "unexpected.exe", "../outside.txt", "..\\outside.txt",
            str(outside), "nested/SHA256SUMS.txt", "directory/",
        )
        for name in hostile_names:
            with self.subTest(name=name):
                self.archive_entries([*PAYLOAD.items(), (name, b"must not be written")])
                self.rejected("Unexpected release archive entries")
                self.assert_no_payload_extracted()
                self.assertEqual(outside.read_bytes(), b"preserve unrelated existing file")

    def test_duplicate_allowed_member_is_rejected_before_extraction(self):
        self.archive_entries([*PAYLOAD.items(), ("SHA256SUMS.txt", b"duplicate override")])
        self.rejected("Unexpected release archive entries")
        self.assert_no_payload_extracted()

    def test_existing_output_file_is_never_overwritten(self):
        self.archive_entries()
        self.output.mkdir()
        existing = self.output / "SHA256SUMS.txt"
        existing.write_bytes(b"previous output must survive")
        self.rejected("FileExistsError")
        self.assertEqual(existing.read_bytes(), b"previous output must survive")
        # The current extractor may leave earlier new members on failure; the
        # release job treats any failed extraction as fatal, not a usable payload.

    def test_oversized_declared_payload_is_rejected_without_allocating_it(self):
        self.archive_entries()
        data = bytearray(self.archive.read_bytes())
        central = data.index(b"PK\x01\x02")
        # ZIP central-directory uncompressed size is offset 24. Patch metadata,
        # keeping the archive tiny; no 300 MiB allocation/compression is required.
        declared = 300 * 1024 * 1024 + 1
        struct.pack_into("<I", data, central + 24, declared)
        self.archive.write_bytes(data)
        self.assertLess(self.archive.stat().st_size, 4096)
        with zipfile.ZipFile(self.archive) as bundle:
            self.assertEqual(bundle.infolist()[0].file_size, declared)
        self.rejected("Release archive exceeds the extraction limit")
        self.assert_no_payload_extracted()

    def test_encrypted_member_flag_is_rejected_before_reading_payload(self):
        self.archive_entries()
        data = bytearray(self.archive.read_bytes())
        central = data.index(b"PK\x01\x02")
        flags = struct.unpack_from("<H", data, central + 8)[0]
        struct.pack_into("<H", data, central + 8, flags | 1)
        self.archive.write_bytes(data)
        with zipfile.ZipFile(self.archive) as bundle:
            self.assertTrue(bundle.infolist()[0].flag_bits & 1)
        self.rejected("Unsupported release archive entry")
        self.assert_no_payload_extracted()

    def test_invalid_zip_is_rejected(self):
        self.archive.write_bytes(b"not a zip archive")
        self.rejected("BadZipFile")
        self.assert_no_payload_extracted()


if __name__ == "__main__":
    unittest.main()
