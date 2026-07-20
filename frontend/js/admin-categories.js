/*
==========================================
CloudCrackers
admin-categories.js
Categories Management Module
==========================================
*/

// State Management
let categories = [];
let filteredCategories = [];
let currentPage = 1;
const pageSize = 10;

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
    if (!payload || payload.role !== "admin" || (payload.exp && payload.exp * 1000 < Date.now())) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = "login.html";
        return null;
    }
    return token;
}

// Log out user
function logout() {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "login.html";
}

// Toast notification
function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `alert alert-${type === "success" ? "success" : "error"} toast`;
    toast.style.margin = "0";
    toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
    toast.style.minWidth = "280px";

    const icon = document.createElement("i");
    icon.className = type === "success" ? "fa-solid fa-circle-check" : "fa-solid fa-circle-exclamation";
    
    const text = document.createElement("span");
    text.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = "fadeOut 0.3s ease-out forwards";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Initialize on DOM Load
document.addEventListener("DOMContentLoaded", async () => {
    const token = checkAuth();
    if (!token) return;

    // Logout binding
    const logoutBtn = document.getElementById("logoutLink");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            logout();
        });
    }

    // Modal elements
    const categoryModal = document.getElementById("categoryModal");
    const addCategoryBtn = document.getElementById("addCategoryBtn");
    const closeCategoryModal = document.getElementById("closeCategoryModal");
    const cancelCategoryBtn = document.getElementById("cancelCategoryBtn");
    const categoryForm = document.getElementById("categoryForm");

    // Modal Triggers
    addCategoryBtn.addEventListener("click", () => openModal());
    closeCategoryModal.addEventListener("click", () => closeModal());
    cancelCategoryBtn.addEventListener("click", () => closeModal());

    categoryForm.addEventListener("submit", handleFormSubmit);

    // Filters bindings
    document.getElementById("searchCategories").addEventListener("input", filterAndRender);
    document.getElementById("filterStatus").addEventListener("change", filterAndRender);

    // Initial Load
    await fetchCategories();
});

async function fetchCategories() {
    try {
        showLoadingState();
        categories = await api.get("/api/categories/", true);
        filterAndRender();
    } catch (error) {
        console.error("Fetching categories failed:", error);
        showToast("Error loading categories list.", "error");
        if (error.status === 401) logout();
    }
}

