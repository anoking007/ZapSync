import express from 'express';
import { PrismaClient } from '@prisma/client'; // Import PrismaClient

const app = express();
const PORT = process.env.PORT || 3002;
const prisma = new PrismaClient(); // Initialize Prisma Client

app.use(express.json());

// Define the webhook catch-all endpoint
// Example URL: /hooks/catch/:userId/:zapId
app.post('/hooks/catch/:userId/:zapId', async (req, res) => {
    const userId = req.params.userId; // We're ignoring this for now, but in a real system, you'd validate it
    const zapId = req.params.zapId;
    const incomingPayload = req.body; // The entire body from the webhook

    console.log(`Received webhook for User ID: ${userId}, Zap ID: ${zapId}`);
    console.log('Request body:', incomingPayload);

    // --- Important: Security check (placeholder) ---
    // In a real application, you'd retrieve the actual Zap configuration
    // using zapId and userId, and perform validation (e.g., check for a secret key
    // associated with the webhook trigger of this zap).
    // For simplicity, we'll assume the zapId is valid for now.
    // --- End security check ---

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Find the Zap and its associated Trigger
            const zap = await tx.zap.findUnique({
                where: { id: zapId },
                include: { trigger: true } // Include the trigger to link the TriggerEvent
            });

            if (!zap || !zap.trigger) {
                console.error(`Zap or Trigger not found for zapId: ${zapId}`);
                // Potentially create a "dead letter" entry or log for investigation
                return res.status(404).send('Zap or associated trigger not found.');
            }

            // 2. Store the incoming webhook payload as a ZapRun
            const zapRun = await tx.zapRun.create({
                data: {
                    zapId: zap.id,
                    metadata: incomingPayload as any, // Store the raw webhook body as JSON
                    status: "PENDING", // Initial status
                    // Link to TriggerEvent if needed, or create a new TriggerEvent
                    // For now, we'll use ZapRun as the primary event for execution
                }
            });

            console.log(`ZapRun created with ID: ${zapRun.id}`);

            // 3. Create an entry in the ZapRunOutbox table (Transactional Outbox Pattern)
            await tx.zapRunOutbox.create({
                data: {
                    zapRunId: zapRun.id,
                    eventType: "ZapRun.Started", // Indicates this event is for starting a ZapRun
                    payload: { // The data to be sent to the message queue consumer
                        zapRunId: zapRun.id,
                        zapId: zap.id,
                        triggerPayload: incomingPayload, // Pass the original payload
                        // Add other relevant data like user ID, action chain info if needed later
                    },
                    processed: false,
                }
            });

            console.log(`ZapRunOutbox entry created for ZapRun ID: ${zapRun.id}`);
        });

        // If the transaction succeeds, send a success response
        res.status(200).json({ message: 'Webhook received and queued for processing successfully!' });

    } catch (error) {
        console.error('Error processing webhook:', error);
        // If anything fails within the transaction, it will be rolled back.
        // Respond with an error so the upstream system (e.g., GitHub, RazorPay) knows.
        res.status(500).json({ message: 'Internal server error while processing webhook.' });
    }
});

app.listen(PORT, () => {
    console.log(`Hooks server listening on port ${PORT}`);
});