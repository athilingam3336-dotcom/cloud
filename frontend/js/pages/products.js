/*
==========================================
CloudCrackers
products.js
Products Management Module with Bulk actions, CSV upload, exports, and Drag & Drop previews
==========================================
*/

// State Management
let products = [];
let categories = [];
let categoriesMap = new Map();
let filteredProducts = [];
let selectedProductIds = new Set();

let currentPage = 1;
const pageSize = 10;
let productsPagination = null;

// Search/Filter State
let searchQuery = "";
let categoryFilter = "";
let statusFilter = "";

document.addEventListener("DOMContentLoaded", async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return;

    // Initialize pagination component
    productsPagination = new Pagination({
        containerId: "productsPagination",
        pageSize: pageSize,
        onPageChange: (page) => {
            currentPage = page;
            renderProductsTable();
        }
    });

    // Filters bindings
    document.getElementById("searchProducts").addEventListener("input", Format.debounce((e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        filterAndRender();
    }, 250));

    document.getElementById("filterCategory").addEventListener("change", (e) => {
        categoryFilter = e.target.value;
        filterAndRender();
    });

    document.getElementById("filterStatus").addEventListener("change", (e) => {
        statusFilter = e.target.value;
        filterAndRender();
    });

    // Checkbox selectors
    document.getElementById("selectAllProducts").addEventListener("change", handleSelectAll);

    // Add triggers
    document.getElementById("addProductBtn").addEventListener("click", () => openModal());
    document.getElementById("closeProductModal").addEventListener("click", closeModal);
    document.getElementById("cancelProductBtn").addEventListener("click", closeModal);
    document.getElementById("productForm").addEventListener("submit", handleFormSubmit);

    // Bulk actions
    document.getElementById("bulkDeleteBtn").addEventListener("click", handleBulkDelete);
    document.getElementById("bulkActivateBtn").addEventListener("click", () => handleBulkStatusUpdate("ACTIVE"));
    document.getElementById("bulkDeactivateBtn").addEventListener("click", () => handleBulkStatusUpdate("INACTIVE"));
    document.getElementById("bulkCategoryBtn").addEventListener("click", handleBulkCategoryChange);
    document.getElementById("bulkPriceBtn").addEventListener("click", handleBulkPriceUpdate);

    // Exports
    document.getElementById("exportCsvBtn").addEventListener("click", handleExportCsv);
    document.getElementById("exportExcelBtn").addEventListener("click", handleExportExcel);

    // CSV Import Modals
    const csvImportModal = document.getElementById("csvImportModal");
    const importCsvBtn = document.getElementById("importCsvBtn");
    const closeCsvModal = document.getElementById("closeCsvModal");
    const cancelCsvBtn = document.getElementById("cancelCsvBtn");
    const processCsvBtn = document.getElementById("processCsvBtn");
    const csvFileInput = document.getElementById("csvFileInput");
    const csvDropZone = document.getElementById("csvDropZone");

    importCsvBtn.addEventListener("click", () => {
        document.getElementById("csvSelectedFileText").style.display = "none";
        csvFileInput.value = "";
        processCsvBtn.disabled = true;
        csvImportModal.style.display = "flex";
    });
    closeCsvModal.addEventListener("click", () => csvImportModal.style.display = "none");
    cancelCsvBtn.addEventListener("click", () => csvImportModal.style.display = "none");

    // CSV Drop Zone
    csvDropZone.addEventListener("click", () => csvFileInput.click());
    csvFileInput.addEventListener("change", handleCsvSelect);
    setupDragDrop(csvDropZone, handleCsvDrop);

    processCsvBtn.addEventListener("click", handleCsvProcess);

    // Image Upload Drag & Drop triggers
    const imageDropZone = document.getElementById("imageDropZone");
    const productImageFile = document.getElementById("productImageFile");
    imageDropZone.addEventListener("click", () => productImageFile.click());
    productImageFile.addEventListener("change", handleImageSelect);
    setupDragDrop(imageDropZone, handleImageDrop);

    document.getElementById("replaceImageFileInput").addEventListener("change", handleReplaceImageSelect);

    // Load dynamic data
    await loadInitialData();
});

