// src/types/express/index.d.ts
import * as express from 'express';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {}; // Very important to make this a module
