/*
==========================================
CloudCrackers
product-details.js
Product Details Module
==========================================
*/

document.addEventListener("DOMContentLoaded", () => {

    const productId = getProductIdFromUrl();

    if (!productId) {
        showError("No product ID in URL.");
        return;
    }

    loadProduct(productId);

    initQtyStepper();

});


/*
==========================================
Get product ID from ?id= query param
==========================================
*/

function getProductIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
}


/*
==========================================
Load Product
GET /api/products/{id}
GET /api/products/{id}/images
==========================================
*/

async function loadProduct(productId) {

    try {

        const product = await api.get(`/api/products/${productId}`);

        renderProduct(product);

        // Load additional images (non-blocking)
        loadProductImages(productId, product);

        // Load related products from the same category (non-blocking)
        loadRelatedProducts(product.category_id, productId);

        // Update cart badge
        updateCartBadge();

    } catch (err) {

        showError(err.message || "Product could not be loaded.");

    }

}


/*
==========================================
Render Product
Populates all IDs in pd-layout
==========================================
*/

function renderProduct(product) {

    // Show layout, hide loading
    document.getElementById("pdLoading").style.display = "none";
    document.getElementById("pdLayout").style.display = "grid";

    // Breadcrumb
    const breadcrumb = document.getElementById("breadcrumbName");
    if (breadcrumb) breadcrumb.textContent = product.product_name;

    // Page title
    document.title = `${product.product_name} | CloudCrackers`;

    // Name
    setText("pdName", product.product_name);

    // Price with discount calculation
    const discountVal = parseFloat(product.discount || 0);
    const originalPrice = parseFloat(product.price);
    const finalPrice = Math.max(0, originalPrice - discountVal);
    const priceEl = document.getElementById("pdPrice");
    if (priceEl) {
        if (discountVal > 0) {
            priceEl.innerHTML = `₹${formatPrice(finalPrice)} <span style="font-size:16px; text-decoration:line-through; color:var(--muted); margin-left:8px;">₹${formatPrice(originalPrice)}</span>`;
        } else {
            priceEl.innerHTML = `₹${formatPrice(originalPrice)}`;
        }
    }

    // Dynamic metadata (SKU, Weight, Brand)
    const metaList = document.querySelector(".pd-meta");
    if (metaList) {
        const dynamicItems = metaList.querySelectorAll(".dynamic-meta");
        dynamicItems.forEach(item => item.remove());

        const brandLi = document.createElement("li");
        brandLi.className = "dynamic-meta";
        brandLi.innerHTML = `<i class="fa-solid fa-copyright"></i> Brand: <strong style="color:var(--gold); margin-left:4px;">${escHtml(product.brand || 'CloudCrackers')}</strong>`;
        
        const skuLi = document.createElement("li");
        skuLi.className = "dynamic-meta";
        skuLi.innerHTML = `<i class="fa-solid fa-barcode"></i> SKU: <strong style="color:var(--text); margin-left:4px;">${escHtml(product.sku || 'N/A')}</strong>`;

        const weightLi = document.createElement("li");
        weightLi.className = "dynamic-meta";
        weightLi.innerHTML = `<i class="fa-solid fa-weight-hanging"></i> Weight: <strong style="color:var(--text); margin-left:4px;">${escHtml(product.weight || 'N/A')}</strong>`;

        metaList.appendChild(brandLi);
        metaList.appendChild(skuLi);
        metaList.appendChild(weightLi);
    }

    // Description
    setText("pdDesc", product.description || "Premium quality firework, certified safe.");

    // Stock
    const stockEl = document.getElementById("pdStock");
    if (stockEl) {
        if (product.stock_quantity === 0) {
            stockEl.textContent = "Out of stock";
            stockEl.style.color = "var(--ember)";
            disableActions();
        } else if (product.stock_quantity <= 10) {
            stockEl.textContent = `Only ${product.stock_quantity} left in stock`;
            stockEl.style.color = "var(--gold)";
        } else {
            stockEl.textContent = `${product.stock_quantity} in stock`;
        }
    }

    // Badge for low stock
    const badge = document.getElementById("pdBadge");
    if (badge && product.stock_quantity > 0 && product.stock_quantity <= 10) {
        badge.textContent = "Low Stock";
        badge.style.display = "inline-block";
    }

    // Primary image or icon
    if (product.product_image) {
        const galleryMain = document.getElementById("pdGalleryMain");
        if (galleryMain) {
            galleryMain.innerHTML = `
                <img src="${escHtml(product.product_image)}"
                     alt="${escHtml(product.product_name)}"
                     style="max-height:380px; max-width:100%; object-fit:contain; border-radius:var(--radius-md);"
                     onerror="this.style.display='none'; document.getElementById('pdFallbackIcon').style.display='flex';">
                <div id="pdFallbackIcon" style="display:none; align-items:center; justify-content:center; width:100%; height:100%;">
                    <i class="${productIcon(product.product_name)}" style="font-size:90px; color:var(--gold);"></i>
                </div>`;
        }
    } else {
        const icon = productIcon(product.product_name);
        const iconEl = document.getElementById("pdGalleryIcon");
        if (iconEl) iconEl.className = icon;
        const thumbEl = document.getElementById("pdThumbIcon");
        if (thumbEl) thumbEl.className = `${icon} `;
    }

    // Wire Add to Cart button
    const addCartBtn = document.getElementById("pdAddToCart");
    if (addCartBtn) {
        addCartBtn.addEventListener("click", () => {
            const qty = parseInt(document.getElementById("qtyInput")?.value || "1", 10);
            addToCart(product.id, qty, addCartBtn);
        });
    }

    // Wire Wishlist button
    const wishlistBtn = document.getElementById("pdAddToWishlist");
    if (wishlistBtn) {
        wishlistBtn.addEventListener("click", () => {
            addToWishlist(product.id, wishlistBtn);
        });
    }

    // Clamp qty max to stock
    const qtyInput = document.getElementById("qtyInput");
    if (qtyInput) {
        qtyInput.max = product.stock_quantity;
    }

}


