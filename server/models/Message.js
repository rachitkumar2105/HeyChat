const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: "" },
    type: { type: String, enum: ["text", "image", "audio", "video"], default: "text" },
    fileUrl: { type: String, default: "" },
    // Read receipts
    delivered: { type: Boolean, default: false },
    seen: { type: Boolean, default: false },
    seenAt: { type: Date },
    // Reply & forward
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    forwarded: { type: Boolean, default: false },
    // Deletion
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // delete for me
    deletedForEveryone: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
