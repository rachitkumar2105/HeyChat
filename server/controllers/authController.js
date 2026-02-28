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

// @POST /api/auth/signup
const signup = async (req, res) => {
    try {
        const { displayName, username, email, password } = req.body;

        if (!displayName || !username || !email || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }

        // Password validation
        const pwErrors = validatePassword(password);
        if (pwErrors.length > 0) {
            return res.status(400).json({ error: pwErrors.join(", ") });
        }

        // Check duplicates
        const existingUser = await User.findOne({
            $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }],
        });
        if (existingUser) {
            if (existingUser.username === username.toLowerCase()) {
                return res.status(400).json({ error: "Username already taken" });
            }
            return res.status(400).json({ error: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await User.create({
            displayName,
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password: hashedPassword,
        });

        res.status(201).json({ message: "Account created successfully" });
    } catch (err) {
        console.error("Signup error:", err);
        res.status(500).json({ error: "Server error during signup" });
    }
};

// @POST /api/auth/login
const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: "Username and password required" });
        }

        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) return res.status(400).json({ error: "Invalid credentials" });
        if (user.isBanned) return res.status(403).json({ error: "Account has been banned" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

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
        console.error("Login error:", err);
        res.status(500).json({ error: "Server error during login" });
    }
};

// @POST /api/auth/admin-login
const adminLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Hardcoded admin credentials
        if (username === "admin123" && password === "admin123") {
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
                    username: "admin123",
                    isAdmin: true,
                },
            });
        }

        // Also allow DB admin users
        const user = await User.findOne({ username: username.toLowerCase(), isAdmin: true });
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
        res.status(500).json({ error: "Server error" });
    }
};

// @GET /api/auth/me
const getMe = async (req, res) => {
    res.json(req.user);
};

module.exports = { signup, login, adminLogin, getMe };
