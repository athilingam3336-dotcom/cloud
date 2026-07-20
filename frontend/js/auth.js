/**
 * ==========================================================================
 * CloudCrackers — Authentication & Security UI Script System
 * Supports skeleton loading states, toast alerts, eye-toggles, password strength
 * meters, active form loading spinners, and dynamic light/dark mode toggles.
 * ==========================================================================
 */

// ---- Toast Notification System ----
function showToast(message, type = "success") {
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.className = "toast-container";
        document.body.appendChild(container);
    }
    
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let icon = "fa-circle-check";
    if (type === "error") icon = "fa-circle-xmark";
    else if (type === "warning") icon = "fa-circle-exclamation";
    else if (type === "info") icon = "fa-circle-info";

    toast.innerHTML = `
        <i class="fa-solid ${icon} toast-icon" aria-hidden="true"></i>
        <div class="toast-content">${message}</div>
        <button class="toast-close" aria-label="Close notification" onclick="this.parentElement.remove()">&times;</button>
    `;
    container.appendChild(toast);

    // Fade out and remove after 4.5 seconds
    setTimeout(() => {
        toast.classList.add("toast-fade-out");
        setTimeout(() => toast.remove(), 350);
    }, 4500);
}

// ---- Form Button Loading Spinner Helper ----
function setFormLoading(form, isLoading) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const inputs = form.querySelectorAll('input, button');
    if (!submitBtn) return;

    if (isLoading) {
        submitBtn.dataset.originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = `<span class="spinner-small" aria-hidden="true"></span> Processing...`;
        submitBtn.disabled = true;
        inputs.forEach(input => {
            if (input !== submitBtn) input.disabled = true;
        });
    } else {
        submitBtn.innerHTML = submitBtn.dataset.originalText || 'Submit';
        submitBtn.disabled = false;
        inputs.forEach(input => {
            input.disabled = false;
        });
    }
}

// ---- Skeleton Screen Transition ----
window.addEventListener("DOMContentLoaded", () => {
    const skeleton = document.getElementById("authSkeleton");
    const content = document.getElementById("authContent");
    if (skeleton && content) {
        setTimeout(() => {
            skeleton.style.display = "none";
            content.classList.add("loaded");
        }, 800);
    } else if (content) {
        content.classList.add("loaded");
    }
    
    // Initialize Theme Toggle Float Button
    initThemeToggle();
    
    // Initialize Password Eye Toggle Listeners
    initPasswordEyeToggles();

    // Initialize Password Strength Meter
    initPasswordStrengthMeter();
});

// ---- Dynamic Theme Toggling (Dark/Light) ----
function initThemeToggle() {
    // Avoid double creation
    if (document.querySelector(".theme-toggle-btn")) return;

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "theme-toggle-btn";
    toggleBtn.setAttribute("aria-label", "Toggle Light and Dark Theme");
    toggleBtn.innerHTML = `<i class="fa-solid fa-moon" aria-hidden="true"></i>`;
    document.body.appendChild(toggleBtn);

    const savedTheme = localStorage.getItem("auth_theme") || "dark";
    if (savedTheme === "light") {
        document.body.classList.add("light-mode");
        toggleBtn.innerHTML = `<i class="fa-solid fa-sun" aria-hidden="true"></i>`;
    }

    toggleBtn.addEventListener("click", () => {
        if (document.body.classList.contains("light-mode")) {
            document.body.classList.remove("light-mode");
            localStorage.setItem("auth_theme", "dark");
            toggleBtn.innerHTML = `<i class="fa-solid fa-moon" aria-hidden="true"></i>`;
            showToast("Dark mode activated", "info");
        } else {
            document.body.classList.add("light-mode");
            localStorage.setItem("auth_theme", "light");
            toggleBtn.innerHTML = `<i class="fa-solid fa-sun" aria-hidden="true"></i>`;
            showToast("Light mode activated", "info");
        }
    });
}

// ---- Eye Toggle Visibility Handler ----
function initPasswordEyeToggles() {
    document.addEventListener("click", function (e) {
        const toggleBtn = e.target.closest("[data-toggle-password]");
        if (toggleBtn) {
            e.preventDefault();
            const targetId = toggleBtn.getAttribute("data-toggle-password");
            const passwordInput = document.getElementById(targetId);
            if (passwordInput) {
                const icon = toggleBtn.querySelector("i");
                if (passwordInput.type === "password") {
                    passwordInput.type = "text";
                    icon.classList.remove("fa-eye");
                    icon.classList.add("fa-eye-slash");
                    toggleBtn.setAttribute("aria-label", "Hide password");
                } else {
                    passwordInput.type = "password";
                    icon.classList.remove("fa-eye-slash");
                    icon.classList.add("fa-eye");
                    toggleBtn.setAttribute("aria-label", "Show password");
                }
            }
        }
    });
}

