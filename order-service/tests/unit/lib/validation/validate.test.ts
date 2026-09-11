import {validateBody} from "@/lib/validation/validate";
import {CreateOrderRequestDTO, UpdateOrderStatusRequestDTO} from "@/app/order/dto/order.request.dto";
import {PaymentMethod, OrderStatus} from "@/app/order/enums";

describe("lib/validation/validate", () => {
    it("returns a valid instance for a correct body", async () => {
        const data = await validateBody(CreateOrderRequestDTO, {
            branchId: 1,
            customerAddressId: 2,
            paymentMethod: PaymentMethod.COD,
            items: [{productId: 3, quantity: 2}],
        });
        expect(data).toBeInstanceOf(CreateOrderRequestDTO);
        expect(data.items).toHaveLength(1);
    });

    it("throws an AppError with 400 on invalid input", async () => {
        await expect(
            validateBody(CreateOrderRequestDTO, {
                branchId: 1,
                items: [],
            }),
        ).rejects.toMatchObject({statusCode: 400, message: expect.stringContaining("paymentMethod")});
    });

    it("strips unknown properties (whitelist)", async () => {
        const data = await validateBody(UpdateOrderStatusRequestDTO, {
            status: OrderStatus.ACCEPTED,
            reason: "ok",
            hack: "should-be-gone",
        });
        expect((data as any).hack).toBeUndefined();
    });
});