/*
==========================================
Load Product Images
GET /api/products/{id}/images
Replaces gallery thumbs if images exist
==========================================
*/

async function loadProductImages(productId, product) {
    const galleryMain = document.getElementById("pdGalleryMain");
    const thumbsContainer = document.getElementById("pdThumbs");

    if (!galleryMain || !thumbsContainer) return;

    // 1. Render Skeleton Placeholders for thumbnails while fetching API
    thumbsContainer.innerHTML = "";
    for (let idx = 0; idx < 3; idx++) {
        const skeletonThumb = document.createElement("div");
        skeletonThumb.style.width = "50px";
        skeletonThumb.style.height = "50px";
        skeletonThumb.style.borderRadius = "var(--radius-sm)";
        skeletonThumb.style.background = "linear-gradient(90deg, var(--sky-700) 25%, var(--sky-600) 50%, var(--sky-700) 75%)";
        skeletonThumb.style.backgroundSize = "200% 100%";
        skeletonThumb.style.animation = "loadingSkeleton 1.5s infinite";
        thumbsContainer.appendChild(skeletonThumb);
    }

    // Add loadingSkeleton style tag if missing
    if (!document.getElementById("skeleton-animation-styles")) {
        const style = document.createElement("style");
        style.id = "skeleton-animation-styles";
        style.textContent = `
            @keyframes loadingSkeleton {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
        `;
        document.head.appendChild(style);
    }

    try {
        const images = await api.get(`/api/products/${productId}/images`);

        if (!images || images.length === 0) {
            // Restore default thumbnail if no gallery images
            thumbsContainer.innerHTML = "";
            return;
        }

        const primary = images.find(img => img.is_primary) || images[0];

        // 2. Prepare Loading Spinner Overlay for the main view
        const spinnerOverlay = document.createElement("div");
        spinnerOverlay.id = "pdMainImgSpinner";
        spinnerOverlay.style.position = "absolute";
        spinnerOverlay.style.inset = "0";
        spinnerOverlay.style.display = "flex";
        spinnerOverlay.style.alignItems = "center";
        spinnerOverlay.style.justifyContent = "center";
        spinnerOverlay.style.background = "rgba(11, 17, 32, 0.5)";
        spinnerOverlay.style.borderRadius = "var(--radius-md)";
        spinnerOverlay.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="font-size:28px; color:var(--gold);"></i>`;
        
        galleryMain.style.position = "relative";
        galleryMain.innerHTML = "";

        const mainImg = document.createElement("img");
        mainImg.id = "pdMainImg";
        mainImg.alt = product.product_name;
        mainImg.style.maxHeight = "380px";
        mainImg.style.maxWidth = "100%";
        mainImg.style.objectFit = "contain";
        mainImg.style.borderRadius = "var(--radius-md)";
        mainImg.style.display = "block";
        
        galleryMain.appendChild(mainImg);
        galleryMain.appendChild(spinnerOverlay);

        // 3. Lazy Load primary image
        Loader.loadImage(mainImg, primary.image_url);

        const tempImg = new Image();
        tempImg.src = primary.image_url;
        tempImg.onload = () => spinnerOverlay.remove();
        tempImg.onerror = () => spinnerOverlay.remove();

        // 4. Render actual thumbnails
        thumbsContainer.innerHTML = "";
        images.forEach((img, i) => {
            const thumb = document.createElement("div");
            thumb.className = img.is_primary ? "active" : "";
            thumb.style.cursor = "pointer";

            const thumbImg = document.createElement("img");
            thumbImg.alt = `view ${i + 1}`;
            thumbImg.style.width = "100%";
            thumbImg.style.height = "100%";
            thumbImg.style.objectFit = "cover";
            thumbImg.style.borderRadius = "var(--radius-sm)";
            
            thumb.appendChild(thumbImg);
            Loader.loadImage(thumbImg, img.image_url);

            thumb.addEventListener("click", () => {
                if (!galleryMain.querySelector("#pdMainImgSpinner")) {
                    galleryMain.appendChild(spinnerOverlay);
                }

                Loader.loadImage(mainImg, img.image_url);

                const tImg = new Image();
                tImg.src = img.image_url;
                tImg.onload = () => spinnerOverlay.remove();
                tImg.onerror = () => spinnerOverlay.remove();

                thumbsContainer.querySelectorAll("div").forEach(d => d.classList.remove("active"));
                thumb.classList.add("active");
            });

            thumbsContainer.appendChild(thumb);
        });

    } catch (err) {
        console.error("Failed to load product details images:", err);
        thumbsContainer.innerHTML = "";
    }
}


/*
==========================================
Load Related Products
GET /api/products?category={id}
Shows up to 3 products from same category
==========================================
*/

async function loadRelatedProducts(categoryId, currentProductId) {

    try {

        const all = await api.get(`/api/products/?category=${categoryId}`);

        const related = all.filter(p => p.id !== currentProductId).slice(0, 3);

        const container = document.getElementById("relatedProducts");
        const section = document.getElementById("relatedSection");

        if (!container || related.length === 0) return;

        if (section) section.style.display = "block";

        container.innerHTML = "";

        related.forEach(product => {
            const icon = productIcon(product.product_name);

            const thumbHtml = product.product_image
                ? `<img src="${escHtml(product.product_image)}"
                        alt="${escHtml(product.product_name)}"
                        style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius-sm);"
                        onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                   <i class="${icon}" style="display:none;font-size:36px;color:var(--gold);"></i>`
                : `<i class="${icon}" style="font-size:36px;color:var(--gold);"></i>`;

            const discountVal = parseFloat(product.discount || 0);
            const originalPrice = parseFloat(product.price);
            const finalPrice = Math.max(0, originalPrice - discountVal);
            const priceHtml = discountVal > 0
                ? `<span class="price">₹${formatPrice(finalPrice)} <span style="font-size:11px; text-decoration:line-through; color:var(--muted); margin-left:4px;">₹${formatPrice(originalPrice)}</span></span>`
                : `<span class="price">₹${formatPrice(originalPrice)}</span>`;

            const card = document.createElement("div");
            card.className = "card product-card";
            card.style.cursor = "pointer";
            card.innerHTML = `
                <div class="product-thumb" style="height:140px; display:flex; align-items:center; justify-content:center; overflow:hidden; background:var(--sky-700); border-radius:var(--radius-sm); margin-bottom:16px;">
                    ${thumbHtml}
                </div>
                <h3>${escHtml(product.product_name)}</h3>
                <p class="muted-text">${escHtml(product.description || "")}</p>
                <div class="product-foot">
                    ${priceHtml}
                    <button class="btn btn-outline btn-sm">Add</button>
                </div>`;

            card.querySelector(".btn").addEventListener("click", (e) => {
                e.stopPropagation();
                const btn = card.querySelector(".btn");
                addToCart(product.id, 1, btn);
            });

            card.addEventListener("click", (e) => {
                if (!e.target.closest("button")) {
                    window.location.href = `product-details.html?id=${product.id}`;
                }
            });

            container.appendChild(card);
        });

    } catch {
        // Non-critical — related section stays hidden
    }

}


/*
==========================================
Qty Stepper
==========================================
*/

function initQtyStepper() {

    const minus = document.getElementById("qtyMinus");
    const plus  = document.getElementById("qtyPlus");
    const input = document.getElementById("qtyInput");

    if (!minus || !plus || !input) return;

    minus.addEventListener("click", () => {
        const v = parseInt(input.value, 10);
        if (v > 1) input.value = v - 1;
    });

    plus.addEventListener("click", () => {
        const v  = parseInt(input.value, 10);
        const mx = parseInt(input.max || "9999", 10);
        if (v < mx) input.value = v + 1;
    });

    input.addEventListener("change", () => {
        let v = parseInt(input.value, 10);
        if (isNaN(v) || v < 1) v = 1;
        const mx = parseInt(input.max || "9999", 10);
        if (v > mx) v = mx;
        input.value = v;
    });

}


/*
==========================================
Add To Cart
POST /api/cart/  { product_id, quantity }
==========================================
*/

async function addToCart(productId, quantity, btnEl) {

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const original = btnEl.innerHTML;
    btnEl.classList.add("is-loading");
    btnEl.disabled = true;

    try {

        await api.post("/api/cart/", { product_id: productId, quantity }, true);

        btnEl.classList.remove("is-loading");
        btnEl.innerHTML = "<i class='fa-solid fa-check'></i> Added!";
        btnEl.style.background = "linear-gradient(135deg,#3DDC97,#2bb87d)";

        setTimeout(() => {
            btnEl.innerHTML = original;
            btnEl.style.background = "";
            btnEl.disabled = false;
        }, 1800);

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
Add To Wishlist
POST /api/wishlist/  { product_id }
==========================================
*/

async function addToWishlist(productId, btnEl) {

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    btnEl.disabled = true;

    try {

        await api.post("/api/wishlist/", { product_id: productId }, true);

        btnEl.innerHTML = "<i class='fa-solid fa-heart' style='color:var(--ember);'></i>";
        btnEl.title = "Added to Wishlist";

        setTimeout(() => { btnEl.disabled = false; }, 1000);

    } catch (err) {

        btnEl.disabled = false;
        if (!err.message.toLowerCase().includes("already")) {
            alert(err.message || "Could not add to wishlist.");
        }

    }

}


/*
==========================================
Disable actions when out of stock
==========================================
*/

function disableActions() {
    const cart = document.getElementById("pdAddToCart");
    const wish = document.getElementById("pdAddToWishlist");
    const minus = document.getElementById("qtyMinus");
    const plus  = document.getElementById("qtyPlus");
    const input = document.getElementById("qtyInput");
    if (cart)  { cart.disabled = true;  cart.textContent = "Out of Stock"; }
    if (wish)  { wish.disabled = true; }
    if (minus) { minus.disabled = true; }
    if (plus)  { plus.disabled = true; }
    if (input) { input.disabled = true; }
}


/*
==========================================
Update cart badge
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
Show error state
==========================================
*/

function showError(msg) {
    document.getElementById("pdLoading").style.display = "none";
    document.getElementById("pdError").style.display = "block";
    const msgEl = document.getElementById("pdErrorMsg");
    if (msgEl) msgEl.textContent = msg;
}


/*
==========================================
Utility helpers (same as products.js to
keep each file self-contained — no shared
global state between pages)
==========================================
*/

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
    if (n.includes("chakr")||n.includes("spin")||n.includes("wheel")) return "fa-solid fa-circle-notch";
    if (n.includes("gift")||n.includes("box")||n.includes("combo"))   return "fa-solid fa-gift";
    if (n.includes("shell")||n.includes("aerial")||n.includes("sky")) return "fa-solid fa-explosion";
    if (n.includes("sound")||n.includes("cracker")||n.includes("bomb"))return "fa-solid fa-volume-high";
    if (n.includes("fountain")||n.includes("star")||n.includes("flower"))return "fa-solid fa-star";
    if (n.includes("kid")||n.includes("safe")||n.includes("child"))   return "fa-solid fa-child-reaching";
    return "fa-solid fa-fire-flame-curved";
}