// ---- Active Password Strength Evaluation ----
function initPasswordStrengthMeter() {
    const passwordInput = document.getElementById("rpassword") || document.getElementById("password");
    const section = document.getElementById("passwordStrengthSection");
    if (!passwordInput || !section) return;

    passwordInput.addEventListener("input", function () {
        const val = this.value;
        if (!val) {
            section.style.display = "none";
            return;
        }
        section.style.display = "block";

        const hasLength = val.length >= 8;
        const hasUpper = /[A-Z]/.test(val);
        const hasLower = /[a-z]/.test(val);
        const hasDigit = /[0-9]/.test(val);
        const hasSpecial = /[@$!%*?&#]/.test(val);

        // Update checklist nodes
        updateCriteriaNode("critLength", hasLength);
        updateCriteriaNode("critUpper", hasUpper);
        updateCriteriaNode("critLower", hasLower);
        updateCriteriaNode("critDigit", hasDigit);
        updateCriteriaNode("critSpecial", hasSpecial);

        let score = 0;
        if (hasLength) score++;
        if (hasUpper) score++;
        if (hasLower) score++;
        if (hasDigit) score++;
        if (hasSpecial) score++;

        const bar = document.getElementById("strengthBar");
        const txt = document.getElementById("strengthText");

        if (score <= 2) {
            bar.style.width = "33%";
            bar.className = "strength-bar strength-weak";
            txt.innerText = "Strength: Weak";
            txt.style.color = "var(--red)";
        } else if (score <= 4) {
            bar.style.width = "66%";
            bar.className = "strength-bar strength-medium";
            txt.innerText = "Strength: Medium";
            txt.style.color = "var(--gold)";
        } else {
            bar.style.width = "100%";
            bar.className = "strength-bar strength-strong";
            txt.innerText = "Strength: Strong";
            txt.style.color = "var(--spark-cyan)";
        }
    });
}

function updateCriteriaNode(id, passed) {
    const el = document.getElementById(id);
    if (el) {
        const icon = el.querySelector("i");
        if (passed) {
            el.classList.add("passed");
            icon.className = "fa-solid fa-circle-check";
        } else {
            el.classList.remove("passed");
            icon.className = "fa-regular fa-circle";
        }
    }
}

// ---- Token Storage Utilities ----
function saveToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function saveTokens(accessToken, refreshToken) {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem("cloudcrackers_refresh_token", refreshToken);
}

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

// ---- Logout API Routine ----
async function logout() {
    const refreshToken = localStorage.getItem("cloudcrackers_refresh_token");
    if (refreshToken) {
        try {
            await api.post("/api/auth/logout", { refresh_token: refreshToken });
        } catch (e) {
            console.error("Logout API failed:", e);
        }
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("cloudcrackers_refresh_token");
    window.location.href = "login.html";
}

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

// ---- Core Authentication Actions ----

// 1. LOGIN SUBMIT HANDLER
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        if (!email || !password) {
            showToast("Please fill in all credentials.", "warning");
            return;
        }

        setFormLoading(loginForm, true);
        try {
            const result = await api.post("/api/auth/login", { email, password });
            saveTokens(result.access_token, result.refresh_token);
            
            showToast("Login successful! Redirecting...", "success");
            
            const payload = parseJwt(result.access_token);
            setTimeout(() => {
                if (payload && payload.role === "admin") {
                    window.location.href = "admin-dashboard.html";
                } else {
                    window.location.href = "products.html";
                }
            }, 1000);
        } catch (err) {
            setFormLoading(loginForm, false);
            showToast(err.message || "Invalid email or password.", "error");
        }
    });
}

// 2. REGISTER SUBMIT HANDLER
const registerForm = document.getElementById("registerForm");
if (registerForm) {
    registerForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        
        const data = {
            first_name: document.getElementById("fname").value,
            last_name: document.getElementById("lname").value,
            email: document.getElementById("remail").value,
            phone: document.getElementById("rphone").value,
            password: document.getElementById("rpassword").value
        };

        if (data.first_name.trim().length < 2) {
            showToast("First Name must be at least 2 characters.", "warning");
            return;
        }
        if (data.last_name.trim().length < 2) {
            showToast("Last Name must be at least 2 characters.", "warning");
            return;
        }
        
        // Client-side password strength validation matching backend rules
        const password = data.password;
        if (password.length < 8) {
            showToast("Password must be at least 8 characters.", "warning");
            return;
        }
        if (!/[A-Z]/.test(password)) {
            showToast("Password must contain at least one uppercase letter.", "warning");
            return;
        }
        if (!/[a-z]/.test(password)) {
            showToast("Password must contain at least one lowercase letter.", "warning");
            return;
        }
        if (!/[0-9]/.test(password)) {
            showToast("Password must contain at least one number.", "warning");
            return;
        }
        if (!/[@$!%*?&#]/.test(password)) {
            showToast("Password must contain at least one special character.", "warning");
            return;
        }

        const checkbox = registerForm.querySelector('input[type="checkbox"]');
        if (checkbox && !checkbox.checked) {
            showToast("Please agree to the Terms & Conditions.", "warning");
            return;
        }

        setFormLoading(registerForm, true);
        try {
            await api.post("/api/auth/register", data);
            showToast("Registration successful! Verify your email to complete registration.", "success");
            
            setTimeout(() => {
                window.location.href = "login.html";
            }, 3000);
        } catch (err) {
            setFormLoading(registerForm, false);
            showToast(err.message || "Failed to create account. Email might be in use.", "error");
        }
    });
}

