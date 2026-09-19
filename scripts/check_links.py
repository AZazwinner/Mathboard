"""Fails if a relative link in any tracked Markdown file points at a file that doesn't exist.

Only relative file links are checked (external URLs and in-page anchors are ignored, so it needs no network).
Fenced code blocks are skipped, so example commands and Mermaid diagrams can't produce false positives.

    python scripts/check_links.py
"""

import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote

LINK = re.compile(r"(?<!\!)\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)|!\[[^\]]*\]\(([^)\s]+)\)")
FENCE = re.compile(r"^\s*(```|~~~)")


def markdown_files(root: Path) -> list[Path]:
    listed = subprocess.run(
        ["git", "ls-files", "*.md"], cwd=root, capture_output=True, text=True, check=True
    ).stdout.split()
    return [root / name for name in listed if (root / name).exists()]


def broken_links(path: Path, root: Path) -> list[tuple[int, str]]:
    problems = []
    in_fence = False
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if FENCE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        for match in LINK.finditer(line):
            target = match.group(1) or match.group(2)
            if re.match(r"^([a-z][a-z0-9+.-]*:|#|mailto:)", target, re.I):
                continue
            file_part = unquote(target.split("#", 1)[0])
            if not file_part:
                continue
            resolved = (root / file_part.lstrip("/")) if file_part.startswith("/") else (path.parent / file_part)
            if not resolved.resolve().exists():
                problems.append((number, target))
    return problems


def main() -> int:
    root = Path(subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True).stdout.strip())
    failed = 0
    files = markdown_files(root)
    for path in files:
        for number, target in broken_links(path, root):
            print(f"{path.relative_to(root)}:{number}: broken link -> {target}")
            failed += 1
    print(f"checked {len(files)} Markdown files, {failed} broken link(s)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
