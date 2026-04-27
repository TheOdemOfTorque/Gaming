#!/usr/bin/env python3
"""
check_recovered_files.py

Reads an R-Studio / R-Disc recovery log file, extracts all file paths that
appear in error/warning lines, and checks whether those files already exist
on the Synology NAS.

R-Studio saves its log as a tab-separated file with four columns:
    Type <TAB> Date <TAB> Time <TAB> Text

The "Text" column contains messages like:
    Error: Cannot read from ... /Volumes/USB/Photos/img001.jpg
    Warning: File /Volumes/USB/Documents/file.docx could not be recovered
    Error copying /Volumes/USB/Video/clip.mp4: I/O error

This script parses those lines, maps the original USB paths to the
corresponding NAS paths, and reports what is already saved and what is still
missing.

Usage examples
--------------
  # Check which log format is being detected (run this first!):
  python3 check_recovered_files.py recovery.log /Volumes/Synology --scan-log

  # Full check – strip the original USB prefix before looking on the NAS:
  python3 check_recovered_files.py recovery.log /Volumes/Synology \\
      --original-prefix /Volumes/USB_Drive \\
      --output report.txt

  # Only list missing files (handy for a second R-Studio pass):
  python3 check_recovered_files.py recovery.log /Volumes/Synology \\
      --original-prefix /Volumes/USB_Drive \\
      --missing-only --output missing.txt
"""

import argparse
import os
import re
import sys
from datetime import datetime
from pathlib import Path


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# R-Studio log levels that indicate a problem
ERROR_TYPES = {"error", "warning", "fehler", "warnung"}

# Keywords that mark a line as an error/warning (used when log is plain text)
ERROR_TOKENS = [
    "error", "fehler", "warning", "warnung",
    "failed", "fehlgeschlagen", "cannot", "kann nicht",
    "unable", "nicht möglich", "skip", "überspringen",
    "bad sector", "bad block", "lesefehler", "read error",
    "crc", "i/o error", "unreadable", "nicht lesbar",
    "could not", "konnte nicht",
]

# Regex patterns to extract file paths from a text fragment.
# Tried in order; first match wins.
PATH_PATTERNS = [
    # macOS absolute path under /Volumes, /Users, /private, etc.
    r'(/(?:Volumes|Users|home|tmp|var|private)/[^\s\'"<>|\r\n]+)',
    # Any absolute Unix path that contains at least one directory separator
    # and ends with a file extension (1–15 chars)
    r'(/(?:[^/\s\'"<>|\r\n]+/)+[^/\s\'"<>|\r\n]+\.[^\s\'"<>|\r\n]{1,15})',
    # Windows-style paths (sometimes embedded in Mac recovery logs)
    r'([A-Za-z]:\\(?:[^\\\s\'"<>|\r\n]+\\)*[^\\\s\'"<>|\r\n]+)',
]


# ---------------------------------------------------------------------------
# Log parsing
# ---------------------------------------------------------------------------

def _extract_paths(text: str) -> list[str]:
    """Return all file paths found in `text`, de-duplicated, in order."""
    found: list[str] = []
    seen: set[str] = set()
    for pattern in PATH_PATTERNS:
        for m in re.findall(pattern, text):
            p = m.strip().rstrip('.,;:)"\'')
            if p and p not in seen:
                seen.add(p)
                found.append(p)
        if found:
            break  # stop at first pattern that yields results
    return found


def _is_rstudio_tsv(line: str) -> bool:
    """Heuristic: does this look like an R-Studio TSV log line?"""
    parts = line.split("\t")
    if len(parts) < 4:
        return False
    type_col = parts[0].strip().lower()
    # Must start with a known log-level word
    return any(type_col.startswith(t) for t in ("error", "warning", "info",
                                                  "fehler", "warnung", "hint"))


