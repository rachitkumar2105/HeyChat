const User = require("../models/User");
const Chat = require("../models/Chat");

// @GET /api/user/search?query=
const searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.json([]);
        const users = await User.find({
            $or: [
                { username: { $regex: query, $options: "i" } },
                { displayName: { $regex: query, $options: "i" } },
            ],
            _id: { $ne: req.user._id },
            isBanned: false,
        }).select("displayName username profilePic lastActive");
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: "Search failed" });
    }
};

// @POST /api/user/request — send chat request
const sendRequest = async (req, res) => {
    try {
        const { toId } = req.body;
        const fromId = req.user._id;

        if (String(fromId) === String(toId)) {
            return res.status(400).json({ error: "Cannot send request to yourself" });
        }

        const toUser = await User.findById(toId);
        if (!toUser) return res.status(404).json({ error: "User not found" });

        // Check if blocked
        if (toUser.blocked.includes(fromId)) {
            return res.status(403).json({ error: "Cannot send request to this user" });
        }

        // Check if already friends
        const fromUser = await User.findById(fromId);
        if (fromUser.friends.includes(toId)) {
            return res.status(400).json({ error: "Already friends" });
        }

        // Check if request already exists
        const existingRequest = toUser.chatRequests.find(
            (r) => String(r.from) === String(fromId) && r.status === "pending"
        );
        if (existingRequest) {
            return res.status(400).json({ error: "Request already sent" });
        }

        toUser.chatRequests.push({ from: fromId, status: "pending" });
        await toUser.save();

        res.json({ message: "Chat request sent" });
    } catch (err) {
        res.status(500).json({ error: "Failed to send request" });
    }
};

// @POST /api/user/accept — accept chat request
const acceptRequest = async (req, res) => {
    try {
        const { requestId } = req.body;
        const userId = req.user._id;

        const user = await User.findById(userId);
        const request = user.chatRequests.id(requestId);
        if (!request) return res.status(404).json({ error: "Request not found" });

        request.status = "accepted";
        user.friends.push(request.from);
        await user.save();

        // Add to sender's friends too
        await User.findByIdAndUpdate(request.from, {
            $addToSet: { friends: userId },
        });

        // Create chat document
        const existingChat = await Chat.findOne({
            participants: { $all: [userId, request.from] },
        });
        if (!existingChat) {
            await Chat.create({
                participants: [userId, request.from],
                status: "accepted",
                requestedBy: request.from,
            });
        }

        res.json({ message: "Request accepted" });
    } catch (err) {
        res.status(500).json({ error: "Failed to accept request" });
    }
};

// @POST /api/user/reject — reject chat request
const rejectRequest = async (req, res) => {
    try {
        const { requestId } = req.body;
        const user = await User.findById(req.user._id);
        const request = user.chatRequests.id(requestId);
        if (!request) return res.status(404).json({ error: "Request not found" });
        request.status = "rejected";
        await user.save();
        res.json({ message: "Request rejected" });
    } catch (err) {
        res.status(500).json({ error: "Failed to reject request" });
    }
};

// @GET /api/user/contacts — get friends + pending requests
const getContacts = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate("friends", "displayName username profilePic lastActive")
            .populate("chatRequests.from", "displayName username profilePic");

        res.json({
            friends: user.friends,
            requests: user.chatRequests.filter((r) => r.status === "pending"),
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to load contacts" });
    }
};

// @POST /api/user/block — block or unblock user
const toggleBlock = async (req, res) => {
    try {
        const { targetId } = req.body;
        const user = await User.findById(req.user._id);

        const isBlocked = user.blocked.includes(targetId);
        if (isBlocked) {
            user.blocked = user.blocked.filter((id) => String(id) !== String(targetId));
        } else {
            user.blocked.push(targetId);
        }
        await user.save();
        res.json({ blocked: !isBlocked, message: isBlocked ? "User unblocked" : "User blocked" });
    } catch (err) {
        res.status(500).json({ error: "Failed to toggle block" });
    }
};

// @GET /api/user/profile/:id
const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select(
            "displayName username profilePic lastActive createdAt"
        );
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: "Failed to get profile" });
    }
};

module.exports = { searchUsers, sendRequest, acceptRequest, rejectRequest, getContacts, toggleBlock, getProfile };
