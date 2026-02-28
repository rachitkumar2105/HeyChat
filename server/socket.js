const jwt = require("jsonwebtoken");
const Message = require("./models/Message");
const Chat = require("./models/Chat");
const User = require("./models/User");

// Map userId -> socketId for online tracking
const onlineUsers = new Map();

module.exports = (io) => {
  // JWT auth for sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId;
    console.log(`User connected: ${userId}`);

    // Register user as online
    onlineUsers.set(userId, socket.id);
    socket.join(userId); // join personal room

    // Notify contacts that this user is online
    socket.broadcast.emit("userOnline", { userId });

    // Update lastActive in DB
    if (userId !== "admin") {
      await User.findByIdAndUpdate(userId, { lastActive: new Date() });

      // Mark pending messages as delivered
      const undelivered = await Message.find({
        receiver: userId,
        delivered: false,
        deletedForEveryone: false,
      });
      if (undelivered.length > 0) {
        await Message.updateMany(
          { receiver: userId, delivered: false },
          { delivered: true }
        );
        undelivered.forEach((msg) => {
          const senderSocketId = onlineUsers.get(String(msg.sender));
          if (senderSocketId) {
            io.to(senderSocketId).emit("messageDelivered", { messageId: msg._id });
          }
        });
      }
    }

    // ─── Private Message ───────────────────────────────────────────────
    socket.on("privateMessage", async (data) => {
      try {
        const { to, content, type, fileUrl, replyTo } = data;

        // Check if sender is blocked by receiver
        const receiver = await User.findById(to);
        if (!receiver) return;
        if (receiver.blocked.includes(userId)) return;

        // Find or create chat
        let chat = await Chat.findOne({
          participants: { $all: [userId, to] },
          status: "accepted",
        });
        if (!chat) {
          socket.emit("error", { message: "No active chat with this user" });
          return;
        }

        const receiverOnline = onlineUsers.has(String(to));

        // Create message
        const message = await Message.create({
          sender: userId,
          receiver: to,
          content,
          type: type || "text",
          fileUrl: fileUrl || "",
          replyTo: replyTo || null,
          delivered: receiverOnline,
          seen: false,
        });

        // Add to chat
        chat.messages.push(message._id);
        chat.lastMessage = message._id;
        await chat.save();

        // Populate replyTo for response
        await message.populate("replyTo", "content type sender");

        // Emit to receiver
        io.to(String(to)).emit("receiveMessage", message);

        // Emit back to sender with DB id
        socket.emit("messageSent", message);

        // Notify sender of delivery status
        if (receiverOnline) {
          socket.emit("messageDelivered", { messageId: message._id });
        }
      } catch (err) {
        console.error("privateMessage error:", err);
      }
    });

    // ─── Typing Indicators ─────────────────────────────────────────────
    socket.on("typing", ({ to }) => {
      io.to(String(to)).emit("userTyping", { from: userId });
    });

    socket.on("stopTyping", ({ to }) => {
      io.to(String(to)).emit("userStopTyping", { from: userId });
    });

    // ─── Message Seen ──────────────────────────────────────────────────
    socket.on("messageSeen", async ({ messageId, senderId }) => {
      try {
        const message = await Message.findByIdAndUpdate(
          messageId,
          { seen: true, seenAt: new Date() },
          { new: true }
        );
        if (message) {
          const senderSocketId = onlineUsers.get(String(senderId));
          if (senderSocketId) {
            io.to(senderSocketId).emit("messageSeen", { messageId, seenAt: message.seenAt });
          }
        }
      } catch (err) {
        console.error("messageSeen error:", err);
      }
    });

    // ─── Delete Message (real-time) ────────────────────────────────────
    socket.on("deleteMessage", async ({ messageId, deleteForEveryone, receiverId }) => {
      if (deleteForEveryone) {
        io.to(String(receiverId)).emit("messageDeleted", { messageId, deleteForEveryone: true });
      }
    });

    // ─── Disconnect ────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      console.log(`User disconnected: ${userId}`);
      onlineUsers.delete(userId);

      if (userId !== "admin") {
        await User.findByIdAndUpdate(userId, { lastActive: new Date() });
      }

      socket.broadcast.emit("userOffline", { userId, lastActive: new Date() });
    });
  });
};
