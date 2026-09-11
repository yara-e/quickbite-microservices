import {AssignmentService} from "@/app/assignment/service/assignment.service";
import {
    OfferNotFoundOrExpiredError,
    NotInCandidateListError,
    OrderAlreadyClaimedError,
} from "@/app/agent/errors";
import {OrderStatus, PaymentMethod, Currency} from "@/app/order/enums";

jest.mock("@/lib/knex/knex", () => ({
    db: jest.fn(),
}));
jest.mock("@/app/order/repository/order.repo", () => ({
    findOrderByPublicId: jest.fn(),
    findReadyUnassigned: jest.fn(),
    claimReadyOrderForAgent: jest.fn(),
}));
jest.mock("@/lib/core-client/branch.client", () => ({
    getBranch: jest.fn(),
    getBranchesByIds: jest.fn(),
}));
jest.mock("@/lib/di/container", () => ({
    container: {resolve: jest.fn()},
}));
jest.mock("@/lib/logger/logger", () => ({
    logger: {error: jest.fn(), info: jest.fn()},
}));

import {db} from "@/lib/knex/knex";
import {findReadyUnassigned, findOrderByPublicId, claimReadyOrderForAgent} from "@/app/order/repository/order.repo";
import {getBranch} from "@/lib/core-client/branch.client";
import {container} from "@/lib/di/container";
import {OrderEntity} from "@/app/order/entity/order.entity";

const dbMock = db as jest.Mock;
const readyMock = findReadyUnassigned as jest.Mock;
const findOrderMock = findOrderByPublicId as jest.Mock;
const claimMock = claimReadyOrderForAgent as jest.Mock;
const branchMock = getBranch as jest.Mock;
const resolveMock = container.resolve as jest.Mock;

function makeOrder(overrides: Partial<OrderEntity> = {}): OrderEntity {
    return new OrderEntity({
        id: 1,
        region: "eg",
        publicId: "pub-1",
        countryCode: "EG",
        restaurantId: 10,
        restaurantOwnerId: 11,
        branchId: 20,
        customerId: 30,
        customerAddressId: 40,
        deliveryLat: 30,
        deliveryLng: 31,
        deliveryAddressTextSnapshot: "1 Main St",
        branchLat: 30,
        branchLng: 31,
        status: OrderStatus.READY,
        subtotal: 5000,
        deliveryFee: 500,
        serviceFee: 1000,
        total: 6500,
        commission: 0,
        currency: Currency.EGP,
        paymentMethod: PaymentMethod.COD,
        deliveryAgentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        acceptedAt: new Date(),
        readyAt: new Date(),
        rejectedAt: null,
        assignedAt: null,
        pickedAt: null,
        deliveredAt: null,
        cancelledAt: null,
        ...overrides,
    });
}

