/*
==========================================
CloudCrackers
checkout.js
Checkout Module
==========================================
*/

let cartItems  = [];
let productMap = {};


document.addEventListener("DOMContentLoaded", () => {

    requireAuth();

    loadOrderSummary();

    initializeCheckoutForm();

    initializePaymentToggle();

    prefillFromProfile();

});


function requireAuth() {
    if (!localStorage.getItem(TOKEN_KEY)) {
        window.location.href = "login.html";
    }
}


/*
==========================================
Load Order Summary
Fetches cart + products in parallel to
show mini-cart and totals in the sidebar.
Backend creates the actual order from cart
server-side; we only preview here.
==========================================
*/

async function loadOrderSummary() {

    try {

        const [cart, products] = await Promise.all([
            api.get("/api/cart/", true),
            api.get("/api/products/")
        ]);

        cartItems = cart || [];

        productMap = {};
        (products || []).forEach(p => { productMap[p.id] = p; });

        if (cartItems.length === 0) {
            showAlert("Your cart is empty. Add items before checking out.");
            document.getElementById("placeOrderBtn").disabled = true;
            document.getElementById("checkoutMiniCart").innerHTML =
                '<p class="muted-text">No items in cart.</p>';
            return;
        }

        renderSummary();

    } catch (err) {

        showAlert(err.message || "Could not load cart summary.");

    }

}


function renderSummary() {

    const miniCart = document.getElementById("checkoutMiniCart");
    if (!miniCart) return;

    miniCart.innerHTML = "";

    let subtotal = 0;

    cartItems.forEach(item => {
        const product  = productMap[item.product_id];
        const name     = product ? product.product_name : "Product";
        const price    = product ? parseFloat(product.price) : 0;
        const lineTotal = price * item.quantity;
        subtotal += lineTotal;

        const div = document.createElement("div");
        div.className = "mini-cart-item";
        div.innerHTML = `
            <span>${escHtml(name)} × ${item.quantity}</span>
            <span>₹${formatPrice(lineTotal)}</span>`;
        miniCart.appendChild(div);
    });

    const delivery = subtotal >= 999 ? 0 : 99;
    const total    = subtotal + delivery;

    setText("subtotal",   `₹${formatPrice(subtotal)}`);
    setText("shipping",   delivery === 0 ? "Free" : `₹${delivery}`);
    setText("grandTotal", `₹${formatPrice(total)}`);
    setText("cartCount",  cartItems.length);

}


/*
==========================================
Pre-fill shipping from profile
GET /api/users/me (non-blocking)
==========================================
*/

async function prefillFromProfile() {

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    try {

        const user = await api.get("/api/users/me", true);

        if (user.first_name) setValue("firstName", user.first_name);
        if (user.last_name)  setValue("lastName",  user.last_name);
        if (user.phone)      setValue("phone",      user.phone);

    } catch { /* non-critical */ }

}


/*
==========================================
Payment option toggle styling
==========================================
*/

function initializePaymentToggle() {

    document.querySelectorAll("input[name='pay']").forEach(radio => {
        radio.addEventListener("change", () => {
            document.querySelectorAll(".payment-option").forEach(opt => {
                opt.classList.remove("selected");
            });
            radio.closest(".payment-option").classList.add("selected");
        });
    });

}


/*
==========================================
Checkout Form Submit
==========================================
*/

function initializeCheckoutForm() {

    const form = document.getElementById("checkoutForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        await placeOrder();
    });

}


/*
==========================================
Place Order
Step 1: POST /api/orders/ { shipping_address }
Step 2: If online → POST /api/payments/create { order_id }
         then open Razorpay
         then POST /api/payments/verify
        If COD → redirect to orders page
==========================================
*/

