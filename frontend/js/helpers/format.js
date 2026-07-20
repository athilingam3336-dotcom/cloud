/*
==========================================
CloudCrackers
format.js
Formatting utilities, search debouncing, and CSV/Excel exports
==========================================
*/

const Format = {
    // Format Currency to Rupees (₹)
    currency(amount) {
        const val = parseFloat(amount || 0);
        return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },

    // Format ISO dates to readable short formats
    date(dateString, includeTime = false) {
        if (!dateString) return "N/A";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "N/A";

        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
            options.hour12 = true;
        }

        return date.toLocaleDateString('en-IN', options);
    },

    // Debounce helper to throttle real-time search typing events
    debounce(func, delay = 300) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    },

    // Export tabular lists to CSV
    exportToCSV(headers, rows, filename = "export.csv") {
        const csvRows = [];
        
        // Push headers row
        csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(","));

        // Push data rows
        rows.forEach(row => {
            csvRows.push(row.map(cell => {
                const text = String(cell !== null && cell !== undefined ? cell : "");
                return `"${text.replace(/"/g, '""')}"`;
            }).join(","));
        });

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    // Export to Excel-compatible Tab-Separated-Values
    exportToExcel(headers, rows, filename = "export.xls") {
        const tabRows = [];
        
        // Push headers
        tabRows.push(headers.join("\t"));

        // Push data rows
        rows.forEach(row => {
            tabRows.push(row.map(cell => {
                const text = String(cell !== null && cell !== undefined ? cell : "");
                // Replace tabs, line breaks inside text fields
                return text.replace(/\t/g, " ").replace(/\r?\n|\r/g, " ");
            }).join("\t"));
        });

        // Use \uFEFF Byte Order Mark for Excel encoding compatibility
        const tsvContent = "\uFEFF" + tabRows.join("\r\n");
        const blob = new Blob([tsvContent], { type: "application/vnd.ms-excel;charset=utf-8" });
        
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};
