import pytesseract
from PIL import Image
import re
from django.utils import timezone

def process_bill_image(image_file):
    """
    Processes an uploaded image of a MERALCO bill using Tesseract OCR.
    Extracts key fields and returns a dictionary with the parsed data
    and a confidence/verification flag.
    """
    try:
        # Open the image file using Pillow
        img = Image.open(image_file)
        
        # Extract raw text via Tesseract
        # Note: In production on Render/Docker, tesseract-ocr is installed in the OS.
        raw_text = pytesseract.image_to_string(img)
        
        return parse_extracted_text(raw_text)
    except Exception as e:
        return {
            "success": False,
            "error_message": f"Failed to process image: {str(e)}",
            "needs_manual_verification": True
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
    
    # Simple regex rules based on standard MERALCO formatting
    # Note: These are baseline regexes and might need fine-tuning based on actual scan quality.
    
    # Look for 10-digit account numbers
    acc_match = re.search(r'(?:Account No\.|CAN)[\s\:\-]+(\d{10})', text, re.IGNORECASE)
    if acc_match:
        data["meralco_account_number"] = acc_match.group(1)
    else:
        needs_manual_verification = True
        
    # Look for billing period (e.g., "Feb 2024" or "02/01/2024 - 02/29/2024")
    # This is a very loose regex grabbing typical month/year combinations
    period_match = re.search(r'(?:Billing Period)[\s\:\-]+([A-Za-z]+\s\d{4}|\d{2}/\d{2}/\d{4}\s*-\s*\d{2}/\d{2}/\d{4})', text, re.IGNORECASE)
    if period_match:
        data["billing_period"] = period_match.group(1).strip()
    else:
        # Default placeholder if not found
        data["billing_period"] = "Unknown"
        needs_manual_verification = True

    # Look for kWh consumed (e.g., "Total kWh 210" or "kWh: 210")
    kwh_match = re.search(r'(?:Total\s+kWh|kWh)[\s\:\-]+([\d\.]+)', text, re.IGNORECASE)
    if kwh_match:
        try:
            data["total_kwh_consumed"] = float(kwh_match.group(1))
        except ValueError:
            needs_manual_verification = True
    else:
        needs_manual_verification = True
        
    # Look for Total Amount Due (PHP)
    php_match = re.search(r'(?:Total Amount Due|Amount Due)[\s\:\-P]+([\d\,\.]+)', text, re.IGNORECASE)
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
        "raw_text": text if needs_manual_verification else None, # Include raw text for debugging if failed
        "needs_manual_verification": needs_manual_verification
    }
