<?php
/**
 * api/inventory.php
 * GET  ?action=list              — get all stock items (beans & pastries)
 * POST { action:'restock', id, qty, cost, note } — add stock
 * POST { action:'set_out', id }  — mark as out of stock
 * POST { action:'log', id }      — get log for a product
 */
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$body   = json_decode(file_get_contents('php://input'), true) ?? [];
if (!$action) $action = $body['action'] ?? '';

$db = getDB();

if ($method === 'GET') {

    if ($action === 'list') {
        // Only beans and pastries (type=stock)
        $result = $db->query("SELECT id, name, category, type, qty, threshold, unit, cost, available FROM menu WHERE type='stock' ORDER BY category, name");
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $row['qty']       = intval($row['qty']);
            $row['threshold'] = intval($row['threshold']);
            $row['cost']      = floatval($row['cost']);
            $row['available'] = intval($row['available']) === 1;
            $rows[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $rows]);
    }

    elseif ($action === 'log') {
        $id   = intval($_GET['id'] ?? 0);
        $stmt = $db->prepare("SELECT * FROM inventory_log WHERE menu_id=? ORDER BY created_at DESC LIMIT 50");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $rows = [];
        while ($row = $stmt->get_result()->fetch_assoc()) $rows[] = $row;
        echo json_encode(['success' => true, 'data' => $rows]);
    }

    else {
        echo json_encode(['success' => false, 'message' => 'Unknown action.']);
    }
    $db->close(); exit;
}

if ($method === 'POST') {

    // Restock a product
    if ($action === 'restock') {
        $id      = intval($body['id']   ?? 0);
        $add_qty = intval($body['qty']  ?? 0);
        $cost    = floatval($body['cost'] ?? 0);
        $note    = trim($body['note']   ?? '');
        $done_by = trim($body['done_by'] ?? 'Owner');

        if ($id <= 0 || $add_qty <= 0) {
            echo json_encode(['success' => false, 'message' => 'Invalid restock data.']);
            $db->close(); exit;
        }
        if ($cost < 0) {
            echo json_encode(['success' => false, 'message' => 'Unit cost cannot be negative.']);
            $db->close(); exit;
        }

        // Update qty and cost
        if ($cost > 0) {
            $stmt = $db->prepare("UPDATE menu SET qty = qty + ?, cost = ?, available = 1 WHERE id = ? AND type='stock'");
            $stmt->bind_param('idi', $add_qty, $cost, $id);
        } else {
            $stmt = $db->prepare("UPDATE menu SET qty = qty + ?, available = 1 WHERE id = ? AND type='stock'");
            $stmt->bind_param('ii', $add_qty, $id);
        }
        $stmt->execute();

        if ($db->affected_rows === 0) {
            echo json_encode(['success' => false, 'message' => 'Product not found or not a stock item.']);
            $db->close(); exit;
        }

        // Get new qty
        $new_qty = $db->query("SELECT qty FROM menu WHERE id=$id")->fetch_assoc()['qty'];

        // Log the restock
        $log = $db->prepare("INSERT INTO inventory_log (menu_id, action, qty_change, qty_after, note, done_by) VALUES (?, 'restock', ?, ?, ?, ?)");
        $log->bind_param('iiiss', $id, $add_qty, $new_qty, $note, $done_by);
        $log->execute();

        echo json_encode(['success' => true, 'new_qty' => intval($new_qty), 'message' => 'Restocked successfully.']);
    }

    // Manually set out of stock
    elseif ($action === 'set_out') {
        $id      = intval($body['id']      ?? 0);
        $done_by = trim($body['done_by']   ?? 'Owner');

        $stmt = $db->prepare("UPDATE menu SET qty=0, available=0 WHERE id=? AND type='stock'");
        $stmt->bind_param('i', $id);
        $stmt->execute();

        $log = $db->prepare("INSERT INTO inventory_log (menu_id, action, qty_change, qty_after, note, done_by) VALUES (?,'set_out',0,0,'Manually set out of stock',?)");
        $log->bind_param('is', $id, $done_by);
        $log->execute();

        echo json_encode(['success' => true, 'message' => 'Item marked as out of stock.']);
    }

    else {
        echo json_encode(['success' => false, 'message' => 'Unknown action.']);
    }

    $db->close(); exit;
}

echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
