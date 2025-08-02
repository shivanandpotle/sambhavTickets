const express = require('express');
const session = require('express-session');
const path = require('path');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const db = require('./database');
const { sendTicketEmail } = require('./email');

const app = express();
const PORT = 3000;

// --- Razorpay Instance ---
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Session ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'a-very-strong-secret-key-for-sambhav-club',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, httpOnly: true, maxAge: 3600000 } // Set secure: true in production
}));

const ADMIN_USERS = [
    { username: 'admin', password: 'password123' },
];

const requireLogin = (req, res, next) => {
    if (req.session && req.session.userId) return next();
    res.redirect('/login');
};

// --- HTML Routes ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/admin', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// --- API Routes ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const foundUser = ADMIN_USERS.find(user => user.username === username && user.password === password);
    if (foundUser) {
        req.session.userId = foundUser.username;
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

app.get('/api/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// Get ALL tickets for admin panel
app.get('/api/bookings', requireLogin, (req, res) => {
    try {
        const tickets = db.getAllTickets.all();
        res.status(200).json(tickets);
    } catch (error) {
        console.error("Failed to load tickets:", error);
        res.status(500).json({ message: 'Failed to load tickets' });
    }
});

app.post('/api/create-order', async (req, res) => {
    const { amount } = req.body;
    if (typeof amount !== 'number' || amount < 1) {
        return res.status(400).json({ success: false, message: 'A valid amount is required.' });
    }
    try {
        const options = {
            amount: Math.round(amount * 100),
            currency: 'INR',
            receipt: `receipt_order_${new Date().getTime()}`,
        };
        const order = await razorpay.orders.create(options);
        res.json({ success: true, order });
    } catch (error) {
        console.error("Razorpay order creation error:", error);
        res.status(500).json({ success: false, message: 'Could not create order.' });
    }
});

// Verify Payment and Create Individual Tickets
app.post('/api/verify-payment', async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingDetails } = req.body;

    if (!bookingDetails || !bookingDetails.attendees || bookingDetails.attendees.length === 0) {
        return res.status(400).json({ success: false, message: 'Booking details are missing.' });
    }

    let isPaymentVerified = false;
    if (razorpay_payment_id === 'N/A_free_event') {
        isPaymentVerified = true;
    } else if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body.toString()).digest('hex');
        if (expectedSignature === razorpay_signature) {
            isPaymentVerified = true;
        }
    }

    if (isPaymentVerified) {
        try {
            const transactionId = uuidv4();
            // 1. Create the main transaction record
            db.addTransaction.run({
                id: transactionId,
                purchaser_email: bookingDetails.purchaser_email,
                purchaser_phone: bookingDetails.purchaser_phone,
                event: bookingDetails.event,
                quantity: bookingDetails.quantity,
                total_amount: bookingDetails.total_amount,
                razorpay_payment_id: razorpay_payment_id !== 'N/A_free_event' ? razorpay_payment_id : null,
                razorpay_order_id: razorpay_order_id || null,
                transaction_date: new Date().toISOString()
            });

            // 2. Loop through attendees, create tickets, and send emails
            for (const attendee of bookingDetails.attendees) {
                const ticketId = uuidv4();
                db.addTicket.run({
                    id: ticketId,
                    transaction_id: transactionId,
                    name: attendee.name,
                    email: attendee.email,
                    whatsapp_number: attendee.whatsapp_number,
                    age_group: attendee.age_group,
                    event: bookingDetails.event,
                    status: 'confirmed',
                    is_student: bookingDetails.is_student ? 1 : 0,
                    prn_number: bookingDetails.prn_number || null
                });
                
                // Construct object for email function
                const emailTicketData = {
                    id: ticketId,
                    event: bookingDetails.event,
                    primary_name: attendee.name, // PDF uses this field
                    email: attendee.email,
                    additional_members: '[]', // No additional members for individual tickets
                    quantity: 1
                };
                await sendTicketEmail(emailTicketData);
                console.log(`✅ Ticket sent to ${attendee.name} at ${attendee.email}`);
            }
            res.status(200).json({ success: true, message: 'Booking confirmed! Individual tickets have been sent.' });
        } catch (error) {
            console.error("❌ Error saving transaction/tickets or sending email:", error);
            res.status(500).json({ success: false, message: 'Server error while saving booking.' });
        }
    } else {
        res.status(400).json({ success: false, message: 'Payment verification failed.' });
    }
});

// Validate Individual Ticket
app.post('/api/validate-ticket/:id', requireLogin, (req, res) => {
    try {
        const { id } = req.params;
        const ticket = db.getTicketById.get(id);

        if (!ticket) {
            return res.status(404).json({ success: false, message: 'Invalid Ticket ID.' });
        }
        if (ticket.status === 'checked-in') {
            return res.status(200).json({ success: false, message: 'This ticket has already been checked in.', ticket });
        }

        db.updateTicketStatus.run('checked-in', id);
        const updatedTicket = db.getTicketById.get(id);
        res.status(200).json({ success: true, message: 'Check-in Successful!', ticket: updatedTicket });

    } catch (error) {
        console.error("Ticket validation error:", error);
        res.status(500).json({ success: false, message: 'Server error during validation.' });
    }
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});