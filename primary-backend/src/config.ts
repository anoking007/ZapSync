// primary-backend/src/config.ts
export const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key_here";
// In production, ALWAYS set JWT_SECRET as an environment variable!