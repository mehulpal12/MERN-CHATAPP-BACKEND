import amqp from "amqplib";
// It communicates with RabbitMQ over TCP Transmission Control Protocol

let channel: amqp.Channel;

export const connectRabbitMQ = async () => {
    try {
        const connection = await amqp.connect({
            protocol: "amqp",
            hostname: process.env.RABBITMQ_HOST,
            port: 5672,
            username: process.env.RABBITMQ_USER,
            password: process.env.RABBITMQ_PASSWORD,
        })
        connection.removeAllListeners();



        connection.on("close", () => {
            console.log("Reconnecting...");
            setTimeout(connectRabbitMQ, 5000);
        });
        connection.on("error", (err) => {
            console.error("RabbitMQ error:", err);
        });

        channel = await connection.createConfirmChannel();

        console.log("✅ RabbitMQ connected");
    } catch (error) {
        console.error("failed to connect to RabbitMQ", error);
    }
};

export const publishToQueue = async (queueName: string, message: any) => {
    if (!channel) {
        console.error("RabbitMQ not connected");
        return
    }
    await channel.assertQueue(queueName, { durable: true });

    
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), { persistent: true });
    console.log(`✅ Message sent to ${queueName}`);
}

