const Message = require("../models/Message");
const Chat = require("../models/Chat");
const User = require("../models/User");

// @GET /api/chat/:chatId/messages
const getMessages = async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user._id;

        const chat = await Chat.findById(chatId).populate({
            path: "messages",
            populate: { path: "replyTo", select: "content type sender" },
        });

        if (!chat) return res.status(404).json({ error: "Chat not found" });
        if (!chat.participants.includes(userId)) {
            return res.status(403).json({ error: "Not authorized" });
        }

        // Filter out messages deleted for this user
        const messages = chat.messages.filter(
            (m) => !m.deletedForEveryone && !m.deletedFor.includes(userId)
        );

        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: "Failed to get messages" });
    }
};

// @GET /api/chat/list — get all chats for current user
const getChatList = async (req, res) => {
    try {
        const userId = req.user._id;
        const chats = await Chat.find({
            participants: userId,
            status: "accepted",
        })
            .populate("participants", "displayName username profilePic lastActive")
            .populate("lastMessage");

        res.json(chats);
    } catch (err) {
        res.status(500).json({ error: "Failed to get chats" });
    }
};

// @GET /api/chat/with/:userId — get or create chat with user
const getChatWith = async (req, res) => {
    try {
        const userId = req.user._id;
        const otherId = req.params.userId;

        let chat = await Chat.findOne({
            participants: { $all: [userId, otherId] },
        })
            .populate("participants", "displayName username profilePic lastActive")
            .populate({
                path: "messages",
                populate: { path: "replyTo", select: "content type sender" },
            });

        if (!chat) return res.status(404).json({ error: "Chat not found" });
        res.json(chat);
    } catch (err) {
        res.status(500).json({ error: "Failed to get chat" });
    }
};

// @DELETE /api/chat/message/:id — delete message
const deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { deleteForEveryone } = req.body;
        const userId = req.user._id;

        const message = await Message.findById(id);
        if (!message) return res.status(404).json({ error: "Message not found" });

        if (deleteForEveryone) {
            if (String(message.sender) !== String(userId)) {
                return res.status(403).json({ error: "Can only delete your own messages for everyone" });
            }
            message.deletedForEveryone = true;
            message.content = "This message was deleted";
        } else {
            if (!message.deletedFor.includes(userId)) {
                message.deletedFor.push(userId);
            }
        }
        await message.save();
        res.json({ message: "Message deleted", deleteForEveryone });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete message" });
    }
};

// @POST /api/chat/forward — forward message
const forwardMessage = async (req, res) => {
    try {
        const { messageId, toUserId } = req.body;
        const userId = req.user._id;

        const original = await Message.findById(messageId);
        if (!original) return res.status(404).json({ error: "Message not found" });

        const chat = await Chat.findOne({
            participants: { $all: [userId, toUserId] },
            status: "accepted",
        });
        if (!chat) return res.status(404).json({ error: "No active chat with this user" });

        const newMsg = await Message.create({
            sender: userId,
            receiver: toUserId,
            content: original.content,
            type: original.type,
            fileUrl: original.fileUrl,
            forwarded: true,
        });

        chat.messages.push(newMsg._id);
        chat.lastMessage = newMsg._id;
        await chat.save();

        res.json(newMsg);
    } catch (err) {
        res.status(500).json({ error: "Failed to forward message" });
    }
};

// @POST /api/chat/clear/:chatId — clear chat history for current user
const clearChat = async (req, res) => {
    try {
        const { chatId } = req.params;
        const userId = req.user._id;

        const chat = await Chat.findById(chatId);
        if (!chat) return res.status(404).json({ error: "Chat not found" });

        // Mark all messages as deleted for this user
        await Message.updateMany(
            { _id: { $in: chat.messages } },
            { $addToSet: { deletedFor: userId } }
        );

        res.json({ message: "Chat cleared" });
    } catch (err) {
        res.status(500).json({ error: "Failed to clear chat" });
    }
};

module.exports = { getMessages, getChatList, getChatWith, deleteMessage, forwardMessage, clearChat };