def parse_log(log_path: str, all_lines: bool = False) -> tuple[list[str], list[str]]:
    """
    Parse the R-Studio/R-Disc log file and return:
        (error_paths, sample_error_lines)

    error_paths       – deduplicated list of file paths from error/warning lines
    sample_error_lines – up to 30 raw lines (for --scan-log preview)
    """
    error_paths: list[str] = []
    seen_paths: set[str] = set()
    sample_lines: list[str] = []

    encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]

    for enc in encodings:
        try:
            with open(log_path, "r", encoding=enc, errors="replace") as fh:
                tsv_mode: bool | None = None  # auto-detect on first non-empty line

                for raw_line in fh:
                    line = raw_line.rstrip("\r\n")
                    if not line.strip():
                        continue

                    # Auto-detect format on first real line
                    if tsv_mode is None:
                        tsv_mode = _is_rstudio_tsv(line)

                    is_error = False
                    text_to_scan = line

                    if tsv_mode:
                        # R-Studio TSV: Type \t Date \t Time \t Text
                        parts = line.split("\t", 3)
                        if len(parts) >= 1:
                            log_type = parts[0].strip().lower()
                            is_error = any(log_type.startswith(t) for t in ERROR_TYPES)
                            if len(parts) >= 4:
                                text_to_scan = parts[3]  # only scan the Text column
                            elif len(parts) == 3:
                                text_to_scan = parts[2]
                    else:
                        # Plain-text log: check for error keywords
                        low = line.lower()
                        is_error = all_lines or any(tok in low for tok in ERROR_TOKENS)

                    if is_error or all_lines:
                        paths = _extract_paths(text_to_scan)
                        if paths and len(sample_lines) < 30:
                            sample_lines.append(line)
                        for p in paths:
                            if p not in seen_paths:
                                seen_paths.add(p)
                                error_paths.append(p)

            break  # successful encoding
        except UnicodeDecodeError:
            continue

    return error_paths, sample_lines


# ---------------------------------------------------------------------------
# NAS existence check
# ---------------------------------------------------------------------------

def map_to_nas(original_path: str, nas_base: str, original_prefix: str) -> str:
    rel = original_path
    if original_prefix and rel.startswith(original_prefix):
        rel = rel[len(original_prefix):]
    rel = rel.lstrip("/\\")
    return os.path.join(nas_base, rel)


