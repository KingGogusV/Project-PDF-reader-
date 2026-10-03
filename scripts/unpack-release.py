"""Extract only the bounded flat release payload produced by this repository."""
import pathlib
import sys
import zipfile

archive, destination = map(pathlib.Path, sys.argv[1:3])
allowed = {
    "Folio-0.1.0-Windows-x64-Setup.exe", "Folio-0.1.0-Third-Party-Notices.zip",
    "SHA256SUMS.txt", "release-provenance.json",
}
destination.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(archive) as bundle:
    entries = bundle.infolist()
    if {e.filename for e in entries} != allowed or len(entries) != len(allowed):
        raise RuntimeError("Unexpected release archive entries")
    if sum(e.file_size for e in entries) > 300 * 1024 * 1024:
        raise RuntimeError("Release archive exceeds the extraction limit")
    for entry in entries:
        if entry.is_dir() or entry.flag_bits & 1:
            raise RuntimeError("Unsupported release archive entry")
        with (destination / entry.filename).open("xb") as output:
            output.write(bundle.read(entry))
