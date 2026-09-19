#!/usr/bin/env python3
"""Fitnessio supplier-feed merger.

Downloads the registered supplier XML feeds, extracts products, normalizes EANs,
merges duplicate products by EAN, and writes audit-friendly JSON/CSV outputs.
No e-shop data is modified.
"""
from __future__ import annotations
import csv, json, re, sys
from collections import defaultdict
from pathlib import Path
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

FEEDS = {
    "dafit": "https://xml.golemos.com/dafit.php",
    "kulturistika": "http://xml.golemos.com/kulturistika.php",
    "gymbeam": "https://xml.golemos.com/gymbeamfitnessio.php",
}
OUT = Path("feed-output")

EAN_NAMES = {"ean", "ean13", "barcode", "gtin", "gtin13"}
SKU_NAMES = {"sku", "code", "productno", "product_no", "item_id", "itemid", "id"}
NAME_NAMES = {"name", "productname", "product_name", "title"}


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def clean(v: str | None) -> str:
    return re.sub(r"\s+", " ", v or "").strip()


def normalize_ean(v: str | None) -> str:
    digits = re.sub(r"\D", "", v or "")
    return digits if 8 <= len(digits) <= 14 else ""


def direct_fields(el: ET.Element) -> dict[str, str]:
    d = {}
    for c in list(el):
        if len(c) == 0:
            d[local(c.tag)] = clean(c.text)
    return d


def first(fields: dict[str, str], names: set[str]) -> str:
    for k, v in fields.items():
        if k in names and v:
            return v
    return ""


def product_candidates(root: ET.Element):
    common = {"product", "item", "shopitem", "offer"}
    found = [e for e in root.iter() if local(e.tag) in common]
    if found:
        return found
    return [e for e in root.iter() if first(direct_fields(e), EAN_NAMES)]


def download(url: str) -> bytes:
    req = Request(url, headers={"User-Agent": "FitnessioFeedAudit/1.0"})
    with urlopen(req, timeout=60) as r:
        return r.read()


def parse_feed(feed: str, url: str) -> list[dict]:
    root = ET.fromstring(download(url))
    rows = []
    for el in product_candidates(root):
        f = direct_fields(el)
        raw_ean = first(f, EAN_NAMES)
        rows.append({
            "feed": feed,
            "ean": normalize_ean(raw_ean),
            "ean_raw": raw_ean,
            "sku": first(f, SKU_NAMES),
            "name": first(f, NAME_NAMES),
        })
    return rows


def main() -> int:
    OUT.mkdir(exist_ok=True)
    all_rows, errors = [], []
    for feed, url in FEEDS.items():
        try:
            rows = parse_feed(feed, url)
            all_rows.extend(rows)
            print(f"{feed}: {len(rows)} products")
        except Exception as e:
            errors.append({"feed": feed, "url": url, "error": str(e)})
            print(f"{feed}: ERROR {e}", file=sys.stderr)

    by_ean = defaultdict(list)
    no_ean = []
    for row in all_rows:
        (by_ean[row["ean"]] if row["ean"] else no_ean).append(row)

    unique = []
    duplicates = []
    for ean, rows in sorted(by_ean.items()):
        feeds = sorted({r["feed"] for r in rows})
        chosen = rows[0].copy()
        chosen["feeds"] = feeds
        chosen["occurrences"] = len(rows)
        unique.append(chosen)
        if len(rows) > 1:
            duplicates.append({"ean": ean, "feeds": feeds, "occurrences": len(rows), "products": rows})

    (OUT / "unique-products.json").write_text(json.dumps(unique, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "duplicate-eans.json").write_text(json.dumps(duplicates, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "products-without-ean.json").write_text(json.dumps(no_ean, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "errors.json").write_text(json.dumps(errors, ensure_ascii=False, indent=2), encoding="utf-8")

    with (OUT / "unique-products.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["ean", "name", "sku", "feed", "feeds", "occurrences"])
        w.writeheader()
        for r in unique:
            w.writerow({
                "ean": r.get("ean", ""),
                "name": r.get("name", ""),
                "sku": r.get("sku", ""),
                "feed": r.get("feed", ""),
                "feeds": "|".join(r.get("feeds", [])),
                "occurrences": r.get("occurrences", 1),
            })

    # Small deterministic sample for safe Eshop-rychle import testing.
    # Prefer named products with valid EANs and spread the sample across feeds.
    sample = []
    used_eans = set()
    for feed in FEEDS:
        candidates = [r for r in unique if feed in r.get("feeds", []) and r.get("name") and r["ean"] not in used_eans]
        for r in candidates[:3]:
            sample.append(r)
            used_eans.add(r["ean"])
    for r in unique:
        if len(sample) >= 10:
            break
        if r.get("name") and r["ean"] not in used_eans:
            sample.append(r)
            used_eans.add(r["ean"])

    sample = sample[:10]
    (OUT / "test-sample-10.json").write_text(json.dumps(sample, ensure_ascii=False, indent=2), encoding="utf-8")
    with (OUT / "test-sample-10.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["ean", "name", "sku", "feed", "feeds"])
        w.writeheader()
        for r in sample:
            w.writerow({
                "ean": r.get("ean", ""),
                "name": r.get("name", ""),
                "sku": r.get("sku", ""),
                "feed": r.get("feed", ""),
                "feeds": "|".join(r.get("feeds", [])),
            })

    print(f"Unique EANs: {len(unique)}; duplicate EAN groups: {len(duplicates)}; without EAN: {len(no_ean)}; test sample: {len(sample)}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
