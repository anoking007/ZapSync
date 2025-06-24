import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json()); // To parse JSON request bodies

// Define the webhook catch-all endpoint
// Example URL: /hooks/catch/:userId/:zapId
app.post('/hooks/catch/:userId/:zapId', (req, res) => {
    const userId = req.params.userId;
    const zapId = req.params.zapId;

    console.log(`Received webhook for User ID: ${userId}, Zap ID: ${zapId}`);
    console.log('Request body:', req.body);

    // --- Important: Security check (placeholder) ---
    // In a real application, you'd add authentication/authorization here.
    // For example, checking a secret key in the request headers or body
    // to ensure only authorized services hit this endpoint.
    // if (req.headers['x-api-key'] !== 'YOUR_SECRET_KEY') {
    //     return res.status(401).send('Unauthorized');
    // }
    // --- End security check ---

    // At this point, we need to:
    // 1. Store the new trigger event in the database.
    // 2. Push the event onto a queue (e.g., Kafka, Redis Streams) for processing.

    res.status(200).send('Webhook received successfully!');
});

app.listen(PORT, () => {
    console.log(`Hooks server listening on port ${PORT}`);
});