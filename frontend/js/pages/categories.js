/*
==========================================
CloudCrackers
categories.js
Categories Management Module with Bulk actions, Status toggles, and Image drag & drop previews
==========================================
*/

// State Management
let categories = [];
let products = [];
let productCounts = new Map(); // category_id -> count
let filteredCategories = [];
let selectedCategoryIds = new Set();

let currentPage = 1;
const pageSize = 10;
let categoriesPagination = null;

// Search/Filter State
let searchQuery = "";
let statusFilter = "";

document.addEventListener("DOMContentLoaded", async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return;

    // Initialize pagination
    categoriesPagination = new Pagination({
        containerId: "categoriesPagination",
        pageSize: pageSize,
        onPageChange: (page) => {
            currentPage = page;
            renderCategoriesTable();
        }
    });

    // Filters bindings
    document.getElementById("searchCategories").addEventListener("input", Format.debounce((e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        filterAndRender();
    }, 250));

    document.getElementById("filterStatus").addEventListener("change", (e) => {
        statusFilter = e.target.value;
        filterAndRender();
    });

    // Checkboxes
    document.getElementById("selectAllCategories").addEventListener("change", handleSelectAll);

    // Modal Triggers
    document.getElementById("addCategoryBtn").addEventListener("click", () => openModal());
    document.getElementById("closeCategoryModal").addEventListener("click", closeModal);
    document.getElementById("cancelCategoryBtn").addEventListener("click", closeModal);
    document.getElementById("categoryForm").addEventListener("submit", handleFormSubmit);

    // Bulk delete
    document.getElementById("bulkDeleteBtn").addEventListener("click", handleBulkDelete);

    // Image Upload Drag & Drop triggers
    const imageDropZone = document.getElementById("imageDropZone");
    const categoryImageFile = document.getElementById("categoryImageFile");
    imageDropZone.addEventListener("click", () => categoryImageFile.click());
    categoryImageFile.addEventListener("change", handleImageSelect);
    setupDragDrop(imageDropZone, handleImageDrop);

    // Load initial data
    await loadInitialData();
});

async function loadInitialData() {
    try {
        Loader.showTableSkeleton(document.getElementById("categoriesTableBody"), 6, 5);

        // Fetch products list first to count categories sizes
        try {
            products = await api.get("/api/products/", true);
            productCounts.clear();
            products.forEach(p => {
                productCounts.set(p.category_id, (productCounts.get(p.category_id) || 0) + 1);
            });
        } catch (err) {
            console.error("Failed to load products list:", err);
        }

        // Fetch categories list
        await fetchCategories();

    } catch (error) {
        console.error("Categories initial load failed:", error);
    }
}

async function fetchCategories() {
    try {
        categories = await api.get("/api/categories/", true);
        selectedCategoryIds.clear();
        updateBulkActionsPanel();
        filterAndRender();
    } catch (error) {
        console.error(error);
    }
}

function filterAndRender() {
    filteredCategories = categories.filter(c => {
        const matchesSearch = !searchQuery || c.category_name.toLowerCase().includes(searchQuery);
        const matchesStatus = !statusFilter || c.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    currentPage = 1;
    renderCategoriesTable();
}

function renderCategoriesTable() {
    const tableBody = document.getElementById("categoriesTableBody");
    if (!tableBody) return;

    if (filteredCategories.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--muted);">No categories match your criteria.</td></tr>`;
        categoriesPagination.render(0, 1);
        return;
    }

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = filteredCategories.slice(start, end);

    tableBody.innerHTML = "";
    pageItems.forEach(c => {
        const tr = document.createElement("tr");

        const statusClass = c.status === "ACTIVE" ? "status-delivered" : "status-cancelled";
        const count = productCounts.get(c.id) || 0;
        const isChecked = selectedCategoryIds.has(c.id);

        tr.innerHTML = `
            <td style="text-align: center;"><input type="checkbox" class="category-select" data-id="${c.id}" ${isChecked ? 'checked' : ''} style="cursor:pointer;"></td>
            <td>
                <div class="table-user">
                    <img id="img-${c.id}" src="../images/folowerpot.jpg" style="width:36px; height:36px; border-radius:4px; object-fit:cover; border:1px solid var(--sky-line);">
                    <strong>${c.category_name}</strong>
                </div>
            </td>
            <td>${c.description || '<span class="muted-text">No description</span>'}</td>
            <td><strong>${count}</strong> products</td>
            <td>
                <span class="status-pill ${statusClass}" onclick="toggleCategoryStatus('${c.id}', '${c.status}')" style="cursor:pointer;" title="Click to Toggle Status">
                    ${c.status}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <button onclick="editCategory('${c.id}')" title="Edit Category"><i class="fa-regular fa-pen-to-square"></i></button>
                    <button onclick="deleteCategory('${c.id}')" class="danger" title="Delete Category"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            </td>
        `;

        tableBody.appendChild(tr);

        // Resolve Image
        if (c.category_image) {
            Loader.loadImage(document.getElementById(`img-${c.id}`), c.category_image);
        }

        // Listener for checkbox
        tr.querySelector(".category-select").addEventListener("change", (e) => {
            const id = e.target.getAttribute("data-id");
            if (e.target.checked) {
                selectedCategoryIds.add(id);
            } else {
                selectedCategoryIds.delete(id);
            }
            updateBulkActionsPanel();
        });
    });

    categoriesPagination.render(filteredCategories.length, currentPage);
}

// Bulk deletion selection
function handleSelectAll(e) {
    const isChecked = e.target.checked;
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = filteredCategories.slice(start, end);

    pageItems.forEach(c => {
        if (isChecked) {
            selectedCategoryIds.add(c.id);
        } else {
            selectedCategoryIds.delete(c.id);
        }
    });

    renderCategoriesTable();
    updateBulkActionsPanel();
}

function updateBulkActionsPanel() {
    const panel = document.getElementById("bulkActionsPanel");
    const countEl = document.getElementById("selectedCount");

    if (selectedCategoryIds.size > 0) {
        panel.style.display = "flex";
        countEl.textContent = selectedCategoryIds.size;
    } else {
        panel.style.display = "none";
        document.getElementById("selectAllCategories").checked = false;
    }
}

async function handleBulkDelete() {
    ModalConfirm.show({
        title: "Bulk Delete Categories",
        message: `Delete the ${selectedCategoryIds.size} selected categories? This will not delete products associated with them, but they may become uncategorized.`,
        confirmText: "Delete All",
        isDanger: true,
        onConfirm: async () => {
            try {
                const deletePromises = Array.from(selectedCategoryIds).map(id => api.delete(`/api/categories/${id}`, true));
                await Promise.all(deletePromises);
                Toast.success("Selected categories deleted successfully.");
                await fetchCategories();
            } catch (err) {
                Toast.error("Failed to delete all categories.");
            }
        }
    });
}

// Click to Toggle Status
window.toggleCategoryStatus = async function(id, currentStatus) {
    const nextStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
        await api.put(`/api/categories/${id}`, { status: nextStatus }, true);
        Toast.success(`Category set to ${nextStatus}.`);
        await fetchCategories();
    } catch (err) {
        console.error(err);
    }
};