function makeTrx() {
    return {
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
    };
}
describe("app/assignment/assignment.service", () => {
    let cache: any;
    let presence: any;
    let service: AssignmentService;

    beforeEach(() => {
        jest.clearAllMocks();
        resolveMock.mockReturnValue({to: jest.fn().mockReturnValue({emit: jest.fn()})});
        cache = {
            exists: jest.fn(),
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(1),
            ttl: jest.fn().mockResolvedValue(30),
            incr: jest.fn().mockResolvedValue(1),
            expire: jest.fn().mockResolvedValue(undefined),
            trySet: jest.fn(),
            geosearchByRadius: jest.fn().mockResolvedValue([]),
            sismember: jest.fn().mockResolvedValue(false),
        };
        presence = {
            markBusy: jest.fn().mockResolvedValue(undefined),
            clearBusy: jest.fn().mockResolvedValue(undefined),
        };
        service = new AssignmentService(cache, presence);
        dbMock.mockReturnValue({transaction: jest.fn()});
        branchMock.mockResolvedValue({id: 20, name: "Downtown"});
    });

    it("builds the redis key names", () => {
        expect(AssignmentService.offerKey("x")).toBe("offer:order:x");
        expect(AssignmentService.claimKey("x")).toBe("claim:order:x");
        expect(AssignmentService.attemptsKey("x")).toBe("assign:attempts:x");
    });

    describe("tryAssign", () => {
        it("skips when an offer already exists", async () => {
            cache.exists.mockResolvedValue(true);
            await expect(service.tryAssign(makeOrder(), "eg")).resolves.toBe("skipped");
        });

        it("marks exhausted past the attempt cap", async () => {
            cache.exists.mockResolvedValue(false);
            cache.get.mockResolvedValue("99");
            await expect(service.tryAssign(makeOrder(), "eg")).resolves.toBe("exhausted");
        });

        it("returns no-candidates when none in range", async () => {
            cache.exists.mockResolvedValue(false);
            cache.get.mockResolvedValue("0");
            cache.geosearchByRadius.mockResolvedValue([]);
            await expect(service.tryAssign(makeOrder(), "eg")).resolves.toBe("no-candidates");
        });

        it("broadcasts an offer to found candidates", async () => {
            cache.exists.mockImplementation((key: string) => Promise.resolve(key.includes("presence:meta")));
            cache.get.mockResolvedValue("0");
            cache.geosearchByRadius.mockResolvedValue(["7"]);
            cache.sismember.mockResolvedValue(false);
            cache.trySet.mockResolvedValue(true);

            await expect(service.tryAssign(makeOrder(), "eg")).resolves.toBe("offered");
            expect(cache.trySet).toHaveBeenCalledWith("offer:order:pub-1", "7", expect.any(Number));
        });
    });

    describe("claim", () => {
        it("throws OfferNotFoundOrExpired when no offer exists", async () => {
            cache.get.mockResolvedValue(null);
            await expect(service.claim("pub-1", 7, "eg")).rejects.toBe(OfferNotFoundOrExpiredError);
        });

        it("throws NotInCandidateList when the agent is not a candidate", async () => {
            cache.get.mockResolvedValue("8,9");
            await expect(service.claim("pub-1", 7, "eg")).rejects.toBe(NotInCandidateListError);
        });

        it("throws OrderAlreadyClaimed when the claim lock is held", async () => {
            cache.get.mockResolvedValue("7,8");
            cache.trySet.mockResolvedValue(false);
            await expect(service.claim("pub-1", 7, "eg")).rejects.toBe(OrderAlreadyClaimedError);
        });

        it("claims a ready order for the agent", async () => {
            cache.get.mockResolvedValue("7,8");
            cache.trySet.mockResolvedValue(true);
            const trx = makeTrx();
            const updated = makeOrder({status: OrderStatus.ASSIGNED, deliveryAgentId: 7});
            findOrderMock.mockResolvedValue(updated);
            claimMock.mockResolvedValue(updated);
            dbMock.mockReturnValue({transaction: jest.fn().mockResolvedValue(trx)});

            const dto = await service.claim("pub-1", 7, "eg");

            expect(dto.status).toBe("assigned");
            expect(claimMock).toHaveBeenCalledWith("pub-1", 7, trx);
            expect(trx.commit).toHaveBeenCalled();
            expect(presence.markBusy).toHaveBeenCalledWith("eg", 7);
            expect(cache.del).toHaveBeenCalledWith("offer:order:pub-1");
        });

        it("rolls back and rethrows when the DB order is not ready", async () => {
            cache.get.mockResolvedValue("7");
            cache.trySet.mockResolvedValue(true);
            const trx = makeTrx();
            claimMock.mockResolvedValue(undefined);
            dbMock.mockReturnValue({transaction: jest.fn().mockResolvedValue(trx)});

            await expect(service.claim("pub-1", 7, "eg")).rejects.toThrow();
            expect(trx.rollback).toHaveBeenCalled();
        });
    });

    describe("reject", () => {
        it("throws when no offer exists", async () => {
            cache.get.mockResolvedValue(null);
            await expect(service.reject("pub-1", 7)).rejects.toBe(OfferNotFoundOrExpiredError);
        });

        it("removes the agent from the offer, keeping others", async () => {
            cache.get.mockResolvedValue("7,8");
            await service.reject("pub-1", 7);
            expect(cache.set).toHaveBeenCalledWith("offer:order:pub-1", "8", expect.any(Number));
        });

        it("deletes the offer when the last candidate rejects", async () => {
            cache.get.mockResolvedValue("7");
            await service.reject("pub-1", 7);
            expect(cache.del).toHaveBeenCalledWith("offer:order:pub-1");
        });
    });

    describe("adminAssign", () => {
        it("force-assigns the order to the agent", async () => {
            cache.trySet.mockResolvedValue(true);
            const trx = makeTrx();
            const updated = makeOrder({status: OrderStatus.ASSIGNED, deliveryAgentId: 9});
            claimMock.mockResolvedValue(updated);
            dbMock.mockReturnValue({transaction: jest.fn().mockResolvedValue(trx)});

            const dto = await service.adminAssign("pub-1", 9, "eg");

            expect(dto.status).toBe("assigned");
            expect(presence.markBusy).toHaveBeenCalledWith("eg", 9);
        });

        it("throws when the claim lock is already held", async () => {
            cache.trySet.mockResolvedValue(false);
            await expect(service.adminAssign("pub-1", 9, "eg")).rejects.toThrow(OrderAlreadyClaimedError);
        });
    });
});