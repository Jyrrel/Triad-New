<?php
/**
 * api/mobile.php — Mobile API for Flutter App
 * Endpoints for mobile app integration.
 * Supports authentication, menu fetching, order placement, etc.
 */
require_once 'config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$body   = json_decode(file_get_contents('php://input'), true) ?? [];
if (!$action) $action = $body['action'] ?? '';

$db = getDB();


function mobile_routes() {
    return [
        'POST?action=login' => 'Owner/staff login',
        'GET?action=menu' => 'List available menu for Flutter',
        'POST?action=place_order' => 'Create completed sale from Flutter app',
        'GET?action=orders' => 'Recent orders',
        'GET?action=health' => 'API health check',
        'GET?action=routes' => 'Discover available mobile endpoints'
    ];
}

if ($method === 'POST') {

    // Mobile login (staff or owner)
    if ($action === 'login') {
        $type = $body['type'] ?? 'staff'; // 'staff' or 'owner'
        if ($type === 'owner') {
            $username = trim($body['username'] ?? '');
            $password = trim($body['password'] ?? '');
            $stmt = $db->prepare("SELECT * FROM accounts WHERE username=?");
            $stmt->bind_param('s', $username);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows > 0) {
                $user = $result->fetch_assoc();
                if (password_verify($password, $user['password_hash'])) {
                    echo json_encode(['success' => true, 'user' => ['id' => $user['id'], 'username' => $user['username'], 'role' => $user['role']]]);
                } else {
                    echo json_encode(['success' => false, 'message' => 'Invalid password']);
                }
            } else {
                echo json_encode(['success' => false, 'message' => 'User not found']);
            }
        } elseif ($type === 'staff') {
            $email = trim($body['email'] ?? '');
            $pin = trim($body['pin'] ?? '');
            $stmt = $db->prepare("SELECT * FROM staff WHERE email=? AND pin=? AND status='active'");
            $stmt->bind_param('ss', $email, $pin);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result->num_rows > 0) {
                $user = $result->fetch_assoc();
                echo json_encode(['success' => true, 'user' => ['id' => $user['id'], 'name' => $user['first_name'] . ' ' . $user['last_name'], 'role' => $user['role']]]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Invalid credentials']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Invalid login type']);
        }
    }

    // Place order
    elseif ($action === 'place_order') {
        $user_id = intval($body['user_id'] ?? 0);
        $items = $body['items'] ?? [];
        $total = floatval($body['total'] ?? 0);
        $payment = trim($body['payment'] ?? 'cash');
        $customer = trim($body['customer'] ?? 'Mobile Guest');

        if ($total <= 0 || empty($items)) {
            echo json_encode(['success' => false, 'message' => 'Invalid order']);
            exit;
        }

        foreach ($items as $item) {
            $itemId = intval($item['id'] ?? 0);
            $itemQty = intval($item['qty'] ?? 0);
            $itemPrice = floatval($item['price'] ?? -1);
            if ($itemId <= 0 || $itemQty <= 0 || $itemPrice < 0) {
                echo json_encode(['success' => false, 'message' => 'Invalid item payload']);
                exit;
            }
        }

        $db->begin_transaction();
        try {
            // Insert sale
            $stmt = $db->prepare("INSERT INTO sales (customer, cashier, type, payment, persons, subtotal, tax, total, status) VALUES (?, 'Mobile App', 'dine-in', ?, 1, ?, ?, ?, 'completed')");
            $tax = $total * 0.12;
            $subtotal = $total - $tax;
            $stmt->bind_param('ssddd', $customer, $payment, $subtotal, $tax, $total);
            $stmt->execute();
            $sale_id = $db->insert_id;

            // Insert items
            foreach ($items as $item) {
                $stmt = $db->prepare("INSERT INTO sale_items (sale_id, menu_id, name, category, qty, price) VALUES (?, ?, ?, ?, ?, ?)");
                $stmt->bind_param('iissid', $sale_id, $item['id'], $item['name'], $item['category'], $item['qty'], $item['price']);
                $stmt->execute();

                // Deduct stock if applicable
                if ($item['type'] === 'stock') {
                    $db->query("UPDATE menu SET qty = GREATEST(0, qty - {$item['qty']}) WHERE id = {$item['id']}");
                }
            }

            $db->commit();
            echo json_encode(['success' => true, 'order_id' => $sale_id]);
        } catch (Exception $e) {
            $db->rollback();
            echo json_encode(['success' => false, 'message' => 'Order failed']);
        }
    }

    else {
        echo json_encode(['success' => false, 'message' => 'Unknown action']);
    }

} elseif ($method === 'GET') {

    if ($action === 'health') {
        echo json_encode(['success' => true, 'service' => 'triad-mobile-api', 'status' => 'ok', 'time' => date(DATE_ATOM)]);
    }

    elseif ($action === 'routes') {
        echo json_encode(['success' => true, 'data' => mobile_routes()]);
    }

    // Get menu
    elseif ($action === 'menu') {
        $result = $db->query("SELECT * FROM menu WHERE available=1 ORDER BY category, name");
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $row['qty'] = intval($row['qty']);
            $row['threshold'] = intval($row['threshold']);
            $row['price'] = floatval($row['price']);
            $row['cost'] = floatval($row['cost']);
            $row['available'] = intval($row['available']) === 1;
            $rows[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $rows]);
    }

    // Get orders
    elseif ($action === 'orders') {
        $user_id = intval($_GET['user_id'] ?? 0);
        $result = $db->query("SELECT * FROM sales ORDER BY created_at DESC LIMIT 50");
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $row['subtotal'] = floatval($row['subtotal']);
            $row['tax'] = floatval($row['tax']);
            $row['total'] = floatval($row['total']);
            $row['persons'] = intval($row['persons']);
            $rows[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $rows]);
    }

    else {
        echo json_encode(['success' => false, 'message' => 'Unknown action']);
    }

} else {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}

$db->close();
?>