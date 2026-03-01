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
    // Profile Details
    about: { type: String, default: "Hey there! I am using HeyChat" },
    phoneNumber: { type: String, default: "" },
    socialLinks: {
      instagram: { type: String, default: "" },
      twitter: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      website: { type: String, default: "" },
    },
    // Privacy Settings
    privacy: {
      lastSeen: { type: String, enum: ["everyone", "contacts", "nobody"], default: "everyone" },
      profilePhoto: { type: String, enum: ["everyone", "contacts", "nobody"], default: "everyone" },
      about: { type: String, enum: ["everyone", "contacts", "nobody"], default: "everyone" },
      status: { type: String, enum: ["everyone", "contacts", "nobody"], default: "everyone" },
      readReceipts: { type: Boolean, default: true },
    },
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
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    verificationTokenExpire: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
