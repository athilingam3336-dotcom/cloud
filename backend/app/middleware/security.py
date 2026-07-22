"""
=========================================
CloudCrackers
Security Middleware
=========================================
"""

import secrets
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, Response, status


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Enforces security headers such as CSP, HSTS, X-Frame-Options, XSS protection.
    """
    async def dispatch(self, request: Request, call_next) -> Response:
        response: Response = await call_next(request)
        
        # CSP Header
        csp_policy = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; "
            "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
            "img-src 'self' data:; "
            "connect-src 'self' http://127.0.0.1:8000 http://localhost:8000 http://127.0.0.1:8080 http://localhost:8080; "
            "frame-ancestors 'none';"
        )
        response.headers["Content-Security-Policy"] = csp_policy
        
        # HSTS Header (2 years)
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        
        # X-Frame-Options (Clickjacking Protection)
        response.headers["X-Frame-Options"] = "DENY"
        
        # X-Content-Type-Options (MIME Sniffing Protection)
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # X-XSS-Protection
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        return response


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """
    Limits the maximum request body size to prevent Denial of Service (DoS) attacks.
    Default limit is 5MB.
    """
    def __init__(self, app, max_size_bytes: int = 5 * 1024 * 1024):
        super().__init__(app)
        self.max_size_bytes = max_size_bytes

    async def dispatch(self, request: Request, call_next) -> Response:
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > self.max_size_bytes:
                    return Response(
                        content="Payload Too Large",
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
                    )
            except ValueError:
                return Response(
                    content="Invalid Content-Length Header",
                    status_code=status.HTTP_400_BAD_REQUEST
                )
        return await call_next(request)


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    Implements CSRF protection using the Double-Submit Cookie pattern.
    Exempts safe methods (GET, HEAD, OPTIONS, TRACE) and public auth handshakes.
    """
    async def dispatch(self, request: Request, call_next) -> Response:
        # Check if cookie exists, otherwise generate a new token
        csrf_cookie = request.cookies.get("csrf_token")
        new_csrf_token = csrf_cookie or secrets.token_hex(32)

        from app.core.config import settings

        # Validate unsafe methods
        if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
            # Bypass CSRF checks for public API/docs paths and DEBUG mode
            path = request.url.path
            exempt_paths = [
                "/docs", "/redoc", "/openapi.json",
                "/api/auth"
            ]
            
            if not settings.DEBUG and not any(path.startswith(p) for p in exempt_paths):
                csrf_header = request.headers.get("x-csrf-token")
                
                if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
                    return Response(
                        content="CSRF Token Validation Failed",
                        status_code=status.HTTP_403_FORBIDDEN
                    )

        response: Response = await call_next(request)
        
        # Set or renew the CSRF cookie dynamically
        is_secure = request.url.scheme == "https"
        response.set_cookie(
            key="csrf_token",
            value=new_csrf_token,
            path="/",
            httponly=False,  # Client JS must read it to copy to request header
            secure=is_secure,
            samesite="lax"
        )
        
        return response
