const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const dns = require('dns');
const db = require('../config/db');
const crypto = require('crypto');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Force Node.js to use IPv4 first to avoid ENETUNREACH on cloud environments like Render
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const router = express.Router();

function getMailTransporter() {
    const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;

    if (!SMTP_USER || !SMTP_PASS) {
        throw new Error('SMTP is not configured. Set SMTP_USER and SMTP_PASS or RESEND_API_KEY.');
    }

    const cleanUser = (SMTP_USER || '').trim();
    const cleanPass = (SMTP_PASS || '').replace(/\s+/g, '');
    const port = Number(SMTP_PORT || 587);
    const isExplicitSecure = SMTP_SECURE === 'true' || port === 465;

    return nodemailer.createTransport({
        host: SMTP_HOST || 'smtp.gmail.com',
        port: port,
        secure: isExplicitSecure,
        requireTLS: !isExplicitSecure,
        auth: {
            user: cleanUser,
            pass: cleanPass,
        },
        tls: {
            rejectUnauthorized: false,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
    });
}

async function sendSystemEmail({ to, subject, html, text }) {
    const recipient = Array.isArray(to) ? to[0] : to;

    // 1. Resend HTTP REST API (port 443 HTTPS - 100% immune to Cloud SMTP port blocks)
    if (process.env.RESEND_API_KEY) {
        const fromAddr = process.env.MAIL_FROM ? process.env.MAIL_FROM.replace(/^"|"$/g, '') : 'Smart Classroom <onboarding@resend.dev>';
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: fromAddr,
                to: [recipient],
                subject: subject,
                html: html,
                text: text
            })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(`Resend API: ${data.message || JSON.stringify(data)}`);
        }
        return { response: 'Resend HTTP API OK', id: data.id };
    }

    // 2. Brevo HTTP REST API (port 443 HTTPS)
    if (process.env.BREVO_API_KEY) {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'api-key': process.env.BREVO_API_KEY.trim(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: 'Smart Classroom', email: process.env.SMTP_USER || 'no-reply@smartclassroom.com' },
                to: [{ email: recipient }],
                subject: subject,
                htmlContent: html,
                textContent: text
            })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(`Brevo API: ${data.message || JSON.stringify(data)}`);
        }
        return { response: 'Brevo HTTP API OK', messageId: data.messageId };
    }

    // 3. Fallback to standard SMTP
    const transporter = getMailTransporter();
    const senderUser = (process.env.SMTP_USER || '').trim();
    const senderFrom = process.env.MAIL_FROM ? process.env.MAIL_FROM.replace(/^"|"$/g, '') : `Smart Classroom <${senderUser}>`;

    return await transporter.sendMail({
        from: senderFrom,
        to: recipient,
        subject: subject,
        text: text,
        html: html,
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
        if (!email) {
            return res.status(400).json({ error: 'Email hoặc tên đăng nhập là bắt buộc.' });
        }

        // 1. Check whether the email or username exists
        const [users] = await db.query('SELECT * FROM users WHERE email = ? OR username = ?', [email, email]);
        if (users.length === 0) {
            return res.json({ message: 'Yêu cầu của bạn đã được gửi tới Quản trị viên.' });
        }

        const user = users[0];

        // 2. Set a flag to notify the admin (reset_requested = 1)
        await db.query('UPDATE users SET reset_requested = 1 WHERE id = ?', [user.id]);

        // 3. Return a success message to the frontend immediately
        res.json({ message: 'Yêu cầu cấp lại mật khẩu của bạn đã được gửi tới Admin. Vui lòng chờ duyệt!' });

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
            'UPDATE users SET reset_token = ?, reset_token_expiry = ?, reset_requested = 0 WHERE email = ? OR username = ?',
            [resetToken, expireTime, target_email, target_email]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Account not found.' });
        }

        const [users] = await db.query('SELECT email FROM users WHERE email = ? OR username = ?', [target_email, target_email]);
        const recipientEmail = users[0]?.email || target_email;

        const frontendUrl = (process.env.FRONTEND_URL || 'https://classroom-monitoring-system.vercel.app').replace(/\/$/, '');
        const resetLink = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(recipientEmail)}`;
        
        console.log(`[ĐÃ DUYỆT] Link khôi phục của ${recipientEmail} là: ${resetLink}`);
        try {
            const mailInfo = await sendSystemEmail({
                to: recipientEmail,
                subject: 'Smart Classroom - Yêu cầu khôi phục mật khẩu',
                text: `Sử dụng liên kết này để đặt lại mật khẩu cho tài khoản Smart Classroom của bạn: ${resetLink}`,
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 24px; border: 1px solid #1e293b; border-radius: 12px; background-color: #0f172a; color: #f8fafc;">
                  <h2 style="color: #38bdf8; margin-top: 0;">Smart Classroom</h2>
                  <p>Xin chào <strong>${recipientEmail}</strong>,</p>
                  <p>Yêu cầu cấp lại mật khẩu của bạn đã được Quản trị viên phê duyệt thành công.</p>
                  <p>Vui lòng nhấp vào nút bên dưới để tiến hành đặt mật khẩu mới (Liên kết có hiệu lực trong 15 phút):</p>
                  <div style="text-align: center; margin: 25px 0;">
                    <a href="${resetLink}" style="background-color: #38bdf8; color: #0f172a; font-weight: bold; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Đặt lại mật khẩu</a>
                  </div>
                  <p style="font-size: 12px; color: #94a3b8;">Hoặc sao chép liên kết dán vào trình duyệt:<br/><a href="${resetLink}" style="color: #38bdf8;">${resetLink}</a></p>
                  <hr style="border-color: #334155; margin-top: 20px;" />
                  <p style="font-size: 11px; color: #64748b;">Nếu bạn không phải người gửi yêu cầu, vui lòng bỏ qua email này.</p>
                </div>
                `,
            });
            console.log(`[APPROVE-RESET] Gửi email thành công cho ${recipientEmail}:`, mailInfo.response);
        } catch (mailError) {
            await db.query(
                'UPDATE users SET reset_token = NULL, reset_token_expiry = NULL, reset_requested = 1 WHERE email = ?',
                [recipientEmail]
            );
            console.error('Password reset email could not be sent:', mailError.message);
            return res.status(502).json({ error: 'Could not send reset email. Check SMTP configuration: ' + mailError.message });
        }

        res.json({ message: `Đã gửi email cấp lại mật khẩu thành công cho ${recipientEmail}!` });
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
