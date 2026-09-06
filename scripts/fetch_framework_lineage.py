#!/usr/bin/env python3
"""Refresh OpenAlex yearly mention counts for frameworkLineage.json."""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "data" / "frameworkLineage.json"

START, END = 1973, 2026
YEARS = list(range(START, END + 1))

SERIES = [
    {
        "id": "zorite_ets4",
        "label": "Zorite / ETS-4",
        "kind": "Ti-silicate · gas separation",
        "family": "prior",
        "discovery": 1973,
        "query": 'zorite | "ETS-4"',
        "filter": 'title_and_abstract.search:zorite|"ETS-4"',
        "note": "Natural zorite + Engelhard ETS-4 (same topology)",
    },
    {
        "id": "sitinakite_cst",
        "label": "Sitinakite / CST / ETS-10",
        "kind": "Ti-silicate · Cs⁺ cleanup",
        "family": "prior",
        "discovery": 1989,
        "query": 'sitinakite | "crystalline silicotitanate" | "ETS-10"',
        "filter": 'title_and_abstract.search:sitinakite|"crystalline silicotitanate"|"ETS-10"',
        "note": "Natural sitinakite + CST + ETS-10 (same lineage)",
    },
    {
        "id": "georgechaoite",
        "label": "Georgechaoite",
        "kind": "natural Zr-silicate",
        "family": "mineral",
        "discovery": 1985,
        "query": "georgechaoite",
        "filter": "title_and_abstract.search:georgechaoite",
        "note": "IMA 1985 · no industrial trade name; DFT 3MR analog for CZS",
    },
    {
        "id": "umbite",
        "label": "Umbite",
        "kind": "natural Zr-silicate",
        "family": "mineral",
        "discovery": 1983,
        "query": "umbite",
        "filter": "title_and_abstract.search:umbite",
        "note": "IMA 1983 · topology name in synth. papers; industrial trade name unknown",
    },
    {
        "id": "szc",
        "label": "SZC / ZS-9 / Lokelma",
        "kind": "synthetic Zr-silicate · drug",
        "family": "drug",
        "discovery": 2010,
        "query": '"sodium zirconium cyclosilicate" | "ZS-9" | Lokelma',
        "filter": 'title_and_abstract.search:"sodium zirconium cyclosilicate"|"ZS-9"|Lokelma',
        "note": "Same product under generic / framework / brand names",
    },
]


def fetch_counts(filt: str) -> dict[int, int]:
    url = "https://api.openalex.org/works?" + urllib.parse.urlencode(
        {
            "filter": filt,
            "group_by": "publication_year",
            "per_page": 200,
        }
    )
    req = urllib.request.Request(url, headers={"User-Agent": "mailto:aaron@nhm.org"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.load(r)
    return {
        int(g["key"]): int(g["count"])
        for g in data["group_by"]
        if str(g.get("key", "")).isdigit()
    }


def main() -> None:
    named = []
    for s in SERIES:
        counts = fetch_counts(s["filter"])
        vals = [counts.get(y, 0) if y >= s["discovery"] else 0 for y in YEARS]
        named.append(
            {
                **{
                    k: s[k]
                    for k in (
                        "id",
                        "label",
                        "kind",
                        "family",
                        "discovery",
                        "query",
                        "note",
                    )
                },
                "vals": vals,
                "total": sum(vals),
            }
        )
        print(f"{s['id']}: total={sum(vals)} max={max(vals)}")

    # ZS-9 alone is noisy; verify combined series and optionally tighten
    out = {
        "source": (
            "OpenAlex API — title/abstract matches, unique works by year. "
            "Lumped only where mineral = industrial rebuild: zorite/ETS-4; "
            "sitinakite/CST/ETS-10. Georgechaoite and umbite stay mineral-only. "
            "SZC / ZS-9 / Lokelma are one product (generic / framework / brand). "
            "Same y-axis for all."
        ),
        "xLabel": "Year",
        "yLabel": "OpenAlex works / year",
        "years": YEARS,
        "xTicks": [1975, 1985, 1995, 2005, 2015, 2025],
        "yMax": max(max(s["vals"]) for s in named) * 1.12,
        "named": named,
    }
    OUT.write_text(json.dumps(out, indent=2) + "\n")
    print("wrote", OUT)
    print("yMax", out["yMax"])


if __name__ == "__main__":
    main()
