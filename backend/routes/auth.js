const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const router = express.Router();

// Account creation API (used to test password hashing)
router.post('/register', async (req, res) => {
    const { full_name, email, username, password, role } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ error: "Email và password là bắt buộc!" });
        }

        const username = email.split('@')[0];

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            'INSERT INTO users (full_name, email, username, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)',
            [full_name || 'Guest', email, username, hashedPassword, role || 'user', 'pending']
        );

        await db.query(
            'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
            [result.insertId, 'REGISTER', `Tạo tài khoản mới với email: ${email} (Chờ duyệt)`]
        );

        res.status(201).json({ message: "Đăng ký thành công!", userId: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: "Email hoặc tài khoản này đã tồn tại!" });
        }
        res.status(500).json({ error: error.message });
    }
});

// Login API and issue token
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM users WHERE email = ? OR username = ?', [email, email]);
        if (users.length === 0) 
            return res.status(404).json({ message: "Account not found!" });

        const user = users[0];

        if (user.status === 'pending') {
            return res.status(403).json({ message: "Your account is pending admin approval." });
        }
        if (user.status === 'rejected') {
            return res.status(403).json({ message: "Your account has been rejected." });
        }

        // Compare the supplied password with the hashed password in the database
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) 
            return res.status(401).json({ message: "Incorrect password!" });

        const token = jwt.sign(
            { 
                id: user.id, 
                role: user.role, 
                username: user.username,
                email: user.email
             },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );

        await db.query(
            'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
            [user.id, 'LOGIN', 'Đăng nhập thành công vào hệ thống']
        );

        res.json({
            message: "Login successful!",
            token: token,
            role: user.role
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Approve account (Admin only)
router.put('/approve-user', async (req, res) => {
    try {
        const { target_email, new_status } = req.body;

        if (!['approved', 'rejected'].includes(new_status)) {
            return res.status(400).json({ error: 'Invalid status!' });
        }

        const [result] = await db.query(
            'UPDATE users SET status = ? WHERE email = ?',
            [new_status, target_email]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Account not found!' });
        }

        res.json({ message: `Updated account ${target_email} to ${new_status}.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Forgot password API
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        // 1. Check whether the email exists
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'No account was found with this email.' });
        }

        // 2. Set a flag to notify the admin (reset_requested = 1)
        await db.query('UPDATE users SET reset_requested = 1 WHERE email = ?', [email]);

        // 3. Return a success message to the frontend immediately
        res.json({ message: 'Your request has been sent to the admin. Please wait for approval.' });

    } catch (error) {
        res.status(500).json({ error: 'System error: ' + error.message });
    }
});

// Reset password API
router.post('/reset-password', async (req, res) => {
    const { email, token, newPassword } = req.body;

    try {
        // Validate the reset token and its expiry time
        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ? AND reset_token = ? AND reset_token_expiry > NOW()',
            [email, token]
        );

        if (users.length === 0) {
            return res.status(400).json({ error: 'The reset link is invalid or has expired.' });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the password and clear the token
        await db.query(
            'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE email = ?',
            [hashedPassword, email]
        );

        res.json({ message: 'Password updated successfully. You can sign in with your new password.' });
    } catch (error) {
        res.status(500).json({ error: 'System error: ' + error.message });
    }
});

// Get all users who have requested a password reset (Admin only)
router.get('/admin/reset-requests', async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, full_name, email, role FROM users WHERE reset_requested = 1'
        );
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi hệ thống: ' + error.message });
    }
});

// Create a reset token and send it to the user (Admin only)
router.post('/admin/approve-reset', async (req, res) => {
    const { target_email } = req.body;

    try {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expireTime = new Date(Date.now() + 15 * 60 * 1000); 

        await db.query(
            'UPDATE users SET reset_token = ?, reset_token_expiry = ?, reset_requested = 0 WHERE email = ?',
            [resetToken, expireTime, target_email]
        );

        const resetLink = `http://localhost:5173/reset-password?token=${resetToken}&email=${target_email}`;
        
        console.log(`[ĐÃ DUYỆT] Link khôi phục của ${target_email} là:`);
        console.log(resetLink);

        res.json({ message: `Đã duyệt thành công cho ${target_email}!` });

    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

// Get the full list of users for the Admin page
router.get('/admin/users', async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, full_name, username, email, role, status, reset_requested FROM users'
        );
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi hệ thống: ' + error.message });
    }
});

module.exports = router;