// Show Loading Spinner inside Table
function showLoadingState() {
    const tableBody = document.getElementById("categoriesTableBody");
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; padding:32px;">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size:24px; color:var(--gold);"></i>
                    <div style="margin-top:8px; color:var(--muted);">Loading categories...</div>
                </td>
            </tr>
        `;
    }
}

// Search and Filter Categories
function filterAndRender() {
    const searchVal = document.getElementById("searchCategories").value.toLowerCase().trim();
    const statusVal = document.getElementById("filterStatus").value;

    filteredCategories = categories.filter(c => {
        const matchesSearch = !searchVal || c.category_name.toLowerCase().includes(searchVal);
        const matchesStatus = !statusVal || c.status === statusVal;
        return matchesSearch && matchesStatus;
    });

    currentPage = 1;
    renderCategoriesTable();
}

// Render Table Rows based on current pagination page
function renderCategoriesTable() {
    const tableBody = document.getElementById("categoriesTableBody");
    if (!tableBody) return;

    if (filteredCategories.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--muted);">No categories found.</td></tr>`;
        renderPagination(0);
        return;
    }

    // Pagination bounds
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = filteredCategories.slice(start, end);

    tableBody.innerHTML = "";
    pageItems.forEach(c => {
        const tr = document.createElement("tr");

        const statusClass = c.status === "ACTIVE" ? "status-delivered" : "status-cancelled";

        tr.innerHTML = `
            <td>
                <div class="table-user">
                    <div class="table-avatar"><i class="fa-solid fa-tags"></i></div>
                    <strong>${c.category_name}</strong>
                </div>
            </td>
            <td>${c.description || '<span class="muted-text">No description</span>'}</td>
            <td><span class="status-pill ${statusClass}">${c.status}</span></td>
            <td>
                <div class="table-actions">
                    <button onclick="editCategory('${c.id}')" title="Edit Category"><i class="fa-regular fa-pen-to-square"></i></button>
                    <button onclick="deleteCategory('${c.id}')" class="danger" title="Delete Category"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    renderPagination(filteredCategories.length);
}

// Render Pagination controls
function renderPagination(totalItems) {
    const container = document.getElementById("categoriesPagination");
    if (!container) return;

    container.innerHTML = "";
    const totalPages = Math.ceil(totalItems / pageSize);
    if (totalPages <= 1) return;

    // Previous Arrow
    const prevLink = document.createElement("a");
    prevLink.href = "#";
    prevLink.innerHTML = "‹";
    if (currentPage === 1) prevLink.style.opacity = "0.5";
    prevLink.addEventListener("click", (e) => {
        e.preventDefault();
        if (currentPage > 1) {
            currentPage--;
            renderCategoriesTable();
        }
    });
    container.appendChild(prevLink);

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        const link = document.createElement("a");
        link.href = "#";
        link.textContent = i;
        if (i === currentPage) link.className = "active";
        link.addEventListener("click", (e) => {
            e.preventDefault();
            currentPage = i;
            renderCategoriesTable();
        });
        container.appendChild(link);
    }

    // Next Arrow
    const nextLink = document.createElement("a");
    nextLink.href = "#";
    nextLink.innerHTML = "›";
    if (currentPage === totalPages) nextLink.style.opacity = "0.5";
    nextLink.addEventListener("click", (e) => {
        e.preventDefault();
        if (currentPage < totalPages) {
            currentPage++;
            renderCategoriesTable();
        }
    });
    container.appendChild(nextLink);
}

// Open modal for Create/Update
function openModal(category = null) {
    const modal = document.getElementById("categoryModal");
    const form = document.getElementById("categoryForm");
    const title = document.getElementById("modalTitle");

    form.reset();
    document.getElementById("categoryId").value = "";

    if (category) {
        title.textContent = "Edit Category";
        document.getElementById("categoryId").value = category.id;
        document.getElementById("categoryName").value = category.category_name;
        document.getElementById("categoryDescription").value = category.description || "";
        document.getElementById("categoryImage").value = category.category_image || "";
        document.getElementById("categoryStatus").value = category.status;
    } else {
        title.textContent = "Add New Category";
        document.getElementById("categoryStatus").value = "ACTIVE";
    }

    modal.style.display = "flex";
}

// Close Modal
function closeModal() {
    const modal = document.getElementById("categoryModal");
    modal.style.display = "none";
}

// Handle Form Submission
async function handleFormSubmit(e) {
    e.preventDefault();

    const categoryId = document.getElementById("categoryId").value;
    const isEdit = !!categoryId;

    const payload = {
        category_name: document.getElementById("categoryName").value.trim(),
        description: document.getElementById("categoryDescription").value.trim() || null,
        category_image: document.getElementById("categoryImage").value.trim() || null,
        status: document.getElementById("categoryStatus").value
    };

    try {
        if (isEdit) {
            await api.put(`/api/categories/${categoryId}`, payload, true);
            showToast("Category updated successfully!");
        } else {
            await api.post("/api/categories/", payload, true);
            showToast("Category created successfully!");
        }

        closeModal();
        await fetchCategories();
    } catch (error) {
        console.error("Save category failed:", error);
        showToast(error.message || "Failed to save category details.", "error");
    }
}

// Edit Button Action (Global trigger)
window.editCategory = function(id) {
    const category = categories.find(c => c.id === id);
    if (category) {
        openModal(category);
    }
};

// Delete Button Action (Global trigger)
window.deleteCategory = async function(id) {
    if (!confirm("Are you sure you want to delete this category?")) return;

    try {
        await api.delete(`/api/categories/${id}`, true);
        showToast("Category deleted successfully!");
        await fetchCategories();
    } catch (error) {
        console.error("Delete category failed:", error);
        showToast(error.message || "Failed to delete category.", "error");
    }
};
