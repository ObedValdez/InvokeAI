#!/usr/bin/env python3
"""
Sync English translation keys into es.json, translating missing values automatically.

Usage:
  python scripts/sync_es_translations.py
  python scripts/sync_es_translations.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
EN_PATH = ROOT / "public" / "locales" / "en.json"
ES_PATH = ROOT / "public" / "locales" / "es.json"

TOKEN_PATTERN = re.compile(r"(\{\{[^}]+\}\}|\$t\([^)]*\)|</?[^>]+>)")
URL_PATTERN = re.compile(r"https?://\S+")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync and auto-translate missing en -> es keys")
    parser.add_argument("--dry-run", action="store_true", help="Do not write files")
    parser.add_argument("--sleep", type=float, default=0.05, help="Sleep between translation requests")
    return parser.parse_args()


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: Any) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
        f.write("\n")


def protect_tokens(text: str) -> tuple[str, dict[str, str]]:
    token_map: dict[str, str] = {}
    token_index = 0

    def replacer(match: re.Match[str]) -> str:
        nonlocal token_index
        token = f"__I18N_TOKEN_{token_index}__"
        token_map[token] = match.group(0)
        token_index += 1
        return token

    protected = TOKEN_PATTERN.sub(replacer, text)
    protected = URL_PATTERN.sub(replacer, protected)
    return protected, token_map


def restore_tokens(text: str, token_map: dict[str, str]) -> str:
    restored = text
    for token, original in token_map.items():
        restored = restored.replace(token, original)
    return restored


def google_translate_en_to_es(text: str, sleep_s: float) -> str:
    query = urllib.parse.quote(text)
    url = (
        "https://translate.googleapis.com/translate_a/single"
        f"?client=gtx&sl=en&tl=es&dt=t&q={query}"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))

    # Payload shape: [[["translated", "source", ...], ...], ...]
    translated = "".join(segment[0] for segment in payload[0] if segment and segment[0])
    if sleep_s > 0:
        time.sleep(sleep_s)
    return translated


def translate_text(text: str, sleep_s: float) -> str:
    stripped = text.strip()
    if not stripped:
        return text

    protected, token_map = protect_tokens(text)

    # Avoid translating pure token strings.
    if re.fullmatch(r"(?:__I18N_TOKEN_\d+__|\s|[.,;:!?()\-_/])+", protected):
        return text

    for attempt in range(3):
        try:
            translated = google_translate_en_to_es(protected, sleep_s=sleep_s)
            restored = restore_tokens(translated, token_map)
            return restored
        except Exception:
            if attempt == 2:
                return text
            time.sleep(0.35 * (attempt + 1))

    return text


class Stats:
    def __init__(self) -> None:
        self.added_keys = 0
        self.translated_strings = 0
        self.copied_non_strings = 0
        self.existing_kept = 0


def merge_and_translate(en_node: Any, es_node: Any, stats: Stats, sleep_s: float) -> Any:
    if isinstance(en_node, dict):
        out: dict[str, Any] = {}
        es_dict = es_node if isinstance(es_node, dict) else {}

        for key, en_child in en_node.items():
            if key in es_dict:
                out[key] = merge_and_translate(en_child, es_dict[key], stats, sleep_s)
                stats.existing_kept += 1
            else:
                out[key] = merge_and_translate(en_child, None, stats, sleep_s)
                stats.added_keys += 1

        # Preserve extra ES-only keys to avoid accidental data loss.
        for key, es_child in es_dict.items():
            if key not in out:
                out[key] = es_child

        return out

    if isinstance(en_node, list):
        if isinstance(es_node, list) and len(es_node) == len(en_node):
            return [
                merge_and_translate(en_item, es_item, stats, sleep_s)
                for en_item, es_item in zip(en_node, es_node, strict=False)
            ]

        # Rebuild from EN list if missing or mismatched.
        return [merge_and_translate(item, None, stats, sleep_s) for item in en_node]

    if es_node is not None:
        return es_node

    if isinstance(en_node, str):
        stats.translated_strings += 1
        return translate_text(en_node, sleep_s=sleep_s)

    stats.copied_non_strings += 1
    return en_node


def main() -> int:
    args = parse_args()
    en_data = load_json(EN_PATH)
    es_data = load_json(ES_PATH)

    stats = Stats()
    merged = merge_and_translate(en_data, es_data, stats=stats, sleep_s=args.sleep)

    if not args.dry_run:
        save_json(ES_PATH, merged)

    print("sync_es_translations.py finished")
    print(f"  added_keys={stats.added_keys}")
    print(f"  translated_strings={stats.translated_strings}")
    print(f"  copied_non_strings={stats.copied_non_strings}")
    print(f"  existing_kept={stats.existing_kept}")
    print(f"  dry_run={args.dry_run}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

