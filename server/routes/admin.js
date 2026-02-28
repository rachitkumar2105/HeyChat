const express = require("express");
const router = express.Router();
const {
  getStats, getAllUsers, toggleBan, deleteUser,
  getReports, deleteMessage, updateReportStatus
} = require("../controllers/adminController");
const { protect, adminOnly } = require("../middleware/auth");

router.use(protect, adminOnly);

router.get("/stats", getStats);
router.get("/users", getAllUsers);
router.post("/ban/:id", toggleBan);
router.delete("/user/:id", deleteUser);
router.get("/reports", getReports);
router.delete("/message/:id", deleteMessage);
router.patch("/report/:id", updateReportStatus);

module.exports = router;
