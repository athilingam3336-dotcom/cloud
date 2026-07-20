/*
==========================================
CloudCrackers
toast.js
Global Toast component to replace simple alert() boxes
==========================================
*/

const Toast = {
    containerId: "toastContainer",

    init() {
        let container = document.getElementById(this.containerId);
        if (!container) {
            container = document.createElement("div");
            container.id = this.containerId;
            document.body.appendChild(container);
        }
    },

    show(message, type = "success", duration = 3000) {
        this.init();
        const container = document.getElementById(this.containerId);

        const toast = document.createElement("div");
        toast.className = `alert alert-${type === 'success' ? 'success' : (type === 'error' ? 'error' : 'info')} toast`;
        toast.style.margin = "0";
        toast.style.boxShadow = "0 8px 16px rgba(0, 0, 0, 0.25)";
        toast.style.minWidth = "300px";
        toast.style.display = "flex";
        toast.style.alignItems = "center";
        toast.style.gap = "12px";
        toast.style.background = this.getBackgroundColor(type);
        toast.style.border = `1px solid ${this.getBorderColor(type)}`;
        toast.style.color = this.getTextColor(type);
        toast.style.padding = "12px 18px";
        toast.style.borderRadius = "var(--radius-md, 8px)";

        // Set Icon
        const icon = document.createElement("i");
        icon.className = this.getIconClass(type);
        icon.style.fontSize = "16px";
        toast.appendChild(icon);

        // Set Text
        const textSpan = document.createElement("span");
        textSpan.style.flex = "1";
        textSpan.style.fontSize = "13px";
        textSpan.style.fontWeight = "500";
        textSpan.textContent = message;
        toast.appendChild(textSpan);

        // Set Close Button
        const closeBtn = document.createElement("button");
        closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeBtn.style.background = "none";
        closeBtn.style.border = "none";
        closeBtn.style.color = "inherit";
        closeBtn.style.cursor = "pointer";
        closeBtn.style.opacity = "0.7";
        closeBtn.style.padding = "4px";
        closeBtn.addEventListener("click", () => {
            this.removeToast(toast);
        });
        toast.appendChild(closeBtn);

        container.appendChild(toast);

        // Auto Close
        setTimeout(() => {
            this.removeToast(toast);
        }, duration);
    },

    removeToast(toast) {
        toast.style.animation = "fadeOut 0.3s ease-out forwards";
        setTimeout(() => {
            toast.remove();
        }, 300);
    },

    success(message, duration) { this.show(message, "success", duration); },
    error(message, duration) { this.show(message, "error", duration); },
    warning(message, duration) { this.show(message, "warning", duration); },
    info(message, duration) { this.show(message, "info", duration); },

    getBackgroundColor(type) {
        if (type === "success") return "rgba(61, 220, 151, 0.12)";
        if (type === "error") return "rgba(255, 77, 109, 0.12)";
        if (type === "warning") return "rgba(242, 183, 5, 0.12)";
        return "rgba(77, 208, 225, 0.12)";
    },

    getBorderColor(type) {
        if (type === "success") return "rgba(61, 220, 151, 0.3)";
        if (type === "error") return "rgba(255, 77, 109, 0.3)";
        if (type === "warning") return "rgba(242, 183, 5, 0.3)";
        return "rgba(77, 208, 225, 0.3)";
    },

    getTextColor(type) {
        if (type === "success") return "#3DDC97";
        if (type === "error") return "var(--ember)";
        if (type === "warning") return "var(--gold)";
        return "var(--spark-cyan)";
    },

    getIconClass(type) {
        if (type === "success") return "fa-solid fa-circle-check";
        if (type === "error") return "fa-solid fa-triangle-exclamation";
        if (type === "warning") return "fa-solid fa-circle-exclamation";
        return "fa-solid fa-circle-info";
    }
};

// Global listener for API error custom events
window.addEventListener("apiError", (e) => {
    if (e.detail && e.detail.message) {
        Toast.error(e.detail.message);
    }
});
