const sqlite = require('better-sqlite3');
const path = require('path');
const db = new sqlite(path.resolve('sambhav.db'), { fileMustExist: false });

// Initialize tables
const createTransactionsTable = `
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    purchaser_email TEXT NOT NULL,
    purchaser_phone TEXT NOT NULL,
    event TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    razorpay_payment_id TEXT,
    razorpay_order_id TEXT,
    transaction_date TEXT NOT NULL
);
`;

const createTicketsTable = `
CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    whatsapp_number TEXT,
    age_group TEXT,
    event TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    is_student INTEGER,
    prn_number TEXT,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);
`;
db.exec(createTransactionsTable);
db.exec(createTicketsTable);

// --- Prepared Statements ---
const addTransaction = db.prepare(
    'INSERT INTO transactions (id, purchaser_email, purchaser_phone, event, quantity, total_amount, razorpay_payment_id, razorpay_order_id, transaction_date) VALUES (@id, @purchaser_email, @purchaser_phone, @event, @quantity, @total_amount, @razorpay_payment_id, @razorpay_order_id, @transaction_date)'
);

const addTicket = db.prepare(
    'INSERT INTO tickets (id, transaction_id, name, email, whatsapp_number, age_group, event, status, is_student, prn_number) VALUES (@id, @transaction_id, @name, @email, @whatsapp_number, @age_group, @event, @status, @is_student, @prn_number)'
);

const getAllTickets = db.prepare('SELECT * FROM tickets ORDER BY transaction_id DESC');
const getTicketById = db.prepare('SELECT * FROM tickets WHERE id = ?');
const updateTicketStatus = db.prepare('UPDATE tickets SET status = ? WHERE id = ?');

module.exports = {
    addTransaction,
    addTicket,
    getAllTickets,
    getTicketById,
    updateTicketStatus,
    db // Export db for custom queries if needed
};