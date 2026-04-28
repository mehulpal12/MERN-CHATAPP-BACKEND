import amqp from "amqplib";
import dotenv from "dotenv";
import sgMail from "@sendgrid/mail";

dotenv.config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

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

        console.log("✅ Mail service (SendGrid) started");

        channel.consume(queueName, async (msg) => {
            if (!msg) return;

            try {
                const { to, subject, text } = JSON.parse(
                    msg.content.toString()
                );

                if (!to || !subject || !text) {
                    throw new Error("Invalid message");
                }

                await sgMail.send({
                    to,
                    from: process.env.EMAIL_FROM!,
                    subject,
                    text,
                });

                console.log(`✅ Email sent to ${to}`);
                channel.prefetch(1);
                channel.ack(msg);
            } catch (error) {
                console.error("❌ Email failed:", error);
                channel.nack(msg);
            }
        });
    } catch (error) {
        console.error("❌ RabbitMQ connection failed", error);
        setTimeout(startSentOtpConsumer, 5000);
    }
};