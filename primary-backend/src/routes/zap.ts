/// <reference path="../types/express/index.d.ts" />

import { Router, Request, Response, NextFunction } from 'express';
import { oMiddleware } from '../middleware/auth';
import { zapCreateSchema } from '../types';
import prisma from '../db';
import { Prisma } from '@prisma/client';

const zapRouter = Router();

// Endpoint to create a Zap
zapRouter.post('/', oMiddleware, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    console.log('[Zap Router] Handling create Zap request.');

    const userId = req.userId;

    if (!userId) {
      console.error('[Zap Router] Create Zap failed: userId not found on request.');
      return res.status(401).json({ message: 'Unauthorized: userId missing' });
    }

    const validationResult = zapCreateSchema.safeParse(req.body);

    if (!validationResult.success) {
      console.log('[Zap Router] Zap validation failed:', validationResult.error.errors);
      return res.status(400).json({
        message: 'Invalid Zap input data',
        errors: validationResult.error.errors
      });
    }

    const { availableTriggerId, triggerMetadata, actions } = validationResult.data;

    try {
      const zap = await prisma.zap.create({
        data: {
          userId: userId,
          
          trigger: {
            create: {
              availableTriggerId: availableTriggerId,
              metadata: triggerMetadata as Prisma.InputJsonValue || {},
            }
          },
          actions: {
            create: actions.map((action: any, index: number) => ({
              availableActionId: action.availableActionId,
              metadata: action.actionMetadata as Prisma.InputJsonValue || {},
              order: index + 1
            }))
          }
        },
        include: {
          trigger: {
            include: {
              availableTrigger: {
                select: {
                  id: true,
                  name: true,
                  image: true
                }
              }
            }
          },
          actions: {
            include: {
              availableAction: {
                select: {
                  id: true,
                  name: true,
                  image: true
                }
              }
            }
          }
        }
      });

      console.log('[Zap Router] Zap created successfully:', zap.id);
      res.status(201).json({
        message: 'Zap created successfully',
        zapId: zap.id
      });
    } catch (error) {
      console.error('[Zap Router] Zap creation error:', error);
      res.status(500).json({ message: 'Internal server error during Zap creation' });
    }
  })();
});

// Endpoint to fetch all Zaps for a user
zapRouter.get('/', oMiddleware, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    console.log('[Zap Router] Handling fetch all Zaps request.');

    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: userId missing' });
    }

    try {
      const zaps = await prisma.zap.findMany({
        where: { userId },
        include: {
          trigger: {
            include: {
              availableTrigger: {
                select: {
                  id: true,
                  name: true,
                  image: true
                }
              }
            }
          },
          actions: {
            include: {
              availableAction: {
                select: {
                  id: true,
                  name: true,
                  image: true
                }
              }
            },
            orderBy: {
              order: 'asc'
            }
          },
          user: { select: { id: true, email: true, name: true } }
        },
        
      });

      const formattedZaps = zaps.map(zap => ({
        ...zap,
        trigger: {
          ...zap.trigger,
          type: zap.trigger?.availableTrigger
        },
        actions: zap.actions.map(action => ({
          ...action,
          type: action.availableAction
        }))
      }));

      console.log(`[Zap Router] Fetched ${zaps.length} zaps for user: ${userId}`);
      res.status(200).json({ message: 'Zaps fetched successfully', zaps: formattedZaps });
    } catch (error) {
      console.error('[Zap Router] Error fetching Zaps:', error);
      res.status(500).json({ message: 'Internal server error while fetching Zaps' });
    }
  })();
});

// Endpoint to fetch a specific Zap by ID
zapRouter.get('/:zapId', oMiddleware, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    const userId = req.userId;
    const { zapId } = req.params;

    if (!zapId) {
      return res.status(400).json({ message: 'Bad Request: Zap ID is required.' });
    }

    try {
      const zap = await prisma.zap.findFirst({
        where: { id: zapId, userId },
        include: {
          trigger: {
            include: {
              availableTrigger: {
                select: {
                  id: true,
                  name: true,
                  image: true
                }
              }
            }
          },
          actions: {
            include: {
              availableAction: {
                select: {
                  id: true,
                  name: true,
                  image: true
                }
              }
            },
            orderBy: {
              order: 'asc'
            }
          },
          user: { select: { id: true, email: true, name: true } }
        }
      });

      if (!zap) {
        return res.status(404).json({ message: 'Zap not found' });
      }

      const formattedZap = {
        ...zap,
        trigger: {
          ...zap.trigger,
          type: zap.trigger?.availableTrigger
        },
        actions: zap.actions.map(action => ({
          ...action,
          type: action.availableAction
        }))
      };

      res.status(200).json({ message: 'Zap fetched successfully', zap: formattedZap });
    } catch (error) {
      console.error('[Zap Router] Error fetching Zap by ID:', error);
      res.status(500).json({ message: 'Internal server error while fetching Zap' });
    }
  })();
});

export default zapRouter;
