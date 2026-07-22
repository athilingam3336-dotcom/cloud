"""
=========================================
CloudCrackers
File Upload & Security Validation Utility
=========================================
"""

import base64
import os
import uuid


def virus_scan_file(data: bytes) -> bool:
    """
    Mock virus scan hook. Searches file contents for malicious patterns
    or the standard EICAR test file string.
    """
    # EICAR standard anti-virus test file signature
    eicar_signature = b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE"
    if eicar_signature in data:
        return False
    return True


def validate_and_sanitize_image(base64_data: str) -> tuple[bytes, str]:
    """
    Decodes a base64 string, validates size, mime types, file signatures,
    and runs virus scans. Rejects dangerous executable binaries.
    """
    if not base64_data:
        raise ValueError("Image content is empty.")

    # Parse data URI format (e.g. data:image/png;base64,...)
    if "," in base64_data:
        header, base64_str = base64_data.split(",", 1)
    else:
        base64_str = base64_data

    try:
        file_bytes = base64.b64decode(base64_str)
    except Exception:
        raise ValueError("Invalid Base64 payload encoding.")

    # 1. Validate File Size (Max 5MB)
    max_size = 5 * 1024 * 1024
    if len(file_bytes) > max_size:
        raise ValueError("File size exceeds the maximum limit of 5MB.")

    # 2. Reject Executables and Scripts (MZ signature check, PHP tag check)
    if file_bytes.startswith(b"MZ") or file_bytes.startswith(b"PE"):
        raise ValueError("Dangerous file type rejected (Executable binary detected).")
    if b"<?php" in file_bytes or b"<script" in file_bytes:
        raise ValueError("Dangerous script tag content rejected.")

    # 3. Magic Signature check (JPG, PNG, WEBP)
    # JPEG signature: FF D8 FF
    # PNG signature: 89 50 4E 47 0D 0A 1A 0A
    # WEBP signature: RIFF at start and WEBP at index 8
    ext = ""
    if file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        ext = "png"
    elif file_bytes.startswith(b"\xff\xd8\xff"):
        ext = "jpg"
    elif file_bytes.startswith(b"RIFF") and file_bytes[8:12] == b"WEBP":
        ext = "webp"
    else:
        raise ValueError("Invalid file signature. Only JPG, JPEG, PNG, and WEBP formats are allowed.")

    # 4. Run Virus Scan
    if not virus_scan_file(file_bytes):
        raise ValueError("Security Threat Alert: Virus signature detected by scanner hook.")

    return file_bytes, ext


def save_secure_file(base64_data: str) -> str:
    """
    Validates the base64 input, generates a unique UUID filename,
    and writes it outside the public folder (inside a local 'uploads' folder).
    """
    file_bytes, ext = validate_and_sanitize_image(base64_data)
    
    # Target directory outside public web server roots
    upload_dir = "uploads"
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)

    # Generate cryptographically secure unique filename
    filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(upload_dir, filename)

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    return filename
