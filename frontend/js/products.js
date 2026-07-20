/*
==========================================
CloudCrackers
products.js
Products Module
==========================================
*/

/*
==========================================
Module State
All active filter/search/sort values are
kept here so every re-render reads from
one source of truth.
==========================================
*/

const state = {
    allProducts: [],      // full list from last API call
    renderedProducts: [], // subset after client-side sort
    activeCategoryId: "", // "" = all categories
    minPrice: "",
    maxPrice: "",
    searchQuery: "",
    sortValue: "default"
};


/*
==========================================
Initialise on DOM Ready
==========================================
*/

document.addEventListener("DOMContentLoaded", () => {

    loadCategories();

    loadProducts();

    initializeSearch();

    initializeSort();

    initializeFilters();

});


/*
==========================================
Load Categories
Populates the sidebar radio-button list
from GET /api/categories/
==========================================
*/

async function loadCategories() {

    const container = document.getElementById("categoryFilter");

    if (!container) return;

    try {

        const categories = await api.get("/categories/");

        // "All" option is already in the HTML; append one per category
        categories.forEach(cat => {

            const label = document.createElement("label");
            label.className = "filter-option";
            label.innerHTML = `
                <input type="radio" name="category" value="${cat.id}">
                ${escapeHtml(cat.category_name)}
            `;
            container.appendChild(label);

        });

    } catch (err) {

        // Non-critical — sidebar still functional with "All" option
        console.warn("Could not load categories:", err.message);

    }

}


/*
==========================================
Load Products
Calls GET /api/products with optional
category / min_price / max_price params.
Search uses GET /api/products/search?q=
==========================================
*/

async function loadProducts() {

    showLoading(true);
    hideAlert();

    try {

        let products;

        if (state.searchQuery.trim().length > 0) {

            // Search path — backend does name-based ilike match
            const params = new URLSearchParams({ q: state.searchQuery.trim() });
            products = await api.get(`/products/search?${params}`); 

        } else {

            // Filter path — all params are optional; omit empty ones
            const params = new URLSearchParams();

            if (state.activeCategoryId) {
                params.set("category", state.activeCategoryId);
            }

            if (state.minPrice !== "") {
                params.set("min_price", state.minPrice);
            }

            if (state.maxPrice !== "") {
                params.set("max_price", state.maxPrice);
            }

            const query = params.toString();
            products = await api.get(`/api/products/${query ? "?" + query : ""}`);

        }

        state.allProducts = products || [];
        applySort();

    } catch (err) {

        showAlert(err.message || "Failed to load products. Please try again.");
        state.allProducts = [];
        renderProducts([]);

    } finally {

        showLoading(false);

    }

}


/*
==========================================
Apply Sort
Sorts state.allProducts client-side then
calls renderProducts. The backend already
applies category + price filters; sorting
is done on whatever the backend returned.
==========================================
*/

function applySort() {

    const sorted = [...state.allProducts];

    switch (state.sortValue) {

        case "price_low":
            sorted.sort((a, b) => a.price - b.price);
            break;

        case "price_high":
            sorted.sort((a, b) => b.price - a.price);
            break;

        case "name_asc":
            sorted.sort((a, b) =>
                a.product_name.localeCompare(b.product_name)
            );
            break;

        default:
            // Keep the order returned by the backend
            break;

    }

    state.renderedProducts = sorted;
    renderProducts(sorted);

}


/*
==========================================
Render Products
Writes product cards into #productsContainer.
Mirrors the exact card markup from the
original products.html (card, product-card,
badge, product-thumb, product-foot, price).
==========================================
*/

function renderProducts(products) {

    const container = document.getElementById("productsContainer");
    const emptyState = document.getElementById("productsEmpty");
    const resultsCount = document.getElementById("resultsCount");

    if (!container) return;

    container.innerHTML = "";

    if (products.length === 0) {

        if (emptyState) emptyState.style.display = "block";
        if (resultsCount) resultsCount.textContent = "0 results";
        return;

    }

    if (emptyState) emptyState.style.display = "none";
    if (resultsCount) {
        resultsCount.textContent = `Showing ${products.length} product${products.length !== 1 ? "s" : ""}`;
    }

    products.forEach(product => {

        const card = buildProductCard(product);
        container.appendChild(card);

    });

    attachCardListeners();

}


/*
==========================================
Build Product Card DOM Element
Reuses every CSS class from the original
HTML (card, product-card, badge, product-
thumb, product-foot, price, btn-outline,
btn-sm) so styling is unchanged.
==========================================
*/

