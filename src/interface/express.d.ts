// express.d.ts
import { Request } from 'express';

declare module 'express' {
  export interface Request {
    user?: any;  // Use appropriate type instead of 'any' if you have a specific type for user
  }
}
