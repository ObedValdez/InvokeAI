#!/usr/bin/env python3
"""
Report translation key coverage against en.json.

Usage:
  python scripts/i18n_coverage_report.py
  python scripts/i18n_coverage_report.py --lang es --fail-on-missing
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
LOCALES_DIR = ROOT / "public" / "locales"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Report locale key coverage compared to en.json")
    parser.add_argument("--lang", default="es", help="Locale file name without extension (default: es)")
    parser.add_argument("--fail-on-missing", action="store_true", help="Exit non-zero if any key is missing")
    return parser.parse_args()


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def flatten(node: Any, prefix: str = "") -> dict[str, Any]:
    if isinstance(node, dict):
        out: dict[str, Any] = {}
        for key, value in node.items():
            next_prefix = f"{prefix}.{key}" if prefix else key
            out.update(flatten(value, next_prefix))
        return out
    return {prefix: node}


def main() -> int:
    args = parse_args()
    en_path = LOCALES_DIR / "en.json"
    lang_path = LOCALES_DIR / f"{args.lang}.json"

    en = flatten(load_json(en_path))
    target = flatten(load_json(lang_path))

    missing = sorted(key for key in en if key not in target)
    extra = sorted(key for key in target if key not in en)

    print(f"lang={args.lang}")
    print(f"en_keys={len(en)}")
    print(f"target_keys={len(target)}")
    print(f"missing={len(missing)}")
    print(f"extra={len(extra)}")

    if missing:
        print("missing_keys_sample:")
        for key in missing[:50]:
            print(f"  - {key}")

    if extra:
        print("extra_keys_sample:")
        for key in extra[:50]:
            print(f"  - {key}")

    if args.fail_on_missing and missing:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

