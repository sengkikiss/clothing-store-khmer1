const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize SQLite Database (PERMANENT STORAGE)
const db = new sqlite3.Database('./clothing_customers.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('✅ Connected to SQLite database (PERMANENT STORAGE)');
        initializeDatabase();
    }
});

// Create customers table with clothing measurements
function initializeDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customerName TEXT NOT NULL,
            phone TEXT NOT NULL,
            gender TEXT NOT NULL,
            
            -- Upper Body Measurements (in cm)
            chest REAL,
            waist REAL,
            shoulder REAL,
            sleeveLength REAL,
            armhole REAL,
            neck REAL,
            
            -- Lower Body Measurements (in cm)
            hips REAL,
            inseam REAL,
            thigh REAL,
            knee REAL,
            
            -- Measurement Type
            measurementType TEXT DEFAULT 'both',
            notes TEXT,
            
            -- Order History
            totalOrders INTEGER DEFAULT 0,
            lastOrderDate DATETIME,
            
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating table:', err);
        } else {
            console.log('✅ Database table ready');
            
            // Add sample data if table is empty
            db.get('SELECT COUNT(*) as count FROM customers', (err, row) => {
                if (row.count === 0) {
                    insertSampleData();
                }
            });
        }
    });

    // Create orders table
    db.run(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customerId INTEGER NOT NULL,
            orderDate DATETIME DEFAULT CURRENT_TIMESTAMP,
            garmentType TEXT NOT NULL,
            fabric TEXT,
            color TEXT,
            quantity INTEGER DEFAULT 1,
            price REAL,
            status TEXT DEFAULT 'Pending',
            deliveryDate DATETIME,
            notes TEXT,
            FOREIGN KEY (customerId) REFERENCES customers(id)
        )
    `);
}

// Insert sample data
function insertSampleData() {
    const sampleCustomers = [
        {
            customerName: 'សុខ វិចិត្រ',
            phone: '012 345 678',
            gender: 'ប្រុស',
            chest: 95,
            waist: 80,
            shoulder: 45,
            sleeveLength: 60,
            neck: 38,
            armhole: 45,
            hips: 90,
            inseam: 75,
            thigh: 55,
            knee: 38,
            measurementType: 'both',
            notes: 'ចូលចិត្តពណ៌ខ្មៅ',
            totalOrders: 3
        },
        {
            customerName: 'ចន្ទ សោភា',
            phone: '098 765 432',
            gender: 'ស្រី',
            chest: 85,
            waist: 65,
            shoulder: 38,
            sleeveLength: 55,
            armhole: 40,
            measurementType: 'upper',
            notes: 'កាត់ខោអាវប្រចាំសប្តាហ៍',
            totalOrders: 5
        },
        {
            customerName: 'រ៉ា សុភា',
            phone: '077 888 999',
            gender: 'ប្រុស',
            hips: 95,
            inseam: 80,
            thigh: 58,
            knee: 40,
            measurementType: 'lower',
            notes: 'កាត់តែខោ',
            totalOrders: 2
        }
    ];

    const stmt = db.prepare(`
        INSERT INTO customers (
            customerName, phone, gender,
            chest, waist, shoulder, sleeveLength, armhole, neck,
            hips, inseam, thigh, knee,
            measurementType, notes, totalOrders
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    sampleCustomers.forEach(customer => {
        stmt.run(
            customer.customerName, customer.phone, customer.gender,
            customer.chest, customer.waist, customer.shoulder, customer.sleeveLength,
            customer.armhole, customer.neck,
            customer.hips, customer.inseam, customer.thigh, customer.knee,
            customer.measurementType, customer.notes, customer.totalOrders
        );
    });

    stmt.finalize();
    console.log('✅ Sample customer data inserted');
}

// API ENDPOINTS

// Get all customers
app.get('/api/customers', (req, res) => {
    const search = req.query.search || '';
    
    let query = 'SELECT * FROM customers';
    let params = [];
    
    if (search) {
        query += ' WHERE customerName LIKE ? OR phone LIKE ?';
        const searchPattern = `%${search}%`;
        params = [searchPattern, searchPattern];
    }
    
    query += ' ORDER BY id DESC';
    
    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// Get single customer by ID
app.get('/api/customers/:id', (req, res) => {
    db.get('SELECT * FROM customers WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (!row) {
            res.status(404).json({ error: 'Customer not found' });
        } else {
            res.json(row);
        }
    });
});

// Create new customer
app.post('/api/customers', (req, res) => {
    const {
        customerName, phone, gender,
        chest, waist, shoulder, sleeveLength, armhole, neck,
        hips, inseam, thigh, knee,
        measurementType, notes
    } = req.body;
    
    // Validation
    if (!customerName || !phone || !gender) {
        return res.status(400).json({ error: 'Missing required fields (name, phone, gender)' });
    }
    
    db.run(`
        INSERT INTO customers (
            customerName, phone, gender,
            chest, waist, shoulder, sleeveLength, armhole, neck,
            hips, inseam, thigh, knee,
            measurementType, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        customerName, phone, gender,
        chest, waist, shoulder, sleeveLength, armhole, neck,
        hips, inseam, thigh, knee,
        measurementType, notes
    ], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json({
                id: this.lastID,
                message: 'Customer created successfully'
            });
        }
    });
});

// Update customer
app.put('/api/customers/:id', (req, res) => {
    const {
        customerName, phone, gender,
        chest, waist, shoulder, sleeveLength, armhole, neck,
        hips, inseam, thigh, knee,
        measurementType, notes
    } = req.body;
    
    db.run(`
        UPDATE customers 
        SET customerName = ?, phone = ?, gender = ?,
            chest = ?, waist = ?, shoulder = ?, sleeveLength = ?,
            armhole = ?, neck = ?, hips = ?, inseam = ?, thigh = ?, knee = ?,
            measurementType = ?, notes = ?,
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [
        customerName, phone, gender,
        chest, waist, shoulder, sleeveLength, armhole, neck,
        hips, inseam, thigh, knee,
        measurementType, notes,
        req.params.id
    ], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Customer not found' });
        } else {
            res.json({ message: 'Customer updated successfully' });
        }
    });
});

// Delete customer
app.delete('/api/customers/:id', (req, res) => {
    db.run('DELETE FROM customers WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Customer not found' });
        } else {
            res.json({ message: 'Customer deleted successfully' });
        }
    });
});

// Get statistics
app.get('/api/stats', (req, res) => {
    db.all(`
        SELECT 
            COUNT(*) as totalCustomers,
            SUM(CASE WHEN gender = 'Male' THEN 1 ELSE 0 END) as maleCustomers,
            SUM(CASE WHEN gender = 'Female' THEN 1 ELSE 0 END) as femaleCustomers,
            SUM(totalOrders) as totalOrders
        FROM customers
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows[0]);
        }
    });
});

// Export all data
app.get('/api/export', (req, res) => {
    db.all('SELECT * FROM customers ORDER BY id', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║  👔 Clothing Store - Customer Measurements System   ║
║                                                      ║
║  ✅ Server running on: http://localhost:${PORT}        ║
║  ✅ Database: SQLite (PERMANENT STORAGE)            ║
║  ✅ Database file: clothing_customers.db            ║
║                                                      ║
║  📏 Store customer measurements permanently!        ║
║  🔒 Data safe even after browser clear!             ║
╚══════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});