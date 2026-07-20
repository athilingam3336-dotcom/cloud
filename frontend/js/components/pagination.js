/*
==========================================
CloudCrackers
pagination.js
Reusable Pagination Component with bounds, page sizes, and navigation handlers
==========================================
*/

class Pagination {
    constructor({ containerId, onPageChange, pageSize = 10 }) {
        this.container = document.getElementById(containerId);
        this.onPageChange = onPageChange;
        this.pageSize = pageSize;
        this.currentPage = 1;
    }

    render(totalItems, currentPage = 1) {
        this.currentPage = currentPage;
        if (!this.container) return;

        this.container.innerHTML = "";
        const totalPages = Math.ceil(totalItems / this.pageSize);
        if (totalPages <= 1) return;

        // First Arrow (<<)
        const firstLink = document.createElement("a");
        firstLink.href = "#";
        firstLink.innerHTML = "«";
        firstLink.title = "First Page";
        if (this.currentPage === 1) firstLink.style.opacity = "0.4";
        firstLink.addEventListener("click", (e) => {
            e.preventDefault();
            if (this.currentPage > 1) {
                this.onPageChange(1);
            }
        });
        this.container.appendChild(firstLink);

        // Previous Arrow (<)
        const prevLink = document.createElement("a");
        prevLink.href = "#";
        prevLink.innerHTML = "‹";
        prevLink.title = "Previous Page";
        if (this.currentPage === 1) prevLink.style.opacity = "0.4";
        prevLink.addEventListener("click", (e) => {
            e.preventDefault();
            if (this.currentPage > 1) {
                this.onPageChange(this.currentPage - 1);
            }
        });
        this.container.appendChild(prevLink);

        // Responsive page numbers (sliding window of max 5 links)
        let startPage = Math.max(1, this.currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);

        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        for (let i = startPage; i <= endPage; i++) {
            const link = document.createElement("a");
            link.href = "#";
            link.textContent = i;
            if (i === this.currentPage) link.className = "active";
            link.addEventListener("click", (e) => {
                e.preventDefault();
                this.onPageChange(i);
            });
            this.container.appendChild(link);
        }

        // Next Arrow (>)
        const nextLink = document.createElement("a");
        nextLink.href = "#";
        nextLink.innerHTML = "›";
        nextLink.title = "Next Page";
        if (this.currentPage === totalPages) nextLink.style.opacity = "0.4";
        nextLink.addEventListener("click", (e) => {
            e.preventDefault();
            if (this.currentPage < totalPages) {
                this.onPageChange(this.currentPage + 1);
            }
        });
        this.container.appendChild(nextLink);

        // Last Arrow (>>)
        const lastLink = document.createElement("a");
        lastLink.href = "#";
        lastLink.innerHTML = "»";
        lastLink.title = "Last Page";
        if (this.currentPage === totalPages) lastLink.style.opacity = "0.4";
        lastLink.addEventListener("click", (e) => {
            e.preventDefault();
            if (this.currentPage < totalPages) {
                this.onPageChange(totalPages);
            }
        });
        this.container.appendChild(lastLink);
    }
}
