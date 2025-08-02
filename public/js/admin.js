document.addEventListener('DOMContentLoaded', () => {
    const bookingTableBody = document.querySelector('#bookingTable tbody');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const scanResultDiv = document.getElementById('qr-scan-result');

    const fetchBookings = async () => {
        loadingDiv.style.display = 'block';
        errorDiv.style.display = 'none';

        try {
            const response = await fetch('/api/bookings');
            if (!response.ok) {
                 if (response.status === 401 || response.status === 403) window.location.href = '/login';
                 throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const tickets = await response.json();
            displayBookings(tickets);
        } catch (error) {
            console.error('Error fetching bookings:', error);
            errorDiv.textContent = 'Failed to load bookings.';
            errorDiv.style.display = 'block';
        } finally {
            loadingDiv.style.display = 'none';
        }
    };

    const displayBookings = (tickets) => {
        bookingTableBody.innerHTML = '';
        if (tickets.length === 0) {
            bookingTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No confirmed tickets yet.</td></tr>';
            return;
        }

        tickets.forEach(ticket => {
            const row = bookingTableBody.insertRow();
            const statusClass = `status-${ticket.status.replace(' ', '-')}`;

            row.innerHTML = `
                <td><span class="status-pill ${statusClass}">${escapeHtml(ticket.status)}</span></td>
                <td><strong>${escapeHtml(ticket.name)}</strong><br><span class="attendee-details">${escapeHtml(ticket.age_group)}</span></td>
                <td>${escapeHtml(ticket.event)}</td>
                <td>${escapeHtml(ticket.email)}<br><span class="contact-phone">${escapeHtml(ticket.whatsapp_number)}</span></td>
                <td>${ticket.is_student ? `Yes (${escapeHtml(ticket.prn_number || 'N/A')})` : 'No'}</td>
                <td class="ticket-id">${escapeHtml(ticket.id)}</td>
            `;
        });
    };
    
    // --- QR Code Scanner Logic (No changes needed here) ---
    const onScanSuccess = async (decodedText, decodedResult) => {
        try { html5QrcodeScanner.pause(); } catch (e) { console.warn("Could not pause scanner", e) }
        scanResultDiv.className = 'processing';
        scanResultDiv.innerHTML = `Processing Ticket ID...`;

        try {
            const response = await fetch(`/api/validate-ticket/${decodedText}`, { method: 'POST' });
            const result = await response.json();
            scanResultDiv.className = result.success ? 'success' : 'error';
            let resultHTML = `<strong>${result.message}</strong>`;
            if (result.ticket) {
                resultHTML += `<br><span>Name: ${result.ticket.name} | Event: ${result.ticket.event}</span>`;
            }
            scanResultDiv.innerHTML = resultHTML;
            fetchBookings(); // Refresh the list
        } catch (error) {
            scanResultDiv.className = 'error';
            scanResultDiv.innerHTML = `<strong>Error:</strong> Could not validate ticket.`;
        }
        
        setTimeout(() => {
             try { html5QrcodeScanner.resume(); } catch(e) { console.warn("Could not resume scanner", e); }
             scanResultDiv.className = '';
             scanResultDiv.textContent = "Scan a ticket's QR code to validate.";
        }, 4000);
    };

    let html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
    html5QrcodeScanner.render(onScanSuccess, (error) => {});

    // --- Helper Function ---
    const escapeHtml = (unsafe) => {
        if (typeof unsafe !== 'string' || !unsafe) return unsafe === null ? '' : unsafe;
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    };

    // --- Initial Load ---
    fetchBookings();
});