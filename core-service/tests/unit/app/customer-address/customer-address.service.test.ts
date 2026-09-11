import { CustomerAddressService } from "@/app/customer-address/service/customer-address.service";
import { CustomerAddress } from "@/app/customer-address/entity/customer-address.entity";
import { AddressType } from "@/app/customer-address/enums";
import { AddressNotFoundError } from "@/app/customer-address/errors";

jest.mock("@/app/customer-address/repository/customer-address.repo", () => ({
    findAddressesByUserId: jest.fn(),
    findAddressById: jest.fn(),
    createAddress: jest.fn(),
    updateAddress: jest.fn(),
    deleteAddress: jest.fn(),
    clearDefaultByUserId: jest.fn(),
}));

import {
    findAddressesByUserId,
    findAddressById,
    createAddress,
    updateAddress,
    deleteAddress,
    clearDefaultByUserId,
} from "@/app/customer-address/repository/customer-address.repo";

const findAddressesMock = findAddressesByUserId as jest.Mock;
const findByIdMock = findAddressById as jest.Mock;
const createMock = createAddress as jest.Mock;
const updateMock = updateAddress as jest.Mock;
const deleteMock = deleteAddress as jest.Mock;
const clearDefaultMock = clearDefaultByUserId as jest.Mock;

function makeAddress(overrides: Partial<CustomerAddress> = {}): CustomerAddress {
    return new CustomerAddress({
        id: 1,
        userId: 7,
        label: "Home",
        country: "EG",
        city: "Cairo",
        street: "Main St",
        type: AddressType.HOME,
        lat: 30.0,
        lng: 31.2,
        isDefault: false,
        ...overrides,
    });
}

describe("CustomerAddressService", () => {
    let service: CustomerAddressService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new CustomerAddressService();
    });

    it("getByUserId maps entities to response shape", async () => {
        findAddressesMock.mockResolvedValue([makeAddress(), makeAddress({ id: 2, isDefault: true })]);
        const out = await service.getByUserId(7);
        expect(out).toHaveLength(2);
        expect(out[0]).toEqual({
            id: 1,
            label: "Home",
            country: "EG",
            city: "Cairo",
            street: "Main St",
            building: null,
            apartmentNumber: null,
            type: AddressType.HOME,
            lat: 30,
            lng: 31.2,
            isDefault: false,
        });
    });

    it("getById throws AddressNotFoundError for unknown ids", async () => {
        findByIdMock.mockResolvedValue(undefined);
        await expect(service.getById(99)).rejects.toBe(AddressNotFoundError);
    });

    it("create clears the default first when isDefault is true", async () => {
        createMock.mockResolvedValue(makeAddress());
        await service.create(7, {
            label: "Home",
            country: "EG",
            city: "Cairo",
            street: "Main",
            type: AddressType.HOME,
            lat: 1,
            lng: 2,
            isDefault: true,
        });
        expect(clearDefaultMock).toHaveBeenCalledWith(7);
    });

    it("update rejects when the address belongs to another user", async () => {
        findByIdMock.mockResolvedValue(makeAddress({ userId: 999 }));
        await expect(service.update(7, 1, { label: "Work" })).rejects.toBe(AddressNotFoundError);
    });

    it("update clears default and updates when isDefault is true", async () => {
        findByIdMock.mockResolvedValue(makeAddress());
        updateMock.mockResolvedValue(makeAddress({ label: "Work" }));

        const out = await service.update(7, 1, { label: "Work", isDefault: true });

        expect(clearDefaultMock).toHaveBeenCalledWith(7);
        expect(updateMock).toHaveBeenCalledWith(1, { label: "Work", isDefault: true });
        expect(out.label).toBe("Work");
    });

    it("remove rejects when the address belongs to another user", async () => {
        findByIdMock.mockResolvedValue(makeAddress({ userId: 999 }));
        await expect(service.remove(7, 1)).rejects.toBe(AddressNotFoundError);
    });

    it("remove deletes an owned address", async () => {
        findByIdMock.mockResolvedValue(makeAddress());
        await service.remove(7, 1);
        expect(deleteMock).toHaveBeenCalledWith(1);
    });
});