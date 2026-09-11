import { AppError } from "../../lib/error/AppError";

export const UserNotFoundError = new AppError('User not found', 404);