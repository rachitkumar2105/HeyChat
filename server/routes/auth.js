const express = require("express");
const router = express.Router();
const { signup, login, adminLogin, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

router.post("/signup", signup);
router.post("/login", login);
router.post("/admin-login", adminLogin);
router.get("/me", protect, getMe);

module.exports = router;
