"""
=========================================
CloudCrackers
Rate Limiter Middleware
=========================================
"""

import time
from fastapi import Request, HTTPException, status


class RateLimiter:

    def __init__(self, requests_limit: int, window_seconds: int):
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        # dict: { ip: [timestamp1, timestamp2, ...] }
        self.requests = {}

    def __call__(self, request: Request):
        # Extract client IP
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()

        if client_ip not in self.requests:
            self.requests[client_ip] = []

        # Remove old timestamps outside window
        self.requests[client_ip] = [
            t for t in self.requests[client_ip]
            if now - t < self.window_seconds
        ]

        # Check limit
        if len(self.requests[client_ip]) >= self.requests_limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later."
            )

        self.requests[client_ip].append(now)


# 10 attempts per minute for sensitive endpoints (login, register, forgot-password, reset-password)
auth_rate_limiter = RateLimiter(requests_limit=10, window_seconds=60)

# 100 attempts per minute for general api calls
api_rate_limiter = RateLimiter(requests_limit=100, window_seconds=60)
