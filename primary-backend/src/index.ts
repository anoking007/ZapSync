// primary-backend/src/index.ts
import express from 'express';
import cors from 'cors'; // Import cors
import userRouter from './routes/user'; // Import user router
import zapRouter from './routes/zap';   // Import zap router

const app = express();
const PORT = process.env.PORT || 3000; // Default port

// Middleware setup
app.use(express.json()); // Parses incoming JSON requests
app.use(cors());         // Enables Cross-Origin Resource Sharing

// Route setup
// All routes starting with /api/v1/user will be handled by userRouter
app.use('/api/v1/user', userRouter);
// All routes starting with /api/v1/zap will be handled by zapRouter
app.use('/api/v1/zap', zapRouter);

// Simple root endpoint for health check or welcome message
app.get('/', (req, res) => {
    res.send('Zapier Clone Primary Backend is running!');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Primary Backend server listening on port ${PORT}`);
    console.log(`Test User routes: http://localhost:${PORT}/api/v1/user/signup`);
    console.log(`Test Zap routes: http://localhost:${PORT}/api/v1/zap/create`);
});