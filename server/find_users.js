const mongoose = require('mongoose');
require('dotenv').config();

const findRecentUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const User = require('./models/User');
        const users = await User.find({
            createdAt: { $gte: new Date('2026-03-01') }
        }).sort({ createdAt: -1 });

        console.log('--- RECENT USERS ---');
        console.log(JSON.stringify(users, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

findRecentUsers();
