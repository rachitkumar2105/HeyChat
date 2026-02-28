const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
    {
        // Exactly 2 participants for 1-to-1 chat
        participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        messages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],
        lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
        // Chat request status between these two users
        status: {
            type: String,
            enum: ["pending", "accepted", "rejected"],
            default: "pending",
        },
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Chat", chatSchema);
