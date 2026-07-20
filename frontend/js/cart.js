/*
==========================================
CloudCrackers
cart.js
Shopping Cart Module
==========================================
*/

/*
==========================================
Module State
cartItems  — raw CartResponse list from backend
productMap — { product_id: ProductResponse } lookup built once
==========================================
*/

let cartItems  = [];
let productMap = {};


document.addEventListener("DOMContentLoaded", () => {

    requireAuth();

    loadCart();

    document.getElementById("applyPromo")?.addEventListener("click", () => {
        alert("Promo codes are not supported yet.");
    });

});


/*
==========================================
Redirect to login if not authenticated
==========================================
*/

function requireAuth() {
    if (!localStorage.getItem(TOKEN_KEY)) {
        window.location.href = "login.html";
    }
}


/*
==========================================
Load Cart
GET /api/cart/
Then cross-references GET /api/products/ to
get names and prices (CartResponse only
contains product_id, not product details).
==========================================
*/

async function loadCart() {

    showLoading(true);

    try {

        // Fetch cart and all products in parallel
        const [cart, products] = await Promise.all([
            api.get("/api/cart/", true),
            api.get("/api/products/")
        ]);

        cartItems = cart || [];

        // Build product lookup map
        productMap = {};
        (products || []).forEach(p => {
            productMap[p.id] = p;
        });

        showLoading(false);
        renderCart();

    } catch (err) {

        showLoading(false);
        alert(err.message || "Could not load cart.");

    }

}


/*
==========================================
Render Cart
Writes rows into #cartTableBody and
updates the order summary panel.
==========================================
*/

function renderCart() {

    const tbody    = document.getElementById("cartTableBody");
    const layout   = document.getElementById("cartLayout");
    const empty    = document.getElementById("cartEmpty");
    const subtitle = document.getElementById("cartSubtitle");

    if (!tbody) return;

    tbody.innerHTML = "";

    if (cartItems.length === 0) {

        if (layout)   layout.style.display   = "none";
        if (empty)    empty.style.display    = "block";
        if (subtitle) subtitle.textContent   = "Your cart is empty";

        document.getElementById("cartCount").textContent = "0";
        return;
    }

    if (layout) layout.style.display = "grid";
    if (empty)  empty.style.display  = "none";
    if (subtitle) subtitle.textContent = `${cartItems.length} item${cartItems.length !== 1 ? "s" : ""} in your cart`;

    document.getElementById("cartCount").textContent = cartItems.length;

    let subtotal = 0;

    cartItems.forEach(item => {

        const product  = productMap[item.product_id];
        const name     = product ? product.product_name : "Unknown Product";
        const price    = product ? parseFloat(product.price) : 0;
        const lineTotal = price * item.quantity;
        const icon     = product ? productIcon(product.product_name) : "fa-solid fa-fire-flame-curved";

        subtotal += lineTotal;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <div class="cart-item-info">
                    <div class="cart-item-thumb">
                        <i class="${icon}"></i>
                    </div>
                    <div>
                        <h4>${escHtml(name)}</h4>
                        <a href="product-details.html?id=${escHtml(item.product_id)}"
                           class="muted-text" style="font-size:12px;">View details</a>
                    </div>
                </div>
            </td>
            <td>₹${formatPrice(price)}</td>
            <td>
                <div class="qty-stepper">
                    <button type="button" class="qty-minus" data-cart-id="${escHtml(item.id)}">−</button>
                    <input type="text" value="${item.quantity}" readonly style="width:46px; text-align:center; background:transparent; border:none; color:var(--paper); font-size:14px;">
                    <button type="button" class="qty-plus" data-cart-id="${escHtml(item.id)}" data-qty="${item.quantity}" data-max="${product ? product.stock_quantity : 99}">+</button>
                </div>
            </td>
            <td class="price">₹${formatPrice(lineTotal)}</td>
            <td>
                <a href="#" class="cart-remove" data-cart-id="${escHtml(item.id)}" title="Remove">
                    <i class="fa-solid fa-trash"></i>
                </a>
            </td>`;

        tbody.appendChild(tr);

    });

    // Delivery: free above 999
    const delivery = subtotal >= 999 ? 0 : 99;
    const total    = subtotal + delivery;

    setText("summarySubtotal", `₹${formatPrice(subtotal)}`);
    setText("summaryDelivery", delivery === 0 ? "Free" : `₹${delivery}`);
    setText("summaryTotal",    `₹${formatPrice(total)}`);

    attachRowListeners();

}


/*
==========================================
Attach listeners to +/−/remove buttons
==========================================
*/

function attachRowListeners() {

    document.querySelectorAll(".qty-minus").forEach(btn => {
        btn.addEventListener("click", () => {
            const cartId = btn.dataset.cartId;
            const item   = cartItems.find(i => i.id === cartId);
            if (!item) return;
            if (item.quantity <= 1) {
                removeCartItem(cartId);
            } else {
                updateQuantity(cartId, item.quantity - 1);
            }
        });
    });

    document.querySelectorAll(".qty-plus").forEach(btn => {
        btn.addEventListener("click", () => {
            const cartId = btn.dataset.cartId;
            const item   = cartItems.find(i => i.id === cartId);
            if (!item) return;
            const max = parseInt(btn.dataset.max || "999", 10);
            if (item.quantity >= max) {
                alert("Maximum stock reached.");
                return;
            }
            updateQuantity(cartId, item.quantity + 1);
        });
    });

    document.querySelectorAll(".cart-remove").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const cartId = link.dataset.cartId;
            if (confirm("Remove this item from your cart?")) {
                removeCartItem(cartId);
            }
        });
    });

}


/*
==========================================
Update Quantity
PUT /api/cart/{cart_id}  { quantity }
Backend expects absolute quantity value
==========================================
*/

async function updateQuantity(cartId, newQty) {

    try {

        await api.put(`/api/cart/${cartId}`, { quantity: newQty }, true);

        // Update local state without full reload
        const item = cartItems.find(i => i.id === cartId);
        if (item) item.quantity = newQty;

        renderCart();

    } catch (err) {

        alert(err.message || "Could not update quantity.");

    }

}


/*
==========================================
Remove Cart Item
DELETE /api/cart/{cart_id}
==========================================
*/

async function removeCartItem(cartId) {

    try {

        await api.delete(`/api/cart/${cartId}`, true);

        cartItems = cartItems.filter(i => i.id !== cartId);

        renderCart();

    } catch (err) {

        alert(err.message || "Could not remove item.");

    }

}


/*
==========================================
UI helpers
==========================================
*/

function showLoading(visible) {
    const loading = document.getElementById("cartLoading");
    if (loading) loading.style.display = visible ? "block" : "none";
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
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