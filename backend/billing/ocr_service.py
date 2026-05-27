import re

import cv2
import numpy as np
import pytesseract
from PIL import Image
from django.utils import timezone

# Tesseract works best around 300 DPI. Camera shots often come in narrower; upscale.
_MIN_WIDTH_FOR_OCR = 1600


def _preprocess_with_opencv(image_file):
    """
    OpenCV pre-processing pipeline per paper §III.A.2 / §IV.C.1, tuned for both
    flatbed scans and phone-camera photos: grayscale -> upscale-if-small ->
    bilateral denoise -> deskew on text pixels only -> adaptive threshold.

    Returns (PIL.Image for Tesseract, numpy uint8 thresholded image for debugging).
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

    # Deskew: threshold first so we only consider text pixels (camera shots have
    # noisy backgrounds — measuring all dark pixels gives a useless angle).
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

    # Adaptive threshold tolerates uneven camera lighting; Otsu fails when the
    # bill has shadows or specular highlights.
    thresh = cv2.adaptiveThreshold(
        denoised, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=31,
        C=15,
    )

    return Image.fromarray(thresh)


def _ocr_with_confidence(pil_image):
    """
    Runs Tesseract and returns (raw_text, overall_confidence_0_to_100).
    overall_confidence is the mean of all non-empty token confidences. Returns
    0.0 when Tesseract found no readable tokens.
    """
    raw_text = pytesseract.image_to_string(pil_image)
    data = pytesseract.image_to_data(pil_image, output_type=pytesseract.Output.DICT)
    confs = [int(c) for c in data.get('conf', []) if str(c).lstrip('-').isdigit() and int(c) >= 0]
    overall = float(sum(confs)) / len(confs) if confs else 0.0
    return raw_text, round(overall, 1)


def process_bill_image(image_file):
    """
    Processes an uploaded MERALCO bill image: OpenCV pre-processing followed by
    Tesseract OCR, then regex extraction of the Contract B fields, with per-field
    confidence scores derived from Tesseract token confidences.
    """
    try:
        preprocessed = _preprocess_with_opencv(image_file)
        raw_text, overall_confidence = _ocr_with_confidence(preprocessed)
        result = parse_extracted_text(raw_text)
        result['overall_confidence'] = overall_confidence
        # Per-field confidence: token-confidence mean when the regex matched,
        # 0 when the field was not extracted. Lets the frontend show realistic
        # pill values instead of a hardcoded 90.
        extracted = result.get('extracted_data', {})
        result['field_confidence'] = {
            'meralco_account_number': overall_confidence if extracted.get('meralco_account_number') else 0.0,
            'billing_period': overall_confidence if extracted.get('billing_period') and extracted.get('billing_period') != 'Unknown' else 0.0,
            'total_kwh_consumed': overall_confidence if extracted.get('total_kwh_consumed') is not None else 0.0,
            'total_bill_php': overall_confidence if extracted.get('total_bill_php') is not None else 0.0,
        }
        return result
    except Exception as e:
        return {
            "success": False,
            "error_message": f"Failed to process image: {str(e)}",
            "needs_manual_verification": True,
            "overall_confidence": 0.0,
            "field_confidence": {},
        }


_ACCOUNT_PATTERNS = [
    # "Account No.: 1234567890", tolerates O/0 confusion in "No"
    r'(?:Account\s*N[o0]\.?|ACCT\s*N[o0]?\.?|CAN|Customer\s*Account\s*Number)[\s\:\-\.]+(\d[\d\s\-]{8,15})',
]

_PERIOD_PATTERNS = [
    # Full date range: "FEB 1, 2024 - FEB 29, 2024"
    r'(?:Billing\s*Period|Statement\s*Period|Period\s*Covered)[\s\:\-]+([A-Za-z]+\.?\s+\d{1,2}[\s,]+\d{4}\s*[\-–to]+\s*[A-Za-z]+\.?\s+\d{1,2}[\s,]+\d{4})',
    # Month + year: "Feb 2024"
    r'(?:Billing\s*Period|Statement\s*Period|Bill\s*Month)[\s\:\-]+([A-Za-z]+\.?\s+\d{4})',
    # Numeric range: "02/01/2024 - 02/29/2024"
    r'(?:Billing\s*Period|Statement\s*Period)[\s\:\-]+(\d{1,2}/\d{1,2}/\d{2,4}\s*[\-–to]+\s*\d{1,2}/\d{1,2}/\d{2,4})',
    # Single date fallback: "Bill Date 02/29/2024"
    r'(?:Bill\s*Date|Statement\s*Date)[\s\:\-]+(\d{1,2}/\d{1,2}/\d{2,4})',
]

_KWH_PATTERNS = [
    r'(?:Total\s*kWh\s*Consumed|Total\s*kWh\s*Used|kWh\s*Consumed|kWh\s*Used|Consumption)[\s\:\-]+([\d,]+\.?\d*)',
    r'(?:Total\s*kWh|kWh)[\s\:\-]+([\d,]+\.?\d*)',
    r'([\d,]+\.?\d*)\s*kWh\b',
]

_PHP_PATTERNS = [
    r'(?:Total\s*Amount\s*Due|Current\s*Amount\s*Due|Total\s*Bill|Amount\s*Due)[\s\:\-\₱\$P,\.]*([\d,]+\.\d{2})',
    r'(?:Total\s*Amount\s*Due|Current\s*Amount\s*Due|Total\s*Bill|Amount\s*Due)[\s\:\-\₱\$P,\.]*([\d,]+)',
    r'(?:PHP|₱|P)\s*([\d,]+\.\d{2})',
]


def _first_match(patterns, text):
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(1)
    return None


def _to_float(s):
    if s is None:
        return None
    try:
        return float(s.replace(',', '').strip())
    except (ValueError, AttributeError):
        return None


def parse_extracted_text(text):
    """
    Applies regex patterns to extract Contract B fields from raw OCR text.
    Tolerates common OCR artefacts: spaces in numbers, O/0 confusion, multiple
    label phrasings used by different MERALCO bill templates.
    """
    data = {
        "meralco_account_number": None,
        "billing_period": None,
        "total_kwh_consumed": None,
        "total_bill_php": None,
        "scan_timestamp": timezone.now().isoformat(),
    }

    needs_manual_verification = False

    acc_raw = _first_match(_ACCOUNT_PATTERNS, text)
    if acc_raw:
        digits = re.sub(r'\D', '', acc_raw)
        if len(digits) >= 9:
            data["meralco_account_number"] = digits
        else:
            needs_manual_verification = True
    else:
        needs_manual_verification = True

    period_raw = _first_match(_PERIOD_PATTERNS, text)
    if period_raw:
        data["billing_period"] = period_raw.strip()
    else:
        data["billing_period"] = "Unknown"
        needs_manual_verification = True

    kwh_val = _to_float(_first_match(_KWH_PATTERNS, text))
    if kwh_val is not None:
        data["total_kwh_consumed"] = kwh_val
    else:
        needs_manual_verification = True

    php_val = _to_float(_first_match(_PHP_PATTERNS, text))
    if php_val is not None:
        data["total_bill_php"] = php_val
    else:
        needs_manual_verification = True

    return {
        "success": True,
        "extracted_data": data,
        "raw_text": text if needs_manual_verification else None,
        "needs_manual_verification": needs_manual_verification,
    }
