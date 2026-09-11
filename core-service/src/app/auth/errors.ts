import { AppError } from "../../lib/error/AppError";

export const UserAlreadyExistsError = new AppError('User Already Exists with same phone or email', 400);

export const CannotSignupAsSystemAdmin = new AppError('You cannot register as a system admin', 403);

export const IncorrectCredentials = new AppError('Incorrect email or password', 401);
export const InvalidOTPError = new AppError('Invalid OTP', 401);
export const RestaurantDataRequiredError = new AppError('Restaurant data is required', 400);