document.addEventListener('DOMContentLoaded', () => {
    // --- Define all element references first ---
    const form = document.getElementById('bookingForm');
    if (!form) {
        console.error("Critical Error: Booking form not found!");
        return;
    }
    const eventSelect = document.getElementById('event');
    const quantitySelect = document.getElementById('quantity');
    const namesContainer = document.getElementById('member-names-container');
    const studentRadios = document.querySelectorAll('input[name="is_student"]');
    const prnContainer = document.getElementById('prn-container');
    const prnInput = document.getElementById('prn_number');
    const submitBtn = document.getElementById('submitBtn');
    const priceSummaryDiv = document.getElementById('price-summary');

    // --- Price data for events ---
    const EVENT_PRICES = {
        "InspireX": 500, "Aarambh": 250, "Udaan": 150,
        "SAHARA - Donation Drive": 0, "Pravaah": 0
    };

    // --- Core Functions ---

    /**
     * Generates the required number of name input fields based on quantity.
     */
    const generateNameInputs = () => {
        const quantity = parseInt(quantitySelect.value, 10);
        namesContainer.innerHTML = ''; // Clear previous inputs
        for (let i = 1; i <= quantity; i++) {
            const nameInputDiv = document.createElement('div');
            nameInputDiv.className = 'input-group';
            const placeholder = (i === 1) ? `Primary Attendee's Full Name` : `Full Name of Member #${i}`;
            nameInputDiv.innerHTML = `<input type="text" name="attendee_name" placeholder="${placeholder}" required>`;
            namesContainer.appendChild(nameInputDiv);
        }
    };

    /**
     * Calculates the total price including discounts and updates the UI.
     */
    const updatePrice = () => {
        const selectedEvent = eventSelect.value;
        const quantity = parseInt(quantitySelect.value, 10);
        const price = EVENT_PRICES[selectedEvent];

        if (!selectedEvent || price === 0) {
            priceSummaryDiv.style.display = 'none';
            submitBtn.textContent = 'Register for Free';
            return;
        }

        let subtotal = price * quantity;
        let discount = 0;
        let discountText = '';

        if (quantity === 5) {
            discount = subtotal * 0.15; // 15% discount
            discountText = `Bulk Discount (15%)`;
        } else if (quantity === 3) {
            discount = subtotal * 0.10; // 10% discount
            discountText = `Bulk Discount (10%)`;
        }

        const total = subtotal - discount;
        priceSummaryDiv.innerHTML = `
            Subtotal: ₹${subtotal.toFixed(2)}<br>
            ${discount > 0 ? `${discountText}: -₹${discount.toFixed(2)}<br>` : ''}
            <strong>Total: ₹${total.toFixed(2)}</strong>
        `;
        priceSummaryDiv.style.display = 'block';
        submitBtn.textContent = `Pay ₹${total.toFixed(2)} Now`;
    };

    /**
     * Shows or hides the PRN number field based on student selection.
     */
    const togglePrnInput = () => {
        const isStudent = document.querySelector('input[name="is_student"]:checked').value === 'yes';
        prnContainer.style.display = isStudent ? 'block' : 'none';
        prnInput.required = isStudent;
    };

    /**
     * Main handler for form submission.
     */
    const handleFormSubmit = async (event) => {
        event.preventDefault(); // This is crucial, prevents page reload
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';

        const nameInputs = document.querySelectorAll('input[name="attendee_name"]');
        const attendeeNames = Array.from(nameInputs).map(input => input.value);

        const bookingDetails = {
            primary_name: attendeeNames[0],
            additional_members: attendeeNames.slice(1),
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            whatsapp_number: document.getElementById('whatsapp_number').value,
            event: eventSelect.value,
            quantity: parseInt(quantitySelect.value, 10),
            is_student: document.querySelector('input[name="is_student"]:checked').value === 'yes',
            prn_number: document.querySelector('input[name="is_student"]:checked').value === 'yes' ? prnInput.value : null
        };

        const price = EVENT_PRICES[bookingDetails.event];
        const isFreeEvent = price === 0;
        
        try {
            if (isFreeEvent) {
                // Handle free event logic
                const response = await fetch('/api/verify-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ razorpay_payment_id: 'N/A_free_event', bookingDetails })
                });
                const result = await response.json();
                if (!result.success) throw new Error(result.message);
                alert('Registration successful! Your ticket has been sent to your email.');
                form.reset();
                generateNameInputs(); // Re-generate the initial name field
                togglePrnInput(); // Reset PRN field visibility
            } else {
                // Handle paid event logic
                const subtotal = price * bookingDetails.quantity;
                let discount = 0;
                if (bookingDetails.quantity === 5) discount = subtotal * 0.15;
                else if (bookingDetails.quantity === 3) discount = subtotal * 0.10;
                const finalAmount = subtotal - discount;

                const orderResponse = await fetch('/api/create-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: finalAmount })
                });
                const orderResult = await orderResponse.json();
                if (!orderResult.success) throw new Error(orderResult.message);
                
                const rzp = new Razorpay({
                    key: 'rzp_test_ygqBnkmxywpjJg',
                    amount: orderResult.order.amount,
                    currency: 'INR',
                    name: 'Sambhav Club',
                    description: `Registration for ${bookingDetails.event}`,
                    order_id: orderResult.order.id,
                    handler: async function (response) {
                        const verifyResponse = await fetch('/api/verify-payment', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...response, bookingDetails })
                        });
                        const verifyResult = await verifyResponse.json();
                        if (verifyResult.success) {
                            alert('Payment successful! Your booking is confirmed and the ticket has been sent to your email.');
                            form.reset();
                            generateNameInputs();
                            togglePrnInput();
                        } else {
                            alert(`Payment verification failed: ${verifyResult.message}`);
                        }
                    },
                    prefill: { name: bookingDetails.primary_name, email: bookingDetails.email, contact: bookingDetails.phone },
                    theme: { color: '#5e5ce6' }
                });
                rzp.on('payment.failed', (response) => alert(`Payment failed: ${response.error.description}`));
                rzp.open();
            }
        } catch (error) {
            alert(`An error occurred: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            updatePrice();
        }
    };

    // --- Attach Event Listeners ---
    quantitySelect.addEventListener('change', () => {
        generateNameInputs();
        updatePrice();
    });
    eventSelect.addEventListener('change', updatePrice);
    studentRadios.forEach(radio => radio.addEventListener('change', togglePrnInput));
    form.addEventListener('submit', handleFormSubmit);

    // --- Initialize the form on page load ---
    const urlParams = new URLSearchParams(window.location.search);
    const eventFromUrl = urlParams.get('event');
    if (eventFromUrl && EVENT_PRICES.hasOwnProperty(eventFromUrl)) {
        eventSelect.value = eventFromUrl;
    }
    
    generateNameInputs();
    updatePrice();
    togglePrnInput();
});