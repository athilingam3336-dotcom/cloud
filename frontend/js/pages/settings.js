/*
=========================================
CloudCrackers
settings.js
=========================================
*/

let storeLogoBase64 = "";

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("cloudcrackers_access_token");
    if (!token) return;

    // Form handlers
    document.getElementById("settingsForm").addEventListener("submit", handleSettingsSubmit);
    document.getElementById("resetSettingsBtn").addEventListener("click", handleSettingsReset);

    // Image upload drag & drop
    const logoDropZone = document.getElementById("logoDropZone");
    const logoImageFile = document.getElementById("logoImageFile");
    logoDropZone.addEventListener("click", () => logoImageFile.click());
    logoImageFile.addEventListener("change", handleLogoSelect);
    setupDragDrop(logoDropZone, handleLogoDrop);

    // Load configurations
    loadSettings();
});

// Load configs from API
async function loadSettings() {
    try {
        const configs = await api.get("/api/settings/", true);

        document.getElementById("settingsStoreName").value = configs.storeName || "";
        document.getElementById("settingsContactEmail").value = configs.contactEmail || "";
        document.getElementById("settingsTaxRate").value = configs.taxRate || 18.0;
        document.getElementById("settingsShippingCharge").value = configs.shippingCharge || 80;
        document.getElementById("settingsCurrency").value = configs.currency || "INR";
        document.getElementById("settingsMaintenanceMode").value = configs.maintenanceMode || "OFF";

        // SMTP
        document.getElementById("settingsSmtpServer").value = configs.smtpServer || "";
        document.getElementById("settingsSmtpPort").value = configs.smtpPort || 587;
        document.getElementById("settingsSmtpUsername").value = configs.smtpUsername || "";
        document.getElementById("settingsSmtpPassword").value = configs.smtpPassword || "";

        // Payment
        document.getElementById("settingsPaymentKeyId").value = configs.paymentKeyId || "";
        document.getElementById("settingsPaymentKeySecret").value = configs.paymentKeySecret || "";

        storeLogoBase64 = configs.logo || "";
        updateLogoPreview();
    } catch (err) {
        console.error("Failed to load settings:", err);
        Toast.error("Failed to load global configurations from server.");
    }
}

function updateLogoPreview() {
    const container = document.getElementById("storeLogoPreviewContainer");
    if (!container) return;

    container.innerHTML = "";
    if (storeLogoBase64) {
        // If it's a relative URL or base64
        const src = storeLogoBase64.startsWith("data:") ? storeLogoBase64 : API_BASE_URL + storeLogoBase64;
        container.innerHTML = `<img src="${src}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
        container.innerHTML = `<span style="font-weight:700; color:var(--gold); font-size:16px;">CC</span>`;
    }
}

// Logo image drop handlers
function handleLogoSelect(e) {
    const file = e.target.files[0];
    if (file) processLogoFile(file);
}

function handleLogoDrop(e) {
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
        processLogoFile(file);
    } else {
        Toast.error("Please drop a valid image file.");
    }
}

function processLogoFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        storeLogoBase64 = e.target.result;
        updateLogoPreview();
        Toast.success("Logo file uploaded. Save settings to apply.");
    };
    reader.readAsDataURL(file);
}

// Submit configurations
function handleSettingsSubmit(e) {
    e.preventDefault();

    const saveBtn = document.getElementById("saveSettingsBtn");

    const payload = {
        storeName: document.getElementById("settingsStoreName").value.trim(),
        logo: storeLogoBase64,
        contactEmail: document.getElementById("settingsContactEmail").value.trim(),
        taxRate: parseFloat(document.getElementById("settingsTaxRate").value),
        shippingCharge: parseInt(document.getElementById("settingsShippingCharge").value, 10),
        currency: document.getElementById("settingsCurrency").value,
        maintenanceMode: document.getElementById("settingsMaintenanceMode").value,
        
        smtpServer: document.getElementById("settingsSmtpServer").value.trim() || null,
        smtpPort: parseInt(document.getElementById("settingsSmtpPort").value, 10) || null,
        smtpUsername: document.getElementById("settingsSmtpUsername").value.trim() || null,
        smtpPassword: document.getElementById("settingsSmtpPassword").value || null,
        
        paymentKeyId: document.getElementById("settingsPaymentKeyId").value.trim() || null,
        paymentKeySecret: document.getElementById("settingsPaymentKeySecret").value || null
    };

    ModalPasswordConfirm.show({
        title: "Confirm Settings Update",
        message: "Applying configuration changes requires password confirmation and MFA verification.",
        mfaRequired: true,
        onConfirm: async (password, mfaCode) => {
            payload.confirm_password = password;
            payload.mfa_code = mfaCode;

            Loader.showButton(saveBtn, "Saving Configurations...");
            try {
                const res = await api.put("/api/settings/", payload, true);
                Toast.success(res.message || "Configurations saved successfully!");
                loadSettings();
            } catch (err) {
                Toast.error(err.detail || "Authentication validation failed. Changes not saved.");
            } finally {
                Loader.hideButton(saveBtn);
            }
        }
    });
}

// Reset defaults / Wipe store
function handleSettingsReset() {
    ModalPasswordConfirm.show({
        title: "CRITICAL: Confirm Store Wipe",
        message: "This will permanently wipe all products, orders, categories, and reset all settings to defaults. This action is irreversible.",
        mfaRequired: true,
        onConfirm: async (password, mfaCode) => {
            const resetBtn = document.getElementById("resetSettingsBtn");
            Loader.showButton(resetBtn, "Wiping Store...");
            try {
                const res = await api.put("/api/settings/", {
                    storeName: "Cleared Store",
                    contactEmail: "cleared@store.com",
                    taxRate: 18.0,
                    shippingCharge: 80,
                    currency: "INR",
                    maintenanceMode: "OFF",
                    confirm_password: password,
                    mfa_code: mfaCode,
                    deleteStore: true
                }, true);

                Toast.success(res.message || "Store wiped successfully.");
                loadSettings();
            } catch (err) {
                Toast.error(err.detail || "Verification failed. Wipe cancelled.");
            } finally {
                Loader.hideButton(resetBtn);
            }
        }
    });
}

function setupDragDrop(zone, dropHandler) {
    zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("dragover");
    });

    zone.addEventListener("dragleave", () => {
        zone.classList.remove("dragover");
    });

    zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("dragover");
        dropHandler(e);
    });
}
