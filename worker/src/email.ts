import nodemailer from "nodemailer";
// Ensure dotenv is loaded if this file can be run standalone.

const transport = nodemailer.createTransport({
    host: process.env.SMTP_ENDPOINT,
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD,
    },
});

export async function sendEmail(to: string, body: string) {
    try {
        console.log(`Email: Attempting to send email to ${to} from ${process.env.SMTP_FROM_EMAIL}`); // Added logging
        const info = await transport.sendMail({
            from: process.env.SMTP_FROM_EMAIL, // FIX: Use the verified email from .env
            sender: process.env.SMTP_FROM_EMAIL, // FIX: Consistent sender
            to,
            subject: "Hello from Zapier",
            text: body,
            html: `<p>${body}</p>` // Recommended: provide an HTML version too
        });
        console.log("Email: Sent successfully! Message ID:", info.messageId); // Success log
    } catch (error) {
        console.error("Email: Sending failed:", error); // Detailed error logging
        // IMPORTANT: Observe these errors in your worker logs after restart
    }
}