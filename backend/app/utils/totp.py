"""
=========================================
CloudCrackers
TOTP (Time-based One-time Password) RFC 6238 Utility
=========================================
"""

import base64
import hashlib
import hmac
import struct
import time


def verify_totp(secret: str, code: str) -> bool:
    try:
        secret = secret.strip().replace(" ", "")
        # base32 padding fix
        missing_padding = len(secret) % 8
        if missing_padding:
            secret += "=" * (8 - missing_padding)

        key = base64.b32decode(secret, casefold=True)
        intervals_no = int(time.time() // 30)

        # Allow 1-step window clock drift
        for i in [0, -1, 1]:
            msg = struct.pack(">Q", intervals_no + i)
            hmac_hash = hmac.new(key, msg, hashlib.sha1).digest()
            o = hmac_hash[19] & 15
            token = (struct.unpack(">I", hmac_hash[o:o+4])[0] & 0x7fffffff) % 1000000
            if f"{token:06d}" == code.strip():
                return True
        return False
    except Exception:
        return False
