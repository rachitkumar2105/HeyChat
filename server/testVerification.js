const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/auth'; // Adjust port if necessary

async function testFlow() {
    const testUser = {
        displayName: "Test User",
        username: "testuser_" + Date.now(),
        email: "test_" + Date.now() + "@example.com",
        password: "Password123!"
    };

    console.log("1. Testing Signup...");
    try {
        const signupRes = await axios.post(`${BASE_URL}/signup`, testUser);
        console.log("Signup Response:", signupRes.data.message);
    } catch (err) {
        console.error("Signup Failed:", err.response?.data || err.message);
    }

    console.log("\n2. Testing Login (Unverified)...");
    try {
        await axios.post(`${BASE_URL}/login`, {
            email: testUser.email,
            password: testUser.password
        });
    } catch (err) {
        console.log("Expected Error (Unverified):", err.response?.data.error);
    }

    console.log("\n3. Testing Resend Verification...");
    try {
        const resendRes = await axios.post(`${BASE_URL}/resend-verification`, {
            email: testUser.email
        });
        console.log("Resend Response:", resendRes.data.message);
    } catch (err) {
        console.error("Resend Failed:", err.response?.data || err.message);
    }
}

testFlow();
