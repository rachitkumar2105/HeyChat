const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
    {
        reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
        reason: { type: String, required: true },
        status: { type: String, enum: ["pending", "reviewed", "dismissed"], default: "pending" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);
