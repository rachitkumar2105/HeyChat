const nodemailer = require("nodemailer");

/**
 * sendEmail - Utility for sending emails via Gmail SMTP
 * @param {Object} options - { email, subject, message, html }
 */
const sendEmail = async (options) => {
    // 1) Validate input
    if (!options.email) throw new Error("Recipient email is required");

    // 2) Create a transporter with explicit settings for better reliability
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true, // use TLS
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        // Helpful for debugging
        debug: true,
        logger: true
    });

    // 3) Verify connection configuration
    try {
        await transporter.verify();
        console.log("[EMAIL] Transporter connection verified ✅");
    } catch (verifyError) {
        console.error("[EMAIL] Transporter verification FAILED ❌:", verifyError.message);
        throw new Error(`Email service connection failed: ${verifyError.message}`);
    }

    // 4) Define the email options
    const mailOptions = {
        from: `"HeyChat Team" <${process.env.EMAIL_USER}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html,
    };

    // 5) Actually send the email
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("✅ [EMAIL] Sent: %s", info.messageId);
        return info;
    } catch (error) {
        console.error("❌ [EMAIL] Send Error:", error.message);
        throw new Error(`Email could not be sent: ${error.message}`);
    }
};

module.exports = sendEmail;
