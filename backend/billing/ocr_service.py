import re

import cv2
import numpy as np
import pytesseract
from PIL import Image
from django.utils import timezone


def _preprocess_with_opencv(image_file):
    """
    OpenCV pre-processing pipeline per paper §III.A.2 / §IV.C.1:
    grayscale -> bilateral denoise -> deskew -> Otsu threshold.
    Returns a PIL.Image suitable for pytesseract.
    """
    image_file.seek(0)
    file_bytes = np.frombuffer(image_file.read(), dtype=np.uint8)
    bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("Could not decode image bytes as an image.")

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    denoised = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)

    inverted = cv2.bitwise_not(denoised)
    coords = np.column_stack(np.where(inverted > 0))
    if coords.size:
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        if abs(angle) > 0.5:
            h, w = denoised.shape[:2]
            center = (w // 2, h // 2)
            rot = cv2.getRotationMatrix2D(center, angle, 1.0)
            denoised = cv2.warpAffine(
                denoised, rot, (w, h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE,
            )

    _, thresh = cv2.threshold(
        denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )
    return Image.fromarray(thresh)


def process_bill_image(image_file):
    """
    Processes an uploaded MERALCO bill image: OpenCV pre-processing followed by
    Tesseract OCR, then regex extraction of the Contract B fields.
    """
    try:
        preprocessed = _preprocess_with_opencv(image_file)
        raw_text = pytesseract.image_to_string(preprocessed)
        return parse_extracted_text(raw_text)
    except Exception as e:
        return {
            "success": False,
            "error_message": f"Failed to process image: {str(e)}",
            "needs_manual_verification": True,
        }


def parse_extracted_text(text):
    """
    Applies regex patterns to extract required fields from raw OCR text.
    """
    data = {
        "meralco_account_number": None,
        "billing_period": None,
        "total_kwh_consumed": None,
        "total_bill_php": None,
        "scan_timestamp": timezone.now().isoformat(),
    }

    needs_manual_verification = False

    acc_match = re.search(
        r'(?:Account No\.|CAN)[\s\:\-]+(\d{10})', text, re.IGNORECASE
    )
    if acc_match:
        data["meralco_account_number"] = acc_match.group(1)
    else:
        needs_manual_verification = True

    period_match = re.search(
        r'(?:Billing Period)[\s\:\-]+([A-Za-z]+\s\d{4}|\d{2}/\d{2}/\d{4}\s*-\s*\d{2}/\d{2}/\d{4})',
        text, re.IGNORECASE,
    )
    if period_match:
        data["billing_period"] = period_match.group(1).strip()
    else:
        data["billing_period"] = "Unknown"
        needs_manual_verification = True

    kwh_match = re.search(
        r'(?:Total\s+kWh|kWh)[\s\:\-]+([\d\.]+)', text, re.IGNORECASE
    )
    if kwh_match:
        try:
            data["total_kwh_consumed"] = float(kwh_match.group(1))
        except ValueError:
            needs_manual_verification = True
    else:
        needs_manual_verification = True

    php_match = re.search(
        r'(?:Total Amount Due|Amount Due)[\s\:\-P]+([\d\,\.]+)',
        text, re.IGNORECASE,
    )
    if php_match:
        try:
            clean_val = php_match.group(1).replace(',', '')
            data["total_bill_php"] = float(clean_val)
        except ValueError:
            needs_manual_verification = True
    else:
        needs_manual_verification = True

    return {
        "success": True,
        "extracted_data": data,
        "raw_text": text if needs_manual_verification else None,
        "needs_manual_verification": needs_manual_verification,
    }
