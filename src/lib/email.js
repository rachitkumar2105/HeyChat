import emailjs from '@emailjs/browser';

const SERVICE_ID = 'YOUR_EMAILJS_SERVICE_ID';
const TEMPLATE_ID = 'YOUR_EMAILJS_TEMPLATE_ID';
const PUBLIC_KEY = 'YOUR_EMAILJS_PUBLIC_KEY';

export const sendLoginAlert = async (email, username) => {
    try {
        const templateParams = {
            to_email: email,
            to_name: username,
            message: `New login detected for account: ${email}`,
        };

        await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
        console.log("Login alert sent!");
    } catch (error) {
        console.error("Failed to send login alert:", error);
    }
};
