/*
==========================================
CloudCrackers
admin-orders.js
Orders Management Module
==========================================
*/

// State Management
let orders = [];
let productsMap = new Map();
let usersMap = new Map();
let filteredOrders = [];
let currentStatusFilter = "";
let currentPage = 1;
const pageSize = 10;
let selectedOrder = null;

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

    // Modal elements bindings
    const orderDetailModal = document.getElementById("orderDetailModal");
    const closeOrderModal = document.getElementById("closeOrderModal");
    const closeOrderBtn = document.getElementById("closeOrderBtn");
    const updateStatusBtn = document.getElementById("updateStatusBtn");

    closeOrderModal.addEventListener("click", () => closeModal());
    closeOrderBtn.addEventListener("click", () => closeModal());
    updateStatusBtn.addEventListener("click", handleStatusUpdate);

    // Filters bindings
    document.getElementById("searchOrders").addEventListener("input", filterAndRender);
    document.getElementById("sortOrders").addEventListener("change", filterAndRender);

    // Setup tabs listener
    const tabLinks = document.querySelectorAll(".tab-link");
    tabLinks.forEach(tab => {
        tab.addEventListener("click", (e) => {
            e.preventDefault();
            tabLinks.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            currentStatusFilter = tab.getAttribute("data-status");
            filterAndRender();
        });
    });

    // Initial load
    await loadInitialData();
});

// Load reference mappings (Products + Users) & Orders
async function loadInitialData() {
    try {
        showLoadingState();

        // 1. Load Products Map
        try {
            const products = await api.get("/api/products/", true);
            products.forEach(p => productsMap.set(p.id, p));
        } catch (err) {
            console.warn("Failed to load products list:", err);
        }

        // 2. Load Users Map
        try {
            const users = await api.get("/api/users", true);
            users.forEach(u => usersMap.set(u.id, u));
        } catch (err) {
            console.warn("Failed to load users list (using fallback values):", err);
        }

        // 3. Load Orders
        await fetchOrders();
    } catch (error) {
        console.error("Initial load failed:", error);
        showToast("Failed to load reference mappings.", "error");
        if (error.status === 401) logout();
    }
}

async function fetchOrders() {
    try {
        orders = await api.get("/api/orders/", true);
        filterAndRender();
    } catch (error) {
        console.error("Fetching orders failed:", error);
        showToast("Error loading orders list.", "error");
    }
}

