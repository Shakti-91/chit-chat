import { z } from "zod";

// Username: letters only, more than 5 characters (i.e. at least 6 letters)
export const usernameSchema = z
  .string()
  .min(6, "Username must be more than 5 characters (at least 6).")
  .regex(/^[A-Za-z]+$/, "Username must contain only alphabetic characters (A-Z, a-z), no spaces, digits, or symbols.");

// Password: any characters, more than 8 characters (i.e. at least 9)
export const passwordSchema = z
  .string()
  .min(9, "Password must be more than 8 characters (at least 9).");

export const registerSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const roomCreateSchema = z.object({
  name: z.string().min(1, "Room name is required").max(60, "Room name too long"),
});

export const roomJoinSchema = z.object({
  code: z.string().min(1, "Room code is required"),
});

export const messageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(4000, "Message too long"),
});