// Load reference categories & products
async function loadInitialData() {
    try {
        Loader.showTableSkeleton(document.getElementById("productsTableBody"), 7, 5);

        // Fetch categories list
        categories = await api.get("/api/categories/", true);
        const filterCategory = document.getElementById("filterCategory");
        const productCategory = document.getElementById("productCategory");
        const bulkCategorySelect = document.getElementById("bulkCategorySelect");

        filterCategory.innerHTML = `<option value="">All Categories</option>`;
        productCategory.innerHTML = `<option value="">Select Category</option>`;
        bulkCategorySelect.innerHTML = `<option value="">Move Category...</option>`;

        categoriesMap.clear();
        categories.forEach(cat => {
            categoriesMap.set(cat.id, cat.category_name);

            // Options
            const opt1 = document.createElement("option");
            opt1.value = cat.id;
            opt1.textContent = cat.category_name;
            filterCategory.appendChild(opt1);

            const opt2 = opt1.cloneNode(true);
            productCategory.appendChild(opt2);

            const opt3 = opt1.cloneNode(true);
            bulkCategorySelect.appendChild(opt3);
        });

        // Load Products
        await fetchProducts();

    } catch (error) {
        console.error("Failed to load products page reference data:", error);
    }
}

async function fetchProducts() {
    try {
        products = await api.get("/api/products/", true);
        selectedProductIds.clear();
        updateBulkActionsPanel();
        filterAndRender();
    } catch (error) {
        console.error(error);
    }
}

function filterAndRender() {
    filteredProducts = products.filter(p => {
        const matchesSearch = !searchQuery || 
            p.product_name.toLowerCase().includes(searchQuery) ||
            (p.description && p.description.toLowerCase().includes(searchQuery));

        const matchesCategory = !categoryFilter || p.category_id === categoryFilter;
        const matchesStatus = !statusFilter || p.status === statusFilter;

        return matchesSearch && matchesCategory && matchesStatus;
    });

    currentPage = 1;
    renderProductsTable();
}

function renderProductsTable() {
    const tableBody = document.getElementById("productsTableBody");
    if (!tableBody) return;

    if (filteredProducts.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--muted);">No products match your criteria.</td></tr>`;
        productsPagination.render(0, 1);
        return;
    }

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = filteredProducts.slice(start, end);

    tableBody.innerHTML = "";
    pageItems.forEach(p => {
        const tr = document.createElement("tr");

        const categoryName = categoriesMap.get(p.category_id) || "General";
        
        // Stock badges
        const isLowStock = p.stock_quantity > 0 && p.stock_quantity <= 10;
        const isOutOfStock = p.stock_quantity === 0;
        const stockBadgeClass = isOutOfStock ? "status-cancelled" : (isLowStock ? "status-pending" : "status-delivered");
        const stockText = isOutOfStock ? "Out of Stock" : (isLowStock ? "Low Stock" : "In Stock");

        // Status badge
        const statusBadgeClass = p.status === "ACTIVE" ? "status-delivered" : "status-cancelled";

        const isChecked = selectedProductIds.has(p.id);

        tr.innerHTML = `
            <td style="text-align: center;"><input type="checkbox" class="product-select" data-id="${p.id}" ${isChecked ? 'checked' : ''} style="cursor:pointer;"></td>
            <td>
                <div class="table-user">
                    <img id="img-${p.id}" src="../images/folowerpot.jpg" style="width:36px; height:36px; border-radius:4px; object-fit:cover; border:1px solid var(--sky-line);">
                    <div>
                        <strong>${p.product_name}</strong>
                        <div style="font-size:11px; color:var(--muted);">${p.description ? p.description.substring(0, 40) + "..." : ""}</div>
                    </div>
                </div>
            </td>
            <td>${categoryName}</td>
            <td>${Format.currency(p.price)}</td>
            <td>
                <span class="status-pill ${stockBadgeClass}">${stockText} (${p.stock_quantity})</span>
            </td>
            <td><span class="status-pill ${statusClass}">${p.status}</span></td>
            <td>
                <div class="table-actions">
                    <button onclick="editProduct('${p.id}')" title="Edit Product"><i class="fa-regular fa-pen-to-square"></i></button>
                    <button onclick="deleteProduct('${p.id}')" class="danger" title="Delete Product"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            </td>
        `;

        tableBody.appendChild(tr);

        // Lazy load/resolve image
        if (p.product_image) {
            Loader.loadImage(document.getElementById(`img-${p.id}`), p.product_image);
        }

        // Row checkbox listener
        tr.querySelector(".product-select").addEventListener("change", (e) => {
            const id = e.target.getAttribute("data-id");
            if (e.target.checked) {
                selectedProductIds.add(id);
            } else {
                selectedProductIds.delete(id);
            }
            updateBulkActionsPanel();
        });
    });

    productsPagination.render(filteredProducts.length, currentPage);
}

