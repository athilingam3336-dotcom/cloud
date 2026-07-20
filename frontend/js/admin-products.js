/*
==========================================
CloudCrackers
admin-products.js
Products Management Module
==========================================
*/

// State Management
let products = [];
let categories = [];
let categoriesMap = new Map();
let filteredProducts = [];
let currentPage = 1;
const pageSize = 10;
let selectedProductIds = new Set();

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
    const productModal = document.getElementById("productModal");
    const addProductBtn = document.getElementById("addProductBtn");
    const closeProductModal = document.getElementById("closeProductModal");
    const cancelProductBtn = document.getElementById("cancelProductBtn");
    const productForm = document.getElementById("productForm");

    // Modal Triggers
    addProductBtn.addEventListener("click", () => openModal());
    closeProductModal.addEventListener("click", () => closeModal());
    cancelProductBtn.addEventListener("click", () => closeModal());

    productForm.addEventListener("submit", handleFormSubmit);

    // Filters bindings
    document.getElementById("searchProducts").addEventListener("input", filterAndRender);
    document.getElementById("filterCategory").addEventListener("change", filterAndRender);
    document.getElementById("filterStatus").addEventListener("change", filterAndRender);

    // Checkbox master binding
    const selectAllCheck = document.getElementById("selectAllProducts");
    if (selectAllCheck) {
        selectAllCheck.addEventListener("change", handleSelectAllChange);
    }

    // Bulk actions buttons bindings
    document.getElementById("bulkDeleteBtn").addEventListener("click", handleBulkDelete);
    document.getElementById("bulkActivateBtn").addEventListener("click", () => handleBulkStatus("ACTIVE"));
    document.getElementById("bulkDeactivateBtn").addEventListener("click", () => handleBulkStatus("INACTIVE"));
    document.getElementById("bulkCategoryBtn").addEventListener("click", handleBulkCategoryMove);
    document.getElementById("bulkPriceBtn").addEventListener("click", handleBulkPriceUpdate);

    // Initial Load
    await loadInitialData();
});

// Load Categories & Products from Backend
async function loadInitialData() {
    try {
        showLoadingState();

        // 1. Fetch Categories
        categories = await api.get("/api/categories/", true);
        const filterCatSelect = document.getElementById("filterCategory");
        const formCatSelect = document.getElementById("productCategory");
        const bulkCatSelect = document.getElementById("bulkCategorySelect");

        // Clear existing dynamic items except the default first option
        filterCatSelect.innerHTML = `<option value="">All Categories</option>`;
        formCatSelect.innerHTML = `<option value="">Select Category</option>`;
        bulkCatSelect.innerHTML = `<option value="">Move Category...</option>`;

        categoriesMap.clear();
        categories.forEach(cat => {
            categoriesMap.set(cat.id, cat.category_name);

            // Populate filter dropdown
            const optFilter = document.createElement("option");
            optFilter.value = cat.id;
            optFilter.textContent = cat.category_name;
            filterCatSelect.appendChild(optFilter);

            // Populate form dropdown
            const optForm = document.createElement("option");
            optForm.value = cat.id;
            optForm.textContent = cat.category_name;
            formCatSelect.appendChild(optForm);

            // Populate bulk move dropdown
            const optBulk = document.createElement("option");
            optBulk.value = cat.id;
            optBulk.textContent = cat.category_name;
            bulkCatSelect.appendChild(optBulk);
        });

        // 2. Fetch Products
        await fetchProducts();

    } catch (error) {
        console.error("Initial load failed:", error);
        showToast("Failed to load initial configuration.", "error");
        if (error.status === 401) logout();
    }
}

async function fetchProducts() {
    try {
        products = await api.get("/api/products/", true);
        selectedProductIds.clear();
        updateBulkPanel();
        filterAndRender();
    } catch (error) {
        console.error("Fetching products failed:", error);
        showToast("Error loading products list.", "error");
    }
}

