import { plainToInstance, ClassConstructor } from "class-transformer";
import { validate } from "class-validator";
import { AppError } from "../error/AppError";

export async function validateBody<T extends object>(
  cls: ClassConstructor<T>,
  body: unknown
): Promise<T> {
  // 1. Guard against undefined/null DTO class
  if (!cls) {
    throw new AppError("Internal Validation Error: DTO class passed to validateBody is undefined.", 500);
  }

  const payload = (typeof body === "object" && body !== null) ? body : {};

  // 2. Transform to class instance
  const instance = plainToInstance(cls, payload);

  // 3. Ensure instance is a valid target object before running validate()
  if (!instance || typeof instance !== "object") {
    throw new AppError("Failed to instantiate validation schema.", 500);
  }

  // 4. Validate instance
  const errors = await validate(instance, { whitelist: true });

  if (errors.length > 0) {
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    throw new AppError(messages.join("\n"), 400);
  }

  return instance;
}