const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

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
        await User.create({
            displayName: displayName.trim(),
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password: hashedPassword,
        });

        res.status(201).json({ message: "Account created successfully" });
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

module.exports = { signup, login, adminLogin, getMe };
