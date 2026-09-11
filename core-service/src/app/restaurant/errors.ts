import { AppError } from "../../lib/error/AppError";

export const RestaurantNotFoundError = new AppError('Restaurant not found', 404);
export const OwnerAlreadyExistsError = new AppError('User with this email or phone already exists', 409);
