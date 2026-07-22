"""
=========================================
CloudCrackers
MIME Validation Utility
=========================================
"""

def validate_image_mime(file_bytes: bytes, filename: str) -> bool:
    """
    Validates that a file's extension and magic bytes match safe image formats (JPEG, PNG, GIF).
    This protects against spoofing attacks (e.g. uploading executable scripts renamed as .png).
    """
    # 1. Extension Check
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    if ext not in ["jpg", "jpeg", "png", "gif"]:
        return False

    # 2. Magic Bytes Check
    # PNG: 89 50 4E 47 0D 0A 1A 0A
    if file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return ext == "png"
    # JPEG: FF D8 FF
    elif file_bytes.startswith(b"\xff\xd8\xff"):
        return ext in ["jpg", "jpeg"]
    # GIF: GIF87a or GIF89a
    elif file_bytes.startswith(b"GIF87a") or file_bytes.startswith(b"GIF89a"):
        return ext == "gif"

    return False
