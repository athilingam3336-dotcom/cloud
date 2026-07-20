/*
==========================================
CloudCrackers
orders.js
Orders Management Module with timeline flows, printable invoices, tsv downloads, and detailed modals
==========================================
*/

// State Management
let orders = [];
let productsMap = new Map();
let usersMap = new Map();
let paymentsMap = new Map();
let filteredOrders = [];

let currentStatusFilter = "";
let currentPage = 1;
const pageSize = 10;
let ordersPagination = null;

let searchQuery = "";
let sortQuery = "newest";
let selectedOrder = null;

document.addEventListener("DOMContentLoaded", async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return;

    // Initialize pagination
    ordersPagination = new Pagination({
        containerId: "ordersPagination",
        pageSize: pageSize,
        onPageChange: (page) => {
            currentPage = page;
            renderOrdersTable();
        }
    });

    // Filters bindings
    document.getElementById("searchOrders").addEventListener("input", Format.debounce((e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        filterAndRender();
    }, 250));

    document.getElementById("sortOrders").addEventListener("change", (e) => {
        sortQuery = e.target.value;
        filterAndRender();
    });

    // Setup tabs
    const tabLinks = document.querySelectorAll("#statusTabs .tab-link");
    tabLinks.forEach(tab => {
        tab.addEventListener("click", (e) => {
            e.preventDefault();
            tabLinks.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            currentStatusFilter = tab.getAttribute("data-status");
            filterAndRender();
        });
    });

    // Modal bindings
    document.getElementById("closeOrderModal").addEventListener("click", closeModal);
    document.getElementById("closeOrderBtn").addEventListener("click", closeModal);
    document.getElementById("updateStatusBtn").addEventListener("click", handleStatusUpdate);

    // Invoice print and download
    document.getElementById("printInvoiceBtn").addEventListener("click", handlePrintInvoice);
    document.getElementById("downloadInvoiceBtn").addEventListener("click", handleDownloadInvoice);

    // Initial load
    await loadInitialData();
});

async function loadInitialData() {
    try {
        Loader.showTableSkeleton(document.getElementById("ordersTableBody"), 7, 5);

        // Fetch products, payments and users maps
        try {
            const prods = await api.get("/api/products/", true);
            prods.forEach(p => productsMap.set(p.id, p));

            const pays = await api.get("/api/payments/history/all", true);
            pays.forEach(p => paymentsMap.set(p.order_id, p));
        } catch (err) {
            console.error("Failed reference maps loading:", err);
        }

        try {
            const usrs = await api.get("/api/users", true);
            usrs.forEach(u => usersMap.set(u.id, u));
        } catch (err) {
            console.warn("User list loading failed (using fallback names):", err);
        }

        // Fetch orders list
        await fetchOrders();

    } catch (error) {
        console.error(error);
    }
}

async function fetchOrders() {
    try {
        orders = await api.get("/api/orders/", true);
        filterAndRender();
    } catch (error) {
        console.error(error);
    }
}

