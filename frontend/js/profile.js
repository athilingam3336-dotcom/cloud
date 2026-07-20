document.addEventListener("DOMContentLoaded", () => {
    loadProfile();
    initializeProfileForm();
});


/*
==========================================
Load Profile
==========================================
*/

async function loadProfile() {
    try {
        const user = await api.get("/api/users/me", true);

        document.getElementById("firstName").value = user.first_name || "";
        document.getElementById("lastName").value = user.last_name || "";
        document.getElementById("email").value = user.email || "";
        document.getElementById("phone").value = user.phone || "";

        // Update visual avatar and name/email in sidebar
        const initials = ((user.first_name || "")[0] || "") + ((user.last_name || "")[0] || "");
        const avatar = document.getElementById("avatarText");
        if (avatar) avatar.innerText = initials.toUpperCase() || "U";

        const nameHeading = document.getElementById("profileName");
        if (nameHeading) nameHeading.innerText = `${user.first_name || ""} ${user.last_name || ""}`;

        const emailMuted = document.getElementById("profileEmail");
        if (emailMuted) emailMuted.innerText = user.email || "";
    }
    catch (error) {
        console.error("Failed to load profile:", error);
    }
}


/*
==========================================
Update Profile
==========================================
*/

function initializeProfileForm() {
    const form = document.getElementById("profileForm");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const profile = {
            first_name: document.getElementById("firstName").value.trim(),
            last_name: document.getElementById("lastName").value.trim(),
            phone: document.getElementById("phone").value.trim() || null
        };

        try {
            await api.put("/api/users/me", profile, true);
            alert("Profile Updated Successfully");
            loadProfile();
        } catch (error) {
            console.error("Failed to update profile:", error);
            alert(error.message || "Failed to update profile.");
        }
    });
}