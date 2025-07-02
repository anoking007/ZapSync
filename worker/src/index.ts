require('dotenv').config()

import { PrismaClient } from "@prisma/client";
import { JsonObject } from "@prisma/client/runtime/library";
import { Kafka } from "kafkajs";
import { parse } from "./parser"; // Make sure parser.ts has the updated parse function
import { sendEmail } from "./email";
import { sendSol } from "./solana";

const prismaClient = new PrismaClient();
const TOPIC_NAME = "zap-events"

const kafka = new Kafka({
    clientId: 'outbox-processor-2',
    brokers: ['localhost:9092']
})

async function main() {
    // --- IMPORTANT CHANGE HERE FOR KAFKA CONSUMER ---
    const consumer = kafka.consumer({
        groupId: 'main-worker-2',
        sessionTimeout: 60000, // Increase to 60 seconds (60000 ms)
        rebalanceTimeout: 60000, // Matching rebalance timeout
    });
    // --- END IMPORTANT CHANGE ---

    await consumer.connect();
    const producer = kafka.producer();
    await producer.connect();

    await consumer.subscribe({ topic: TOPIC_NAME, fromBeginning: true })

    await consumer.run({
        autoCommit: false,
        eachMessage: async ({ topic, partition, message }) => {
            console.log({
                partition,
                offset: message.offset,
                value: message.value?.toString(),
            })
            if (!message.value?.toString()) {
                return;
            }

            const parsedValue = JSON.parse(message.value?.toString());
            const zapRunId = parsedValue.zapRunId;
            const stage = parsedValue.stage;

            const zapRunDetails = await prismaClient.zapRun.findFirst({
                where: {
                    id: zapRunId
                },
                include: {
                    zap: {
                        include: {
                            actions: {
                                include: {
                                    availableAction: true
                                }
                            }
                        }
                    },
                }
            });

            if (!zapRunDetails) {
                console.log(`ZapRun with ID ${zapRunId} not found. Skipping message.`);
                await consumer.commitOffsets([{
                    topic: TOPIC_NAME,
                    partition: partition,
                    offset: (parseInt(message.offset) + 1).toString()
                }]);
                return;
            }

            const currentAction = zapRunDetails.zap.actions.find((x: { sortingOrder: number; }) => x.sortingOrder === stage) as
                {
                    id: string;
                    zapId: string;
                    sortingOrder: number;
                    availableActionId: string;
                    metadata: JsonObject;
                    availableAction: {
                        id: string;
                        name: string;
                    };
                } | undefined;


            if (!currentAction) {
                console.log(`Current action for stage ${stage} not found in ZapRun ${zapRunId}. Skipping message.`);
                await consumer.commitOffsets([{
                    topic: TOPIC_NAME,
                    partition: partition,
                    offset: (parseInt(message.offset) + 1).toString()
                }]);
                return;
            }

            console.log(`Processing Stage ${stage}: Action ID is "${currentAction.availableAction.id}"`);

            let zapRunMetadata: JsonObject;
            if (zapRunDetails.metadata && typeof zapRunDetails.metadata === 'object' && !Array.isArray(zapRunDetails.metadata)) {
                zapRunMetadata = zapRunDetails.metadata as JsonObject;
            } else {
                console.warn(`ZapRun metadata for ID ${zapRunId} is not a valid JsonObject. It's:`, zapRunDetails.metadata);
                zapRunMetadata = {};
            }

            if (currentAction.availableAction.id === "solana-action") {
                const amountInput = (currentAction.metadata as JsonObject)?.amount as string | undefined;
                const addressInput = (currentAction.metadata as JsonObject)?.address as string | undefined;

                const amount = parse(amountInput || '', zapRunMetadata);
                const address = parse(addressInput || '', zapRunMetadata);

                console.log(`Parsed Solana Amount: "${amount}", Parsed Solana Address: "${address}"`);
                console.log(`Sending out SOL of ${amount} to address ${address}`);

                try {
                    await sendSol(address, amount);
                    console.log("Solana transaction sent successfully.");
                } catch (solanaError) {
                    console.error("Error sending Solana:", solanaError);
                    // No need to explicitly commit here, as re-throwing the error
                    // will cause KafkaJS not to commit the offset for this message,
                    // allowing it to be retried (or handled by a dead-letter queue if configured).
                }
            }

            if (currentAction.availableAction.id === "email-action") {
                const bodyInput = (currentAction.metadata as JsonObject)?.body as string | undefined;
                const toInput = (currentAction.metadata as JsonObject)?.email as string | undefined;

                const body = parse(bodyInput || '', zapRunMetadata);
                const to = parse(toInput || '', zapRunMetadata);

                console.log(`Parsed Email To: "${to}", Parsed Email Body: "${body}"`);
                console.log(`Sending out email to ${to} body is ${body}`);

                try {
                    await sendEmail(to, body);
                    console.log("Email sent successfully.");
                } catch (emailError) {
                    console.error("Error sending email:", emailError);
                    // Similar to Solana, re-throwing ensures KafkaJS handles the retry.
                }
            }

            await new Promise(r => setTimeout(r, 500));

            const lastStage = (zapRunDetails.zap.actions?.length || 1) - 1;
            console.log(`Last stage: ${lastStage}, Current stage: ${stage}`);

            if (lastStage !== stage) {
                console.log("Pushing back to the queue for next stage...");
                await producer.send({
                    topic: TOPIC_NAME,
                    messages: [{
                        value: JSON.stringify({
                            stage: stage + 1,
                            zapRunId
                        })
                    }]
                })
            }

            console.log("Processing done for this message.");

            await consumer.commitOffsets([{
                topic: TOPIC_NAME,
                partition: partition,
                offset: (parseInt(message.offset) + 1).toString()
            }])
        },
    })
}

main().catch(e => console.error("Worker crashed:", e));