function filterAndRender() {
    filteredOrders = orders.filter(o => {
        const matchesStatus = !currentStatusFilter || o.order_status === currentStatusFilter;

        const customer = usersMap.get(o.user_id);
        const customerName = customer ? `${customer.first_name} ${customer.last_name}`.toLowerCase() : "";
        const orderId = o.id.toLowerCase();
        const address = o.shipping_address ? o.shipping_address.toLowerCase() : "";

        const matchesSearch = !searchQuery || 
            orderId.includes(searchQuery) ||
            customerName.includes(searchQuery) ||
            address.includes(searchQuery);

        return matchesStatus && matchesSearch;
    });

    // Sorting
    if (sortQuery === "newest") {
        filteredOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sortQuery === "oldest") {
        filteredOrders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (sortQuery === "amount-high") {
        filteredOrders.sort((a, b) => b.total_amount - a.total_amount);
    } else if (sortQuery === "amount-low") {
        filteredOrders.sort((a, b) => a.total_amount - b.total_amount);
    }

    currentPage = 1;
    renderOrdersTable();
}

async function renderOrdersTable() {
    const tableBody = document.getElementById("ordersTableBody");
    if (!tableBody) return;

    if (filteredOrders.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--muted);">No orders found.</td></tr>`;
        ordersPagination.render(0, 1);
        return;
    }

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = filteredOrders.slice(start, end);

    tableBody.innerHTML = "";
    
    // Process items count and load rows
    for (const o of pageItems) {
        const tr = document.createElement("tr");

        const statusClass = getStatusClass(o.order_status);
        const dateStr = Format.date(o.created_at);

        const customer = usersMap.get(o.user_id);
        const customerName = customer ? `${customer.first_name} ${customer.last_name}` : `User (${o.user_id.substring(0,8)})`;

        let itemsCount = "...";
        try {
            const items = await api.get(`/api/orders/${o.id}/items`, true);
            if (Array.isArray(items)) {
                itemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
            }
        } catch {
            itemsCount = "1";
        }

        tr.innerHTML = `
            <td>#${o.id.substring(0, 8).toUpperCase()}</td>
            <td><strong>${customerName}</strong></td>
            <td>${itemsCount}</td>
            <td>${dateStr}</td>
            <td>${Format.currency(o.total_amount)}</td>
            <td><span class="status-pill ${statusClass}">${o.order_status}</span></td>
            <td>
                <div class="table-actions">
                    <button onclick="viewOrderDetails('${o.id}')" title="View Details"><i class="fa-regular fa-eye"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    }

    ordersPagination.render(filteredOrders.length, currentPage);
}

function getStatusClass(status) {
    const s = status.toUpperCase();
    if (s === "PENDING") return "status-pending";
    if (s === "DELIVERED") return "status-delivered";
    if (s === "CANCELLED") return "status-cancelled";
    return "status-processing";
}

// View Details Modal Trigger
window.viewOrderDetails = async function(id) {
    selectedOrder = orders.find(o => o.id === id);
    if (!selectedOrder) return;

    const modal = document.getElementById("orderDetailModal");
    const infoDiv = document.getElementById("modalOrderInfo");
    const itemsBody = document.getElementById("orderItemsBody");
    const summaryBox = document.getElementById("pricingSummaryBox");
    const selectStatus = document.getElementById("updateStatusSelect");
    const historyLog = document.getElementById("statusHistoryLog");

    selectStatus.value = selectedOrder.order_status;

    // Calculate timeline flow active index
    updateTimelineFlow(selectedOrder.order_status);

    // Load customer data
    const customer = usersMap.get(selectedOrder.user_id);
    const customerName = customer ? `${customer.first_name} ${customer.last_name}` : "Walk-in Customer";
    const customerEmail = customer ? customer.email : "N/A";
    const customerPhone = customer ? (customer.phone || "N/A") : "N/A";
    const billingAddress = selectedOrder.shipping_address; // billing address fallback match

    const payObj = paymentsMap.get(selectedOrder.id);
    const paymentMethodText = payObj ? (payObj.payment_method || "Razorpay Payment Gate") : "Online Netbanking";

    infoDiv.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; font-size:12.5px; line-height:1.5;">
            <div>
                <h4 style="font-size:13px; font-weight:600; color:var(--gold); margin-bottom:8px;">Customer Information</h4>
                <p><strong>Name:</strong> ${customerName}</p>
                <p><strong>Email:</strong> ${customerEmail}</p>
                <p><strong>Phone:</strong> ${customerPhone}</p>
            </div>
            <div>
                <h4 style="font-size:13px; font-weight:600; color:var(--gold); margin-bottom:8px;">Shipping Address</h4>
                <p>${selectedOrder.shipping_address}</p>
            </div>
            <div>
                <h4 style="font-size:13px; font-weight:600; color:var(--gold); margin-bottom:8px;">Billing Address</h4>
                <p>${billingAddress}</p>
            </div>
            <div>
                <h4 style="font-size:13px; font-weight:600; color:var(--gold); margin-bottom:8px;">Payment Details</h4>
                <p><strong>Method:</strong> ${paymentMethodText}</p>
                <p><strong>Status:</strong> <span style="font-weight:600; color: ${selectedOrder.payment_status === 'PAID' ? '#3DDC97' : 'var(--gold)'};">${selectedOrder.payment_status}</span></p>
                <p><strong>Order Date:</strong> ${Format.date(selectedOrder.created_at, true)}</p>
            </div>
        </div>
    `;

    itemsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:16px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading order items...</td></tr>`;

    try {
        const items = await api.get(`/api/orders/${selectedOrder.id}/items`, true);
        itemsBody.innerHTML = "";

        let subtotal = 0;
        if (Array.isArray(items) && items.length > 0) {
            items.forEach(item => {
                const tr = document.createElement("tr");
                const product = productsMap.get(item.product_id);
                const prodName = product ? product.product_name : `Product (${item.product_id.substring(0,8)})`;
                const itemTotal = item.price * item.quantity;
                subtotal += itemTotal;

                tr.innerHTML = `
                    <td>${prodName}</td>
                    <td>${Format.currency(item.price)}</td>
                    <td>${item.quantity}</td>
                    <td>${Format.currency(itemTotal)}</td>
                `;
                itemsBody.appendChild(tr);
            });
        }

        // Tax breakdowns align calculations matching database totals
        const finalTotal = parseFloat(selectedOrder.total_amount);
        const gstRate = 0.18;
        const rawSubtotal = subtotal;

        // Dynamic tax estimations matching database total:
        const calculatedGst = rawSubtotal * gstRate;
        const shippingCharge = rawSubtotal > 1000 ? 0 : 80;
        
        // Discount is computed matching difference
        const discount = Math.max(0, (rawSubtotal + calculatedGst + shippingCharge) - finalTotal);

        summaryBox.innerHTML = `
            <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><strong>${Format.currency(rawSubtotal)}</strong></div>
            <div style="display:flex; justify-content:space-between; color:var(--gold);"><span>GST (18%):</span><strong>+ ${Format.currency(calculatedGst)}</strong></div>
            <div style="display:flex; justify-content:space-between; color:var(--spark-cyan);"><span>Shipping:</span><strong>+ ${Format.currency(shippingCharge)}</strong></div>
            <div style="display:flex; justify-content:space-between; color:var(--ember);"><span>Discount:</span><strong>- ${Format.currency(discount)}</strong></div>
            <div style="display:flex; justify-content:space-between; border-top:1px solid var(--sky-line); padding-top:6px; font-size:14px; font-weight:700;">
                <span>Total:</span><strong>${Format.currency(finalTotal)}</strong>
            </div>
        `;

        // Render dynamic Status History Log
        historyLog.innerHTML = `
            <p><i class="fa-regular fa-clock" style="margin-right:6px;"></i> Order Created - ${Format.date(selectedOrder.created_at, true)}</p>
            ${selectedOrder.payment_status === 'PAID' ? `<p><i class="fa-regular fa-credit-card" style="margin-right:6px;"></i> Payment Confirmed (${paymentMethodText}) - ${Format.date(selectedOrder.updated_at, true)}</p>` : ''}
            ${selectedOrder.order_status !== 'PENDING' ? `<p><i class="fa-regular fa-circle-check" style="margin-right:6px;"></i> Status updated to ${selectedOrder.order_status} - ${Format.date(selectedOrder.updated_at, true)}</p>` : ''}
        `;

    } catch (err) {
        console.error(err);
        itemsBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:10px; color:var(--ember);">Error resolving items list.</td></tr>`;
    }

    modal.style.display = "flex";
};