async function placeOrder() {

    const firstName  = getValue("firstName");
    const lastName   = getValue("lastName");
    const street     = getValue("streetAddress");
    const city       = getValue("city");
    const state      = getValue("state");
    const pincode    = getValue("pincode");
    const phone      = getValue("phone");

    if (!firstName || !street || !city || !pincode || !phone) {
        showAlert("Please fill in all required fields.");
        return;
    }

    // Build shipping_address string (backend expects a single string)
    const shippingAddress =
        `${firstName} ${lastName}, ${street}, ${city}, ${state} - ${pincode}. Phone: ${phone}`;

    const paymentMethod = document.querySelector("input[name='pay']:checked")?.value || "online";

    const btn = document.getElementById("placeOrderBtn");
    btn.classList.add("is-loading");
    btn.disabled = true;

    hideAlert();

    try {

        // Step 1 — create order from cart
        const order = await api.post(
            "/api/orders/",
            { shipping_address: shippingAddress },
            true
        );

        if (paymentMethod === "cod") {

            // COD — no payment step needed
            btn.classList.remove("is-loading");
            btn.disabled = false;
            window.location.href = `orders.html?order_id=${order.id}&method=cod`;

        } else {

            // Online — create Razorpay order, then open SDK
            await initiateRazorpay(order);

        }

    } catch (err) {

        btn.classList.remove("is-loading");
        btn.disabled = false;
        showAlert(err.message || "Could not place order. Please try again.");

    }

}


/*
==========================================
Razorpay Payment Flow
POST /api/payments/create { order_id }
Opens Razorpay checkout
POST /api/payments/verify on success
==========================================
*/

async function initiateRazorpay(order) {

    const btn = document.getElementById("placeOrderBtn");

    try {

        // Create payment with backend (gets Razorpay order id + key)
        const payment = await api.post(
            "/api/payments/create",
            { order_id: order.id },
            true
        );

        // Dynamically load Razorpay SDK
        await loadScript("https://checkout.razorpay.com/v1/checkout.js");

        const options = {
            key: payment.key_id || "",
            amount: payment.amount,
            currency: payment.currency || "INR",
            name: "CloudCrackers",
            description: `Order ${order.id.slice(0, 8).toUpperCase()}`,
            order_id: payment.razorpay_order_id,
            handler: async (response) => {
                await verifyPayment(order.id, response);
            },
            prefill: {
                name:  getValue("firstName") + " " + getValue("lastName"),
                contact: getValue("phone")
            },
            theme: { color: "#F2B705" },
            modal: {
                ondismiss: () => {
                    btn.classList.remove("is-loading");
                    btn.disabled = false;
                    showAlert("Payment was cancelled. Your order is saved — you can pay from Orders.");
                }
            }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();

    } catch (err) {

        btn.classList.remove("is-loading");
        btn.disabled = false;
        // If Razorpay setup fails, order is already created — tell user
        showAlert(
            "Payment gateway error. Your order is placed — you can pay from My Orders. " +
            (err.message || "")
        );

    }

}


/*
==========================================
Verify Payment
POST /api/payments/verify
==========================================
*/

async function verifyPayment(orderId, razorpayResponse) {

    try {

        await api.post(
            "/api/payments/verify",
            {
                razorpay_order_id:   razorpayResponse.razorpay_order_id,
                razorpay_payment_id: razorpayResponse.razorpay_payment_id,
                razorpay_signature:  razorpayResponse.razorpay_signature
            },
            true
        );

        window.location.href = `orders.html?order_id=${orderId}&payment=success`;

    } catch (err) {

        showAlert("Payment verification failed. Contact support with order ID: " + orderId);

    }

}


/*
==========================================
Utility — load external script dynamically
==========================================
*/

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const s = document.createElement("script");
        s.src = src;
        s.onload  = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}


/*
==========================================
UI helpers
==========================================
*/

function showAlert(msg) {
    const alert = document.getElementById("checkoutAlert");
    const msgEl = document.getElementById("checkoutAlertMsg");
    if (!alert || !msgEl) return;
    msgEl.textContent = msg;
    alert.style.display = "flex";
    alert.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideAlert() {
    const alert = document.getElementById("checkoutAlert");
    if (alert) alert.style.display = "none";
}

function getText(id) {
    return document.getElementById(id)?.textContent || "";
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

function getValue(id) {
    return document.getElementById(id)?.value.trim() || "";
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