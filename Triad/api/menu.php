<?php
/**
 * api/menu.php — with image upload support
 */
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

$body = [];
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (strpos($contentType, 'application/json') !== false) {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
} else {
    $body = $_POST;
}
if (!$action) $action = $body['action'] ?? '';

$db = getDB();

$uploadDir = __DIR__ . '/../assets/assets/image/';
$uploadUrl = '../assets/assets/image/';

if ($method === 'GET') {
    if ($action === 'list') {
        $result = $db->query("SELECT * FROM menu ORDER BY category, name");
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $row['qty']       = intval($row['qty']);
            $row['threshold'] = intval($row['threshold']);
            $row['price']     = floatval($row['price']);
            $row['cost']      = floatval($row['cost']);
            $row['available'] = intval($row['available']) === 1;
            $rows[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $rows]);
    } elseif ($action === 'archive') {
        $result = $db->query("SELECT * FROM menu_archive ORDER BY archived_on DESC");
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $row['price'] = floatval($row['price']);
            $row['cost']  = floatval($row['cost']);
            $rows[] = $row;
        }
        echo json_encode(['success' => true, 'data' => $rows]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Unknown action.']);
    }
    $db->close(); exit;
}

if ($method === 'POST') {

    if ($action === 'save') {
        $id          = intval($body['id'] ?? 0);
        $name        = trim($body['name'] ?? '');
        $category    = trim($body['category'] ?? 'hot-coffee');
        $type        = trim($body['type'] ?? 'manual');
        $qty         = intval($body['qty'] ?? 999);
        $threshold   = intval($body['threshold'] ?? 0);
        $unit        = trim($body['unit'] ?? 'cups');
        $price       = floatval($body['price'] ?? 0);
        $cost        = floatval($body['cost'] ?? 0);
        $available   = intval($body['available'] ?? 1);
        $description = trim($body['description'] ?? '');

        if (!$name) { echo json_encode(['success' => false, 'message' => 'Item name required.']); $db->close(); exit; }
        if ($price < 0) { echo json_encode(['success' => false, 'message' => 'Selling price cannot be negative.']); $db->close(); exit; }
        if ($cost < 0) { echo json_encode(['success' => false, 'message' => 'Unit cost cannot be negative.']); $db->close(); exit; }
        if ($qty < 0) $qty = 0;
        if ($threshold < 0) $threshold = 0;
        if ($type === 'manual') $qty = 999;

        // Handle image upload
        $image_path = null;
        if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $file    = $_FILES['image'];
            $ext     = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
            if (!in_array($ext, $allowed)) {
                echo json_encode(['success' => false, 'message' => 'Invalid image type.']);
                $db->close(); exit;
            }
            $safeName = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $name);
            $filename = $safeName . '_' . time() . '.' . $ext;
            if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
            if (move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) {
                $image_path = $uploadUrl . $filename;
            } else {
                echo json_encode(['success' => false, 'message' => 'Failed to save image.']);
                $db->close(); exit;
            }
        }

        if ($id > 0) {
            if ($image_path !== null) {
                // Delete old image
                $old = $db->query("SELECT image_path FROM menu WHERE id=$id")->fetch_assoc();
                if ($old && $old['image_path']) { $f = $uploadDir . basename($old['image_path']); if (file_exists($f)) @unlink($f); }
                $stmt = $db->prepare("UPDATE menu SET name=?,category=?,type=?,qty=?,threshold=?,unit=?,price=?,cost=?,available=?,description=?,image_path=? WHERE id=?");
                $stmt->bind_param('sssiiisdissi', $name,$category,$type,$qty,$threshold,$unit,$price,$cost,$available,$description,$image_path,$id);
            } else {
                $stmt = $db->prepare("UPDATE menu SET name=?,category=?,type=?,qty=?,threshold=?,unit=?,price=?,cost=?,available=?,description=? WHERE id=?");
                $stmt->bind_param('sssiiisdisi', $name,$category,$type,$qty,$threshold,$unit,$price,$cost,$available,$description,$id);
            }
            $stmt->execute();
            echo json_encode(['success' => true, 'id' => $id, 'image_path' => $image_path]);
        } else {
            if ($image_path !== null) {
                $stmt = $db->prepare("INSERT INTO menu (name,category,type,qty,threshold,unit,price,cost,available,description,image_path) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
                $stmt->bind_param('sssiiisdiss', $name,$category,$type,$qty,$threshold,$unit,$price,$cost,$available,$description,$image_path);
            } else {
                $stmt = $db->prepare("INSERT INTO menu (name,category,type,qty,threshold,unit,price,cost,available,description) VALUES (?,?,?,?,?,?,?,?,?,?)");
                $stmt->bind_param('sssiiisdis', $name,$category,$type,$qty,$threshold,$unit,$price,$cost,$available,$description);
            }
            $stmt->execute();
            echo json_encode(['success' => true, 'id' => $db->insert_id, 'image_path' => $image_path]);
        }

    } elseif ($action === 'toggle_avail') {
        $id = intval($body['id'] ?? 0);
        $stmt = $db->prepare("UPDATE menu SET available = IF(available=1,0,1) WHERE id=?");
        $stmt->bind_param('i', $id); $stmt->execute();
        $r = $db->query("SELECT available FROM menu WHERE id=$id")->fetch_assoc();
        echo json_encode(['success' => true, 'available' => intval($r['available']) === 1]);

    } elseif ($action === 'archive') {
        $id = intval($body['id'] ?? 0);
        $stmt = $db->prepare("SELECT * FROM menu WHERE id=?"); $stmt->bind_param('i',$id); $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) { echo json_encode(['success'=>false,'message'=>'Item not found.']); $db->close(); exit; }
        $ins = $db->prepare("INSERT INTO menu_archive (original_id,name,category,type,qty,threshold,unit,price,cost,description,image_path) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
        $ins->bind_param('isssiiisdss', $row['id'],$row['name'],$row['category'],$row['type'],$row['qty'],$row['threshold'],$row['unit'],$row['price'],$row['cost'],$row['description'],$row['image_path']);
        $ins->execute();
        $del = $db->prepare("DELETE FROM menu WHERE id=?"); $del->bind_param('i',$id); $del->execute();
        echo json_encode(['success' => true]);

    } elseif ($action === 'restore') {
        $aid = intval($body['id'] ?? 0);
        $stmt = $db->prepare("SELECT * FROM menu_archive WHERE id=?"); $stmt->bind_param('i',$aid); $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) { echo json_encode(['success'=>false,'message'=>'Not found.']); $db->close(); exit; }
        $img = $row['image_path'] ?? null;
        if ($row['original_id']) {
            $ins = $db->prepare("INSERT INTO menu (id,name,category,type,qty,threshold,unit,price,cost,available,description,image_path) VALUES (?,?,?,?,?,?,?,?,?,1,?,?)");
            $ins->bind_param('isssiiisdss',$row['original_id'],$row['name'],$row['category'],$row['type'],$row['qty'],$row['threshold'],$row['unit'],$row['price'],$row['cost'],$row['description'],$img);
        } else {
            $ins = $db->prepare("INSERT INTO menu (name,category,type,qty,threshold,unit,price,cost,available,description,image_path) VALUES (?,?,?,?,?,?,?,?,1,?,?)");
            $ins->bind_param('sssiiisdss',$row['name'],$row['category'],$row['type'],$row['qty'],$row['threshold'],$row['unit'],$row['price'],$row['cost'],$row['description'],$img);
        }
        $ins->execute(); $new_id = $db->insert_id;
        $del = $db->prepare("DELETE FROM menu_archive WHERE id=?"); $del->bind_param('i',$aid); $del->execute();
        echo json_encode(['success' => true, 'new_id' => $new_id]);

    } elseif ($action === 'delete') {
        $id = intval($body['id'] ?? 0);
        $row = $db->query("SELECT image_path FROM menu_archive WHERE id=$id")->fetch_assoc();
        if ($row && $row['image_path']) { $f = $uploadDir . basename($row['image_path']); if (file_exists($f)) @unlink($f); }
        $stmt = $db->prepare("DELETE FROM menu_archive WHERE id=?"); $stmt->bind_param('i',$id); $stmt->execute();
        echo json_encode(['success' => true]);

    } else {
        echo json_encode(['success' => false, 'message' => 'Unknown action.']);
    }

    $db->close(); exit;
}
echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
