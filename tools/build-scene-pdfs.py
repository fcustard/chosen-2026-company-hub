#!/usr/bin/env python3
"""Build the twelve company-script PDFs from the same typed scene JSON as the Hub."""

from __future__ import annotations

import json
import re
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parents[1]
SCENES = ROOT / "data" / "scenes"
NAVY = colors.HexColor("#0D1B2A")
GOLD = colors.HexColor("#A86F00")
GRAY = colors.HexColor("#556070")


def register_fonts():
    font_dir = Path("/usr/share/fonts/truetype/dejavu")
    faces = {
        "ChosenSans": "DejaVuSans.ttf",
        "ChosenSans-Bold": "DejaVuSans-Bold.ttf",
        "ChosenSans-Oblique": "DejaVuSansMono-Oblique.ttf",
        "ChosenSerif-Bold": "DejaVuSerif-Bold.ttf",
    }
    missing = [str(font_dir / file_name) for file_name in faces.values() if not (font_dir / file_name).exists()]
    if missing:
        raise FileNotFoundError("Required PDF fonts are missing: " + ", ".join(missing))
    for name, file_name in faces.items():
        pdfmetrics.registerFont(TTFont(name, str(font_dir / file_name)))


def styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("SceneTitle", parent=base["Title"], fontName="ChosenSerif-Bold", fontSize=23, leading=26, textColor=NAVY, alignment=TA_LEFT, spaceAfter=8),
        "meta": ParagraphStyle("Meta", parent=base["Normal"], fontName="ChosenSans", fontSize=8.5, leading=11, textColor=GRAY, spaceAfter=12),
        "heading": ParagraphStyle("Section", parent=base["Heading2"], fontName="ChosenSans-Bold", fontSize=11, leading=14, textColor=GOLD, spaceBefore=13, spaceAfter=7, keepWithNext=True),
        "character": ParagraphStyle("Character", parent=base["Normal"], fontName="ChosenSans-Bold", fontSize=10.5, leading=13, textColor=colors.black, spaceBefore=9, spaceAfter=2, keepWithNext=True),
        "dialogue": ParagraphStyle("Dialogue", parent=base["Normal"], fontName="ChosenSans", fontSize=10.5, leading=14, textColor=colors.black, leftIndent=0.18 * inch, spaceAfter=7),
        "stage": ParagraphStyle("Stage", parent=base["Normal"], fontName="ChosenSans-Oblique", fontSize=9.5, leading=13, textColor=GRAY, spaceBefore=4, spaceAfter=7),
        "music": ParagraphStyle("Music", parent=base["Normal"], fontName="ChosenSans-Bold", fontSize=9.5, leading=12, textColor=GOLD, spaceBefore=10, spaceAfter=5, keepWithNext=True),
        "transition": ParagraphStyle("Transition", parent=base["Normal"], fontName="ChosenSans-Bold", fontSize=9.5, leading=12, textColor=NAVY, spaceBefore=11, spaceAfter=6),
        "lyric": ParagraphStyle("Lyric", parent=base["Normal"], fontName="ChosenSans-Oblique", fontSize=10.5, leading=14, textColor=NAVY, leftIndent=0.18 * inch, spaceAfter=7),
    }


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D9D4C8"))
    canvas.line(doc.leftMargin, 0.55 * inch, LETTER[0] - doc.rightMargin, 0.55 * inch)
    canvas.setFont("ChosenSans", 8)
    canvas.setFillColor(GRAY)
    canvas.drawString(doc.leftMargin, 0.36 * inch, "CHOSEN 2026 · Company Script")
    canvas.drawRightString(LETTER[0] - doc.rightMargin, 0.36 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_scene(path: Path, sheet):
    scene = json.loads(path.read_text(encoding="utf-8"))
    out = ROOT / f"scene-{str(scene['scene']).zfill(2)}.pdf"
    doc = SimpleDocTemplate(
        str(out), pagesize=LETTER, rightMargin=0.72 * inch, leftMargin=0.72 * inch,
        topMargin=0.68 * inch, bottomMargin=0.72 * inch,
        title=f"Scene {scene['scene']} — {scene['title']}", author="CHOSEN 2026",
    )
    story = [
        Paragraph(f"Scene {escape(str(int(scene['scene'])))}", sheet["meta"]),
        Paragraph(escape(scene["title"]), sheet["title"]),
        Paragraph("Current company version · generated from the structured master script", sheet["meta"]),
        Spacer(1, 0.04 * inch),
    ]
    blocks = scene.get("blocks", [])
    ending = next((index for index in range(len(blocks) - 1, -1, -1)
                   if (str(blocks[index].get("type", "")).lower() == "transition"
                       and re.match(r"^(?:END SCENE\s*\d+|Scene\s*\d+\s+begins\.)",
                                    str(blocks[index].get("text", "")).strip(), re.I))
                   or (str(blocks[index].get("type", "")).lower() == "heading"
                       and re.match(r"^END OF CHOSEN:",
                                    str(blocks[index].get("text", "")).strip(), re.I))), -1)
    if ending >= 0:
        blocks = blocks[:ending + 1]
    for block in blocks:
        kind = str(block.get("type", "")).strip().lower()
        text = str(block.get("text", "")).strip()
        if kind == "production-note":
            # Actor PDFs intentionally omit internal production notes. The
            # structured scene JSON remains the complete source of truth.
            continue
        if kind == "stage" and (
            re.match(r"^Musical Reprise:\s*approx\.", text, re.I)
            or re.search(r"\bpublic naming payoff remains protected for Scene \d+\b", text, re.I)
        ):
            # Source-styled stage paragraphs that are production planning notes.
            continue
        if kind == "spacer" or not text:
            story.append(Spacer(1, 0.07 * inch))
            continue
        if kind not in sheet:
            raise ValueError(f"{path.name}: unsupported block type {kind!r}")
        story.append(Paragraph(escape(text).replace("\n", "<br/>"), sheet[kind]))
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def main():
    register_fonts()
    sheet = styles()
    files = sorted(SCENES.glob("scene-[0-9][0-9].json"))
    if len(files) != 12:
        raise SystemExit(f"Expected 12 scene JSON files, found {len(files)}")
    for path in files:
        build_scene(path, sheet)
        print(f"Built {path.stem}.pdf")


if __name__ == "__main__":
    main()
