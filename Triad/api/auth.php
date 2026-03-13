<?php
/**
 * api/auth.php
 * Handles: Owner login, Staff login, Password change, Logout check
 * Method: POST
 * Body: { action, ...params }
 */
require_once 'config.php';

$body   = json_decode(file_get_contents('php://input'), true);
$action = $body['action'] ?? $_POST['action'] ?? '';

switch ($action) {

    // ── Owner Login ──────────────────────────────────
    case 'owner_login':
        $username = trim($body['username'] ?? '');
        $password = trim($body['password'] ?? '');

        if (!$username || !$password) {
            echo json_encode(['success' => false, 'message' => 'Missing credentials.']);
            exit;
        }

        $db = getDB();

        // 1. Check accounts table (owner account)
        $hash = hash('sha256', $password);
        $stmt = $db->prepare("SELECT id, username, email, role FROM accounts WHERE username = ? AND password_hash = ? AND role = 'owner' LIMIT 1");
        $stmt->bind_param('ss', $username, $hash);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 1) {
            $owner = $result->fetch_assoc();
            echo json_encode(['success' => true, 'role' => 'owner', 'username' => $owner['username']]);
            $db->close();
            break;
        }

        // 2. Check staff table — allow Manager role to log in as owner using email + PIN
        if (preg_match('/^\d{4}$/', $password)) {
            $stmt2 = $db->prepare("SELECT id, first_name, last_name, email FROM staff WHERE email = ? AND pin = ? AND role = 'Manager' AND status = 'active' LIMIT 1");
            $stmt2->bind_param('ss', $username, $password);
            $stmt2->execute();
            $result2 = $stmt2->get_result();

            if ($result2->num_rows === 1) {
                $manager = $result2->fetch_assoc();
                $displayName = $manager['first_name'] . ' ' . $manager['last_name'];
                echo json_encode(['success' => true, 'role' => 'owner', 'username' => $displayName]);
                $db->close();
                break;
            }
        }

        echo json_encode(['success' => false, 'message' => 'Incorrect username or password.']);
        $db->close();
        break;

    // ── Staff Login ──────────────────────────────────
    case 'staff_login':
        $email = trim($body['email'] ?? '');
        $pin   = trim($body['pin']   ?? '');

        if (!$email || !$pin || !preg_match('/^\d{4}$/', $pin)) {
            echo json_encode(['success' => false, 'message' => 'Invalid credentials.']);
            exit;
        }

        $db   = getDB();
        $stmt = $db->prepare("SELECT id, first_name, last_name, email, role FROM staff WHERE email = ? AND pin = ? AND status = 'active' LIMIT 1");
        $stmt->bind_param('ss', $email, $pin);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 1) {
            $staff = $result->fetch_assoc();
            echo json_encode([
                'success'  => true,
                'role'     => 'staff',
                'staff_id' => $staff['id'],
                'name'     => $staff['first_name'] . ' ' . $staff['last_name'],
                'email'    => $staff['email'],
                'position' => $staff['role']
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Invalid email or PIN.']);
        }
        $db->close();
        break;

    // ── Change Owner Password ────────────────────────
    case 'change_password':
        $username        = trim($body['username']         ?? '');
        $current_password = trim($body['current_password'] ?? '');
        $new_password    = trim($body['new_password']     ?? '');

        if (!$username || !$current_password || !$new_password) {
            echo json_encode(['success' => false, 'message' => 'All fields required.']);
            exit;
        }
        if (strlen($new_password) < 8) {
            echo json_encode(['success' => false, 'message' => 'New password must be at least 8 characters.']);
            exit;
        }

        $db          = getDB();
        $current_hash = hash('sha256', $current_password);
        $new_hash    = hash('sha256', $new_password);

        // Verify current password
        $stmt = $db->prepare("SELECT id FROM accounts WHERE username = ? AND password_hash = ? LIMIT 1");
        $stmt->bind_param('ss', $username, $current_hash);
        $stmt->execute();
        if ($stmt->get_result()->num_rows === 0) {
            echo json_encode(['success' => false, 'message' => 'Current password is incorrect.']);
            $db->close();
            exit;
        }

        // Update to new password
        $stmt2 = $db->prepare("UPDATE accounts SET password_hash = ? WHERE username = ?");
        $stmt2->bind_param('ss', $new_hash, $username);
        $stmt2->execute();
        echo json_encode(['success' => true, 'message' => 'Password updated successfully.']);
        $db->close();
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Unknown action.']);
}
