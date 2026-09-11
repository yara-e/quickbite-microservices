import { UserService } from "@/app/user/service/user.service";
import { SystemRole } from "@/app/user/enums";
import { User } from "@/app/user/entity/user.entity";
import { UserAlreadyExistsError } from "@/app/auth/errors";
import { UserNotFoundError } from "@/app/user/errors";

jest.mock("@/app/user/repository/users.repo", () => ({
    findUserExistsByEmailOrPhone: jest.fn(),
    createUser: jest.fn(),
    findUserById: jest.fn(),
    updateUser: jest.fn(),
}));

jest.mock("@/app/auth/utils", () => ({
    hashPassword: jest.fn().mockResolvedValue("hashed"),
}));

import {
    findUserExistsByEmailOrPhone,
    createUser,
    findUserById,
    updateUser,
} from "@/app/user/repository/users.repo";
import { hashPassword } from "@/app/auth/utils";

const existsMock = findUserExistsByEmailOrPhone as jest.Mock;
const createUserMock = createUser as jest.Mock;
const findUserByIdMock = findUserById as jest.Mock;
const updateUserMock = updateUser as jest.Mock;

function makeUser(overrides: Partial<User> = {}): User {
    return new User({
        id: 1,
        email: "user@test.com",
        phone: "01000000001",
        name: "User",
        passwordHash: "h",
        systemRole: SystemRole.CUSTOMER,
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-01"),
        deletedAt: null,
        ...overrides,
    });
}

describe("UserService", () => {
    let service: UserService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new UserService();
    });

    describe("create", () => {
        it("rejects when the email or phone already exists", async () => {
            existsMock.mockResolvedValue(true);
            await expect(
                service.create({
                    email: "a@b.com",
                    phone: "01000000001",
                    name: "A",
                    password: "pass",
                    systemRole: SystemRole.CUSTOMER,
                })
            ).rejects.toBe(UserAlreadyExistsError);
            expect(createUserMock).not.toHaveBeenCalled();
        });

        it("hashes the password and creates the user", async () => {
            existsMock.mockResolvedValue(false);
            createUserMock.mockResolvedValue(makeUser());

            const user = await service.create({
                email: "a@b.com",
                phone: "01000000001",
                name: "A",
                password: "pass",
                systemRole: SystemRole.CUSTOMER,
            });

            expect(hashPassword).toHaveBeenCalledWith("pass");
            expect(createUserMock).toHaveBeenCalledWith(
                expect.objectContaining({ passwordHash: "hashed", email: "a@b.com", systemRole: SystemRole.CUSTOMER }),
                undefined
            );
            expect(user.id).toBe(1);
        });

        it("creates with an empty hash when no password is provided", async () => {
            existsMock.mockResolvedValue(false);
            createUserMock.mockResolvedValue(makeUser());

            await service.create({
                email: "a@b.com",
                phone: "01000000001",
                name: "A",
                password: "",
                systemRole: SystemRole.RESTAURANT_USER,
            });

            expect(createUserMock).toHaveBeenCalledWith(
                expect.objectContaining({ passwordHash: "" }),
                undefined
            );
        });
    });

    describe("getByUserId", () => {
        it("throws UserNotFoundError when missing", async () => {
            findUserByIdMock.mockResolvedValue(undefined);
            await expect(service.getByUserId(99)).rejects.toBe(UserNotFoundError);
        });

        it("returns the public profile shape", async () => {
            findUserByIdMock.mockResolvedValue(makeUser());
            const profile = await service.getByUserId(1);
            expect(profile).toEqual({
                id: 1,
                email: "user@test.com",
                name: "User",
                phone: "01000000001",
                systemRole: SystemRole.CUSTOMER,
            });
        });
    });

    describe("updateProfile", () => {
        it("throws when the user does not exist", async () => {
            findUserByIdMock.mockResolvedValue(undefined);
            await expect(service.updateProfile(1, { name: "New" })).rejects.toBe(UserNotFoundError);
        });

        it("updates and returns the profile", async () => {
            findUserByIdMock.mockResolvedValue(makeUser());
            updateUserMock.mockResolvedValue(makeUser({ name: "New Name" }));

            const profile = await service.updateProfile(1, { name: "New Name" });

            expect(updateUserMock).toHaveBeenCalledWith(1, { name: "New Name" });
            expect(profile.name).toBe("New Name");
        });
    });

    describe("getAgentById", () => {
        it("throws when the agent is not a delivery agent", async () => {
            findUserByIdMock.mockResolvedValue(makeUser());
            await expect(service.getAgentById(1)).rejects.toBe(UserNotFoundError);
        });

        it("returns agent contact info", async () => {
            const agent = makeUser({ name: "Rider", phone: "01111111111", systemRole: SystemRole.DELIVERY_AGENT });
            findUserByIdMock.mockResolvedValue(agent);
            await expect(service.getAgentById(1)).resolves.toEqual({ id: 1, name: "Rider", phone: "01111111111" });
        });

        it("throws UserNotFoundError when the user is missing", async () => {
            findUserByIdMock.mockResolvedValue(undefined);
            await expect(service.getAgentById(1)).rejects.toBe(UserNotFoundError);
        });
    });
});