function showLoadingState() {
    const tableBody = document.getElementById("ordersTableBody");
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:32px;">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size:24px; color:var(--gold);"></i>
                    <div style="margin-top:8px; color:var(--muted);">Loading orders...</div>
                </td>
            </tr>
        `;
    }
}

// Search, Filter, Sort, and Paginate Orders
async function filterAndRender() {
    const searchVal = document.getElementById("searchOrders").value.toLowerCase().trim();
    const sortVal = document.getElementById("sortOrders").value;

    // 1. Status Filter & Search
    filteredOrders = orders.filter(order => {
        const matchesStatus = !currentStatusFilter || order.order_status === currentStatusFilter;

        const customerName = usersMap.get(order.user_id) 
            ? `${usersMap.get(order.user_id).first_name} ${usersMap.get(order.user_id).last_name}`.toLowerCase()
            : "";
        const orderId = order.id.toLowerCase();
        const address = order.shipping_address ? order.shipping_address.toLowerCase() : "";

        const matchesSearch = !searchVal || 
            orderId.includes(searchVal) || 
            customerName.includes(searchVal) ||
            address.includes(searchVal);

        return matchesStatus && matchesSearch;
    });

    // 2. Sorting
    if (sortVal === "newest") {
        filteredOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sortVal === "oldest") {
        filteredOrders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (sortVal === "amount-high") {
        filteredOrders.sort((a, b) => b.total_amount - a.total_amount);
    } else if (sortVal === "amount-low") {
        filteredOrders.sort((a, b) => a.total_amount - b.total_amount);
    }

    currentPage = 1;
    await renderOrdersTable();
}

// Render Table Rows
async function renderOrdersTable() {
    const tableBody = document.getElementById("ordersTableBody");
    if (!tableBody) return;

    if (filteredOrders.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--muted);">No orders found.</td></tr>`;
        renderPagination(0);
        return;
    }

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = filteredOrders.slice(start, end);

    tableBody.innerHTML = "";

    // Show dynamic orders list
    for (const order of pageItems) {
        const tr = document.createElement("tr");

        const dateObj = new Date(order.created_at);
        const formattedDate = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const statusClass = getStatusClass(order.order_status);

        const customer = usersMap.get(order.user_id);
        const customerName = customer ? `${customer.first_name} ${customer.last_name}` : `User (${order.user_id.substring(0, 8)})`;

        // Fetch order items count lazily/cached or fallback to placeholder
        let itemsCount = "...";
        try {
            // We fetch the count from order items endpoint or fallback to 1
            const items = await api.get(`/api/orders/${order.id}/items`, true);
            if (Array.isArray(items)) {
                itemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
            }
        } catch {
            itemsCount = "1";
        }

        tr.innerHTML = `
            <td>#${order.id.substring(0, 8).toUpperCase()}</td>
            <td><strong>${customerName}</strong></td>
            <td>${itemsCount}</td>
            <td>${formattedDate}</td>
            <td>₹${parseFloat(order.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td><span class="status-pill ${statusClass}">${order.order_status}</span></td>
            <td>
                <div class="table-actions">
                    <button onclick="viewOrderDetails('${order.id}')" title="View Details"><i class="fa-regular fa-eye"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    }

    renderPagination(filteredOrders.length);
}

function getStatusClass(status) {
    const s = status.toUpperCase();
    if (s === "PENDING") return "status-pending";
    if (s === "DELIVERED") return "status-delivered";
    if (s === "CANCELLED") return "status-cancelled";
    return "status-processing"; // for CONFIRMED, PROCESSING, SHIPPED
}

// Render Pagination
function renderPagination(totalItems) {
    const container = document.getElementById("ordersPagination");
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
            renderOrdersTable();
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
            renderOrdersTable();
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
            renderOrdersTable();
        }
    });
    container.appendChild(nextLink);
}

// View Order details modal
window.viewOrderDetails = async function(id) {
    selectedOrder = orders.find(o => o.id === id);
    if (!selectedOrder) return;

    const modal = document.getElementById("orderDetailModal");
    const infoDiv = document.getElementById("modalOrderInfo");
    const itemsBody = document.getElementById("orderItemsBody");
    const selectStatus = document.getElementById("updateStatusSelect");

    // Set initial form state
    selectStatus.value = selectedOrder.order_status;

    // Set header info
    const customer = usersMap.get(selectedOrder.user_id);
    const customerName = customer ? `${customer.first_name} ${customer.last_name}` : "Unknown";
    const customerEmail = customer ? customer.email : "N/A";
    const customerPhone = customer ? (customer.phone || "N/A") : "N/A";
    
    const dateObj = new Date(selectedOrder.created_at);
    const formattedDate = dateObj.toLocaleString('en-IN');

    infoDiv.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:13px;">
            <div>
                <p><strong>Order ID:</strong> #${selectedOrder.id.toUpperCase()}</p>
                <p><strong>Date & Time:</strong> ${formattedDate}</p>
                <p><strong>Total Amount:</strong> ₹${parseFloat(selectedOrder.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                <p><strong>Payment Status:</strong> <span style="font-weight:600; color: ${selectedOrder.payment_status === 'PAID' ? '#3DDC97' : 'var(--gold)'};">${selectedOrder.payment_status}</span></p>
            </div>
            <div>
                <p><strong>Customer:</strong> ${customerName}</p>
                <p><strong>Email:</strong> ${customerEmail}</p>
                <p><strong>Phone:</strong> ${customerPhone}</p>
                <p><strong>Shipping Address:</strong> ${selectedOrder.shipping_address}</p>
            </div>
        </div>
    `;

    // Fetch and show items
    itemsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:16px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading items...</td></tr>`;
    
    try {
        const items = await api.get(`/api/orders/${selectedOrder.id}/items`, true);
        itemsBody.innerHTML = "";
        
        if (!items || items.length === 0) {
            itemsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:10px; color:var(--muted);">No items found.</td></tr>`;
        } else {
            items.forEach(item => {
                const tr = document.createElement("tr");
                const product = productsMap.get(item.product_id);
                const prodName = product ? product.product_name : `Product (${item.product_id.substring(0,8)})`;
                const totalItemPrice = item.price * item.quantity;
                
                tr.innerHTML = `
                    <td>${prodName}</td>
                    <td>₹${parseFloat(item.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>${item.quantity}</td>
                    <td>₹${parseFloat(totalItemPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                `;
                itemsBody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error("Failed to load order items:", err);
        itemsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:10px; color:var(--ember);">Error loading items.</td></tr>`;
    }

    modal.style.display = "flex";
};

// Close modal
function closeModal() {
    const modal = document.getElementById("orderDetailModal");
    modal.style.display = "none";
    selectedOrder = null;
}

// Update status handler
async function handleStatusUpdate() {
    if (!selectedOrder) return;

    const selectStatus = document.getElementById("updateStatusSelect");
    const newStatus = selectStatus.value;

    try {
        await api.put(`/api/orders/status/${selectedOrder.id}`, { order_status: newStatus }, true);
        showToast("Order status updated successfully!");
        closeModal();
        await fetchOrders();
    } catch (error) {
        console.error("Failed to update status:", error);
        showToast(error.message || "Failed to update order status.", "error");
    }
}