// Bulk Actions selection updates
function handleSelectAll(e) {
    const isChecked = e.target.checked;
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = filteredProducts.slice(start, end);

    pageItems.forEach(p => {
        if (isChecked) {
            selectedProductIds.add(p.id);
        } else {
            selectedProductIds.delete(p.id);
        }
    });

    renderProductsTable();
    updateBulkActionsPanel();
}

function updateBulkActionsPanel() {
    const panel = document.getElementById("bulkActionsPanel");
    const countEl = document.getElementById("selectedCount");
    
    if (selectedProductIds.size > 0) {
        panel.style.display = "flex";
        countEl.textContent = selectedProductIds.size;
    } else {
        panel.style.display = "none";
        document.getElementById("selectAllProducts").checked = false;
    }
}

// Bulk actions processing
async function handleBulkDelete() {
    ModalConfirm.show({
        title: "Bulk Delete Products",
        message: `Are you sure you want to delete the ${selectedProductIds.size} selected products? This action is permanent.`,
        confirmText: "Delete All",
        isDanger: true,
        onConfirm: async () => {
            try {
                const deletePromises = Array.from(selectedProductIds).map(id => api.delete(`/api/products/${id}`, true));
                await Promise.all(deletePromises);
                Toast.success("Selected products deleted successfully.");
                await fetchProducts();
            } catch (err) {
                Toast.error("Failed to delete all products.");
            }
        }
    });
}

async function handleBulkStatusUpdate(newStatus) {
    ModalConfirm.show({
        title: `Bulk Status Update`,
        message: `Set status of the ${selectedProductIds.size} selected products to ${newStatus}?`,
        confirmText: "Update Status",
        isDanger: false,
        onConfirm: async () => {
            try {
                const updatePromises = Array.from(selectedProductIds).map(id => 
                    api.put(`/api/products/${id}`, { status: newStatus }, true)
                );
                await Promise.all(updatePromises);
                Toast.success("Products statuses updated successfully.");
                await fetchProducts();
            } catch (err) {
                Toast.error("Failed to update status on all products.");
            }
        }
    });
}

async function handleBulkCategoryChange() {
    const catId = document.getElementById("bulkCategorySelect").value;
    if (!catId) {
        Toast.warning("Please select a target category.");
        return;
    }

    ModalConfirm.show({
        title: "Bulk Category Move",
        message: `Move the ${selectedProductIds.size} selected products to ${categoriesMap.get(catId)}?`,
        confirmText: "Move",
        isDanger: false,
        onConfirm: async () => {
            try {
                const updatePromises = Array.from(selectedProductIds).map(id => 
                    api.put(`/api/products/${id}`, { category_id: catId }, true)
                );
                await Promise.all(updatePromises);
                Toast.success("Category moved successfully.");
                await fetchProducts();
            } catch (err) {
                Toast.error("Failed to update categories.");
            }
        }
    });
}

async function handleBulkPriceUpdate() {
    const priceVal = parseFloat(document.getElementById("bulkPriceInput").value);
    if (isNaN(priceVal) || priceVal <= 0) {
        Toast.warning("Please enter a valid price greater than ₹0.");
        return;
    }

    ModalConfirm.show({
        title: "Bulk Price Update",
        message: `Set price of ${selectedProductIds.size} products to ${Format.currency(priceVal)}?`,
        confirmText: "Update Prices",
        isDanger: false,
        onConfirm: async () => {
            try {
                const updatePromises = Array.from(selectedProductIds).map(id => 
                    api.put(`/api/products/${id}`, { price: priceVal }, true)
                );
                await Promise.all(updatePromises);
                Toast.success("Prices updated successfully.");
                await fetchProducts();
            } catch (err) {
                Toast.error("Failed to update prices.");
            }
        }
    });
}

