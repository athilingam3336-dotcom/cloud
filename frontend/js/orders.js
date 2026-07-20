/*
==========================================
CloudCrackers
orders.js
Orders Module
==========================================
*/

let allOrders  = [];
let activeFilter = "ALL";
let productMap = {};


document.addEventListener("DOMContentLoaded", () => {

    requireAuth();

    checkSuccessBanner();

    loadOrders();

    initTabs();

    document.getElementById("closeModal")?.addEventListener("click", closeModal);

    window.addEventListener("click", (e) => {
        const modal = document.getElementById("orderDetailModal");
        if (modal && e.target === modal) closeModal();
    });

});


function requireAuth() {
    if (!localStorage.getItem(TOKEN_KEY)) {
        window.location.href = "login.html";
    }
}


/*
==========================================
Show success banner if redirected from checkout
==========================================
*/

function checkSuccessBanner() {

    const params  = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");
    const payment = params.get("payment");
    const method  = params.get("method");

    if (!orderId) return;

    const banner = document.getElementById("orderSuccessBanner");
    const msg    = document.getElementById("orderSuccessMsg");

    if (!banner || !msg) return;

    if (payment === "success") {
        msg.textContent = "Payment successful! Your order has been placed.";
    } else if (method === "cod") {
        msg.textContent = "Order placed! You'll pay cash on delivery.";
    } else {
        msg.textContent = "Order placed successfully!";
    }

    banner.style.display = "block";

}


/*
==========================================
Load Orders
GET /api/orders/
Also prefetch products for item name lookup
==========================================
*/

async function loadOrders() {

    showLoading(true);

    try {

        const [orders, products] = await Promise.all([
            api.get("/api/orders/", true),
            api.get("/api/products/")
        ]);

        allOrders = (orders || []).sort((a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        );

        productMap = {};
        (products || []).forEach(p => { productMap[p.id] = p; });

        showLoading(false);
        renderOrders();

    } catch (err) {

        showLoading(false);
        alert(err.message || "Could not load orders.");

    }

}


/*
==========================================
Render Orders
Filtered by activeFilter tab
==========================================
*/

function renderOrders() {

    const container = document.getElementById("ordersContainer");
    const empty     = document.getElementById("ordersEmpty");

    if (!container) return;

    const filtered = activeFilter === "ALL"
        ? allOrders
        : allOrders.filter(o => o.order_status === activeFilter);

    container.innerHTML = "";

    if (filtered.length === 0) {
        container.style.display  = "none";
        if (empty) empty.style.display = "block";
        return;
    }

    if (empty) empty.style.display = "none";
    container.style.display = "block";

    filtered.forEach(order => {

        const statusClass = statusPillClass(order.order_status);
        const date        = formatDate(order.created_at);
        const shortId     = order.id.slice(0, 8).toUpperCase();
        const canCancel   = ["PENDING", "CONFIRMED"].includes(order.order_status);

        const card = document.createElement("div");
        card.className = "card";
        card.style.marginBottom = "18px";
        card.innerHTML = `
            <div class="order-card">
                <div>
                    <div class="order-id">Order #CC-${shortId}</div>
                    <div class="order-date">Placed on ${date}</div>
                </div>
                <span class="status-pill ${statusClass}">${order.order_status}</span>
                <span class="price">₹${formatPrice(order.total_amount)}</span>
                <div style="display:flex; gap:8px;">
                    <button class="btn btn-outline btn-sm view-order-btn"
                            data-order-id="${escHtml(order.id)}">
                        View Details
                    </button>
                    ${canCancel ? `
                    <button class="btn btn-outline btn-sm cancel-order-btn"
                            data-order-id="${escHtml(order.id)}"
                            style="color:var(--ember); border-color:var(--ember);">
                        Cancel
                    </button>` : ""}
                </div>
            </div>`;

        container.appendChild(card);

    });

    attachOrderListeners();

}


/*
==========================================
Attach row button listeners
==========================================
*/

function attachOrderListeners() {

    document.querySelectorAll(".view-order-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            openOrderDetail(btn.dataset.orderId);
        });
    });

    document.querySelectorAll(".cancel-order-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            if (confirm("Are you sure you want to cancel this order?")) {
                cancelOrder(btn.dataset.orderId);
            }
        });
    });

}


