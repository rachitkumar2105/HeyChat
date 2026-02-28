const User = require("../models/User");
const Message = require("../models/Message");
const Report = require("../models/Report");
const Chat = require("../models/Chat");

// @GET /api/admin/stats
const getStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ isAdmin: false });
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const activeUsers = await User.countDocuments({
            lastActive: { $gte: fiveMinutesAgo },
            isAdmin: false,
        });
        const totalMessages = await Message.countDocuments();
        const totalReports = await Report.countDocuments();
        const bannedUsers = await User.countDocuments({ isBanned: true });

        res.json({ totalUsers, activeUsers, totalMessages, totalReports, bannedUsers });
    } catch (err) {
        res.status(500).json({ error: "Failed to get stats" });
    }
};

// @GET /api/admin/users
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({ isAdmin: false })
            .select("-password")
            .sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: "Failed to get users" });
    }
};

// @POST /api/admin/ban/:id — toggle ban
const toggleBan = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: "User not found" });
        user.isBanned = !user.isBanned;
        await user.save();
        res.json({ isBanned: user.isBanned, message: user.isBanned ? "User banned" : "User unbanned" });
    } catch (err) {
        res.status(500).json({ error: "Failed to toggle ban" });
    }
};

// @DELETE /api/admin/user/:id
const deleteUser = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: "User deleted" });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete user" });
    }
};

// @GET /api/admin/reports
const getReports = async (req, res) => {
    try {
        const reports = await Report.find()
            .populate("reportedBy", "username displayName")
            .populate("reportedUser", "username displayName")
            .populate("messageId", "content type")
            .sort({ createdAt: -1 });
        res.json(reports);
    } catch (err) {
        res.status(500).json({ error: "Failed to get reports" });
    }
};

// @DELETE /api/admin/message/:id — remove abusive message
const deleteMessage = async (req, res) => {
    try {
        const msg = await Message.findById(req.params.id);
        if (!msg) return res.status(404).json({ error: "Message not found" });
        msg.deletedForEveryone = true;
        msg.content = "[Removed by admin]";
        await msg.save();
        res.json({ message: "Message removed" });
    } catch (err) {
        res.status(500).json({ error: "Failed to remove message" });
    }
};

// @PATCH /api/admin/report/:id — update report status
const updateReportStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const report = await Report.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: "Failed to update report" });
    }
};

module.exports = { getStats, getAllUsers, toggleBan, deleteUser, getReports, deleteMessage, updateReportStatus };
