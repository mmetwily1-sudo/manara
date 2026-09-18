#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
استخراج امتحان رسمي PDF → صور صفحات + مسودات أسئلة مقترحة (JSON).
لا يعتمد على دقة النص المستخرج: المراجع البشري يقرأ صورة الصفحة ويصحح.

الاستخدام:
  python scripts/pdf_ingest.py exam.pdf ./out/exam2024 --ref "THA-2024-physics" --subject "فيزياء"

المخرجات:
  out/exam2024/pages/p001.png ... (150dpi)
  out/exam2024/manifest.json {ref, subject, pages, segments:[{page, text}]}
"""
import json
import os
import re
import sys

import pymupdf  # PyMuPDF


def split_segments(page_text):
    """تقطيع تقريبي لمرشحات أسئلة: سطور مرقمة أو عناوين أسئلة."""
    lines = [l.strip() for l in page_text.split("\n")]
    lines = [l for l in lines if l]
    # بداية سؤال: "السؤال الأول/الثاني...", "1- ", "1) ", "أ- ", "اختر", "ضع علامة"
    start = re.compile(
        r"^(السؤال\s+(الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)|\d+\s*[-).:]|\(?\d+\)|[أ-ي]\)|اختر|ضع\s+علامة)"
    )
    segs, cur = [], []
    for l in lines:
        if start.match(l) and cur and sum(len(x) for x in cur) > 40:
            segs.append(" ".join(cur))
            cur = [l]
        else:
            cur.append(l)
    if cur and sum(len(x) for x in cur) > 20:
        segs.append(" ".join(cur))
    return segs


def main():
    if len(sys.argv) < 3:
        print("usage: pdf_ingest.py <pdf> <outdir> [--ref X] [--subject Y]")
        sys.exit(2)
    pdf, outdir = sys.argv[1], sys.argv[2]
    ref, subject = "exam", ""
    for i, a in enumerate(sys.argv):
        if a == "--ref" and i + 1 < len(sys.argv):
            ref = sys.argv[i + 1]
        if a == "--subject" and i + 1 < len(sys.argv):
            subject = sys.argv[i + 1]
    pages_dir = os.path.join(outdir, "pages")
    os.makedirs(pages_dir, exist_ok=True)
    doc = pymupdf.open(pdf)
    manifest = {"ref": ref, "subject": subject, "file": os.path.basename(pdf), "pages": len(doc), "segments": []}
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=150)
        pix.save(os.path.join(pages_dir, "p%03d.png" % (i + 1)))
        text = (page.get_text("text") or "").strip()
        if len(text) < 40:
            # صفحة ممسوحة/مرسومة بمنحنيات (مثل ملفات الوزارة): لا نص قابل للاستخراج.
            # ننشئ مسودة على مستوى الصفحة — المراجع ينسخ بيده من الصورة (موثوق 100%).
            manifest["segments"].append({
                "page": i + 1,
                "text": "[صفحة %d — تُنسخ يدوياً من الصورة]" % (i + 1),
                "needs_transcription": True,
            })
            continue
        for seg in split_segments(text):
            manifest["segments"].append({"page": i + 1, "text": seg[:2000]})
    with open(os.path.join(outdir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print("pages=%d segments=%d" % (manifest["pages"], len(manifest["segments"])))


if __name__ == "__main__":
    main()
