import { validateBody } from "../../../../src/lib/validation/validate";
import { LoginDTO, RegisterDTO } from "../../../../src/app/auth/dto/auth.dto";

describe("validateBody", () => {
    it("returns a valid instance for a correct body", async () => {
        const data = await validateBody(LoginDTO, { email: "user@test.com", password: "secret" });
        expect(data).toBeInstanceOf(LoginDTO);
        expect(data.email).toBe("user@test.com");
    });

    it("throws an AppError with 400 summarizing constraint messages", async () => {
        await expect(validateBody(LoginDTO, { email: "not-an-email", password: "" })).rejects.toMatchObject({
            statusCode: 400,
            message: expect.stringContaining("email"),
        });
    });

    it("strips unknown properties when whitelist is enabled", async () => {
        const register = await validateBody(RegisterDTO, {
            email: "a@b.com",
            phone: "01000000000",
            name: "Ali",
            password: "Strong1!Pass",
            role: "customer",
            hack: "should-be-stripped",
        });
        expect((register as any).hack).toBeUndefined();
    });

    it("catches nested validation errors on nested DTOs", async () => {
        await expect(
            validateBody(RegisterDTO, {
                email: "a@b.com",
                phone: "01000000000",
                name: "Ali",
                password: "Strong1!Pass",
                role: "restaurant_user",
                restaurant: { name: "", primaryCountry: "" },
            })
        ).rejects.toMatchObject({ statusCode: 400 });
    });
});