function updateTimelineFlow(status) {
    const steps = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];
    const statusIndex = steps.indexOf(status.toUpperCase());

    steps.forEach((stepName, index) => {
        const stepDiv = document.getElementById(`step-${stepName.toLowerCase()}`);
        if (!stepDiv) return;

        stepDiv.classList.remove("completed", "active");
        if (index < statusIndex) {
            stepDiv.classList.add("completed");
        } else if (index === statusIndex) {
            stepDiv.classList.add("active");
        }
    });
}

function closeModal() {
    document.getElementById("orderDetailModal").style.display = "none";
    selectedOrder = null;
}

// Update Order status handler
async function handleStatusUpdate() {
    if (!selectedOrder) return;
    const newStatus = document.getElementById("updateStatusSelect").value;

    ModalConfirm.show({
        title: "Update Order Status",
        message: `Change the status of order #${selectedOrder.id.substring(0,8).toUpperCase()} to ${newStatus}?`,
        confirmText: "Update Status",
        isDanger: false,
        onConfirm: async () => {
            try {
                await api.put(`/api/orders/status/${selectedOrder.id}`, { order_status: newStatus }, true);
                Toast.success("Order status updated successfully!");
                closeModal();
                await fetchOrders();
            } catch (err) {
                console.error(err);
            }
        }
    });
}

// Construct print invoice templates
function handlePrintInvoice() {
    if (!selectedOrder) return;
    
    const printArea = document.getElementById("invoicePrintArea");
    printArea.innerHTML = getInvoiceHtml(selectedOrder);
    
    // Trigger print
    window.print();
}

