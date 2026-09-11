import {PresenceService} from "@/app/agent/service/presence.service";
import {OfflineWhilePickedForbidden} from "@/app/agent/errors";
import {OrderStatus} from "@/app/order/enums";

jest.mock("@/lib/knex/knex", () => ({
    db: jest.fn(),
}));

import {db} from "@/lib/knex/knex";

const dbMock = db as jest.Mock;

describe("app/agent/presence.service", () => {
    let cache: any;
    let service: PresenceService;

    beforeEach(() => {
        jest.clearAllMocks();
        cache = {
            hsetWithTtl: jest.fn().mockResolvedValue(undefined),
            geoadd: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(1),
            zrem: jest.fn().mockResolvedValue(0),
            srem: jest.fn().mockResolvedValue(0),
            sadd: jest.fn().mockResolvedValue(undefined),
        };
        service = new PresenceService(cache);
    });

    describe("static key builders", () => {
        it("builds region-scoped keys", () => {
            expect(PresenceService.metaKey("eg", 5)).toBe("presence:meta:eg:5");
            expect(PresenceService.geoKey("eg")).toBe("presence:geo:eg");
            expect(PresenceService.busyKey("eg")).toBe("presence:busy:eg");
        });
    });

    describe("upsert", () => {
        it("writes the meta hash with a TTL and geoadds the point", async () => {
            await service.upsert("eg", 5, 30.04, 31.23);

            expect(cache.hsetWithTtl).toHaveBeenCalledWith(
                "presence:meta:eg:5",
                {
                    lat: "30.04",
                    lng: "31.23",
                    lastSeenAt: expect.any(String),
                },
                expect.any(Number),
            );
            expect(cache.geoadd).toHaveBeenCalledWith("presence:geo:eg", 31.23, 30.04, "5");
        });
    });

    describe("goOffline", () => {
        /** The knex conn returned by db(region) is callable: conn("orders").select()... */
        function makeConn() {
            const chain = {
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                first: jest.fn().mockResolvedValue(undefined),
                update: jest.fn().mockResolvedValue(1),
            };
            const conn = (() => chain) as any;
            conn.fn = {now: jest.fn(() => new Date())};
            return {conn, chain};
        }

        it("forbids going offline while holding a picked order", async () => {
            const {conn, chain} = makeConn();
            chain.first.mockResolvedValue({public_id: "x", status: OrderStatus.PICKED});
            dbMock.mockReturnValue(conn);

            await expect(service.goOffline("eg", 5)).rejects.toBe(OfflineWhilePickedForbidden);
            expect(cache.del).not.toHaveBeenCalled();
        });

        it("resets assigned orders to ready, clears presence keys", async () => {
            const {conn, chain} = makeConn();
            chain.first.mockResolvedValue(undefined);
            dbMock.mockReturnValue(conn);

            await service.goOffline("eg", 5);

            expect(chain.where).toHaveBeenCalledWith({
                delivery_agent_id: 5,
                status: OrderStatus.ASSIGNED,
            });
            expect(cache.del).toHaveBeenCalledWith("presence:meta:eg:5");
            expect(cache.zrem).toHaveBeenCalledWith("presence:geo:eg", "5");
            expect(cache.srem).toHaveBeenCalledWith("presence:busy:eg", "5");
        });
    });

    describe("busy markers", () => {
        it("markBusy adds to the busy set", async () => {
            await service.markBusy("eg", 5);
            expect(cache.sadd).toHaveBeenCalledWith("presence:busy:eg", "5");
        });

        it("clearBusy removes from the busy set", async () => {
            await service.clearBusy("eg", 5);
            expect(cache.srem).toHaveBeenCalledWith("presence:busy:eg", "5");
        });
    });
});