function buildProductCard(product) {

    const card = document.createElement("div");
    card.className = "card product-card";
    card.style.cursor = "pointer";

    // Choose a fallback icon based on the product name when no image is set
    const icon = productIcon(product.product_name);

    // Thumbnail — show real image if product_image is set, else icon
    const thumbHtml = product.product_image
        ? `<img src="${escapeHtml(product.product_image)}"
                alt="${escapeHtml(product.product_name)}"
                style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius-sm);"
                onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
           <i class="${icon}" style="display:none;font-size:36px;color:var(--gold);"></i>`
        : `<i class="${icon}" style="font-size:36px;color:var(--gold);"></i>`;

    // Stock badge
    const badgeHtml = product.stock_quantity === 0
        ? `<span class="badge" style="background:var(--muted);">Out of Stock</span>`
        : product.stock_quantity <= 5
            ? `<span class="badge">Low Stock</span>`
            : "";

    // Status — skip INACTIVE products silently (they shouldn't come from API, but guard)
    if (product.status === "INACTIVE") return document.createDocumentFragment();

    const discountVal = parseFloat(product.discount || 0);
    const originalPrice = parseFloat(product.price);
    const finalPrice = Math.max(0, originalPrice - discountVal);

    const priceHtml = discountVal > 0
        ? `<span class="price">₹${formatPrice(finalPrice)} <span style="font-size:11px; text-decoration:line-through; color:var(--muted); margin-left:4px;">₹${formatPrice(originalPrice)}</span></span>`
        : `<span class="price">₹${formatPrice(originalPrice)}</span>`;

    card.innerHTML = `
        ${badgeHtml}
        <div class="product-thumb" data-product-id="${escapeHtml(String(product.id))}">
            ${thumbHtml}
        </div>
        <h3>${escapeHtml(product.product_name)}</h3>
        <p class="muted-text">${escapeHtml(product.description || "")}</p>
        <div class="product-foot">
            ${priceHtml}
            <div style="display:flex;gap:8px;">
                <button
                    class="btn btn-outline btn-sm wishlist-btn"
                    data-id="${escapeHtml(String(product.id))}"
                    title="Add to Wishlist"
                    ${product.stock_quantity === 0 ? "disabled" : ""}
                >
                    <i class="fa-regular fa-heart"></i>
                </button>
                <button
                    class="btn btn-outline btn-sm add-cart-btn"
                    data-id="${escapeHtml(String(product.id))}"
                    data-name="${escapeHtml(product.product_name)}"
                    ${product.stock_quantity === 0 ? "disabled" : ""}
                >
                    Add
                </button>
            </div>
        </div>
    `;

    // Clicking the card body (not the buttons) goes to product details
    card.addEventListener("click", (e) => {
        if (!e.target.closest("button")) {
            viewProduct(product.id);
        }
    });

    return card;

}


/*
==========================================
Attach Button Event Listeners
Called after every render so newly created
buttons get their handlers.
==========================================
*/

function attachCardListeners() {

    document.querySelectorAll(".add-cart-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            addToCart(btn.dataset.id, btn.dataset.name, btn);
        });
    });

    document.querySelectorAll(".wishlist-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            addToWishlist(btn.dataset.id, btn);
        });
    });

}


/*
==========================================
Add To Cart
POST /api/cart/  { product_id, quantity }
Requires auth — redirects to login if no
token is present.
==========================================
*/

async function addToCart(productId, productName, buttonEl) {

    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const original = buttonEl.textContent;
    buttonEl.classList.add("is-loading");
    buttonEl.disabled = true;

    try {

        await api.post(
            "/api/cart/",
            { product_id: productId, quantity: 1 },
            true  // auth = true
        );

        buttonEl.classList.remove("is-loading");
        buttonEl.textContent = "Added!";
        buttonEl.style.color = "#3DDC97";
        buttonEl.style.borderColor = "#3DDC97";

        setTimeout(() => {
            buttonEl.textContent = original;
            buttonEl.style.color = "";
            buttonEl.style.borderColor = "";
            buttonEl.disabled = false;
        }, 1500);

        updateCartCount();

    } catch (err) {

        buttonEl.classList.remove("is-loading");
        buttonEl.textContent = original;
        buttonEl.disabled = false;
        showAlert(err.message || "Could not add to cart. Please try again.");

    }

}


/*
==========================================
Add To Wishlist
POST /api/wishlist/  { product_id }
Requires auth — redirects to login if no
token is present.
==========================================
*/

async function addToWishlist(productId, buttonEl) {

    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const icon = buttonEl.querySelector("i");
    buttonEl.disabled = true;

    try {

        await api.post(
            "/api/wishlist/",
            { product_id: productId },
            true  // auth = true
        );

        if (icon) {
            icon.classList.replace("fa-regular", "fa-solid");
            icon.style.color = "var(--ember)";
        }

        buttonEl.title = "Added to Wishlist";

        setTimeout(() => {
            buttonEl.disabled = false;
        }, 1000);

    } catch (err) {

        buttonEl.disabled = false;

        // 409 = already in wishlist — treat as success silently
        if (!err.message.includes("already")) {
            showAlert(err.message || "Could not add to wishlist.");
        }

    }

}


/*
==========================================
View Product Details
==========================================
*/

function viewProduct(productId) {

    window.location.href = `product-details.html?id=${productId}`;

}


/*
==========================================
Update Cart Count Badge
Reads current cart from GET /api/cart/
and updates the navbar badge.
==========================================
*/

async function updateCartCount() {

    const token = localStorage.getItem(TOKEN_KEY);
    const badge = document.getElementById("cartCount");

    if (!badge || !token) return;

    try {

        const cart = await api.get("/api/cart/", true);
        badge.textContent = cart.length;

    } catch {

        // Non-critical — badge stays as-is
    }

}


