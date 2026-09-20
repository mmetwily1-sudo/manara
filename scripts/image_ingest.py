#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
مسح صور ورقية (كاميرا/رفع) → صور معالجة + مسودات أسئلة (JSON بنفس شكل pdf_ingest).
الـ OCR مساعد فقط (Tesseract ara إن وُجد) — المراجعة البشرية إلزامية دائماً.

الاستخدام:
  python scripts/image_ingest.py ./out/scan1 --ref "scan-1680000000" --subject "فيزياء" img1.jpg img2.png

المخرجات:
  out/scan1/pages/p001.png ... (معالجة: رمادي + تباين + حد أقصى 1600px)
  out/scan1/manifest.json {ref, subject, pages, ocr:boolean, segments:[{page, text, needs_transcription?}]}
"""
import json
import os
import re
import sys

from PIL import Image, ImageOps


def split_segments(page_text):
    lines = [l.strip() for l in page_text.split("\n")]
    lines = [l for l in lines if l]
    start = re.compile(
        r"^(السؤال\s+(الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)|\d+\s*[-).:]|\(?\d+\)|اختر|ضع\s+علامة)"
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


def ocr_available():
    try:
        import pytesseract  # noqa

        return True
    except Exception:
        return False


_TESS_OK = None


def tesseract_ready():
    """تأكد من ثنائي Tesseract وبيانات العربية (أي موقع معروف)."""
    global _TESS_OK
    if _TESS_OK is not None:
        return _TESS_OK
    import os
    import shutil

    import pytesseract

    for cand in [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]:
        if os.path.exists(cand):
            pytesseract.pytesseract.tesseract_cmd = cand
            break
    if not os.environ.get("TESSDATA_PREFIX"):
        home = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Manara", "tessdata")
        if os.path.exists(os.path.join(home, "ara.traineddata")):
            os.environ["TESSDATA_PREFIX"] = home
    try:
        langs = pytesseract.get_languages()
        _TESS_OK = "ara" in langs
    except Exception:
        _TESS_OK = False
    if not _TESS_OK:
        print("tesseract ara unavailable — manual mode")
    return _TESS_OK


def ocr_text(img):
    import pytesseract

    if not tesseract_ready():
        return ""
    try:
        return pytesseract.image_to_string(img, lang="ara", config="--psm 6") or ""
    except Exception as e:
        print("tesseract failed: %s" % e)
        return ""


def ocr_image(path):
    """OCR مزدوج: طبيعي + عتبة مزيلة للعلامات المائية — يُؤخذ الأطول."""
    from PIL import ImageOps

    img = Image.open(path)
    a = ocr_text(img)
    try:
        g = img.convert("L")
        g = ImageOps.autocontrast(g, cutoff=1)
        w, h = g.size
        px = g.load()
        data = list(g.getdata())
        g2 = Image.new("L", (w, h))
        g2.putdata([0 if p < 170 else 255 for p in data])
        b = ocr_text(g2)
        return b if len(b) > len(a) else a
    except Exception:
        return a


def ocr_blocks(path):
    """سطور OCR مع إحداثياتها — للتجميع المكاني بدل التخمين النصي."""
    import pytesseract
    from PIL import Image

    if not tesseract_ready():
        return []
    try:
        d = pytesseract.image_to_data(
            Image.open(path), lang="ara", config="--psm 6",
            output_type=pytesseract.Output.DICT,
        )
    except Exception:
        return []
    lines = {}
    n = len(d.get("text", []))
    for i in range(n):
        t = (d["text"][i] or "").strip()
        if not t:
            continue
        try:
            conf = float(d["conf"][i])
        except Exception:
            conf = -1
        if conf < 0:
            continue
        key = (d["block_num"][i], d["par_num"][i], d["line_num"][i])
        if key not in lines:
            lines[key] = {"words": [], "top": d["top"][i], "conf": []}
        lines[key]["words"].append(t)
        lines[key]["conf"].append(conf)
        lines[key]["top"] = min(lines[key]["top"], d["top"][i])
    out = []
    for key in sorted(lines, key=lambda k: lines[k]["top"]):
        w = lines[key]["words"]
        avg = sum(lines[key]["conf"]) / max(1, len(lines[key]["conf"]))
        out.append({"text": " ".join(w), "conf": avg})
    return out


QUESTION_START = None


def _qstart():
    global QUESTION_START
    if QUESTION_START is None:
        import re

        # بداية سؤال فقط (أرقام/عناوين) — علامات الاختيارات (أ ب ج د) تظل داخل الكتلة
        QUESTION_START = re.compile(
            r"^(\d+\s*[-).:]|\(?\d+\)|\d+\.|اختر|ضع\s+علامة|السؤال\s+|س\s*[:：])"
        )
    return QUESTION_START


def group_lines(lines):
    """جمّع السطور لكتل أسئلة: فاصل عند بداية سؤال فقط (الاختيارات تلتحق بسؤالها)."""
    start = _qstart()
    blocks, cur = [], []
    for ln in lines:
        t = ln["text"].strip() if isinstance(ln, dict) else str(ln).strip()
        if not t:
            continue
        if start.match(t) and cur and sum(len(x) for x in cur) > 40:
            blocks.append(cur)
            cur = [t]
        else:
            cur.append(t)
    if cur and sum(len(x) for x in cur) > 20:
        blocks.append(cur)
    if len(blocks) <= 1 and sum(len(x) for x in cur) > 600:
        all_lines = blocks[0] if blocks else cur
        blocks = [" ".join(all_lines[i:i + 3]) for i in range(0, len(all_lines), 3)]
    return [" ".join(b) for b in blocks]


def preprocess(src, dst):
    img = Image.open(src)
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass
    img = img.convert("L")
    img = ImageOps.autocontrast(img, cutoff=1)
    w, h = img.size
    if max(w, h) > 1600:
        r = 1600.0 / max(w, h)
        img = img.resize((int(w * r), int(h * r)), Image.LANCZOS)
    img.save(dst)
    return dst


def main():
    if len(sys.argv) < 3:
        print("usage: image_ingest.py <outdir> [--ref X] [--subject Y] <img...>")
        sys.exit(2)
    outdir = sys.argv[1]
    ref, subject, files = "scan", "", []
    i = 2
    while i < len(sys.argv):
        a = sys.argv[i]
        if a == "--ref" and i + 1 < len(sys.argv):
            ref = sys.argv[i + 1]
            i += 2
        elif a == "--subject" and i + 1 < len(sys.argv):
            subject = sys.argv[i + 1]
            i += 2
        else:
            files.append(a)
            i += 1
    if not files:
        print("no images")
        sys.exit(2)
    pages_dir = os.path.join(outdir, "pages")
    os.makedirs(pages_dir, exist_ok=True)
    can_ocr = ocr_available()
    manifest = {"ref": ref, "subject": subject, "pages": 0, "ocr": can_ocr, "segments": []}
    for n, f in enumerate(files, 1):
        dst = os.path.join(pages_dir, "p%03d.png" % n)
        try:
            preprocess(f, dst)
        except Exception as e:
            print("preprocess failed for %s: %s" % (f, e))
            continue
        manifest["pages"] += 1
        text = ""
        if can_ocr:
            try:
                # أولاً: سطور مكانية (أدق للتقسيم)، ثم نص حر احتياطاً
                blines = ocr_blocks(dst)
                grouped = group_lines(blines) if blines else []
                if grouped:
                    for seg in grouped:
                        manifest["segments"].append({"page": n, "text": seg[:2000]})
                    continue
                if blines:
                    joined = " ".join(
                        (b["text"] if isinstance(b, dict) else str(b)) for b in blines
                    ).strip()
                    if len(joined) >= 30:
                        manifest["segments"].append({"page": n, "text": joined[:2000]})
                        continue
                text = (ocr_image(dst) or "").strip()
            except Exception as e:
                print("ocr failed p%d: %s" % (n, e))
        if len(text) < 30:
            manifest["segments"].append({
                "page": n,
                "text": "[صفحة %d — تُنسخ يدوياً من الصورة]" % n,
                "needs_transcription": True,
            })
        else:
            for seg in split_segments(text):
                manifest["segments"].append({"page": n, "text": seg[:2000]})
    with open(os.path.join(outdir, "manifest.json"), "w", encoding="utf-8") as fo:
        json.dump(manifest, fo, ensure_ascii=False, indent=1)
    print("pages=%d segments=%d ocr=%s" % (manifest["pages"], len(manifest["segments"]), can_ocr))


if __name__ == "__main__":
    main()
