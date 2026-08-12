const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const db = require('../config/db');
const crypto = require('crypto');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

function getMailTransporter() {
    const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS.');
    }

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: SMTP_SECURE === 'true',
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });
}

// Account creation API (used to test password hashing)
router.post('/register', async (req, res) => {
    const { full_name, email, username: requestedUsername, password, role } = req.body;
    try {
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ error: 'Email hợp lệ và mật khẩu ít nhất 8 ký tự là bắt buộc.' });
        }

        const usernameSource = typeof requestedUsername === 'string'
            ? requestedUsername
            : normalizedEmail.split('@')[0];
        const username = usernameSource.trim();
        if (!/^[A-Za-z0-9._-]{1,50}$/.test(username)) {
            return res.status(400).json({ error: 'Tên đăng nhập không hợp lệ.' });
        }

        const requestedRole = ['user', 'technician'].includes(role) ? role : 'user';

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            'INSERT INTO users (full_name, email, username, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)',
            [full_name?.trim() || 'Guest', normalizedEmail, username, hashedPassword, requestedRole, 'pending']
        );

        await db.query(
            'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
            [result.insertId, 'REGISTER', `Tạo tài khoản mới với email: ${normalizedEmail} (Chờ duyệt)`]
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
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ error: 'JWT_SECRET is not configured.' });
        }
        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ message: 'Email/username and password are required.' });
        }

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
            role: user.role,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Approve account (Admin only)
router.put('/approve-user', verifyToken, requireRole('admin'), async (req, res) => {
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
            return res.json({ message: 'If the account exists, the request has been sent to an administrator.' });
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
        if (typeof email !== 'string' || typeof token !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) {
            return res.status(400).json({ error: 'Email, token and a password of at least 8 characters are required.' });
        }

        // Validate the reset token and its expiry time
        const [users] = await db.query(
            // `reset_token_expiry` is written by Node.js as a UTC time. Compare it
            // with MySQL's UTC clock as well, so the result does not depend on the
            // Windows/MySQL server time zone.
            'SELECT * FROM users WHERE email = ? AND reset_token = ? AND reset_token_expiry > UTC_TIMESTAMP()',
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
router.get('/admin/reset-requests', verifyToken, requireRole('admin'), async (req, res) => {
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
router.post('/admin/approve-reset', verifyToken, requireRole('admin'), async (req, res) => {
    const { target_email } = req.body;

    try {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expireTime = new Date(Date.now() + 15 * 60 * 1000); 

        const [result] = await db.query(
            'UPDATE users SET reset_token = ?, reset_token_expiry = ?, reset_requested = 0 WHERE email = ?',
            [resetToken, expireTime, target_email]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetLink = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(target_email)}`;
        
        console.log(`[ĐÃ DUYỆT] Link khôi phục của ${target_email} là:`);
        try {
            const transporter = getMailTransporter();
            await transporter.sendMail({
                from: process.env.MAIL_FROM || process.env.SMTP_USER,
                to: target_email,
                subject: 'Smart Classroom - Password reset request',
                text: `Use this link to reset your password. It expires in 15 minutes: ${resetLink}`,
                html: `<h2>Smart Classroom</h2><p>You requested a password reset.</p><p><a href="${resetLink}">Reset your password</a></p><p>This link expires in 15 minutes. If you did not make this request, ignore this email.</p>`,
            });
        } catch (mailError) {
            await db.query(
                'UPDATE users SET reset_token = NULL, reset_token_expiry = NULL, reset_requested = 1 WHERE email = ?',
                [target_email]
            );
            console.error('Password reset email could not be sent:', mailError.message);
            return res.status(502).json({ error: 'Could not send reset email. Check SMTP configuration.' });
        }

        res.json({ message: `Đã duyệt thành công cho ${target_email}!` });

    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống: " + error.message });
    }
});

// Get the full list of users for the Admin page
router.get('/admin/users', verifyToken, requireRole('admin'), async (req, res) => {
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