/*
==========================================
Open Order Detail Modal
GET /api/orders/{id}/items
==========================================
*/

async function openOrderDetail(orderId) {

    const modal   = document.getElementById("orderDetailModal");
    const content = document.getElementById("orderDetailContent");

    if (!modal || !content) return;

    modal.style.display = "flex";
    content.innerHTML   = `
        <div style="text-align:center; padding:40px;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size:28px; color:var(--gold);"></i>
        </div>`;

    try {

        const [order, items] = await Promise.all([
            api.get(`/api/orders/${orderId}`, true),
            api.get(`/api/orders/${orderId}/items`, true)
        ]);

        const shortId  = order.id.slice(0, 8).toUpperCase();
        const statusCl = statusPillClass(order.order_status);

        let itemsHtml = "";
        items.forEach(item => {
            const product = productMap[item.product_id];
            const name    = product ? product.product_name : `Product (${item.product_id.slice(0,8)})`;
            itemsHtml += `
                <div class="mini-cart-item">
                    <span>${escHtml(name)} × ${item.quantity}</span>
                    <span>₹${formatPrice(item.price * item.quantity)}</span>
                </div>`;
        });

        content.innerHTML = `
            <h3 style="margin-bottom:6px;">Order #CC-${shortId}</h3>
            <p class="muted-text" style="margin-bottom:16px;">Placed on ${formatDate(order.created_at)}</p>

            <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:20px;">
                <span class="status-pill ${statusCl}">${order.order_status}</span>
                <span class="status-pill" style="background:rgba(77,208,225,0.15); color:var(--spark-cyan);">
                    Payment: ${order.payment_status}
                </span>
            </div>

            <h4 style="margin-bottom:12px;">Items</h4>
            ${itemsHtml || '<p class="muted-text">No items found.</p>'}

            <div style="border-top:1px solid var(--sky-line); padding-top:16px; margin-top:16px;">
                <div class="summary-row total">
                    <span>Order Total</span>
                    <span class="price">₹${formatPrice(order.total_amount)}</span>
                </div>
            </div>

            <h4 style="margin-top:20px; margin-bottom:8px;">Shipping Address</h4>
            <p class="muted-text" style="font-size:13.5px;">${escHtml(order.shipping_address)}</p>
        `;

    } catch (err) {

        content.innerHTML = `
            <div class="alert alert-error">
                <i class="fa-solid fa-circle-exclamation"></i>
                <span>${escHtml(err.message || "Could not load order details.")}</span>
            </div>`;

    }

}

function closeModal() {
    const modal = document.getElementById("orderDetailModal");
    if (modal) modal.style.display = "none";
}


/*
==========================================
Cancel Order
PUT /api/orders/cancel/{order_id}
==========================================
*/

async function cancelOrder(orderId) {

    try {

        await api.put(`/api/orders/cancel/${orderId}`, {}, true);

        // Update local state
        const order = allOrders.find(o => o.id === orderId);
        if (order) order.order_status = "CANCELLED";

        renderOrders();

    } catch (err) {

        alert(err.message || "Could not cancel order.");

    }

}


/*
==========================================
Tab filter
==========================================
*/

function initTabs() {

    document.querySelectorAll("#orderTabs a").forEach(tab => {
        tab.addEventListener("click", (e) => {
            e.preventDefault();
            document.querySelectorAll("#orderTabs a").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            activeFilter = tab.dataset.filter;
            renderOrders();
        });
    });

}


/*
==========================================
Helpers
==========================================
*/

function showLoading(visible) {
    const el = document.getElementById("ordersLoading");
    if (el) el.style.display = visible ? "block" : "none";
}

function statusPillClass(status) {
    const map = {
        PENDING:    "status-pending",
        CONFIRMED:  "status-processing",
        PROCESSING: "status-processing",
        SHIPPED:    "status-processing",
        DELIVERED:  "status-delivered",
        CANCELLED:  "status-cancelled"
    };
    return map[status] || "status-pending";
}

function formatDate(isoString) {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric"
    });
}

function formatPrice(value) {
    return Number(value).toLocaleString("en-IN", {
        minimumFractionDigits: 0, maximumFractionDigits: 2
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