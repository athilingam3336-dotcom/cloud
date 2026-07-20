/*
==========================================
CloudCrackers
api.js
Centralized API service with timeout, retry, and global error handling
==========================================
*/

const api = {
    TIMEOUT_MS: 10000,
    MAX_RETRIES: 2,

    async request(endpoint, method = "GET", data = null, auth = false, retryCount = 0) {
        const headers = {
            "Content-Type": "application/json"
        };

        // Extract double-submit CSRF token cookie if set
        const csrfToken = (function(name) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        })("csrf_token");
        
        if (csrfToken) {
            headers["X-CSRF-Token"] = csrfToken;
        }

        if (auth) {
            const token = localStorage.getItem(TOKEN_KEY);
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }
        }

        const options = {
            method: method,
            headers: headers,
            credentials: "include"
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        // Setup Request Timeout using AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
        options.signal = controller.signal;

        try {
            const response = await fetch(API_BASE_URL + endpoint, options);
            clearTimeout(timeoutId);

            let result = {};
            try {
                result = await response.json();
            } catch {
                result = {};
            }

            if (!response.ok) {
                // If 401, try to silently refresh token using refresh_token rotation
                if (response.status === 401 && auth && endpoint !== "/api/auth/refresh" && endpoint !== "/auth/login")
     {
                    const refreshToken = localStorage.getItem("cloudcrackers_refresh_token");
                    if (refreshToken) {
                        try {
                            const refreshResponse = await fetch(API_BASE_URL + "/auth/refresh", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({ refresh_token: refreshToken })
                            });

                            if (refreshResponse.ok) {
                                const refreshResult = await refreshResponse.json();
                                localStorage.setItem(TOKEN_KEY, refreshResult.access_token);
                                localStorage.setItem("cloudcrackers_refresh_token", refreshResult.refresh_token);

                                // Retry the original request with the new access token
                                headers["Authorization"] = `Bearer ${refreshResult.access_token}`;
                                const retryResponse = await fetch(API_BASE_URL + endpoint, {
                                    ...options,
                                    headers: headers
                                });

                                let retryResult = {};
                                try {
                                    retryResult = await retryResponse.json();
                                } catch {
                                    retryResult = {};
                                }

                                if (retryResponse.ok) {
                                    return retryResult;
                                } else {
                                    let retryErrMsg = "Request Failed";
                                    if (Array.isArray(retryResult.detail)) {
                                        retryErrMsg = retryResult.detail.map(e => `${e.loc[e.loc.length - 1]}: ${e.msg}`).join(", ");
                                    } else if (retryResult.detail) {
                                        retryErrMsg = retryResult.detail;
                                    } else if (retryResult.message) {
                                        retryErrMsg = retryResult.message;
                                    }
                                    const retryError = new Error(retryErrMsg);
                                    retryError.status = retryResponse.status;
                                    retryError.detail = retryResult.detail || "";
                                    this.handleGlobalError(retryError);
                                    throw retryError;
                                }
                            }
                        } catch (refreshErr) {
                            console.error("Token refresh failed:", refreshErr);
                        }
                    }
                }

                let errMsg = "Request Failed";
                if (Array.isArray(result.detail)) {
                    errMsg = result.detail.map(e => `${e.loc[e.loc.length - 1]}: ${e.msg}`).join(", ");
                } else if (result.detail) {
                    errMsg = result.detail;
                } else if (result.message) {
                    errMsg = result.message;
                }
                const error = new Error(errMsg);
                error.status = response.status;
                error.detail = result.detail || "";
                
                // Invoke global error handler
                this.handleGlobalError(error);
                throw error;
            }

            return result;
        } catch (err) {
            clearTimeout(timeoutId);

            // Handle Retry Logic for network errors
            if (err.name === 'AbortError') {
                const timeoutError = new Error("Request Timeout - Server took too long to respond.");
                timeoutError.status = 408;
                this.handleGlobalError(timeoutError);
                throw timeoutError;
            }

            if (retryCount < this.MAX_RETRIES && (!err.status || err.status >= 500)) {
                console.warn(`API retry ${retryCount + 1}/${this.MAX_RETRIES} for: ${endpoint}`);
                return await this.request(endpoint, method, data, auth, retryCount + 1);
            }

            this.handleGlobalError(err);
            throw err;
        }
    },

    get(endpoint, auth = false) {
        return this.request(endpoint, "GET", null, auth);
    },

    post(endpoint, data, auth = false) {
        return this.request(endpoint, "POST", data, auth);
    },

    put(endpoint, data, auth = false) {
        return this.request(endpoint, "PUT", data, auth);
    },

    patch(endpoint, data, auth = false) {
        return this.request(endpoint, "PATCH", data, auth);
    },

    delete(endpoint, auth = false) {
        return this.request(endpoint, "DELETE", null, auth);
    },

    // Global API Error Handler
    handleGlobalError(error) {
        console.error("Global API Error Caught:", error);

        if (error.status === 401 || error.status === 403) {
            console.warn("Session expired or Unauthorized. Redirecting to login...");
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem("cloudcrackers_refresh_token");
            // Verify if we are already in login.html to avoid infinite loop
            if (!window.location.pathname.endsWith("login.html")) {
                window.location.href = "login.html";
            }
            return;
        }

        // Emit globally so pages can catch and print toasts, or display user-friendly warnings
        let msg = "An unexpected error occurred.";
        if (error.status === 404) {
            msg = "Requested resource not found (404).";
        } else if (error.status === 422) {
            msg = "Validation Error - Invalid fields submitted (422).";
        } else if (error.status === 500) {
            msg = "Internal Server Error - Something went wrong on the server.";
        } else if (error.status === 408) {
            msg = error.message;
        } else if (error.message) {
            msg = error.message;
        }

        // Dispatch custom event for global logger/toast display
        const event = new CustomEvent("apiError", { detail: { message: msg, error } });
        window.dispatchEvent(event);
    }
};