/**
 * triad-db.js — MySQL/XAMPP API Client
 * Include this BEFORE owner.js or staff.js
 *
 * All functions return promises.
 * Call window.TriadDB.* from anywhere.
 */

(function () {
  'use strict';

  // ── Base URL — auto-detects XAMPP path ──────────────────
  const BASE = (() => {
    const p = window.location.pathname;
    // Extract the project folder name (e.g. /triad-mysql/)
    const parts = p.split('/').filter(Boolean);
    const root  = parts.length > 0 ? '/' + parts[0] : '';
    return root + '/api';
  })();

  // ── Low-level fetch helper ───────────────────────────────
  async function api(endpoint, method = 'GET', body = null, params = {}) {
    let url = BASE + '/' + endpoint;
    if (method === 'GET' && Object.keys(params).length) {
      url += '?' + new URLSearchParams(params).toString();
    }
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    try {
      const res  = await fetch(url, opts);
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('[TriadDB] API Error:', endpoint, err);
      return { success: false, message: err.message };
    }
  }

  // ════════════════════════════════════════════════════════
  const TriadDB = {

    // ── AUTH ──────────────────────────────────────────────

    /** Owner login. username="Owner123", password="Password1234" */
    ownerLogin: (username, password) =>
      api('auth.php', 'POST', { action: 'owner_login', username, password }),

    /** Staff login. email + 4-digit pin */
    staffLogin: (email, pin) =>
      api('auth.php', 'POST', { action: 'staff_login', email, pin }),

    /** Change owner password */
    changePassword: (username, current_password, new_password) =>
      api('auth.php', 'POST', { action: 'change_password', username, current_password, new_password }),


    // ── STAFF ─────────────────────────────────────────────

    /** Get all active staff */
    getStaff: () =>
      api('staff.php', 'GET', null, { action: 'list' }),

    /** Get staff archive */
    getStaffArchive: () =>
      api('staff.php', 'GET', null, { action: 'archive' }),

    /** Add or update staff. Pass id>0 to update. */
    saveStaff: (data) =>
      api('staff.php', 'POST', { action: 'save', ...data }),

    /** Toggle active/inactive */
    toggleStaffStatus: (id) =>
      api('staff.php', 'POST', { action: 'toggle_status', id }),

    /** Archive a staff member (moves to staff_archive) */
    archiveStaff: (id) =>
      api('staff.php', 'POST', { action: 'archive', id }),

    /** Restore from archive */
    restoreStaff: (id) =>
      api('staff.php', 'POST', { action: 'restore', id }),


    // ── MENU ─────────────────────────────────────────────

    /** Get all active menu items */
    getMenu: () =>
      api('menu.php', 'GET', null, { action: 'list' }),

    /** Get menu archive */
    getMenuArchive: () =>
      api('menu.php', 'GET', null, { action: 'archive' }),

    /** Add or update menu item */
    saveMenuItem: (data) =>
      api('menu.php', 'POST', { action: 'save', ...data }),

    /** Toggle availability */
    toggleMenuAvail: (id) =>
      api('menu.php', 'POST', { action: 'toggle_avail', id }),

    /** Archive a menu item */
    archiveMenuItem: (id) =>
      api('menu.php', 'POST', { action: 'archive', id }),

    /** Restore menu item from archive */
    restoreMenuItem: (id) =>
      api('menu.php', 'POST', { action: 'restore', id }),


    // ── SALES ─────────────────────────────────────────────

    /**
     * Get sales history.
     * @param {string} from  YYYY-MM-DD
     * @param {string} to    YYYY-MM-DD
     * @param {number} limit max rows (default 500)
     */
    getSales: (from, to, limit = 500) =>
      api('sales.php', 'GET', null, { action: 'list', from, to, limit }),

    /**
     * Save a completed transaction.
     * @param {object} order  { customer, cashier, orderType, payment, persons, subtotal, tax, total, items[] }
     */
    saveSale: (order) =>
      api('sales.php', 'POST', { action: 'save', order }),

    /** Mark a sale as refunded */
    refundSale: (id) =>
      api('sales.php', 'POST', { action: 'refund', id }),


    // ── INVENTORY (Beans & Pastries) ──────────────────────

    /** Get all stock items */
    getInventory: () =>
      api('inventory.php', 'GET', null, { action: 'list' }),

    /**
     * Restock a product.
     * @param {number} id       menu item id
     * @param {number} qty      quantity to ADD
     * @param {number} cost     unit cost (optional)
     * @param {string} note     restock note (optional)
     * @param {string} done_by  who did the restock
     */
    restock: (id, qty, cost = 0, note = '', done_by = 'Owner') =>
      api('inventory.php', 'POST', { action: 'restock', id, qty, cost, note, done_by }),

    /** Manually mark a product as out of stock */
    setOutOfStock: (id, done_by = 'Owner') =>
      api('inventory.php', 'POST', { action: 'set_out', id, done_by }),

    /** Get restock/deduct log for a product */
    getInventoryLog: (id) =>
      api('inventory.php', 'GET', null, { action: 'log', id }),

  };

  // ── Expose globally ──────────────────────────────────────
  window.TriadDB = TriadDB;

})();
