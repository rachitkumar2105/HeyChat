const express = require("express");
const router = express.Router();
const { signup, login, adminLogin, getMe, verifyEmail, resendVerification } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

router.post("/signup", signup);
router.get("/verify-email/:token", verifyEmail);
router.post("/login", login);
router.post("/resend-verification", resendVerification);
router.post("/admin-login", adminLogin);
router.post("/admin-login", adminLogin);
router.get("/me", protect, getMe);

module.exports = router;
