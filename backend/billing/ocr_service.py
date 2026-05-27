"""OCR pipeline for MERALCO bills (paper §IV.B / §IV.C.1).

Three-stage extraction:

1. **Spatial parsing** (P2.15a) — uses Tesseract bounding boxes to find label
   tokens by string match, then reads value tokens that lie to the right of
   the label on the same line, or below the label within the same column
   band. Removes the regex "label and value must be on one line" limit.

2. **Regex parsing** — the original line-based extractor. Acts as backup when
   spatial parsing finds nothing (e.g. when the bill has no label tokens).

3. **LLM post-processing fallback** (P2.15b) — when any field is still None
   after stages 1 and 2, send the raw Tesseract text to the configured LLM
   (LLM_BASE_URL / LLM_API_KEY / LLM_MODEL — already wired for the chatbot)
   and ask for structured JSON. Silent fallback when LLM is unconfigured or
   errors.

The three stages are layered, not replaced: each fills in only the fields the
previous stage missed, and per-field source attribution is exposed in the
response so debugging mismatches stays cheap.
"""

from __future__ import annotations

import json
import logging
import os
import re

import cv2
import numpy as np
import pytesseract
from PIL import Image
from django.utils import timezone

try:
    from openai import OpenAI, OpenAIError
except ImportError:  # pragma: no cover — openai is a real dep
    OpenAI = None
    OpenAIError = Exception


logger = logging.getLogger(__name__)

_MIN_WIDTH_FOR_OCR = 1600


# ---------------------------------------------------------------------------
# OpenCV pre-processing (unchanged from the previous implementation)
# ---------------------------------------------------------------------------

