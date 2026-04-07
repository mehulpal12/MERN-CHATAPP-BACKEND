import amqp from "amqplib";

import nodemailer from "nodemailer"
import dotenv from "dotenv"
dotenv.config();

// this is my job that is done by worker here 
export const startSentOtpConsumer = async()=>{
    try {
        const connection = await amqp.connect({
            protocol: "amqp",
            hostname: process.env.RABBITMQ_HOST,
            port: 5672,
            username: process.env.RABBITMQ_USER,
            password: process.env.RABBITMQ_PASSWORD,
        })
        const channel = await connection.createChannel();

        const queueName = "send_otp"
        await channel.assertQueue(queueName, {durable : true});
        console.log("✅ Mail services consumer started, listening for otp emails");

        channel.consume(queueName, async(msg)=>{
            if(msg){
                try {
                    const {to, subject, text} = JSON.parse(msg.content.toString());
                    
                    const transport = nodemailer.createTransport({
                        host: 'smtp.gmail.com',
                        port: 465,
                        auth: {
                            user: process.env.USER,
                            pass: process.env.PASSWORD,
                        },
                    })

                    await transport.sendMail({
                        from: `"Chat App" <${process.env.USER}>`,
                        to,
                        subject,
                        text,
                    })
                    console.log(`✅ OTP email sent to ${to}`);
                    channel.ack(msg);
                } catch (error) {
                    console.error("Failed to process otp email request", error);
                    channel.nack(msg);
                }
            }
        })
    } catch (error) {
        console.error("failed to connect to RabbitMQ", error);
    }
}
