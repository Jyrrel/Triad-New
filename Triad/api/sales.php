<?php
/**
 * api/sales.php
 * GET  ?action=list&from=DATE&to=DATE  — list sales with items
 * POST { action: 'save', order: {...} } — save a new transaction
 * POST { action: 'refund', id }         — mark sale as refunded
 */
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$body   = json_decode(file_get_contents('php://input'), true) ?? [];
if (!$action) $action = $body['action'] ?? '';

$db = getDB();

if ($method === 'GET') {

    if ($action === 'list') {
        $from  = $_GET['from'] ?? date('Y-m-d', strtotime('-30 days'));
        $to    = $_GET['to']   ?? date('Y-m-d');
        $limit = intval($_GET['limit'] ?? 500);

        $stmt = $db->prepare("
            SELECT s.*,
                   GROUP_CONCAT(si.menu_id,'|',si.name,'|',si.category,'|',si.qty,'|',si.price SEPARATOR ';;') AS items_raw
            FROM sales s
            LEFT JOIN sale_items si ON si.sale_id = s.id
            WHERE DATE(s.created_at) BETWEEN ? AND ?
            GROUP BY s.id
            ORDER BY s.created_at DESC
            LIMIT ?
        ");
        $stmt->bind_param('ssi', $from, $to, $limit);
        $stmt->execute();
        $result = $stmt->get_result();

        $rows = [];
        while ($row = $result->fetch_assoc()) {
            // Parse items
            $items = [];
            if ($row['items_raw']) {
                foreach (explode(';;', $row['items_raw']) as $item_str) {
                    $parts = explode('|', $item_str);
                    if (count($parts) >= 5) {
                        $items[] = [
                            'id'       => intval($parts[0]),
                            'name'     => $parts[1],
                            'category' => $parts[2],
                            'qty'      => intval($parts[3]),
                            'price'    => floatval($parts[4])
                        ];
                    }
                }
            }
            unset($row['items_raw']);
            $row['items']    = $items;
            $row['subtotal'] = floatval($row['subtotal']);
            $row['tax']      = floatval($row['tax']);
            $row['total']    = floatval($row['total']);
            $row['persons']  = intval($row['persons']);
            $rows[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $rows, 'count' => count($rows)]);
    }

    else {
        echo json_encode(['success' => false, 'message' => 'Unknown action.']);
    }
    $db->close(); exit;
}

if ($method === 'POST') {

    // Save a new completed sale
    if ($action === 'save') {
        $order    = $body['order'] ?? $body;
        $customer = trim($order['customer']  ?? 'Guest');
        $cashier  = trim($order['cashier']   ?? 'Staff');
        $type     = trim($order['orderType'] ?? 'dine-in');
        $payment  = trim($order['payment']   ?? 'cash');
        $persons  = intval($order['persons'] ?? 1);
        $subtotal = floatval($order['subtotal'] ?? 0);
        $tax      = floatval($order['tax']      ?? 0);
        $total    = floatval($order['total']    ?? 0);
        $items    = $order['items'] ?? [];

        if ($total <= 0 || empty($items)) {
            echo json_encode(['success' => false, 'message' => 'Invalid order data.']);
            $db->close(); exit;
        }

        $db->begin_transaction();
        try {
            // Insert sale
            $stmt = $db->prepare("INSERT INTO sales (customer, cashier, order_type, payment, persons, subtotal, tax, total, status) VALUES (?,?,?,?,?,?,?,?,'completed')");
            $stmt->bind_param('ssssiddd', $customer, $cashier, $type, $payment, $persons, $subtotal, $tax, $total);
            $stmt->execute();
            $sale_id = $db->insert_id;

            // Insert line items
            $stmt2 = $db->prepare("INSERT INTO sale_items (sale_id, menu_id, name, category, qty, price) VALUES (?,?,?,?,?,?)");
            foreach ($items as $item) {
                $menu_id  = intval($item['id']       ?? 0);
                $name     = trim($item['name']        ?? '');
                $category = trim($item['category']   ?? '');
                $qty      = intval($item['qty']       ?? 1);
                $price    = floatval($item['price']   ?? 0);
                $stmt2->bind_param('iissid', $sale_id, $menu_id, $name, $category, $qty, $price);
                $stmt2->execute();

                // Deduct stock for any stock-tracked item
                $item_type = trim($item['type'] ?? '');
                if ($item_type === 'stock' || $category === 'beans' || $category === 'pastries') {
                    $deduct = $db->prepare("UPDATE menu SET qty = GREATEST(0, qty - ?) WHERE id=? AND type='stock'");
                    $deduct->bind_param('ii', $qty, $menu_id);
                    $deduct->execute();

                    // Log the deduction
                    $log_stmt = $db->prepare("INSERT INTO inventory_log (menu_id, action, qty_change, qty_after, note) SELECT ?, 'deduct', ?, qty, 'Auto-deducted from sale #?' FROM menu WHERE id=?");
                    // Simpler log
                    $db->query("INSERT INTO inventory_log (menu_id, action, qty_change, qty_after, note) SELECT $menu_id, 'deduct', -$qty, qty, 'Deducted from sale #$sale_id' FROM menu WHERE id=$menu_id");
                }
            }

            $db->commit();
            echo json_encode(['success' => true, 'sale_id' => $sale_id]);

        } catch (Exception $e) {
            $db->rollback();
            echo json_encode(['success' => false, 'message' => 'DB error: ' . $e->getMessage()]);
        }
    }

    // Refund a sale
    elseif ($action === 'refund') {
        $id = intval($body['id'] ?? 0);
        $stmt = $db->prepare("UPDATE sales SET status='refunded', refunded_at=NOW() WHERE id=?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        echo json_encode(['success' => true, 'message' => 'Sale marked as refunded.']);
    }

    else {
        echo json_encode(['success' => false, 'message' => 'Unknown action.']);
    }

    $db->close(); exit;
}

echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
