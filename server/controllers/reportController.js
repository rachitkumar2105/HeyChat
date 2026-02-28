const Report = require("../models/Report");

// @POST /api/report
const createReport = async (req, res) => {
    try {
        const { reportedUser, messageId, reason } = req.body;
        if (!reason) return res.status(400).json({ error: "Reason is required" });

        const report = await Report.create({
            reportedBy: req.user._id,
            reportedUser,
            messageId,
            reason,
        });
        res.status(201).json({ message: "Report submitted", report });
    } catch (err) {
        res.status(500).json({ error: "Failed to submit report" });
    }
};

module.exports = { createReport };
