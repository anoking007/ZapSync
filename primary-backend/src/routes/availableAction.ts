// primary-backend/src/routes/availableAction.ts
import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db'; // Import centralized Prisma client

const availableActionRouter = Router();

// Endpoint to get all available action types
// GET /api/v1/action/available
availableActionRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
    console.log('[Available Action Router] Handling get all available actions request.');

    try {
        // Find all available actions from the database
        const availableActions = await prisma.availableAction.findMany({
            // You can add `select` here if you only want specific fields
            select: {
                id: true,
                name: true,
                metadata: true ,// Include metadata if needed for frontend logic
                image: true 
            }
        });

        console.log(`[Available Action Router] Fetched ${availableActions.length} available actions.`);
        res.status(200).json({
            message: 'Available actions fetched successfully!',
            availableActions: availableActions
        });

    } catch (error) {
        console.error('[Available Action Router] Error fetching available actions:', error);
        // Pass the error to the next middleware for centralized handling
        next(error);
    }
});

export default availableActionRouter;