import { type User } from "@workspace/db";
import { type TokenPayload } from "../lib/session";

declare global {
  namespace Express {
    interface Request {
      authUser?: User;
      tokenPayload?: TokenPayload;
    }
  }
}

export {};
