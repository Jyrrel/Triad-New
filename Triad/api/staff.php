<?php
/**
 * api/staff.php
 * GET  ?action=list               — get all active staff
 * GET  ?action=archive            — get staff archive
 * POST { action: 'save', ...data }— add or update staff
 * POST { action: 'archive', id }  — archive a staff member
 * POST { action: 'restore', id }  — restore from archive
 * POST { action: 'delete', id }   — permanently delete from archive
 * POST { action: 'toggle_status', id } — activate/deactivate
 */
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$body   = json_decode(file_get_contents('php://input'), true) ?? [];
if (!$action) $action = $body['action'] ?? '';

$db = getDB();

// ── GET requests ──────────────────────────────────────────
if ($method === 'GET') {

    if ($action === 'list') {
        $result = $db->query("SELECT * FROM staff ORDER BY first_name ASC");
        $rows   = [];
        while ($row = $result->fetch_assoc()) $rows[] = $row;
        echo json_encode(['success' => true, 'data' => $rows]);
    }

    elseif ($action === 'archive') {
        $result = $db->query("SELECT * FROM staff_archive ORDER BY archived_on DESC");
        $rows   = [];
        while ($row = $result->fetch_assoc()) $rows[] = $row;
        echo json_encode(['success' => true, 'data' => $rows]);
    }

    else {
        echo json_encode(['success' => false, 'message' => 'Unknown action.']);
    }
    $db->close();
    exit;
}

// ── POST requests ─────────────────────────────────────────
if ($method === 'POST') {

    // Save (add or update)
    if ($action === 'save') {
        $id         = intval($body['id'] ?? 0);
        $first      = trim($body['first']    ?? '');
        $last       = trim($body['last']     ?? '');
        $email      = trim($body['email']    ?? '');
        $phone      = trim($body['phone']    ?? '');
        $role       = trim($body['role']     ?? 'Barista');
        $pin        = trim($body['pin']      ?? '');
        $schedule   = trim($body['schedule'] ?? '');
        $status     = trim($body['status']   ?? 'active');
        $joined     = trim($body['joined']   ?? date('Y-m-d'));

        if (!$first || !$last) {
            echo json_encode(['success' => false, 'message' => 'First and last name required.']);
            $db->close(); exit;
        }
        if ($pin && !preg_match('/^\d{4}$/', $pin)) {
            echo json_encode(['success' => false, 'message' => 'PIN must be 4 digits.']);
            $db->close(); exit;
        }

        if ($id > 0) {
            // Update existing
            if ($pin) {
                $stmt = $db->prepare("UPDATE staff SET first_name=?, last_name=?, email=?, phone=?, role=?, pin=?, schedule=?, status=?, joined_date=? WHERE id=?");
                $stmt->bind_param('sssssssssi', $first, $last, $email, $phone, $role, $pin, $schedule, $status, $joined, $id);
            } else {
                $stmt = $db->prepare("UPDATE staff SET first_name=?, last_name=?, email=?, phone=?, role=?, schedule=?, status=?, joined_date=? WHERE id=?");
                $stmt->bind_param('ssssssssi', $first, $last, $email, $phone, $role, $schedule, $status, $joined, $id);
            }
            $stmt->execute();
            echo json_encode(['success' => true, 'message' => 'Staff updated.', 'id' => $id]);
        } else {
            // Insert new
            $pin_val = $pin ?: '0000';
            $stmt = $db->prepare("INSERT INTO staff (first_name, last_name, email, phone, role, pin, schedule, status, joined_date) VALUES (?,?,?,?,?,?,?,?,?)");
            $stmt->bind_param('sssssssss', $first, $last, $email, $phone, $role, $pin_val, $schedule, $status, $joined);
            $stmt->execute();
            echo json_encode(['success' => true, 'message' => 'Staff added.', 'id' => $db->insert_id]);
        }
    }

    // Toggle active/inactive
    elseif ($action === 'toggle_status') {
        $id = intval($body['id'] ?? 0);
        $stmt = $db->prepare("UPDATE staff SET status = IF(status='active','inactive','active') WHERE id=?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        // Return new status
        $r = $db->query("SELECT status FROM staff WHERE id=$id")->fetch_assoc();
        echo json_encode(['success' => true, 'new_status' => $r['status']]);
    }

    // Archive a staff member
    elseif ($action === 'archive') {
        $id = intval($body['id'] ?? 0);
        $stmt = $db->prepare("SELECT * FROM staff WHERE id=?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) {
            echo json_encode(['success' => false, 'message' => 'Staff not found.']);
            $db->close(); exit;
        }
        // Copy to archive
        $ins = $db->prepare("INSERT INTO staff_archive (original_id, first_name, last_name, email, phone, role, pin, schedule, status, joined_date) VALUES (?,?,?,?,?,?,?,?,?,?)");
        $ins->bind_param('isssssssss', $row['id'], $row['first_name'], $row['last_name'], $row['email'], $row['phone'], $row['role'], $row['pin'], $row['schedule'], $row['status'], $row['joined_date']);
        $ins->execute();
        // Delete from active
        $db->prepare("DELETE FROM staff WHERE id=?")->execute() || $db->query("DELETE FROM staff WHERE id=$id");
        $del = $db->prepare("DELETE FROM staff WHERE id=?");
        $del->bind_param('i', $id);
        $del->execute();
        echo json_encode(['success' => true, 'message' => 'Staff archived.']);
    }

    // Restore from archive
    elseif ($action === 'restore') {
        $archive_id = intval($body['id'] ?? 0);
        $stmt = $db->prepare("SELECT * FROM staff_archive WHERE id=?");
        $stmt->bind_param('i', $archive_id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) {
            echo json_encode(['success' => false, 'message' => 'Archive record not found.']);
            $db->close(); exit;
        }
        $ins = $db->prepare("INSERT INTO staff (first_name, last_name, email, phone, role, pin, schedule, status, joined_date) VALUES (?,?,?,?,?,?,?,'inactive',?)");
        $ins->bind_param('ssssssss', $row['first_name'], $row['last_name'], $row['email'], $row['phone'], $row['role'], $row['pin'], $row['schedule'], $row['joined_date']);
        $ins->execute();
        $new_id = $db->insert_id;
        $del = $db->prepare("DELETE FROM staff_archive WHERE id=?");
        $del->bind_param('i', $archive_id);
        $del->execute();
        echo json_encode(['success' => true, 'new_id' => $new_id, 'message' => 'Staff restored (set Inactive).']);
    }

    // Permanently delete from archive
    elseif ($action === 'delete') {
        $id = intval($body['id'] ?? 0);
        $stmt = $db->prepare("DELETE FROM staff_archive WHERE id=?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        echo json_encode(['success' => true]);
    }

    else {
        echo json_encode(['success' => false, 'message' => 'Unknown action.']);
    }

    $db->close();
    exit;
}

echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
