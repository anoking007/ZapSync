// primary-backend/src/routes/user.ts
/// <reference path="../types/express/index.d.ts" />

import { Router, Request, Response } from 'express';
import { oMiddleware } from '../middleware/auth';
import { signupData, signinData } from '../types'; // Ensure signinData is imported
import prisma from '../db'; // Import centralized Prisma client
import bcrypt from 'bcryptjs'; // Import bcryptjs
import jwt from 'jsonwebtoken'; // Import jsonwebtoken
import { JWT_SECRET } from '../config'; // Import JWT_SECRET

const userRouter = Router();

// Endpoint for user signup
userRouter.post('/signup', (req: Request, res: Response, next) => {
  void (async () => {
    console.log('[User Router] Handling signup request.');

    const validationResult = signupData.safeParse(req.body);

    if (!validationResult.success) {
      console.log('[User Router] Validation failed:', validationResult.error.errors);
      return res.status(400).json({
        message: 'Invalid input data',
        errors: validationResult.error.errors
      });
    }

    const { email, password, name } = validationResult.data;

    try {
      const userExists = await prisma.user.findUnique({ where: { email } });

      if (userExists) {
        return res.status(409).json({ message: 'User with this email already exists.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || null,
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      res.status(201).json({
        message: 'User registered successfully!',
        user: newUser,
      });

    } catch (error) {
      console.error('[User Router] Signup error:', error);
      res.status(500).json({ message: 'Internal server error during signup.' });
    }
  })();
});


// ... (rest of user.ts - signin and get user will be implemented next) ...
// Endpoint for user signin
userRouter.post('/signin', (req: Request, res: Response, next) => {
  void (async () => {
    console.log('[User Router] Handling signin request.');

    // 1. Validate incoming request body using zod
    const validationResult = signinData.safeParse(req.body);

    if (!validationResult.success) {
      console.log('[User Router] Signin validation failed:', validationResult.error.errors);
      res.status(400).json({
        message: 'Invalid input data',
        errors: validationResult.error.errors,
      });
      return;
    }

    const { email, password } = validationResult.data;

    try {
      // 2. Find user by email
      const user = await prisma.user.findUnique({
        where: { email: email },
      });

      if (!user) {
        console.log('[User Router] Signin failed: User not found for email:', email);
        res.status(403).json({ message: 'Incorrect credentials.' });
        return;
      }

      // 3. Compare provided password with hashed password in DB
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        console.log('[User Router] Signin failed: Invalid password for email:', email);
        res.status(403).json({ message: 'Incorrect credentials.' });
        return;
      }

      // 4. Sign JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      console.log('[User Router] User signed in successfully:', user.email);

      // 5. Respond with token and user data
      res.status(200).json({
        message: 'Signed in successfully!',
        token: token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      });

    } catch (error) {
      console.error('[User Router] Error during signin:', error);
      res.status(500).json({ message: 'Internal server error during signin.' });
    }
  })();
});



// Endpoint to get user profile (requires authentication)
// Endpoint to get user profile (requires authentication)
userRouter.get('/', oMiddleware, (req: Request, res: Response, next) => {
  void (async () => {
    console.log('[User Router] Handling authenticated get user request.');

    const userId = req.userId ;

    if (!userId) {
      // This case should ideally not happen if oMiddleware works correctly
      console.error('[User Router] Get user failed: userId not found on request after authentication.');
      return res.status(500).json({ message: 'User ID not available after authentication.' });
    }

    try {
      const userDetails = await prisma.user.findUnique({
        where: { id: userId as string },
        select: {
          id: true,
          email: true,
          name: true,
          
        }
      });

      if (!userDetails) {
        console.warn(`[User Router] Get user failed: User not found for ID: ${userId}`);
        return res.status(404).json({ message: 'User not found.' });
      }

      console.log(`[User Router] Fetched details for user: ${userDetails.email}`);
      res.status(200).json({
        message: 'User details fetched successfully.',
        user: userDetails
      });

    } catch (error) {
      console.error('[User Router] Error fetching user details:', error);
      res.status(500).json({ message: 'Internal server error while fetching user details.' });
    }
  })();
});


export default userRouter;