// Import CSV
let csvImportFile = null;

function handleCsvSelect(e) {
    const file = e.target.files[0];
    if (file) loadCsvFile(file);
}

function handleCsvDrop(e) {
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
        loadCsvFile(file);
    } else {
        Toast.error("Please drop a valid CSV file.");
    }
}

function loadCsvFile(file) {
    csvImportFile = file;
    const txt = document.getElementById("csvSelectedFileText");
    txt.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    txt.style.display = "block";
    document.getElementById("processCsvBtn").disabled = false;
}

async function handleCsvProcess() {
    if (!csvImportFile) return;

    const processBtn = document.getElementById("processCsvBtn");
    Loader.showButton(processBtn, "Importing...");

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split(/\r?\n/);
        
        // Match headers
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
        
        let count = 0;
        let failCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;

            const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ''));
            const data = {};
            headers.forEach((h, index) => {
                data[h] = cols[index];
            });

            // Reconstruct payload
            if (data.product_name && data.price && data.stock_quantity) {
                try {
                    // Try mapping category_name to category_id
                    let categoryId = "";
                    if (data.category_name) {
                        const existingCatId = [...categoriesMap.entries()].find(([id, name]) => name.toLowerCase() === data.category_name.toLowerCase())?.[0];
                        if (existingCatId) {
                            categoryId = existingCatId;
                        } else {
                            // Create category if missing
                            const newCat = await api.post("/api/categories/", {
                                category_name: data.category_name,
                                status: "ACTIVE"
                            }, true);
                            categoryId = newCat.id;
                            // Add locally
                            categoriesMap.set(newCat.id, newCat.category_name);
                        }
                    }

                    await api.post("/api/products/", {
                        product_name: data.product_name,
                        category_id: categoryId || categories[0].id,
                        price: parseFloat(data.price),
                        stock_quantity: parseInt(data.stock_quantity, 10),
                        description: data.description || null,
                        product_image: data.product_image || null,
                        status: data.status || "ACTIVE"
                    }, true);

                    count++;
                } catch (err) {
                    failCount++;
                }
            }
        }

        Loader.hideButton(processBtn);
        document.getElementById("csvImportModal").style.display = "none";
        
        if (count > 0) {
            Toast.success(`Successfully imported ${count} products.`);
            await loadInitialData(); // reload options & catalog
        }
        if (failCount > 0) {
            Toast.error(`Failed to import ${failCount} products.`);
        }
    };
    reader.readAsText(csvImportFile);
}

// Exports
function handleExportCsv() {
    const headers = ["Product Name", "Category", "Price (₹)", "Stock", "Status", "Date Added"];
    const rows = filteredProducts.map(p => [
        p.product_name,
        categoriesMap.get(p.category_id) || "General",
        p.price,
        p.stock_quantity,
        p.status,
        p.created_at
    ]);
    Format.exportToCSV(headers, rows, "products_catalog.csv");
    Toast.success("Products exported to CSV successfully.");
}

function handleExportExcel() {
    const headers = ["Product Name", "Category", "Price (₹)", "Stock", "Status", "Date Added"];
    const rows = filteredProducts.map(p => [
        p.product_name,
        categoriesMap.get(p.category_id) || "General",
        p.price,
        p.stock_quantity,
        p.status,
        p.created_at
    ]);
    Format.exportToExcel(headers, rows, "products_catalog.xls");
    Toast.success("Products exported to Excel (TSV) successfully.");
}

// Drag & Drop Image Management Module
let productImagesList = [];
let replaceTargetImg = null;

const VALID_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