// 3. FORGOT PASSWORD SUBMIT HANDLER
const forgotPasswordForm = document.getElementById("forgotPasswordForm");
if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const email = document.getElementById("email").value;

        if (!email) {
            showToast("Please enter your email address.", "warning");
            return;
        }

        setFormLoading(forgotPasswordForm, true);
        try {
            const res = await api.post("/api/auth/forgot-password", { email });
            showToast(res.message || "If the email exists, a password reset link has been sent.", "success");
            setFormLoading(forgotPasswordForm, false);
        } catch (err) {
            setFormLoading(forgotPasswordForm, false);
            showToast(err.message || "Failed to send reset link.", "error");
        }
    });
}

// 4. RESET PASSWORD SUBMIT HANDLER
const resetPasswordForm = document.getElementById("resetPasswordForm");
if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (password !== confirmPassword) {
            showToast("Passwords do not match.", "warning");
            return;
        }

        // Strength checks
        if (password.length < 8) {
            showToast("Password must be at least 8 characters.", "warning");
            return;
        }
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[@$!%*?&#]/.test(password)) {
            showToast("Password does not meet complexity requirements.", "warning");
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get("token");
        if (!token) {
            showToast("Invalid reset link. Token is missing.", "error");
            return;
        }

        setFormLoading(resetPasswordForm, true);
        try {
            const res = await api.post("/api/auth/reset-password", { token, password });
            showToast(res.message || "Password has been reset successfully.", "success");
            
            setTimeout(() => {
                window.location.href = "login.html";
            }, 2000);
        } catch (err) {
            setFormLoading(resetPasswordForm, false);
            showToast(err.message || "Reset token has expired or is invalid.", "error");
        }
    });
}

// 5. EMAIL VERIFICATION INITIALIZATION
const verifyEmailContainer = document.getElementById("verifyEmailContainer");
if (verifyEmailContainer) {
    window.addEventListener("DOMContentLoaded", async function () {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get("token");
        const statusTitle = document.getElementById("verifyTitle");
        const statusText = document.getElementById("verifyText");
        const verifyIcon = document.getElementById("verifyIcon");
        const actionBtn = document.getElementById("verifyActionBtn");

        const skeleton = document.getElementById("authSkeleton");
        const content = document.getElementById("authContent");

        // Keep skeleton loader active during the API query
        if (!token) {
            if (skeleton) skeleton.style.display = "none";
            if (content) content.classList.add("loaded");

            if (statusTitle) statusTitle.innerText = "Verification Failed";
            if (statusText) statusText.innerText = "No token was found in the URL link parameters.";
            if (verifyIcon) {
                verifyIcon.className = "fa-regular fa-circle-xmark error-icon";
            }
            showToast("Email verification failed: Missing token.", "error");
            return;
        }

        try {
            const res = await api.get(`/api/auth/verify-email?token=${token}`, false);
            
            // Verification succeeded
            if (skeleton) skeleton.style.display = "none";
            if (content) content.classList.add("loaded");

            if (statusTitle) statusTitle.innerText = "Verification Successful!";
            if (statusText) statusText.innerText = res.message || "Your activation has been successfully verified.";
            if (verifyIcon) {
                verifyIcon.className = "fa-regular fa-circle-check success-icon";
            }
            if (actionBtn) {
                actionBtn.style.display = "inline-block";
            }
            showToast("Email verified successfully! You can now log in.", "success");
        } catch (err) {
            // Verification failed
            if (skeleton) skeleton.style.display = "none";
            if (content) content.classList.add("loaded");

            if (statusTitle) statusTitle.innerText = "Verification Failed";
            if (statusText) statusText.innerText = err.message || "The verification link is invalid or has expired.";
            if (verifyIcon) {
                verifyIcon.className = "fa-regular fa-circle-xmark error-icon";
            }
            showToast(err.message || "Verification link is invalid or expired.", "error");
        }
    });
}