/*
==========================================
Search
Debounced keyup on #searchInput.
Clears category/price filters when a
search query is active (backend search
is name-only and does not support
simultaneous filter params).
==========================================
*/

let searchTimer = null;

function initializeSearch() {

    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");

    if (!searchInput) return;

    const doSearch = () => {
        state.searchQuery = searchInput.value.trim();
        loadProducts();
    };

    searchInput.addEventListener("keyup", (e) => {

        clearTimeout(searchTimer);

        if (e.key === "Enter") {
            doSearch();
            return;
        }

        // Debounce — wait 400 ms after the user stops typing
        searchTimer = setTimeout(doSearch, 400);

    });

    if (searchBtn) {
        searchBtn.addEventListener("click", doSearch);
    }

}


/*
==========================================
Sort
#sortProducts select — client-side only.
Re-sorts the already-loaded product list.
==========================================
*/

function initializeSort() {

    const sort = document.getElementById("sortProducts");

    if (!sort) return;

    sort.addEventListener("change", () => {
        state.sortValue = sort.value;
        applySort();
    });

}


/*
==========================================
Filters
Apply Filters — reads category radio +
min/max price inputs then re-fetches from
the backend with those query params.
Clear Filters — resets everything.
==========================================
*/

function initializeFilters() {

    const applyBtn = document.getElementById("applyFilters");
    const clearBtn = document.getElementById("clearFilters");

    if (applyBtn) {
        applyBtn.addEventListener("click", applyFilters);
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", clearFilters);
    }

    // Dynamic delegation for category radio button clicks in sidebar
    const container = document.getElementById("categoryFilter");
    if (container) {
        container.addEventListener("change", (e) => {
            if (e.target.name === "category") {
                applyFilters();
            }
        });
    }

}

function applyFilters() {

    const selectedCategory = document.querySelector(
        'input[name="category"]:checked'
    );

    state.activeCategoryId = selectedCategory ? selectedCategory.value : "";
    state.minPrice = document.getElementById("minPrice")?.value.trim() || "";
    state.maxPrice = document.getElementById("maxPrice")?.value.trim() || "";

    // Clear any active search when filters are applied
    state.searchQuery = "";
    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.value = "";

    loadProducts();

}

function clearFilters() {

    state.activeCategoryId = "";
    state.minPrice = "";
    state.maxPrice = "";
    state.searchQuery = "";
    state.sortValue = "default";

    // Reset UI controls
    const allRadio = document.querySelector('input[name="category"][value=""]');
    if (allRadio) allRadio.checked = true;

    const minEl = document.getElementById("minPrice");
    const maxEl = document.getElementById("maxPrice");
    if (minEl) minEl.value = "";
    if (maxEl) maxEl.value = "";

    const sortEl = document.getElementById("sortProducts");
    if (sortEl) sortEl.value = "default";

    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.value = "";

    loadProducts();

}


/*
==========================================
UI Helpers
==========================================
*/

function showLoading(visible) {

    const loading = document.getElementById("productsLoading");
    const grid = document.getElementById("productsContainer");

    if (loading) loading.style.display = visible ? "block" : "none";
    if (grid) grid.style.opacity = visible ? "0.4" : "1";

}

function showAlert(message) {

    const alert = document.getElementById("productsAlert");
    const msg = document.getElementById("productsAlertMsg");

    if (!alert || !msg) return;

    msg.textContent = message;
    alert.style.display = "flex";

}

function hideAlert() {

    const alert = document.getElementById("productsAlert");
    if (alert) alert.style.display = "none";

}


/*
==========================================
Utility — pick an icon by product name
keywords (fallback when no product_image)
==========================================
*/

function productIcon(name) {

    const n = (name || "").toLowerCase();

    if (n.includes("sparkl"))   return "fa-solid fa-sparkles";
    if (n.includes("rocket"))   return "fa-solid fa-rocket";
    if (n.includes("chakr") || n.includes("spin") || n.includes("wheel"))
                                return "fa-solid fa-circle-notch";
    if (n.includes("gift") || n.includes("box") || n.includes("combo"))
                                return "fa-solid fa-gift";
    if (n.includes("shell") || n.includes("aerial") || n.includes("sky"))
                                return "fa-solid fa-explosion";
    if (n.includes("sound") || n.includes("cracker") || n.includes("bomb"))
                                return "fa-solid fa-volume-high";
    if (n.includes("fountain") || n.includes("star") || n.includes("flower"))
                                return "fa-solid fa-star";
    if (n.includes("kid") || n.includes("safe") || n.includes("child"))
                                return "fa-solid fa-child-reaching";

    return "fa-solid fa-fire-flame-curved";

}


/*
==========================================
Utility — format price with commas
==========================================
*/

function formatPrice(value) {

    return Number(value).toLocaleString("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });

}


/*
==========================================
Utility — escape HTML to prevent XSS
==========================================
*/

function escapeHtml(str) {

    if (str === null || str === undefined) return "";

    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

}