// primary-backend/src/routes/availableTrigger.ts
import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db'; // Import centralized Prisma client

const availableTriggerRouter = Router();

// Endpoint to get all available trigger types
// GET /api/v1/trigger/available
availableTriggerRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
    console.log('[Available Trigger Router] Handling get all available triggers request.');

    try {
        // Find all available triggers from the database
        const availableTriggers = await prisma.availableTrigger.findMany({
            // You can add `select` here if you only want specific fields
            select: {
                id: true,
                name: true,
                metadata: true, // Include metadata if needed for frontend logic
               image: true 
            }
        });

        console.log(`[Available Trigger Router] Fetched ${availableTriggers.length} available triggers.`);
        res.status(200).json({
            message: 'Available triggers fetched successfully!',
            availableTriggers: availableTriggers
        });

    } catch (error) {
        console.error('[Available Trigger Router] Error fetching available triggers:', error);
        // Pass the error to the next middleware for centralized handling
        next(error);
    }
});

export default availableTriggerRouter;