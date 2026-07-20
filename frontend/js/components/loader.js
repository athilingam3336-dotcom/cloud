/*
==========================================
CloudCrackers
loader.js
Reusable loader animations (Skeleton loaders, Button spinner, table indicators)
==========================================
*/

const Loader = {
    // Button Loading State
    showButton(btn, loadingText = "Processing...") {
        if (!btn || btn.disabled) return;
        btn.dataset.originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="margin-right:8px;"></i> ${loadingText}`;
    },

    hideButton(btn) {
        if (!btn || !btn.dataset.originalHtml) return;
        btn.innerHTML = btn.dataset.originalHtml;
        btn.disabled = false;
        delete btn.dataset.originalHtml;
    },

    // Table Skeleton Loading Animation
    showTableSkeleton(tableBody, columnsCount = 5, rowsCount = 5) {
        if (!tableBody) return;
        tableBody.innerHTML = "";
        
        for (let r = 0; r < rowsCount; r++) {
            const tr = document.createElement("tr");
            tr.className = "skeleton-row";
            tr.style.opacity = "0.7";
            
            for (let c = 0; c < columnsCount; c++) {
                const td = document.createElement("td");
                td.innerHTML = `<div class="skeleton-placeholder" style="height:16px; background:linear-gradient(90deg, var(--sky-700) 25%, var(--sky-600) 50%, var(--sky-700) 75%); background-size:200% 100%; animation:loadingSkeleton 1.5s infinite; border-radius:4px; width: ${c === 0 ? '60%' : (c === columnsCount - 1 ? '40%' : '80%')};"></div>`;
                tr.appendChild(td);
            }
            tableBody.appendChild(tr);
        }

        // Add skeleton CSS globally if not added
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
    },

    // Spinner Display inside containers
    showSpinner(container, text = "Loading details...") {
        if (!container) return;
        container.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px; gap:12px; width:100%;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size:28px; color:var(--gold);"></i>
                <span style="font-size:13px; color:var(--muted); font-weight:500;">${text}</span>
            </div>
        `;
    },

    hideSpinner(container) {
        if (container) container.innerHTML = "";
    },

    // Image loading with placeholder & fade-in transition
    loadImage(img, src, fallbackSrc = "../images/folowerpot.jpg") {
        if (!img) return;
        
        // Show spinner placeholder before image resolves
        img.style.opacity = "0.3";
        img.style.transition = "opacity 0.3s ease-in-out";
        
        const tempImg = new Image();
        tempImg.src = src;
        tempImg.onload = () => {
            img.src = src;
            img.style.opacity = "1";
        };
        tempImg.onerror = () => {
            img.src = fallbackSrc;
            img.style.opacity = "1";
        };
    }
};