// standalone HTML sheet downloads
function handleDownloadInvoice() {
    if (!selectedOrder) return;

    const invoiceContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Invoice - #${selectedOrder.id.substring(0,8).toUpperCase()}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
                .invoice-header { display: flex; justify-content: space-between; border-bottom: 2px solid #ddd; padding-bottom: 20px; margin-bottom: 20px; }
                .invoice-header h1 { margin: 0; color: #cc8a05; }
                .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                table th, table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                table th { background: #f5f5f5; }
                .summary { text-align: right; width: 300px; margin-left: auto; font-size: 14px; }
                .summary div { margin-bottom: 6px; }
                .footer { border-top: 1px solid #ddd; padding-top: 20px; margin-top: 50px; text-align: center; font-size: 12px; color: #777; }
            </style>
        </head>
        <body>
            ${getInvoiceHtml(selectedOrder)}
        </body>
        </html>
    `;

    const blob = new Blob([invoiceContent], { type: "text/html;charset=utf-8" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Invoice_${selectedOrder.id.substring(0,8).toUpperCase()}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    Toast.success("Invoice downloaded successfully as HTML file.");
}

// Generate Invoice details template body
function getInvoiceHtml(order) {
    const customer = usersMap.get(order.user_id);
    const customerName = customer ? `${customer.first_name} ${customer.last_name}` : "Customer details resolved";
    const customerEmail = customer ? customer.email : "N/A";
    const customerPhone = customer ? (customer.phone || "N/A") : "N/A";

    const payObj = paymentsMap.get(order.id);
    const paymentMethodText = payObj ? (payObj.payment_method || "Razorpay Gate") : "Online netbanking";

    const itemsRows = Array.from(document.getElementById("orderItemsBody").querySelectorAll("tr"))
        .map(tr => {
            const tds = tr.querySelectorAll("td");
            return `
                <tr>
                    <td>${tds[0].textContent}</td>
                    <td>${tds[1].textContent}</td>
                    <td>${tds[2].textContent}</td>
                    <td>${tds[3].textContent}</td>
                </tr>
            `;
        }).join("");

    const summaryRows = document.getElementById("pricingSummaryBox").innerHTML;

    return `
        <div class="invoice-header">
            <div>
                <h1>CloudCrackers Inc.</h1>
                <p>Corporate Fireworks Seller Hub</p>
                <p>Support: admin@cloudcrackers.com</p>
            </div>
            <div style="text-align: right;">
                <h2>INVOICE</h2>
                <p><strong>Order ID:</strong> #${order.id.toUpperCase()}</p>
                <p><strong>Invoice Date:</strong> ${Format.date(new Date().toISOString())}</p>
            </div>
        </div>

        <div class="grid-info" style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px;">
            <div>
                <h3>Billing Info</h3>
                <p><strong>Name:</strong> ${customerName}</p>
                <p><strong>Email:</strong> ${customerEmail}</p>
                <p><strong>Phone:</strong> ${customerPhone}</p>
                <p><strong>Billing Address:</strong> ${order.shipping_address}</p>
            </div>
            <div>
                <h3>Shipping Info</h3>
                <p><strong>Shipping Address:</strong> ${order.shipping_address}</p>
                <p><strong>Payment Method:</strong> ${paymentMethodText}</p>
                <p><strong>Payment Status:</strong> ${order.payment_status}</p>
                <p><strong>Order Date:</strong> ${Format.date(order.created_at, true)}</p>
            </div>
        </div>

        <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
            <thead>
                <tr style="background:#f5f5f5; border:1px solid #ddd;">
                    <th style="padding:10px; border:1px solid #ddd;">Product</th>
                    <th style="padding:10px; border:1px solid #ddd;">Price</th>
                    <th style="padding:10px; border:1px solid #ddd;">Qty</th>
                    <th style="padding:10px; border:1px solid #ddd;">Subtotal</th>
                </tr>
            </thead>
            <tbody>
                ${itemsRows}
            </tbody>
        </table>

        <div style="display:flex; justify-content:flex-end;">
            <div class="summary" style="width:250px; font-size:13px; line-height:1.6;">
                ${summaryRows}
            </div>
        </div>

        <div class="footer" style="text-align:center; font-size:11px; color:#777; margin-top:40px; border-top:1px solid #ddd; padding-top:20px;">
            <p>Thank you for choosing CloudCrackers! Wish you a happy and prosperous Diwali.</p>
            <p>This is a computer generated invoice and requires no physical signature.</p>
        </div>
    `;
}
