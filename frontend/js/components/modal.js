/*
==========================================
CloudCrackers
modal.js
Global modal elements to replace confirm() dialogue boxes
==========================================
*/

const ModalConfirm = {
    modalId: "confirmModalOverlay",

    show({ title = "Confirm Action", message = "Are you sure?", confirmText = "Confirm", cancelText = "Cancel", isDanger = true, onConfirm, onCancel = null }) {
        // Remove existing if any
        let modal = document.getElementById(this.modalId);
        if (modal) modal.remove();

        // Create overlay
        modal = document.createElement("div");
        modal.id = this.modalId;
        modal.className = "modal";
        modal.style.display = "flex";
        modal.style.position = "fixed";
        modal.style.top = "0";
        modal.style.left = "0";
        modal.style.width = "100%";
        modal.style.height = "100%";
        modal.style.background = "rgba(0, 0, 0, 0.6)";
        modal.style.backdropFilter = "blur(4px)";
        modal.style.zIndex = "2000";
        modal.style.alignItems = "center";
        modal.style.justifyContent = "center";

        // Create card content
        const content = document.createElement("div");
        content.className = "modal-content card";
        content.style.maxWidth = "400px";
        content.style.padding = "24px";
        content.style.position = "relative";
        content.style.background = "var(--sky-800)";
        content.style.border = "1px solid var(--sky-line)";
        content.style.borderRadius = "var(--radius-md)";
        content.style.animation = "modalFadeIn 0.3s ease-out";

        // Header Title
        const header = document.createElement("h3");
        header.style.fontFamily = "var(--font-display)";
        header.style.fontSize = "16px";
        header.style.marginBottom = "12px";
        header.style.color = isDanger ? "var(--ember)" : "var(--spark-cyan)";
        header.textContent = title;
        content.appendChild(header);

        // Message
        const msg = document.createElement("p");
        msg.style.fontSize = "13.5px";
        msg.style.lineHeight = "1.5";
        msg.style.color = "var(--text-light, #f8f9fa)";
        msg.style.marginBottom = "24px";
        msg.textContent = message;
        content.appendChild(msg);

        // Buttons Footer
        const footer = document.createElement("div");
        footer.style.display = "flex";
        footer.style.justifyContent = "flex-end";
        footer.style.gap = "12px";

        // Cancel Btn
        const cancelBtn = document.createElement("button");
        cancelBtn.className = "btn btn-outline";
        cancelBtn.style.padding = "8px 16px";
        cancelBtn.style.fontSize = "12.5px";
        cancelBtn.textContent = cancelText;
        cancelBtn.addEventListener("click", () => {
            modal.remove();
            if (onCancel) onCancel();
        });
        footer.appendChild(cancelBtn);

        // Confirm Btn
        const confirmBtn = document.createElement("button");
        confirmBtn.className = isDanger ? "btn btn-primary danger" : "btn btn-primary";
        confirmBtn.style.padding = "8px 16px";
        confirmBtn.style.fontSize = "12.5px";
        if (isDanger) {
            confirmBtn.style.background = "var(--ember)";
            confirmBtn.style.borderColor = "var(--ember)";
        }
        confirmBtn.textContent = confirmText;
        confirmBtn.addEventListener("click", () => {
            modal.remove();
            if (onConfirm) onConfirm();
        });
        footer.appendChild(confirmBtn);

        content.appendChild(footer);
        modal.appendChild(content);
        document.body.appendChild(modal);
    }
};

const ModalPasswordConfirm = {
    modalId: "passwordConfirmModalOverlay",
    
    show({ title = "Confirm Security Verification", message = "Please enter your password to continue.", mfaRequired = false, onConfirm, onCancel = null }) {
        let modal = document.getElementById(this.modalId);
        if (modal) modal.remove();

        modal = document.createElement("div");
        modal.id = this.modalId;
        modal.className = "modal";
        modal.style.display = "flex";
        modal.style.position = "fixed";
        modal.style.top = "0"; modal.style.left = "0"; modal.style.width = "100%"; modal.style.height = "100%";
        modal.style.background = "rgba(0, 0, 0, 0.6)";
        modal.style.backdropFilter = "blur(4px)";
        modal.style.zIndex = "2500";
        modal.style.alignItems = "center"; modal.style.justifyContent = "center";

        const content = document.createElement("div");
        content.className = "modal-content card";
        content.style.maxWidth = "400px"; content.style.padding = "24px";
        content.style.background = "var(--sky-800)";
        content.style.border = "1px solid var(--sky-line)";
        content.style.borderRadius = "var(--radius-md)";

        const header = document.createElement("h3");
        header.style.fontFamily = "var(--font-display)"; header.style.fontSize = "16px"; header.style.marginBottom = "12px";
        header.style.color = "var(--ember)";
        header.textContent = title;
        content.appendChild(header);

        const msg = document.createElement("p");
        msg.style.fontSize = "13px"; msg.style.lineHeight = "1.5"; msg.style.marginBottom = "16px";
        msg.textContent = message;
        content.appendChild(msg);

        // Password input field
        const pwdGroup = document.createElement("div");
        pwdGroup.className = "form-group";
        pwdGroup.style.marginBottom = "12px";
        pwdGroup.innerHTML = `
            <label style="display:block; margin-bottom:4px; font-size:12px;">Admin Password</label>
            <input type="password" id="confirmPasswordInput" class="form-control" placeholder="Enter your password" required style="width:100%;">
        `;
        content.appendChild(pwdGroup);

        // MFA input field (optional)
        if (mfaRequired) {
            const mfaGroup = document.createElement("div");
            mfaGroup.className = "form-group";
            mfaGroup.style.marginBottom = "20px";
            mfaGroup.innerHTML = `
                <label style="display:block; margin-bottom:4px; font-size:12px;">MFA Code (OTP / TOTP)</label>
                <input type="text" id="confirmMfaInput" class="form-control" placeholder="6-digit code" required style="width:100%;">
            `;
            content.appendChild(mfaGroup);
        } else {
            pwdGroup.style.style = "margin-bottom: 20px;";
        }

        const footer = document.createElement("div");
        footer.style.display = "flex"; footer.style.justifyContent = "flex-end"; footer.style.gap = "12px";

        const cancelBtn = document.createElement("button");
        cancelBtn.className = "btn btn-outline"; cancelBtn.style.padding = "8px 16px"; cancelBtn.textContent = "Cancel";
        cancelBtn.addEventListener("click", () => {
            modal.remove();
            if (onCancel) onCancel();
        });
        footer.appendChild(cancelBtn);

        const confirmBtn = document.createElement("button");
        confirmBtn.className = "btn btn-primary danger"; confirmBtn.style.padding = "8px 16px"; confirmBtn.textContent = "Confirm";
        confirmBtn.style.background = "var(--ember)";
        confirmBtn.style.borderColor = "var(--ember)";
        confirmBtn.addEventListener("click", () => {
            const password = document.getElementById("confirmPasswordInput").value;
            const mfaCode = mfaRequired ? document.getElementById("confirmMfaInput").value : "";
            if (!password) {
                alert("Password is required.");
                return;
            }
            modal.remove();
            if (onConfirm) onConfirm(password, mfaCode);
        });
        footer.appendChild(confirmBtn);

        content.appendChild(footer);
        modal.appendChild(content);
        document.body.appendChild(modal);
    }
};
