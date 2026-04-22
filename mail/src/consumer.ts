import amqp from "amqplib";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.USER,
        pass: process.env.PASSWORD,
    },
    pool: true,
    maxConnections: 1,
    maxMessages: 5,
});

export const startSentOtpConsumer = async () => {
    try {
        const connection = await amqp.connect({
            protocol: "amqp",
            hostname: process.env.RABBITMQ_HOST,
            port: 5672,
            username: process.env.RABBITMQ_USER,
            password: process.env.RABBITMQ_PASSWORD,
        });

        const channel = await connection.createChannel();
        const queueName = "send_otp";

        await channel.assertQueue(queueName, { durable: true });

        channel.prefetch(1);

        console.log("✅ Mail service started");

        connection.on("close", () => {
            console.log("🔁 Reconnecting...");
            setTimeout(startSentOtpConsumer, 5000);
        });

        connection.on("error", (err) => {
            console.error("❌ RabbitMQ error:", err);
        });

        channel.consume(queueName, async (msg) => {
            if (!msg) return;

            try {
                const { to, subject, text } = JSON.parse(
                    msg.content.toString()
                );

                if (!to || !subject || !text) {
                    throw new Error("Invalid message");
                }

                await transport.sendMail({
                    from: `"Chat App" <${process.env.USER}>`,
                    to,
                    subject,
                    text,
                });

                console.log(`✅ OTP email sent to ${to}`);

                channel.ack(msg);
            } catch (error) {
                const { to } = JSON.parse(msg.content.toString());
                console.error(`❌ Email failed for ${to}`, error);

                const headers = msg.properties.headers || {};
                const retries = headers["x-retries"] || 0;

                if (retries < 3) {
                    const delay = Math.min(1000 * Math.pow(2, retries), 10000);
                    await new Promise(res => setTimeout(res, delay));

                    channel.sendToQueue(queueName, msg.content, {
                        headers: { "x-retries": retries + 1 },
                        persistent: true,
                        contentType: msg.properties.contentType,
                    });
                } else {
                    console.error(`❌ Message dropped after retries for ${to}`);
                }

                channel.ack(msg);
            }
        });
    } catch (error) {
        console.error("❌ RabbitMQ connection failed", error);
        setTimeout(startSentOtpConsumer, 5000);
    }
};