// Show Loading Spinner inside Products Table
function showLoadingState() {
    const tableBody = document.getElementById("productsTableBody");
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center; padding:32px;">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size:24px; color:var(--gold);"></i>
                    <div style="margin-top:8px; color:var(--muted);">Loading products...</div>
                </td>
            </tr>
        `;
    }
}

// Search, Filter, and Paginate Products
function filterAndRender() {
    const searchVal = document.getElementById("searchProducts").value.toLowerCase().trim();
    const catVal = document.getElementById("filterCategory").value;
    const statusVal = document.getElementById("filterStatus").value;

    filteredProducts = products.filter(p => {
        const matchesSearch = !searchVal || 
            p.product_name.toLowerCase().includes(searchVal) || 
            (p.description && p.description.toLowerCase().includes(searchVal)) ||
            (p.sku && p.sku.toLowerCase().includes(searchVal));

        const matchesCategory = !catVal || p.category_id === catVal;
        const matchesStatus = !statusVal || p.status === statusVal;

        return matchesSearch && matchesCategory && matchesStatus;
    });

    currentPage = 1;
    renderProductsTable();
}

// Render Table Rows based on current pagination page
function renderProductsTable() {
    const tableBody = document.getElementById("productsTableBody");
    if (!tableBody) return;

    if (filteredProducts.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:20px; color:var(--muted);">No products found.</td></tr>`;
        renderPagination(0);
        return;
    }

    // Pagination bounds
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = filteredProducts.slice(start, end);

    tableBody.innerHTML = "";
    pageItems.forEach(p => {
        const tr = document.createElement("tr");

        const categoryName = categoriesMap.get(p.category_id) || "Uncategorized";
        const isChecked = selectedProductIds.has(p.id);

        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="product-select-check" data-id="${p.id}" ${isChecked ? 'checked' : ''} style="cursor:pointer;">
            </td>
            <td>
                <div class="table-user">
                    <img src="${p.product_image || '../images/folowerpot.jpg'}" style="width:36px; height:36px; border-radius:4px; object-fit:cover; border:1px solid var(--sky-line); margin-right: 8px;">
                    <div>
                        <strong>${p.product_name}</strong>
                        <div style="font-size:11px; color:var(--muted);">${p.description ? p.description.substring(0, 45) + (p.description.length > 45 ? "..." : "") : ""}</div>
                    </div>
                </div>
            </td>
            <td>${categoryName}</td>
            <td>₹${parseFloat(p.price).toFixed(2)}</td>
            <td>₹${parseFloat(p.discount || 0).toFixed(2)}</td>
            <td>${p.stock_quantity}</td>
            <td>
                <span class="status-pill ${p.status === 'ACTIVE' ? 'status-delivered' : 'status-cancelled'}">${p.status}</span>
            </td>
            <td>
                <div class="table-actions">
                    <button onclick="editProduct('${p.id}')" title="Edit Product"><i class="fa-regular fa-pen-to-square"></i></button>
                    <button onclick="deleteProduct('${p.id}')" class="danger" title="Delete Product"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    // Checkbox items click bindings
    const checks = tableBody.querySelectorAll(".product-select-check");
    checks.forEach(check => {
        check.addEventListener("change", handleRowSelectChange);
    });

    // Sync selectAll check state
    syncSelectAllState(pageItems);

    renderPagination(filteredProducts.length);
}

// Master select change
function handleSelectAllChange(e) {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = filteredProducts.slice(start, end);

    pageItems.forEach(p => {
        if (e.target.checked) {
            selectedProductIds.add(p.id);
        } else {
            selectedProductIds.delete(p.id);
        }
    });

    renderProductsTable();
    updateBulkPanel();
}

// Single row checkbox change
function handleRowSelectChange(e) {
    const pid = e.target.getAttribute("data-id");
    if (e.target.checked) {
        selectedProductIds.add(pid);
    } else {
        selectedProductIds.delete(pid);
    }
    updateBulkPanel();
}

function syncSelectAllState(pageItems) {
    const selectAllCheck = document.getElementById("selectAllProducts");
    if (!selectAllCheck) return;

    if (pageItems.length === 0) {
        selectAllCheck.checked = false;
        return;
    }
    const allChecked = pageItems.every(p => selectedProductIds.has(p.id));
    selectAllCheck.checked = allChecked;
}

// Update Bulk Actions Panel state
function updateBulkPanel() {
    const panel = document.getElementById("bulkActionsPanel");
    const countSpan = document.getElementById("selectedCount");
    if (!panel) return;

    if (selectedProductIds.size > 0) {
        panel.style.display = "flex";
        countSpan.textContent = selectedProductIds.size;
    } else {
        panel.style.display = "none";
        countSpan.textContent = "0";
    }
}

// Bulk Actions Logic
async function handleBulkDelete() {
    if (!confirm(`Are you sure you want to delete the ${selectedProductIds.size} selected products?`)) return;

    try {
        showLoadingState();
        const promises = Array.from(selectedProductIds).map(id => api.delete(`/api/products/${id}`, true));
        await Promise.all(promises);
        showToast("Selected products deleted successfully!");
        await fetchProducts();
    } catch (error) {
        console.error("Bulk delete failed:", error);
        showToast("Failed to delete some products.", "error");
        await fetchProducts();
    }
}

async function handleBulkStatus(status) {
    try {
        showLoadingState();
        const promises = Array.from(selectedProductIds).map(id => 
            api.put(`/api/products/${id}`, { status: status }, true)
        );
        await Promise.all(promises);
        showToast(`Selected products updated to ${status}!`);
        await fetchProducts();
    } catch (error) {
        console.error("Bulk status update failed:", error);
        showToast("Failed to update status for some products.", "error");
        await fetchProducts();
    }
}

async function handleBulkCategoryMove() {
    const catVal = document.getElementById("bulkCategorySelect").value;
    if (!catVal) {
        showToast("Please select a target category first.", "error");
        return;
    }

    try {
        showLoadingState();
        const promises = Array.from(selectedProductIds).map(id => 
            api.put(`/api/products/${id}`, { category_id: catVal }, true)
        );
        await Promise.all(promises);
        showToast("Selected products moved successfully!");
        document.getElementById("bulkCategorySelect").value = "";
        await fetchProducts();
    } catch (error) {
        console.error("Bulk category move failed:", error);
        showToast("Failed to move some products.", "error");
        await fetchProducts();
    }
}

async function handleBulkPriceUpdate() {
    const priceVal = parseFloat(document.getElementById("bulkPriceInput").value);
    if (isNaN(priceVal) || priceVal <= 0) {
        showToast("Please enter a valid price.", "error");
        return;
    }

    try {
        showLoadingState();
        const promises = Array.from(selectedProductIds).map(id => 
            api.put(`/api/products/${id}`, { price: priceVal }, true)
        );
        await Promise.all(promises);
        showToast("Selected products prices updated successfully!");
        document.getElementById("bulkPriceInput").value = "";
        await fetchProducts();
    } catch (error) {
        console.error("Bulk price update failed:", error);
        showToast("Failed to update prices for some products.", "error");
        await fetchProducts();
    }
}

// Render Pagination controls
function renderPagination(totalItems) {
    const container = document.getElementById("productsPagination");
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
            renderProductsTable();
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
            renderProductsTable();
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
            renderProductsTable();
        }
    });
    container.appendChild(nextLink);
}