def _preprocess_with_opencv(image_file):
    """
    OpenCV pre-processing pipeline per paper §III.A.2 / §IV.C.1:
    grayscale -> upscale-if-small -> bilateral denoise -> deskew -> adaptive threshold.
    Returns a PIL.Image suitable for pytesseract.
    """
    image_file.seek(0)
    file_bytes = np.frombuffer(image_file.read(), dtype=np.uint8)
    bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("Could not decode image bytes as an image.")

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    h, w = gray.shape[:2]
    if w < _MIN_WIDTH_FOR_OCR:
        scale = _MIN_WIDTH_FOR_OCR / float(w)
        gray = cv2.resize(
            gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC
        )

    denoised = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)

    _, text_mask = cv2.threshold(
        denoised, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )
    coords = np.column_stack(np.where(text_mask > 0))
    if coords.size:
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        if 0.5 < abs(angle) < 15.0:
            h2, w2 = denoised.shape[:2]
            center = (w2 // 2, h2 // 2)
            rot = cv2.getRotationMatrix2D(center, angle, 1.0)
            denoised = cv2.warpAffine(
                denoised, rot, (w2, h2),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE,
            )

    thresh = cv2.adaptiveThreshold(
        denoised, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=31,
        C=15,
    )
    return Image.fromarray(thresh)


# ---------------------------------------------------------------------------
# Helpers shared by the three extractors
# ---------------------------------------------------------------------------

def _parse_number(s):
    if s is None:
        return None
    try:
        return float(str(s).replace(',', '').strip())
    except (ValueError, TypeError):
        return None


def _parse_currency(s):
    """
    Parse a currency string tolerant of OCR comma↔dot confusion. Tesseract
    frequently misreads the thousands-comma in '2,326.43' as a dot, producing
    '2.326.43' — the plain `float()` path would then truncate to 2.32. This
    helper recognises the `<1-3 digits><sep><3 digits>.<2 digits>` shape and
    treats the inner separator as thousands regardless of which character it is.
    """
    if s is None:
        return None
    text = str(s).strip()
    if not text:
        return None
    m = re.match(r'^(\d{1,3})[.,](\d{3})\.(\d{2})$', text)
    if m:
        return float(f"{m.group(1)}{m.group(2)}.{m.group(3)}")
    try:
        return float(text.replace(',', ''))
    except (ValueError, TypeError):
        return None


def _normalize_digits(s):
    if not isinstance(s, str):
        return None
    digits = re.sub(r'\D', '', s)
    return digits if len(digits) >= 9 else None


# ---------------------------------------------------------------------------
# Stage 1 — Spatial parsing using image_to_data bounding boxes (P2.15a)
# ---------------------------------------------------------------------------

def _build_tokens(data):
    """Flatten image_to_data dict into a list of token records."""
    out = []
    texts = data.get('text', [])
    for i, text in enumerate(texts):
        text = (text or '').strip()
        if not text:
            continue
        try:
            conf = int(data['conf'][i])
        except (KeyError, ValueError, TypeError):
            conf = -1
        if conf < 0:
            continue
        out.append({
            'text': text,
            'block_num': data['block_num'][i],
            'par_num': data['par_num'][i],
            'line_num': data['line_num'][i],
            'left': data['left'][i],
            'top': data['top'][i],
            'right': data['left'][i] + data['width'][i],
            'bottom': data['top'][i] + data['height'][i],
            'conf': conf,
        })
    return out


def _group_into_lines(tokens):
    """Group tokens by (block, paragraph, line) and order each line left-to-right."""
    groups = {}
    for t in tokens:
        key = (t['block_num'], t['par_num'], t['line_num'])
        groups.setdefault(key, []).append(t)
    lines = []
    for key in sorted(groups.keys()):
        lines.append(sorted(groups[key], key=lambda x: x['left']))
    return lines


def _line_text(line):
    return ' '.join(t['text'] for t in line)


def _find_anchor_line(lines, label_substrings):
    """Return (idx, line) of the first line whose lowercased text contains any label substring."""
    for i, line in enumerate(lines):
        text = _line_text(line).lower()
        for label in label_substrings:
            if label in text:
                return i, line
    return None


def _search_below(lines, start_idx, n, regex):
    """Search up to n lines starting at start_idx for the first regex match."""
    for offset in range(n):
        idx = start_idx + offset
        if idx >= len(lines):
            break
        text = _line_text(lines[idx])
        m = re.search(regex, text, re.IGNORECASE)
        if m:
            return m.group(1)
    return None


def _spatial_account_number(lines):
    anchor = _find_anchor_line(
        lines,
        ['account no', 'account number', 'acct no', 'acct.', 'customer account', ' can '],
    )
    if not anchor:
        return None
    idx, _ = anchor
    raw = _search_below(lines, idx, 3, r'(\d[\d\s\-]{8,15})')
    return _normalize_digits(raw)


def _spatial_billing_period(lines):
    anchor = _find_anchor_line(
        lines,
        ['billing period', 'service period', 'statement period', 'period covered', 'billing month'],
    )
    if not anchor:
        return None
    idx, _ = anchor
    patterns = [
        # Day-first range — MERALCO format e.g. "25 Apr 2026 to 24 May 2026".
        # Listed first so the month-only fallback can't clip it.
        r'(\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{4}\s+(?:to|[\-–])\s+\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{4})',
        # Month-first range — "Feb 1, 2024 - Feb 29, 2024"
        r'([A-Za-z]+\.?\s+\d{1,2}[,\s]+\d{4}\s*(?:[\-–to]+)\s*[A-Za-z]+\.?\s+\d{1,2}[,\s]+\d{4})',
        # Month name + year
        r'([A-Za-z]{3,9}\.?\s+\d{4})',
        # Numeric range
        r'(\d{1,2}/\d{1,2}/\d{2,4}\s*(?:[\-–to]+)\s*\d{1,2}/\d{1,2}/\d{2,4})',
        # Single date
        r'(\d{1,2}/\d{1,2}/\d{2,4})',
    ]
    for pat in patterns:
        hit = _search_below(lines, idx, 3, pat)
        if hit:
            return hit.strip()
    return None


def _spatial_total_kwh(lines, tokens):
    # Strategy A: token "kWh" exists somewhere; nearest number to its left on the same line wins.
    kwh_units = [t for t in tokens if t['text'].lower().rstrip(':.') in ('kwh', 'kwhr', 'kw-h')]
    for unit in kwh_units:
        same_line = [
            t for t in tokens
            if t['block_num'] == unit['block_num']
            and t['par_num'] == unit['par_num']
            and t['line_num'] == unit['line_num']
            and t['right'] <= unit['left']
        ]
        for tok in reversed(same_line):
            val = _parse_number(tok['text'])
            if val is not None and val > 0:
                return val
    # Strategy B: label-anchored search.
    anchor = _find_anchor_line(
        lines,
        ['total kwh', 'kwh consumed', 'kwh used', 'consumption', 'energy used'],
    )
    if anchor:
        idx, _ = anchor
        raw = _search_below(lines, idx, 3, r'([\d,]+(?:\.\d+)?)')
        val = _parse_number(raw)
        if val is not None and val > 0:
            return val
    return None


def _spatial_total_php(lines):
    anchor = _find_anchor_line(
        lines,
        ['total amount due', 'amount due', 'total bill', 'current bill', 'total due', 'please pay'],
    )
    if not anchor:
        return None
    idx, _ = anchor
    # Try the thousands-formatted shape FIRST so 2,326.43 (or OCR's 2.326.43)
    # doesn't get truncated to 2.32 by the plain decimal pattern.
    for pat in (
        r'(?:PHP|Php|₱|P\s)?\s*(\d{1,3}[.,]\d{3}\.\d{2})',
        r'(?:PHP|Php|₱|P\s)?\s*([\d,]+\.\d{2})',
    ):
        raw = _search_below(lines, idx, 3, pat)
        val = _parse_currency(raw)
        if val is not None and val > 0:
            return val
    # Fall back to any integer-looking value above a sane floor.
    raw = _search_below(lines, idx, 3, r'([\d,]{3,})')
    val = _parse_currency(raw)
    if val is not None and val > 100:
        return val
    return None


def _spatial_extract(data):
    """Top-level spatial extraction; returns the Contract B field dict (values may be None)."""
    tokens = _build_tokens(data)
    lines = _group_into_lines(tokens)
    return {
        'meralco_account_number': _spatial_account_number(lines),
        'billing_period': _spatial_billing_period(lines),
        'total_kwh_consumed': _spatial_total_kwh(lines, tokens),
        'total_bill_php': _spatial_total_php(lines),
    }


# ---------------------------------------------------------------------------
# Stage 2 — Regex parsing (unchanged in spirit, kept as fallback)
# ---------------------------------------------------------------------------

_ACCOUNT_PATTERNS = [
    r'(?:Account\s*N[o0]\.?|ACCT\s*N[o0]?\.?|CAN|Customer\s*Account\s*Number)[\s\:\-\.]+(\d[\d\s\-]{8,15})',
]

_PERIOD_PATTERNS = [
    # Day-first range with month name — MERALCO's actual format
    # ("25 Apr 2026 to 24 May 2026"). Listed first so the month-only fallback
    # can't clip it to just "Apr 2026". No label anchor — matches anywhere.
    r'(\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{4}\s+(?:to|[\-–])\s+\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{4})',
    r'(?:Billing\s*Period|Statement\s*Period|Period\s*Covered)[\s\:\-]+([A-Za-z]+\.?\s+\d{1,2}[\s,]+\d{4}\s*[\-–to]+\s*[A-Za-z]+\.?\s+\d{1,2}[\s,]+\d{4})',
    r'(?:Billing\s*Period|Statement\s*Period|Bill\s*Month)[\s\:\-]+([A-Za-z]+\.?\s+\d{4})',
    r'(?:Billing\s*Period|Statement\s*Period)[\s\:\-]+(\d{1,2}/\d{1,2}/\d{2,4}\s*[\-–to]+\s*\d{1,2}/\d{1,2}/\d{2,4})',
    r'(?:Bill\s*Date|Statement\s*Date)[\s\:\-]+(\d{1,2}/\d{1,2}/\d{2,4})',
]

_KWH_PATTERNS = [
    r'(?:Total\s*kWh\s*Consumed|Total\s*kWh\s*Used|kWh\s*Consumed|kWh\s*Used|Consumption)[\s\:\-]+([\d,]+\.?\d*)',
    r'(?:Total\s*kWh|kWh)[\s\:\-]+([\d,]+\.?\d*)',
    r'([\d,]+\.?\d*)\s*kWh\b',
]

_PHP_PATTERNS = [
    # Thousands-formatted, label-anchored. Listed first so 2,326.43 (or OCR's
    # misread 2.326.43) is captured intact instead of being clipped to 2.32.
    r'(?:Total\s*Amount\s*Due|Current\s*Amount\s*Due|Total\s*Bill|Amount\s*Due|Please\s*Pay)[\s\:\-\₱\$P,\.]*(\d{1,3}[.,]\d{3}\.\d{2})',
    # Plain decimal, label-anchored.
    r'(?:Total\s*Amount\s*Due|Current\s*Amount\s*Due|Total\s*Bill|Amount\s*Due|Please\s*Pay)[\s\:\-\₱\$P,\.]*([\d,]+\.\d{2})',
    # Label-anchored integer fallback.
    r'(?:Total\s*Amount\s*Due|Current\s*Amount\s*Due|Total\s*Bill|Amount\s*Due|Please\s*Pay)[\s\:\-\₱\$P,\.]*([\d,]+)',
    # Currency-symbol-anchored, thousands-formatted.
    r'(?:PHP|Php|₱|P)\s*(\d{1,3}[.,]\d{3}\.\d{2})',
    # Currency-symbol-anchored, plain decimal.
    r'(?:PHP|Php|₱|P)\s*([\d,]+\.\d{2})',
]


def _first_regex_match(patterns, text):
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(1)
    return None


def _regex_extract(text):
    return {
        'meralco_account_number': _normalize_digits(_first_regex_match(_ACCOUNT_PATTERNS, text)),
        'billing_period': (_first_regex_match(_PERIOD_PATTERNS, text) or '').strip() or None,
        'total_kwh_consumed': _parse_number(_first_regex_match(_KWH_PATTERNS, text)),
        'total_bill_php': _parse_currency(_first_regex_match(_PHP_PATTERNS, text)),
    }


# ---------------------------------------------------------------------------
# Stage 3 — LLM post-processing fallback (P2.15b)
# ---------------------------------------------------------------------------

_LLM_EXTRACTION_PROMPT = (
    "You extract billing fields from MERALCO electricity bill OCR text. The OCR "
    "may have errors (0/O, 1/I confusion, dropped characters, broken lines). "
    "Return ONLY a JSON object with these exact keys and nothing else: "
    "meralco_account_number (string of digits with no spaces or dashes, ~10 digits long; "
    "use null if not present), "
    "billing_period (string like 'Feb 2024' or 'FEB 1, 2024 - FEB 29, 2024'; use null if not present), "
    "total_kwh_consumed (number — kWh consumed this period; use null if not present), "
    "total_bill_php (number — total amount due in Philippine peso; use null if not present). "
    "Do not include any explanation, prose, or other keys."
)


def _normalize_llm_output(data):
    out = {
        'meralco_account_number': None,
        'billing_period': None,
        'total_kwh_consumed': None,
        'total_bill_php': None,
    }
    if not isinstance(data, dict):
        return out

    acc = data.get('meralco_account_number') or data.get('account_number')
    if acc is not None:
        out['meralco_account_number'] = _normalize_digits(str(acc))

    period = data.get('billing_period') or data.get('period')
    if isinstance(period, str) and period.strip():
        out['billing_period'] = period.strip()

    kwh_keys = ('total_kwh_consumed', 'total_kwh', 'kwh_consumed', 'kwh')
    for k in kwh_keys:
        if data.get(k) is not None:
            out['total_kwh_consumed'] = _parse_number(data.get(k))
            break

    php_keys = ('total_bill_php', 'total_php', 'total_amount', 'amount_due', 'total_bill')
    for k in php_keys:
        if data.get(k) is not None:
            out['total_bill_php'] = _parse_currency(data.get(k))
            break

    return out


def _llm_extract(raw_text):
    """Call the configured LLM to extract Contract B fields from OCR text. Silent on failure."""
    base_url = os.environ.get('LLM_BASE_URL')
    api_key = os.environ.get('LLM_API_KEY')
    model = os.environ.get('LLM_MODEL')
    timeout = float(os.environ.get('LLM_TIMEOUT_SECONDS', '20'))

    if not (base_url and api_key and model and OpenAI is not None):
        return {}
    if not raw_text or not raw_text.strip():
        return {}

    try:
        client = OpenAI(base_url=base_url, api_key=api_key, timeout=timeout)
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _LLM_EXTRACTION_PROMPT},
                {"role": "user", "content": raw_text[:4000]},
            ],
            response_format={"type": "json_object"},
            temperature=0,
            max_tokens=300,
        )
        body = (completion.choices[0].message.content or "").strip()
        data = json.loads(body)
        return _normalize_llm_output(data)
    except (OpenAIError, json.JSONDecodeError) as exc:
        logger.info("LLM OCR extraction unavailable / failed: %s", exc)
        return {}
    except Exception as exc:  # noqa: BLE001 — never break the OCR endpoint on a stage 3 issue
        logger.warning("LLM OCR extraction crashed: %s", exc)
        return {}


