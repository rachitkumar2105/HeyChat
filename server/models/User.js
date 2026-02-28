const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    displayName: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: "" },
    isAdmin: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false }, // blocked by admin
    isBanned: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now },
    // Friends (accepted chat requests)
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // Incoming chat requests
    chatRequests: [
      {
        from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected"],
          default: "pending",
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    // Users this user has blocked
    blocked: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    loginCount: { type: Number, default: 0 },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