async function compressImage(file, maxWidth = 1000, maxHeight = 1000, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                let mimeType = file.type;
                if (!VALID_TYPES.includes(mimeType)) {
                    mimeType = "image/jpeg";
                }
                const compressedBase64 = canvas.toDataURL(mimeType, quality);
                resolve(compressedBase64);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

function handleImageSelect(e) {
    const files = Array.from(e.target.files);
    files.forEach(processImageFile);
    e.target.value = ""; // reset
}

function handleImageDrop(e) {
    const files = Array.from(e.dataTransfer.files);
    files.forEach(processImageFile);
}

async function processImageFile(file) {
    if (!VALID_TYPES.includes(file.type)) {
        Toast.error("Invalid image format. Only JPG, PNG, and WEBP are allowed.");
        return;
    }
    if (file.size > MAX_SIZE) {
        Toast.error("Image size exceeds the maximum limit of 5MB.");
        return;
    }

    const productId = document.getElementById("productId").value;

    try {
        const compressedBase64 = await compressImage(file);

        if (productId) {
            const tempId = Date.now() + Math.random();
            productImagesList.push({ tempId, image_url: compressedBase64, is_loading: true });
            renderImagePreviews();

            const isPrimary = productImagesList.length === 1;
            const res = await api.post(`/api/products/${productId}/images`, {
                image_data: compressedBase64,
                is_primary: isPrimary
            }, true);

            const idx = productImagesList.findIndex(img => img.tempId === tempId);
            if (idx !== -1) {
                productImagesList[idx] = res;
            }
            Toast.success("Image uploaded successfully.");
            fetchProducts();
        } else {
            const isPrimary = productImagesList.length === 0;
            productImagesList.push({
                tempId: Date.now() + Math.random(),
                image_url: compressedBase64,
                image_data: compressedBase64,
                is_primary: isPrimary,
                is_temp: true
            });
        }

        syncMainProductImageInput();
        renderImagePreviews();
    } catch (err) {
        console.error(err);
        Toast.error(err.message || "Failed to upload image.");
    }
}

function renderImagePreviews() {
    const container = document.getElementById("imagePreviewsContainer");
    if (!container) return;

    container.innerHTML = "";
    if (productImagesList.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:12px; color:var(--muted); font-size:11px;">No images uploaded yet.</div>`;
        return;
    }

    productImagesList.forEach((img, index) => {
        const idOrTempId = img.id || img.tempId;
        const isPrimary = img.is_primary;
        const src = img.image_url || img.image_data;
        const isLoading = img.is_loading;

        const item = document.createElement("div");
        item.className = "gallery-item";

        let primaryBadgeHtml = isPrimary ? `<span class="gallery-item-primary-badge">Primary</span>` : "";
        let spinnerHtml = isLoading ? `<div class="gallery-item-spinner"><i class="fa-solid fa-spinner fa-spin" style="color:var(--gold); font-size:16px;"></i></div>` : "";

        item.innerHTML = `
            ${primaryBadgeHtml}
            ${spinnerHtml}
            <img src="${src}" onerror="this.src='../images/folowerpot.jpg'">
            <div class="gallery-item-actions">
                <button type="button" class="gallery-action-btn" onclick="setAsPrimary('${idOrTempId}')" title="Set as Primary">
                    <i class="${isPrimary ? 'fa-solid' : 'fa-regular'} fa-star" style="${isPrimary ? 'color:var(--gold);' : ''}"></i>
                </button>
                <button type="button" class="gallery-action-btn" onclick="triggerReplaceImage('${idOrTempId}')" title="Replace Image">
                    <i class="fa-solid fa-arrows-rotate"></i>
                </button>
                <button type="button" class="gallery-action-btn delete" onclick="deleteGalleryImage('${idOrTempId}')" title="Delete Image">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </div>
        `;
        container.appendChild(item);
    });
}

function syncMainProductImageInput() {
    const primaryImg = productImagesList.find(img => img.is_primary) || productImagesList[0];
    const input = document.getElementById("productImage");
    if (input) {
        input.value = primaryImg ? (primaryImg.image_url || primaryImg.image_data) : "";
    }
}

window.setAsPrimary = async function(idOrTempId) {
    const productId = document.getElementById("productId").value;
    if (productId) {
        try {
            const img = productImagesList.find(i => i.id == idOrTempId);
            if (!img) return;

            img.is_loading = true;
            renderImagePreviews();

            const updated = await api.put(`/api/products/${productId}/images/${idOrTempId}/primary`, {}, true);

            productImagesList.forEach(i => {
                i.is_primary = (i.id == idOrTempId);
                delete i.is_loading;
            });

            Toast.success("Primary image updated successfully.");
            fetchProducts();
        } catch (err) {
            console.error(err);
            Toast.error("Failed to update primary image.");
        }
    } else {
        productImagesList.forEach(i => {
            i.is_primary = (i.tempId == idOrTempId);
        });
    }
    syncMainProductImageInput();
    renderImagePreviews();
};

window.triggerReplaceImage = function(idOrTempId) {
    replaceTargetImg = idOrTempId;
    document.getElementById("replaceImageFileInput").click();
};

async function handleReplaceImageSelect(e) {
    const file = e.target.files[0];
    if (!file || !replaceTargetImg) return;

    if (!VALID_TYPES.includes(file.type)) {
        Toast.error("Invalid image format. Only JPG, PNG, and WEBP are allowed.");
        return;
    }
    if (file.size > MAX_SIZE) {
        Toast.error("Image size exceeds the maximum limit of 5MB.");
        return;
    }

    const productId = document.getElementById("productId").value;

    try {
        const compressedBase64 = await compressImage(file);

        if (productId) {
            const target = productImagesList.find(i => i.id == replaceTargetImg);
            if (target) {
                target.is_loading = true;
                renderImagePreviews();
            }

            const updated = await api.put(`/api/products/${productId}/images/${replaceTargetImg}`, {
                image_data: compressedBase64
            }, true);

            const idx = productImagesList.findIndex(i => i.id == replaceTargetImg);
            if (idx !== -1) {
                productImagesList[idx] = updated;
            }
            Toast.success("Image replaced successfully.");
            fetchProducts();
        } else {
            const idx = productImagesList.findIndex(i => i.tempId == replaceTargetImg);
            if (idx !== -1) {
                productImagesList[idx].image_url = compressedBase64;
                productImagesList[idx].image_data = compressedBase64;
            }
        }

        syncMainProductImageInput();
        renderImagePreviews();
    } catch (err) {
        console.error(err);
        Toast.error("Failed to replace image.");
    } finally {
        e.target.value = "";
        replaceTargetImg = null;
    }
}

window.deleteGalleryImage = function(idOrTempId) {
    const productId = document.getElementById("productId").value;
    ModalConfirm.show({
        title: "Delete Image",
        message: "Are you sure you want to delete this product image? This will permanently delete the file.",
        confirmText: "Delete",
        isDanger: true,
        onConfirm: async () => {
            if (productId) {
                try {
                    const target = productImagesList.find(i => i.id == idOrTempId);
                    if (target) {
                        target.is_loading = true;
                        renderImagePreviews();
                    }

                    await api.delete(`/api/products/${productId}/images/${idOrTempId}`, true);
                    productImagesList = productImagesList.filter(i => i.id != idOrTempId);

                    const refreshed = await api.get(`/api/products/${productId}/images`);
                    productImagesList = refreshed || [];

                    Toast.success("Image deleted successfully.");
                    fetchProducts();
                } catch (err) {
                    console.error(err);
                    Toast.error("Failed to delete image.");
                }
            } else {
                const wasPrimary = productImagesList.find(i => i.tempId == idOrTempId)?.is_primary;
                productImagesList = productImagesList.filter(i => i.tempId != idOrTempId);
                if (wasPrimary && productImagesList.length > 0) {
                    productImagesList[0].is_primary = true;
                }
            }

            syncMainProductImageInput();
            renderImagePreviews();
        }
    });
};

// Open Product Modal for Edit/Add
async function openModal(product = null) {
    const modal = document.getElementById("productModal");
    const form = document.getElementById("productForm");
    const title = document.getElementById("modalTitle");

    form.reset();
    document.getElementById("productId").value = "";
    productImagesList = [];
    renderImagePreviews();

    if (product) {
        title.textContent = "Edit Product";
        document.getElementById("productId").value = product.id;
        document.getElementById("productName").value = product.product_name;
        document.getElementById("productCategory").value = product.category_id;
        document.getElementById("productPrice").value = product.price;

        const skuInput = document.getElementById("productSku");
        if (skuInput) skuInput.value = product.sku || "";
        const weightInput = document.getElementById("productWeight");
        if (weightInput) weightInput.value = product.weight || "";
        const discountInput = document.getElementById("productDiscount");
        if (discountInput) discountInput.value = product.discount || "0";
        const brandInput = document.getElementById("productBrand");
        if (brandInput) brandInput.value = product.brand || "CloudCrackers";

        document.getElementById("productStock").value = product.stock_quantity;
        document.getElementById("productDescription").value = product.description || "";
        document.getElementById("productImage").value = product.product_image || "";
        document.getElementById("productStatus").value = product.status;

        try {
            const container = document.getElementById("imagePreviewsContainer");
            if (container) {
                container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:12px; color:var(--muted); font-size:11px;"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px; color:var(--gold);"></i>Loading product gallery...</div>`;
            }
            const images = await api.get(`/api/products/${product.id}/images`);
            productImagesList = images || [];
            renderImagePreviews();
        } catch (err) {
            console.error("Failed to load product images:", err);
            if (product.product_image) {
                productImagesList = [{ id: "main-fallback", image_url: product.product_image, is_primary: true }];
                renderImagePreviews();
            }
        }
    } else {
        title.textContent = "Add New Product";
        document.getElementById("productStatus").value = "ACTIVE";

        const skuInput = document.getElementById("productSku");
        if (skuInput) skuInput.value = "";
        const weightInput = document.getElementById("productWeight");
        if (weightInput) weightInput.value = "";
        const discountInput = document.getElementById("productDiscount");
        if (discountInput) discountInput.value = "0";
        const brandInput = document.getElementById("productBrand");
        if (brandInput) brandInput.value = "CloudCrackers";
    }

    modal.style.display = "flex";
}

function closeModal() {
    document.getElementById("productModal").style.display = "none";
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const saveBtn = document.getElementById("saveProductBtn");
    const productId = document.getElementById("productId").value;
    const isEdit = !!productId;

    const payload = {
        product_name: document.getElementById("productName").value.trim(),
        category_id: document.getElementById("productCategory").value,
        price: parseFloat(document.getElementById("productPrice").value),
        stock_quantity: parseInt(document.getElementById("productStock").value, 10),
        description: document.getElementById("productDescription").value.trim() || null,
        product_image: document.getElementById("productImage").value.trim() || null,
        status: document.getElementById("productStatus").value,
        discount: parseFloat(document.getElementById("productDiscount")?.value || "0"),
        weight: document.getElementById("productWeight")?.value.trim() || null,
        sku: document.getElementById("productSku")?.value.trim() || null,
        brand: document.getElementById("productBrand")?.value.trim() || "CloudCrackers"
    };

    Loader.showButton(saveBtn, "Saving...");

    try {
        if (isEdit) {
            await api.put(`/api/products/${productId}`, payload, true);
            Toast.success("Product updated successfully!");
            closeModal();
            await fetchProducts();
        } else {
            const newProduct = await api.post("/api/products/", payload, true);

            if (productImagesList.length > 0) {
                Loader.showButton(saveBtn, "Uploading Images...");
                for (let i = 0; i < productImagesList.length; i++) {
                    const img = productImagesList[i];
                    try {
                        await api.post(`/api/products/${newProduct.id}/images`, {
                            image_data: img.image_data,
                            is_primary: img.is_primary
                        }, true);
                    } catch (uploadErr) {
                        console.error("Failed to upload image during product creation:", uploadErr);
                    }
                }
            }

            Toast.success("Product created successfully!");
            closeModal();
            await fetchProducts();
        }
    } catch (err) {
        console.error("Save product failed:", err);
    } finally {
        Loader.hideButton(saveBtn);
    }
}

// Edit & Delete Button hooks
window.editProduct = function(id) {
    const product = products.find(p => p.id === id);
    if (product) openModal(product);
};

window.deleteProduct = function(id) {
    ModalConfirm.show({
        title: "Delete Product",
        message: "Are you sure you want to delete this product? This action cannot be undone.",
        confirmText: "Delete Product",
        isDanger: true,
        onConfirm: async () => {
            try {
                await api.delete(`/api/products/${id}`, true);
                Toast.success("Product deleted successfully!");
                await fetchProducts();
            } catch (err) {
                console.error(err);
            }
        }
    });
};

// Helper Drag & Drop handlers
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