def check_files(
    paths: list[str],
    nas_base: str,
    original_prefix: str,
) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    found: list[tuple[str, str]] = []
    missing: list[tuple[str, str]] = []
    total = len(paths)

    for i, path in enumerate(paths, 1):
        if i % 5000 == 0:
            print(f"  ... {i}/{total} geprüft", flush=True)
        nas_path = map_to_nas(path, nas_base, original_prefix)
        if os.path.exists(nas_path):
            found.append((path, nas_path))
        else:
            missing.append((path, nas_path))

    return found, missing


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def write_report(
    log_path: str,
    nas_base: str,
    original_prefix: str,
    found: list[tuple[str, str]],
    missing: list[tuple[str, str]],
    output_path: str | None,
    missing_only: bool,
) -> None:
    total = len(found) + len(missing)
    pct_found   = (len(found)   / total * 100) if total else 0.0
    pct_missing = (len(missing) / total * 100) if total else 0.0

    lines = [
        "R-Studio / R-Disc Recovery – Dateiprüfung auf Synology NAS",
        f"Erstellt:          {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"Log-Datei:         {log_path}",
        f"NAS-Pfad:          {nas_base}",
        f"Originalpräfix:    {original_prefix or '(keiner – relativer Pfad)'}",
        "",
        "Zusammenfassung",
        "---------------",
        f"  Dateien mit Fehlern im Log:  {total}",
        f"  Auf NAS vorhanden:           {len(found):>6}  ({pct_found:.1f} %)",
        f"  Auf NAS FEHLEND:             {len(missing):>6}  ({pct_missing:.1f} %)",
        "",
    ]

    if not missing_only:
        lines += [
            "=" * 70,
            f"AUF NAS VORHANDEN ({len(found)})",
            "=" * 70,
        ]
        for orig, _ in sorted(found):
            lines.append(f"  [OK]      {orig}")
        lines.append("")

    lines += [
        "=" * 70,
        f"AUF NAS FEHLEND ({len(missing)})",
        "=" * 70,
    ]
    for orig, nas in sorted(missing):
        lines.append(f"  [FEHLT]   {orig}")
        lines.append(f"            → erwartet auf NAS: {nas}")

    report = "\n".join(lines)

    if output_path:
        Path(output_path).write_text(report, encoding="utf-8")
        print(f"Report gespeichert: {output_path}")

    print(report)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Prüft welche Dateien aus dem R-Studio/R-Disc Fehler-Log auf der "
            "Synology NAS vorhanden sind und welche fehlen."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("log_file", help="Pfad zur R-Studio/R-Disc Log-Datei")
    parser.add_argument(
        "nas_path",
        help="Einhängepunkt der Synology NAS, z. B. /Volumes/Synology",
    )
    parser.add_argument(
        "--original-prefix",
        default="",
        metavar="PREFIX",
        help=(
            "Ursprünglicher Pfadpräfix auf der USB-Festplatte, der vor der "
            "NAS-Prüfung entfernt wird, z. B. /Volumes/USB_Drive"
        ),
    )
    parser.add_argument(
        "--output",
        metavar="FILE",
        help="Report zusätzlich in diese Datei speichern",
    )
    parser.add_argument(
        "--missing-only",
        action="store_true",
        help="Nur fehlende Dateien ausgeben (kompakterer Report)",
    )
    parser.add_argument(
        "--scan-log",
        action="store_true",
        help=(
            "Nur die ersten 30 geparsten Fehlerzeilen + extrahierten Pfade anzeigen "
            "und dann beenden – zum Überprüfen, ob das Log korrekt gelesen wird"
        ),
    )
    parser.add_argument(
        "--all-lines",
        action="store_true",
        help=(
            "Alle Zeilen auswerten (nicht nur Fehler-/Warnzeilen). "
            "Nützlich wenn das Log-Format unbekannt ist."
        ),
    )

    args = parser.parse_args()

    if not os.path.isfile(args.log_file):
        print(f"Fehler: Log-Datei nicht gefunden: {args.log_file}", file=sys.stderr)
        sys.exit(1)

    if not args.scan_log and not os.path.isdir(args.nas_path):
        print(
            f"Fehler: NAS-Pfad nicht erreichbar: {args.nas_path}\n"
            "Stelle sicher, dass die Synology NAS eingehängt ist.",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"Lese Log-Datei: {args.log_file} …")
    paths, sample_lines = parse_log(args.log_file, all_lines=args.all_lines)
    print(f"  {len(paths)} Dateipfade mit Fehlern gefunden.")

    if args.scan_log:
        print("\n--- Beispiel-Fehlerzeilen (bis zu 30) ---")
        for line in sample_lines:
            print(f"  ZEILE  : {line[:120]}")
            for p in _extract_paths(line):
                print(f"  PFAD → : {p}")
        if not paths:
            print(
                "\nKeine Pfade erkannt. Bitte teile ein paar Zeilen aus deiner "
                "Log-Datei, damit die Muster angepasst werden können."
            )
        else:
            print(f"\nGesamt extrahierte Pfade: {len(paths)}")
            print("Erste 10 Pfade:")
            for p in paths[:10]:
                print(f"  {p}")
        sys.exit(0)

    if not paths:
        print(
            "Keine Pfade gefunden. Starte mit --scan-log und teile ein paar "
            "Beispielzeilen aus dem Log, damit die Regex-Muster angepasst werden können."
        )
        sys.exit(1)

    print(f"Prüfe Dateien auf NAS: {args.nas_path} …")
    found, missing = check_files(paths, args.nas_path, args.original_prefix)

    write_report(
        log_path=args.log_file,
        nas_base=args.nas_path,
        original_prefix=args.original_prefix,
        found=found,
        missing=missing,
        output_path=args.output,
        missing_only=args.missing_only,
    )


if __name__ == "__main__":
    main()
