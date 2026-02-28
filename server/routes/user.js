const express = require("express");
const router = express.Router();
const {
    searchUsers, sendRequest, acceptRequest, rejectRequest,
    getContacts, toggleBlock, getProfile,
    updateProfile, updatePrivacy
} = require("../controllers/userController");
const { protect } = require("../middleware/auth");

router.get("/search", protect, searchUsers);
router.post("/request", protect, sendRequest);
router.post("/accept", protect, acceptRequest);
router.post("/reject", protect, rejectRequest);
router.get("/contacts", protect, getContacts);
router.post("/block", protect, toggleBlock);
router.get("/profile/:id", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/privacy", protect, updatePrivacy);

module.exports = router;
