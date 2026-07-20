/*
==========================================
CloudCrackers
admin.js
==========================================
*/

const TOKEN_KEY = "cloudcrackers_access_token";
const ADMIN_ROLES = ["admin", "Super Admin", "Admin", "Manager", "Staff"];

// JWT decoding helper
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

// Check admin authentication
function checkAuth() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        window.location.href = "login.html";
        return null;
    }
    const payload = parseJwt(token);
    if (!payload || !ADMIN_ROLES.includes(payload.role) || (payload.exp && payload.exp * 1000 < Date.now())) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem("cloudcrackers_refresh_token");
        window.location.href = "login.html";
        return null;
    }
    return token;
}

// Log out user
function logout() {
    const refreshToken = localStorage.getItem("cloudcrackers_refresh_token");
    if (refreshToken && typeof api !== 'undefined') {
        api.post("/api/auth/logout", { refresh_token: refreshToken }, false).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("cloudcrackers_refresh_token");
    window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
    // 1. Run immediate auth check
    const token = checkAuth();
    if (!token) return;

    // 2. Set up Periodic JWT expiration check (Auto Logout)
    setInterval(() => {
        const payload = parseJwt(localStorage.getItem(TOKEN_KEY));
        if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
            console.warn("JWT Session Expired. Log out auto trigger.");
            logout();
        }
    }, 15000); // Check every 15s

    // 3. Setup Idle Timeout (15 minutes of inactivity)
    const INACTIVITY_LIMIT = 15 * 60 * 1000;
    let lastActivityTime = Date.now();

    function resetActivityTimer() {
        lastActivityTime = Date.now();
    }

    window.addEventListener("mousemove", resetActivityTimer);
    window.addEventListener("keypress", resetActivityTimer);
    window.addEventListener("click", resetActivityTimer);
    window.addEventListener("scroll", resetActivityTimer);

    setInterval(() => {
        const inactiveDuration = Date.now() - lastActivityTime;
        if (inactiveDuration >= INACTIVITY_LIMIT) {
            console.warn("Session idle timeout exceeded. Auto logging out...");
            const refreshToken = localStorage.getItem("cloudcrackers_refresh_token");
            if (refreshToken && typeof api !== 'undefined') {
                api.post("/api/auth/logout", { refresh_token: refreshToken }, false).catch(() => {});
            }
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem("cloudcrackers_refresh_token");
            window.location.href = "session-expired.html";
        }
    }, 10000); // Check every 10 seconds

    // 4. Update Admin initials avatar in topbar
    const payload = parseJwt(token);
    const avatar = document.getElementById("adminAvatarHeader");
    if (avatar && payload) {
        if (payload.first_name && payload.last_name) {
            avatar.textContent = `${payload.first_name.charAt(0)}${payload.last_name.charAt(0)}`.toUpperCase();
        } else if (payload.email) {
            avatar.textContent = payload.email.substring(0, 2).toUpperCase();
        } else {
            avatar.textContent = "AD";
        }
    }

    // 5. Bind logout link handler
    const logoutBtn = document.getElementById("logoutLink");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            ModalConfirm.show({
                title: "Confirm Log Out",
                message: "Are you sure you want to log out of the admin panel?",
                confirmText: "Log Out",
                isDanger: true,
                onConfirm: logout
            });
        });
    }

    // 6. Setup sidebar active navigation classes automatically based on URL path
    const navLinks = document.querySelectorAll(".admin-nav a");
    const currentPath = window.location.pathname.split("/").pop();
    navLinks.forEach(link => {
        const linkPath = link.getAttribute("href");
        if (linkPath === currentPath) {
            navLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");
        }
    });
});