# ---------------------------------------------------------------------------
# Merge + entrypoint
# ---------------------------------------------------------------------------

_FIELDS = ('meralco_account_number', 'billing_period', 'total_kwh_consumed', 'total_bill_php')


def _merge_stages(spatial, regex, llm):
    """Merge per field: spatial > regex > LLM. Track source for debugging."""
    merged = {}
    sources = {}
    for field in _FIELDS:
        if spatial.get(field) is not None:
            merged[field] = spatial[field]
            sources[field] = 'spatial'
        elif regex.get(field) is not None:
            merged[field] = regex[field]
            sources[field] = 'regex'
        elif llm.get(field) is not None:
            merged[field] = llm[field]
            sources[field] = 'llm'
        else:
            merged[field] = None
            sources[field] = None
    return merged, sources


def _overall_confidence(data):
    """Mean of all non-negative Tesseract token confidences (0-100). 0 when none."""
    confs = []
    for raw in data.get('conf', []):
        try:
            v = int(raw)
        except (TypeError, ValueError):
            continue
        if v >= 0:
            confs.append(v)
    if not confs:
        return 0.0
    return round(sum(confs) / len(confs), 1)


def process_bill_image(image_file):
    """
    Three-stage Contract B extraction. Returns the same dict shape the existing
    API consumers expect, plus `extraction_sources` per field (one of
    'spatial' | 'regex' | 'llm' | None) for debugging.
    """
    try:
        preprocessed = _preprocess_with_opencv(image_file)
        data_dict = pytesseract.image_to_data(
            preprocessed, output_type=pytesseract.Output.DICT
        )
        raw_text = pytesseract.image_to_string(preprocessed)
        overall_confidence = _overall_confidence(data_dict)
    except Exception as exc:  # noqa: BLE001
        return {
            "success": False,
            "error_message": f"Failed to process image: {exc}",
            "needs_manual_verification": True,
            "overall_confidence": 0.0,
            "field_confidence": {},
            "extraction_sources": {},
        }

    spatial = _spatial_extract(data_dict)
    regex = _regex_extract(raw_text)

    interim, _ = _merge_stages(spatial, regex, {})
    needs_llm = any(interim.get(f) is None for f in _FIELDS)
    llm = _llm_extract(raw_text) if needs_llm else {}

    merged, sources = _merge_stages(spatial, regex, llm)

    needs_manual_verification = any(
        merged.get(f) is None for f in _FIELDS
    ) or merged.get('billing_period') in (None, 'Unknown')

    extracted_data = {
        'meralco_account_number': merged.get('meralco_account_number'),
        'billing_period': merged.get('billing_period') or 'Unknown',
        'total_kwh_consumed': merged.get('total_kwh_consumed'),
        'total_bill_php': merged.get('total_bill_php'),
        'scan_timestamp': timezone.now().isoformat(),
    }

    field_confidence = {
        'meralco_account_number': overall_confidence if merged.get('meralco_account_number') else 0.0,
        'billing_period': overall_confidence if merged.get('billing_period') and merged.get('billing_period') != 'Unknown' else 0.0,
        'total_kwh_consumed': overall_confidence if merged.get('total_kwh_consumed') is not None else 0.0,
        'total_bill_php': overall_confidence if merged.get('total_bill_php') is not None else 0.0,
    }

    return {
        'success': True,
        'extracted_data': extracted_data,
        'raw_text': raw_text if needs_manual_verification else None,
        'needs_manual_verification': needs_manual_verification,
        'overall_confidence': overall_confidence,
        'field_confidence': field_confidence,
        'extraction_sources': sources,
    }


# ---------------------------------------------------------------------------
# Backwards-compatible alias
# ---------------------------------------------------------------------------

def parse_extracted_text(text):
    """Deprecated: kept so existing imports keep working. Use process_bill_image instead."""
    fields = _regex_extract(text)
    needs_manual = any(fields.get(f) is None for f in _FIELDS)
    fields['scan_timestamp'] = timezone.now().isoformat()
    if not fields['billing_period']:
        fields['billing_period'] = 'Unknown'
    return {
        'success': True,
        'extracted_data': fields,
        'raw_text': text if needs_manual else None,
        'needs_manual_verification': needs_manual,
    }