// Open modal for Create/Update
function openModal(product = null) {
    const modal = document.getElementById("productModal");
    const form = document.getElementById("productForm");
    const title = document.getElementById("modalTitle");

    form.reset();
    document.getElementById("productId").value = "";

    if (product) {
        title.textContent = "Edit Product";
        document.getElementById("productId").value = product.id;
        document.getElementById("productName").value = product.product_name;
        document.getElementById("productCategory").value = product.category_id;
        document.getElementById("productPrice").value = product.price;
        document.getElementById("productDiscount").value = product.discount || 0;
        document.getElementById("productWeight").value = product.weight || "";
        document.getElementById("productSku").value = product.sku || "";
        document.getElementById("productBrand").value = product.brand || "CloudCrackers";
        document.getElementById("productStock").value = product.stock_quantity;
        document.getElementById("productDescription").value = product.description || "";
        document.getElementById("productImage").value = product.product_image || "";
        document.getElementById("productStatus").value = product.status;
    } else {
        title.textContent = "Add New Product";
        document.getElementById("productStatus").value = "ACTIVE";
        document.getElementById("productBrand").value = "CloudCrackers";
        document.getElementById("productDiscount").value = 0.00;
    }

    modal.style.display = "flex";
}

// Close Modal
function closeModal() {
    const modal = document.getElementById("productModal");
    modal.style.display = "none";
}

// Handle Form Submission (Create or Edit Product)
async function handleFormSubmit(e) {
    e.preventDefault();

    const productId = document.getElementById("productId").value;
    const isEdit = !!productId;

    const payload = {
        product_name: document.getElementById("productName").value.trim(),
        category_id: document.getElementById("productCategory").value,
        price: parseFloat(document.getElementById("productPrice").value),
        discount: parseFloat(document.getElementById("productDiscount").value),
        weight: document.getElementById("productWeight").value.trim() || null,
        sku: document.getElementById("productSku").value.trim() || null,
        brand: document.getElementById("productBrand").value.trim() || "CloudCrackers",
        stock_quantity: parseInt(document.getElementById("productStock").value, 10),
        description: document.getElementById("productDescription").value.trim() || null,
        product_image: document.getElementById("productImage").value.trim() || null,
        status: document.getElementById("productStatus").value
    };

    try {
        if (isEdit) {
            await api.put(`/api/products/${productId}`, payload, true);
            showToast("Product updated successfully!");
        } else {
            await api.post("/api/products/", payload, true);
            showToast("Product created successfully!");
        }

        closeModal();
        await fetchProducts();
    } catch (error) {
        console.error("Save product failed:", error);
        showToast(error.message || "Failed to save product details.", "error");
    }
}

// Edit Button Action (Global trigger)
window.editProduct = function(id) {
    const product = products.find(p => p.id === id);
    if (product) {
        openModal(product);
    }
};

// Delete Button Action (Global trigger)
window.deleteProduct = async function(id) {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
        await api.delete(`/api/products/${id}`, true);
        showToast("Product deleted successfully!");
        await fetchProducts();
    } catch (error) {
        console.error("Delete product failed:", error);
        showToast(error.message || "Failed to delete product.", "error");
    }
};