// Image Upload inside Modal
let categoryImagePreviewUrl = "";

function handleImageSelect(e) {
    const file = e.target.files[0];
    if (file) processImageFile(file);
}

function handleImageDrop(e) {
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
        processImageFile(file);
    } else {
        Toast.error("Please drop a valid image file.");
    }
}

function processImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        categoryImagePreviewUrl = e.target.result;
        document.getElementById("categoryImage").value = categoryImagePreviewUrl;
        renderImagePreviews();
    };
    reader.readAsDataURL(file);
}

function renderImagePreviews() {
    const container = document.getElementById("imagePreviewsContainer");
    if (!container) return;

    container.innerHTML = "";
    if (categoryImagePreviewUrl) {
        const item = document.createElement("div");
        item.style.position = "relative";
        item.style.width = "60px";
        item.style.height = "60px";

        item.innerHTML = `
            <img src="${categoryImagePreviewUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:4px; border:1px solid var(--sky-line);">
            <button type="button" onclick="removePreviewImage()" style="position:absolute; top:-4px; right:-4px; width:16px; height:16px; border-radius:50%; background:var(--ember); color:white; border:none; cursor:pointer; font-size:10px; display:flex; align-items:center; justify-content:center;">×</button>
        `;
        container.appendChild(item);
    }
}

window.removePreviewImage = function() {
    categoryImagePreviewUrl = "";
    document.getElementById("categoryImage").value = "";
    renderImagePreviews();
};

// Open Modals
function openModal(category = null) {
    const modal = document.getElementById("categoryModal");
    const form = document.getElementById("categoryForm");
    const title = document.getElementById("modalTitle");

    form.reset();
    document.getElementById("categoryId").value = "";
    categoryImagePreviewUrl = "";
    renderImagePreviews();

    if (category) {
        title.textContent = "Edit Category";
        document.getElementById("categoryId").value = category.id;
        document.getElementById("categoryName").value = category.category_name;
        document.getElementById("categoryDescription").value = category.description || "";
        document.getElementById("categoryImage").value = category.category_image || "";
        document.getElementById("categoryStatus").value = category.status;

        if (category.category_image) {
            categoryImagePreviewUrl = category.category_image;
            renderImagePreviews();
        }
    } else {
        title.textContent = "Add New Category";
        document.getElementById("categoryStatus").value = "ACTIVE";
    }

    modal.style.display = "flex";
}

function closeModal() {
    document.getElementById("categoryModal").style.display = "none";
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const saveBtn = document.getElementById("saveCategoryBtn");
    const categoryId = document.getElementById("categoryId").value;
    const isEdit = !!categoryId;

    const payload = {
        category_name: document.getElementById("categoryName").value.trim(),
        description: document.getElementById("categoryDescription").value.trim() || null,
        category_image: document.getElementById("categoryImage").value.trim() || null,
        status: document.getElementById("categoryStatus").value
    };

    Loader.showButton(saveBtn, "Saving...");

    try {
        if (isEdit) {
            await api.put(`/api/categories/${categoryId}`, payload, true);
            Toast.success("Category updated successfully!");
        } else {
            await api.post("/api/categories/", payload, true);
            Toast.success("Category created successfully!");
        }

        closeModal();
        await loadInitialData(); // Refetch catalog sizes
    } catch (err) {
        console.error(err);
    } finally {
        Loader.hideButton(saveBtn);
    }
}

// Edit & Delete Buttons
window.editCategory = function(id) {
    const category = categories.find(c => c.id === id);
    if (category) openModal(category);
};

window.deleteCategory = function(id) {
    ModalConfirm.show({
        title: "Delete Category",
        message: "Are you sure you want to delete this category? Associated products will not be deleted but they will become uncategorized.",
        confirmText: "Delete",
        isDanger: true,
        onConfirm: async () => {
            try {
                await api.delete(`/api/categories/${id}`, true);
                Toast.success("Category deleted successfully!");
                await loadInitialData();
            } catch (err) {
                console.error(err);
            }
        }
    });
};

// Helper Drag & Drop
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
