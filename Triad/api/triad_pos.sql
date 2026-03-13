-- ============================================================
--  TRIAD COFFEE ROASTERS — MySQL Database Setup
--  Run this in phpMyAdmin or MySQL command line
--  Steps:
--    1. Open phpMyAdmin (http://localhost/phpmyadmin)
--    2. Click "New" to create a database named: triad_pos
--    3. Click "Import" and upload this SQL file
--    4. Done! All tables and initial data are created.
-- ============================================================

CREATE DATABASE IF NOT EXISTS triad_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE triad_pos;

-- ─────────────────────────────────────────
--  1. ACCOUNTS (Owner login + password)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(100) NOT NULL UNIQUE,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('owner','staff') DEFAULT 'owner',
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Owner account: Username = Owner123, Password = Password1234
INSERT INTO accounts (username, email, password_hash, role) VALUES
('Owner123', 'owner@triadcoffee.com', SHA2('Password1234', 256), 'owner')
ON DUPLICATE KEY UPDATE username=username;

-- ─────────────────────────────────────────
--  2. STAFF
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    first_name  VARCHAR(100) NOT NULL,
    last_name   VARCHAR(100) NOT NULL,
    email       VARCHAR(150) NOT NULL,
    phone       VARCHAR(30),
    role        ENUM('Barista','Cashier','Shift Lead','Manager') DEFAULT 'Barista',
    pin         CHAR(4) NOT NULL,
    schedule    VARCHAR(100),
    status      ENUM('active','inactive') DEFAULT 'active',
    joined_date DATE,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO staff (first_name, last_name, email, phone, role, pin, schedule, status, joined_date) VALUES
('Maria',  'Santos',    'maria@triadcoffee.com',  '0912-345-6789', 'Shift Lead', '1234', 'Mon–Fri · 7AM–3PM',  'active',   '2024-01-15'),
('Carlos', 'Reyes',     'carlos@triadcoffee.com', '0917-234-5678', 'Barista',    '2345', 'Tue–Sat · 7AM–3PM',  'active',   '2024-03-02'),
('Ana',    'Cruz',      'ana@triadcoffee.com',    '0923-456-7890', 'Cashier',    '3456', 'Mon–Fri · 3PM–11PM', 'active',   '2024-04-10'),
('Josh',   'Estrada',   'josh@triadcoffee.com',   '0998-765-4321', 'Manager',    '0000', 'Mon–Fri · 7AM–3PM',  'active',   '2023-11-01'),
('Lena',   'Gomez',     'lena@triadcoffee.com',   '0909-876-5432', 'Barista',    '4567', 'Wed–Sun · 7AM–3PM',  'inactive', '2024-06-20'),
('Rico',   'Dela Cruz', 'rico@triadcoffee.com',   '0906-543-2109', 'Cashier',    '5678', 'Weekends Only',      'active',   '2024-08-05');

-- ─────────────────────────────────────────
--  3. STAFF ARCHIVE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_archive (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    original_id  INT,
    first_name   VARCHAR(100),
    last_name    VARCHAR(100),
    email        VARCHAR(150),
    phone        VARCHAR(30),
    role         VARCHAR(50),
    pin          CHAR(4),
    schedule     VARCHAR(100),
    status       VARCHAR(20),
    joined_date  DATE,
    archived_on  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
--  4. MENU ITEMS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    category    VARCHAR(50) NOT NULL,
    type        ENUM('manual','stock') DEFAULT 'manual',
    qty         INT DEFAULT 999,
    threshold   INT DEFAULT 0,
    unit        VARCHAR(20) DEFAULT 'cups',
    price       DECIMAL(10,2) DEFAULT 0.00,
    cost        DECIMAL(10,2) DEFAULT 0.00,
    available   TINYINT(1) DEFAULT 1,
    description TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO menu (id, name, category, type, qty, threshold, unit, price, cost, available, description) VALUES
(1,  'Caramel Latte',        'hot-coffee',  'manual', 999, 0, 'cups',  3.95, 0.00,  1, 'Rich espresso with smooth caramel & steamed milk'),
(2,  'Americano',             'hot-coffee',  'manual', 999, 0, 'cups',  3.10, 0.00,  1, 'Bold black espresso with hot water, clean & strong'),
(3,  'Cappuccino',            'hot-coffee',  'manual', 999, 0, 'cups',  3.50, 0.00,  1, 'Espresso with velvety steamed milk & light foam'),
(4,  'Mocha Latte',           'hot-coffee',  'manual', 999, 0, 'cups',  3.75, 0.00,  1, 'Espresso blended with rich chocolate & steamed milk'),
(5,  'Matcha Latte',          'hot-coffee',  'manual', 999, 0, 'cups',  3.85, 0.00,  1, 'Earthy matcha whisked into warm steamed milk'),
(6,  'Golden Turmeric Latte', 'hot-coffee',  'manual', 999, 0, 'cups',  2.40, 0.00,  1, 'Warm turmeric blend with honey & steamed milk'),
(7,  'Iced Latte',            'iced-coffee', 'manual', 999, 0, 'cups',  3.80, 0.00,  1, 'Double espresso over ice with cold fresh milk'),
(8,  'Vanilla Cold Brew',     'iced-coffee', 'manual', 999, 0, 'cups',  3.95, 0.00,  1, 'Cold-brewed coffee infused with sweet vanilla'),
(9,  'Single Espresso',       'espresso',    'manual', 999, 0, 'shots', 2.20, 0.00,  1, 'Single pulled shot of our house espresso blend'),
(10, 'Double Espresso',       'espresso',    'manual', 999, 0, 'shots', 2.95, 0.00,  1, 'Double shot of our signature espresso — intense'),
(11, 'Mocha Frappe',          'frappe',      'manual', 999, 0, 'cups',  4.25, 0.00,  1, 'Blended espresso, chocolate & ice topped with cream'),
(12, 'Caramel Frappe',        'frappe',      'manual', 999, 0, 'cups',  4.35, 0.00,  1, 'Caramel drizzle blended with espresso & creamy ice'),
(13, 'Matcha Latte (Iced)',   'tea',         'manual', 999, 0, 'cups',  3.85, 0.00,  1, 'Ceremonial matcha whisked into cold milk over ice'),
(14, 'Classic Black Tea',     'tea',         'manual', 999, 0, 'cups',  2.50, 0.00,  1, 'Smooth black tea brewed from whole leaves'),
(15, 'Butter Croissant',      'pastries',    'stock',  12,  8, 'pcs',   2.40, 45.00, 1, 'Buttery, flaky croissant baked fresh daily'),
(16, 'Chocolate Muffin',      'pastries',    'stock',  8,   6, 'pcs',   2.80, 38.00, 1, 'Double chocolate muffin, moist and rich'),
(17, 'Darkfruit Blend 250g',  'beans',       'stock',  14,  5, 'bags',  8.99, 280.00,1, 'Complex dark fruit notes, medium roast 250g'),
(18, 'Mono Blend 250g',       'beans',       'stock',  3,   5, 'bags',  9.50, 295.00,1, 'Balanced single-origin mono blend 250g'),
(19, 'Espresso Beans 250g',   'beans',       'stock',  20,  5, 'bags', 10.99, 310.00,1, 'Specially selected espresso beans 250g'),
(20, 'House Blend 250g',      'beans',       'stock',  2,   5, 'bags',  8.99, 270.00,1, 'Our signature house blend, smooth & consistent 250g')
ON DUPLICATE KEY UPDATE name=name;

-- ─────────────────────────────────────────
--  5. MENU ARCHIVE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_archive (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    original_id  INT,
    name         VARCHAR(150),
    category     VARCHAR(50),
    type         VARCHAR(10),
    qty          INT,
    threshold    INT,
    unit         VARCHAR(20),
    price        DECIMAL(10,2),
    cost         DECIMAL(10,2),
    description  TEXT,
    archived_on  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
--  6. SALES / TRANSACTIONS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    customer    VARCHAR(150) DEFAULT 'Guest',
    cashier     VARCHAR(150),
    order_type  ENUM('dine-in','takeout') DEFAULT 'dine-in',
    payment     ENUM('cash','gcash','paymaya') DEFAULT 'cash',
    persons     INT DEFAULT 1,
    subtotal    DECIMAL(10,2) DEFAULT 0.00,
    tax         DECIMAL(10,2) DEFAULT 0.00,
    total       DECIMAL(10,2) DEFAULT 0.00,
    status      ENUM('completed','refunded') DEFAULT 'completed',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    refunded_at DATETIME NULL
);

-- ─────────────────────────────────────────
--  7. SALE ITEMS (line items per transaction)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    sale_id     INT NOT NULL,
    menu_id     INT,
    name        VARCHAR(150),
    category    VARCHAR(50),
    qty         INT DEFAULT 1,
    price       DECIMAL(10,2) DEFAULT 0.00,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
--  8. INVENTORY (Beans & Pastries stock log)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_log (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    menu_id     INT NOT NULL,
    action      ENUM('restock','deduct','set_out') DEFAULT 'restock',
    qty_change  INT DEFAULT 0,
    qty_after   INT DEFAULT 0,
    note        TEXT,
    done_by     VARCHAR(150) DEFAULT 'Owner',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
