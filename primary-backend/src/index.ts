// primary-backend/src/index.ts
import express from 'express';
import cors from 'cors';
import userRouter from './routes/user';
import zapRouter from './routes/zap';
// [MARK] New Imports for Available Triggers/Actions Router
import availableTriggerRouter from './routes/availableTrigger';
import availableActionRouter from './routes/availableAction';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Primary Backend is healthy!' });
});

// Mount user routes
app.use('/api/v1/user', userRouter);
// Mount zap routes
app.use('/api/v1/zap', zapRouter);
// [MARK] Mount new routes for available triggers and actions
app.use('/api/v1/trigger/available', availableTriggerRouter); // Matches frontend axios.get(`${BACKEND_URL}/api/v1/trigger/available`)
app.use('/api/v1/action/available', availableActionRouter);   // Matches frontend axios.get(`${BACKEND_URL}/api/v1/action/available`)


app.listen(PORT, () => {
    console.log(`Primary Backend server listening on port ${PORT}`);
});