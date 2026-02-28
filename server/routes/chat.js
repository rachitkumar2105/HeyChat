const express = require("express");
const router = express.Router();
const {
    getMessages, getChatList, getChatWith,
    deleteMessage, forwardMessage, clearChat
} = require("../controllers/chatController");
const { protect } = require("../middleware/auth");

router.get("/list", protect, getChatList);
router.get("/with/:userId", protect, getChatWith);
router.get("/:chatId/messages", protect, getMessages);
router.delete("/message/:id", protect, deleteMessage);
router.post("/forward", protect, forwardMessage);
router.post("/clear/:chatId", protect, clearChat);

module.exports = router;
