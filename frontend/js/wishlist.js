/*
==========================================
CloudCrackers
wishlist.js
Wishlist Module
==========================================
*/

let wishlistItems = [];
let productMap    = {};


document.addEventListener("DOMContentLoaded", () => {

    requireAuth();

    loadWishlist();

});


function requireAuth() {
    if (!localStorage.getItem(TOKEN_KEY)) {
        window.location.href = "login.html";
    }
}


/*
==========================================
Load Wishlist
GET /api/wishlist/ cross-referenced with
GET /api/products/ (WishlistResponse only
returns product_id, not product details)
==========================================
*/

async function loadWishlist() {

    showLoading(true);

    try {

        const [wishlist, products] = await Promise.all([
            api.get("/api/wishlist/", true),
            api.get("/api/products/")
        ]);

        wishlistItems = wishlist || [];

        productMap = {};
        (products || []).forEach(p => { productMap[p.id] = p; });

        showLoading(false);
        renderWishlist();

    } catch (err) {

        showLoading(false);
        alert(err.message || "Could not load wishlist.");

    }

}


/*
==========================================
Render Wishlist
Uses .products-grid-page and .card .product-card
CSS — same classes as the products page
==========================================
*/

function renderWishlist() {

    const grid     = document.getElementById("wishlistGrid");
    const layout   = document.getElementById("wishlistLayout");
    const empty    = document.getElementById("wishlistEmpty");
    const subtitle = document.getElementById("wishlistSubtitle");

    if (!grid) return;

    grid.innerHTML = "";

    if (wishlistItems.length === 0) {
        if (layout)   layout.style.display  = "none";
        if (empty)    empty.style.display   = "block";
        if (subtitle) subtitle.textContent  = "No items saved yet";
        return;
    }

    if (layout) layout.style.display = "block";
    if (empty)  empty.style.display  = "none";
    if (subtitle) subtitle.textContent = `${wishlistItems.length} saved item${wishlistItems.length !== 1 ? "s" : ""}`;

    wishlistItems.forEach(item => {

        const product = productMap[item.product_id];
        const name    = product ? product.product_name : "Unknown Product";
        const price   = product ? parseFloat(product.price) : 0;
        const icon    = product ? productIcon(product.product_name) : "fa-solid fa-fire-flame-curved";
        const inStock = product ? product.stock_quantity > 0 : false;

        const card = document.createElement("div");
        card.className = "card product-card";
        card.style.cursor = "pointer";
        card.innerHTML = `
            <div class="product-thumb">
                <i class="${icon}" style="font-size:36px; color:var(--gold);"></i>
            </div>
            <h3>${escHtml(name)}</h3>
            <p class="muted-text">${escHtml(product?.description || "")}</p>
            <div class="product-foot">
                <span class="price">₹${formatPrice(price)}</span>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-primary btn-sm add-from-wish-btn"
                            data-product-id="${escHtml(item.product_id)}"
                            ${!inStock ? "disabled" : ""}>
                        <i class="fa-solid fa-cart-shopping"></i> Add
                    </button>
                    <button class="btn btn-outline btn-sm remove-wish-btn"
                            data-wishlist-id="${escHtml(item.id)}"
                            title="Remove from wishlist">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>`;

        card.addEventListener("click", (e) => {
            if (!e.target.closest("button")) {
                window.location.href = `product-details.html?id=${item.product_id}`;
            }
        });

        grid.appendChild(card);

    });

    attachWishlistListeners();

    // Also update cart badge
    updateCartBadge();

}


/*
==========================================
Attach button listeners after render
==========================================
*/

function attachWishlistListeners() {

    document.querySelectorAll(".add-from-wish-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            addToCart(btn.dataset.productId, btn);
        });
    });

    document.querySelectorAll(".remove-wish-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (confirm("Remove this item from your wishlist?")) {
                removeFromWishlist(btn.dataset.wishlistId);
            }
        });
    });

}


/*
==========================================
Move to Cart
POST /api/cart/  { product_id, quantity: 1 }
==========================================
*/

async function addToCart(productId, btnEl) {

    const original = btnEl.innerHTML;
    btnEl.classList.add("is-loading");
    btnEl.disabled = true;

    try {

        await api.post("/api/cart/", { product_id: productId, quantity: 1 }, true);

        btnEl.classList.remove("is-loading");
        btnEl.innerHTML = "<i class='fa-solid fa-check'></i> Added!";

        setTimeout(() => {
            btnEl.innerHTML = original;
            btnEl.disabled = false;
        }, 1500);

        updateCartBadge();

    } catch (err) {

        btnEl.classList.remove("is-loading");
        btnEl.innerHTML = original;
        btnEl.disabled = false;
        alert(err.message || "Could not add to cart.");

    }

}


/*
==========================================
Remove from Wishlist
DELETE /api/wishlist/{wishlist_id}
==========================================
*/

async function removeFromWishlist(wishlistId) {

    try {

        await api.delete(`/api/wishlist/${wishlistId}`, true);

        wishlistItems = wishlistItems.filter(i => i.id !== wishlistId);

        renderWishlist();

    } catch (err) {

        alert(err.message || "Could not remove item.");

    }

}


/*
==========================================
Update cart badge in navbar
==========================================
*/

async function updateCartBadge() {
    const token = localStorage.getItem(TOKEN_KEY);
    const badge = document.getElementById("cartCount");
    if (!badge || !token) return;
    try {
        const cart = await api.get("/api/cart/", true);
        badge.textContent = cart.length;
    } catch { /* silent */ }
}


/*
==========================================
UI helpers
==========================================
*/

function showLoading(visible) {
    const el = document.getElementById("wishlistLoading");
    if (el) el.style.display = visible ? "block" : "none";
}

function formatPrice(value) {
    return Number(value).toLocaleString("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

function escHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function productIcon(name) {
    const n = (name || "").toLowerCase();
    if (n.includes("sparkl"))                          return "fa-solid fa-sparkles";
    if (n.includes("rocket"))                          return "fa-solid fa-rocket";
    if (n.includes("chakr")||n.includes("spin"))       return "fa-solid fa-circle-notch";
    if (n.includes("gift")||n.includes("box")||n.includes("combo")) return "fa-solid fa-gift";
    if (n.includes("shell")||n.includes("aerial")||n.includes("sky")) return "fa-solid fa-explosion";
    if (n.includes("sound")||n.includes("cracker"))    return "fa-solid fa-volume-high";
    if (n.includes("star")||n.includes("fountain")||n.includes("flower")) return "fa-solid fa-star";
    return "fa-solid fa-fire-flame-curved";
}