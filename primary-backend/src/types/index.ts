// primary-backend/src/types/index.ts
import { z } from 'zod';

// **[CORRECTION/DETAIL]**: The transcript mentions `username` and `password`.
// However, our `User` model in `schema.prisma` uses `email`.
// To align with the database schema and common practice, we'll use `email` here.

export const signupData = z.object({
    email: z.string().email(),       // Validate as email format
    password: z.string().min(6),     // Minimum 6 characters
    // Add name as optional, as per our schema in previous steps
    name: z.string().min(1, { message: "Name is required" }),
});

export const signinData = z.object({
    email: z.string().email(),       // Validate as email format
    password: z.string().min(6),     // Minimum 6 characters
});

// You might also export the inferred types for TS:
export type SignupInput = z.infer<typeof signupData>;
export type SigninInput = z.infer<typeof signinData>;