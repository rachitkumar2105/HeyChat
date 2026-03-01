const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

// Password validation
const validatePassword = (password) => {
    const errors = [];
    if (password.length < 8) errors.push("Minimum 8 characters");
    if (!/[A-Z]/.test(password)) errors.push("At least one uppercase letter");
    if (!/[a-z]/.test(password)) errors.push("At least one lowercase letter");
    if (!/[0-9]/.test(password)) errors.push("At least one number");
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
        errors.push("At least one special character");
    return errors;
};

// Generate username suggestions
const generateUsernameSuggestions = (username) => {
    const base = username.toLowerCase().replace(/[^a-z0-9]/g, "");
    return [
        `${base}${Math.floor(Math.random() * 900) + 100}`,
        `${base}_${Math.floor(Math.random() * 99) + 1}`,
        `${base}${new Date().getFullYear()}`,
    ];
};

// @POST /api/auth/signup
const signup = async (req, res) => {
    try {
        // Check DB connection status first
        if (require("mongoose").connection.readyState !== 1) {
            return res.status(503).json({ error: "Database temporarily unavailable. Please check MongoDB whitelisting/status." });
        }

        const { displayName, username, email, password } = req.body;

        if (!displayName || !username || !email || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }

        // Username format validation (only letters, numbers, underscores)
        if (!/^[a-z0-9_]{3,20}$/.test(username.toLowerCase())) {
            return res.status(400).json({ error: "Username must be 3-20 characters: letters, numbers, underscores only" });
        }

        // Password validation
        const pwErrors = validatePassword(password);
        if (pwErrors.length > 0) {
            return res.status(400).json({ error: pwErrors.join(", ") });
        }

        // Check if email already exists → signal frontend to redirect to login
        const emailExists = await User.findOne({ email: email.toLowerCase() });
        if (emailExists) {
            return res.status(409).json({ error: "Email already registered", redirect: "/login" });
        }

        // Check if username already taken → suggest alternatives
        const usernameExists = await User.findOne({ username: username.toLowerCase() });
        if (usernameExists) {
            const suggestions = generateUsernameSuggestions(username);
            return res.status(400).json({
                error: "Username already taken",
                suggestions,
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString("hex");
        const verificationTokenExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

        const user = await User.create({
            displayName: displayName.trim(),
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password: hashedPassword,
            verificationToken,
            verificationTokenExpire,
        });

        // Send verification email
        const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
        const message = `Welcome to HeyChat, ${user.displayName}!\n\nPlease verify your email by clicking the link below:\n\n${verifyUrl}\n\nThis link will expire in 24 hours.`;
        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #075e54;">Welcome to HeyChat!</h2>
                <p>Hi ${user.displayName},</p>
                <p>Thank you for joining HeyChat. Please verify your email address to activate your account:</p>
                <a href="${verifyUrl}" style="display: inline-block; padding: 10px 20px; background-color: #075e54; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Verify Email Address</a>
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p>${verifyUrl}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 12px; color: #888;">This link will expire in 24 hours. If you didn't create an account, please ignore this email.</p>
            </div>
        `;

        try {
            console.log(`[AUTH] Sending verification email to ${user.email}...`);
            await sendEmail({
                email: user.email,
                subject: "Verify your HeyChat Account",
                message,
                html,
            });
            console.log(`[AUTH] Verification email sent to ${user.email}`);
            res.status(201).json({ message: "Account created! Please check your email to verify your account." });
        } catch (emailErr) {
            console.error(`[AUTH] ERROR: Email send failed for ${user.email}:`, emailErr.message);
            // We still created the user, but they'll need a way to resend verification later if needed
            res.status(201).json({ message: "Account created, but verification email failed to send. Please check your Gmail App Password configuration." });
        }
    } catch (err) {
        console.error("Signup error:", err.message, err.stack);
        res.status(500).json({ error: "Server error during signup" });
    }
};

// @POST /api/auth/login  (login with email + password)
const login = async (req, res) => {
    try {
        // Check DB connection status
        if (require("mongoose").connection.readyState !== 1) {
            return res.status(503).json({ error: "Database temporarily unavailable." });
        }

        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(400).json({ error: "No account found with this email" });
        if (user.isBanned) return res.status(403).json({ error: "Account has been banned" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Incorrect password" });

        // Check verification
        if (!user.isVerified) {
            console.warn(`[AUTH] Login blocked: User ${user.email} is not verified.`);
            return res.status(401).json({ error: "Please verify your email to log in." });
        }

        // Update login stats
        user.loginCount += 1;
        user.lastLogin = new Date();
        user.lastActive = new Date();
        await user.save();

        const token = jwt.sign(
            { id: user._id, isAdmin: user.isAdmin },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            token,
            user: {
                id: user._id,
                displayName: user.displayName,
                username: user.username,
                email: user.email,
                profilePic: user.profilePic,
                isAdmin: user.isAdmin,
            },
        });

        // Send Login Notification Email (After response is sent to avoid delay)
        const loginTime = new Date().toLocaleString();
        const loginMessage = `Hello ${user.displayName},\n\nA new login was detected for your HeyChat account at ${loginTime}.\n\nIf this wasn't you, please change your password immediately.`;
        const loginHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h3 style="color: #075e54;">New Login Alert</h3>
                <p>Hello <b>${user.displayName}</b>,</p>
                <p>A new login was detected for your HeyChat account:</p>
                <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <p style="margin: 5px 0;"><b>Time:</b> ${loginTime}</p>
                    <p style="margin: 5px 0;"><b>Account:</b> ${user.email}</p>
                </div>
                <p>If this was you, you can safely ignore this email.</p>
                <p style="color: #d32f2f;"><b>If this wasn't you, please change your password immediately.</b></p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 12px; color: #888;">This is an automated security notification.</p>
            </div>
        `;

        sendEmail({
            email: user.email,
            subject: "Security Alert: New Login to HeyChat",
            message: loginMessage,
            html: loginHtml,
        }).catch(err => console.error("Login notification failed:", err.message));

        // Admin Notification
        const adminEmail = process.env.ADMIN_ALERT_EMAIL || process.env.EMAIL_USER;
        const adminHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #fcfcfc;">
                <h3 style="color: #d97706;">PROACTIVE ALERT: User Login</h3>
                <p>Hello Admin,</p>
                <p>A user has just logged into HeyChat:</p>
                <div style="background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <p style="margin: 5px 0;"><b>Name:</b> ${user.displayName}</p>
                    <p style="margin: 5px 0;"><b>Email:</b> ${user.email}</p>
                    <p style="margin: 5px 0;"><b>Username:</b> @${user.username}</p>
                    <p style="margin: 5px 0;"><b>Time:</b> ${loginTime}</p>
                </div>
                <p style="font-size: 12px; color: #888;">You can manage this user in the <a href="${process.env.CLIENT_URL}/admin">Admin Portal</a>.</p>
            </div>
        `;

        if (adminEmail) {
            sendEmail({
                email: adminEmail,
                subject: `HeyChat Activity: ${user.displayName} logged in`,
                message: `User ${user.displayName} (${user.email}) logged in at ${loginTime}.`,
                html: adminHtml,
            }).catch(err => console.error("Admin alert failed:", err.message));
        }

        console.log(`[LOGIN_ALERT] ${user.displayName} (${user.email}) logged in at ${loginTime}`);

    } catch (err) {
        console.error("Login error:", err.message);
        res.status(500).json({ error: "Server error during login" });
    }
};

// @POST /api/auth/admin-login  (admin: email admin@123 / password admin@123)
const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Hardcoded admin credentials
        if (email === "admin@123" && password === "admin@123") {
            const token = jwt.sign(
                { id: "admin", isAdmin: true },
                process.env.JWT_SECRET,
                { expiresIn: "1d" }
            );
            return res.json({
                token,
                user: {
                    id: "admin",
                    displayName: "Administrator",
                    username: "admin",
                    email: "admin@123",
                    isAdmin: true,
                },
            });
        }

        // Also allow DB admin users by email
        const user = await User.findOne({ email: email.toLowerCase(), isAdmin: true });
        if (!user) return res.status(400).json({ error: "Invalid admin credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid admin credentials" });

        const token = jwt.sign(
            { id: user._id, isAdmin: true },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({
            token,
            user: {
                id: user._id,
                displayName: user.displayName,
                username: user.username,
                isAdmin: true,
            },
        });
    } catch (err) {
        console.error("Admin login error:", err.message);
        res.status(500).json({ error: "Server error" });
    }
};

// @GET /api/auth/me
const getMe = async (req, res) => {
    res.json(req.user);
};

// @GET /api/auth/verify-email/:token
const verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;

        const user = await User.findOne({
            verificationToken: token,
            verificationTokenExpire: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).send(`
                <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                    <h1 style="color: #d32f2f;">❌ Verification Failed</h1>
                    <p>The verification link is invalid or has expired.</p>
                    <a href="${process.env.CLIENT_URL}/signup" style="color: #075e54;">Register again</a>
                </div>
            `);
        }

        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpire = undefined;
        await user.save();

        console.log(`[AUTH] User ${user.email} verified successfully.`);

        // Send Welcome Email
        const welcomeMessage = `Welcome to HeyChat, ${user.displayName}!\n\nYour account is now fully verified and ready to use. Start chatting with your friends now!`;
        const welcomeHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #075e54;">Registration Successful!</h2>
                <p>Hi ${user.displayName},</p>
                <p>Welcome to <b>HeyChat</b>! Your email has been verified, and your account is now active.</p>
                <p>You can now start sending messages, sharing media, and more.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.CLIENT_URL}/login" style="display: inline-block; padding: 12px 24px; background-color: #075e54; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Login to Start Chatting</a>
                </div>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 12px; color: #888;">Thank you for joining our community!</p>
            </div>
        `;

        sendEmail({
            email: user.email,
            subject: "Welcome to HeyChat - Registration Success!",
            message: welcomeMessage,
            html: welcomeHtml,
        }).catch(err => console.error(`[AUTH] Welcome email failed for ${user.email}:`, err.message));

        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h1 style="color: #075e54;">✅ Email Verified!</h1>
                <p>Your email has been successfully verified. You can now log in to HeyChat.</p>
                <a href="${process.env.CLIENT_URL}/login" style="display: inline-block; padding: 10px 20px; background-color: #075e54; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">Go to Login</a>
            </div>
        `);
    } catch (err) {
        console.error("Verification error:", err.message);
        res.status(500).json({ error: "Server error during verification" });
    }
};

module.exports = { signup, login, adminLogin, getMe, verifyEmail };
