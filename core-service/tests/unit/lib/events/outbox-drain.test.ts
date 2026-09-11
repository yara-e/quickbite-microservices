import { drainOutbox } from "../../../../src/lib/events/outbox-drain";

jest.mock("@/lib/knex/knex", () => ({
    db: { transaction: jest.fn() },
}));

jest.mock("@/lib/events/init", () => ({
    messageBroker: { connect: jest.fn(), publishConfirmed: jest.fn() },
}));

jest.mock("@/lib/config/env", () => ({
    env: {
        rabbit: { batchSize: 50, exchange: "core.events" },
    },
}));

jest.mock("@/lib/logger/logger", () => ({
    logger: { error: jest.fn() },
}));

// Add this mock declaration so Jest replaces the repo functions with jest.fn()
jest.mock("../../../../src/lib/events/outbox.repo", () => ({
    claimBatch: jest.fn(),
    markDispatched: jest.fn(),
    markFailed: jest.fn(),
}));

import { db } from "../../../../src/lib/knex/knex";
import { messageBroker } from "../../../../src/lib/events/init";
import { logger } from "../../../../src/lib/logger/logger";
import {
    claimBatch,
    markDispatched,
    markFailed,
} from "../../../../src/lib/events/outbox.repo";

const transactionMock = db.transaction as jest.Mock;
const claimBatchMock = claimBatch as jest.Mock;
const markDispatchedMock = markDispatched as jest.Mock;
const markFailedMock = markFailed as jest.Mock;

const row = {
    id: "1",
    event_id: "evt-1",
    event_type: "product.stock.changed",
    aggregate_type: "product_branch_details",
    aggregate_id: "4:7",
    payload: { branchId: 4, productId: 7 },
    attempts: 0,
};

describe("drainOutbox", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("publishes every claimed row and commits", async () => {
        claimBatchMock.mockResolvedValue([row, { ...row, id: "2", event_id: "evt-2" }]);
        const trx = { commit: jest.fn(), rollback: jest.fn() };
        transactionMock.mockResolvedValue(trx);
        (messageBroker.connect as jest.Mock).mockResolvedValue(undefined);
        (messageBroker.publishConfirmed as jest.Mock).mockResolvedValue(undefined);

        await drainOutbox();

        expect(messageBroker.publishConfirmed).toHaveBeenCalledTimes(2);
        expect(messageBroker.publishConfirmed).toHaveBeenCalledWith(
            "core.events",
            "product.stock.changed",
            expect.any(Buffer)
        );
        expect(markDispatchedMock).toHaveBeenCalledTimes(2);
        expect(trx.commit).toHaveBeenCalled();
        expect(trx.rollback).not.toHaveBeenCalled();
    });

    it("commits and short-circuits when there are no pending rows", async () => {
        claimBatchMock.mockResolvedValue([]);
        const trx = { commit: jest.fn(), rollback: jest.fn() };
        transactionMock.mockResolvedValue(trx);

        await drainOutbox();

        expect(trx.commit).toHaveBeenCalled();
        expect(messageBroker.publishConfirmed).not.toHaveBeenCalled();
    });

    it("marks the row failed on publish error and stops the batch", async () => {
        claimBatchMock.mockResolvedValue([row, { ...row, id: "2" }]);
        const trx = { commit: jest.fn(), rollback: jest.fn() };
        transactionMock.mockResolvedValue(trx);
        (messageBroker.publishConfirmed as jest.Mock).mockRejectedValue(new Error("broker down"));

        await drainOutbox();

        expect(markFailedMock).toHaveBeenCalledWith(trx, "1", "broker down");
        expect(markDispatchedMock).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith("outbox publish failed", { id: "1", error: "broker down" });
        expect(trx.commit).toHaveBeenCalled();
    });

    it("rolls back and rethrows on claim errors", async () => {
        claimBatchMock.mockRejectedValue(new Error("lock timeout"));
        const trx = { rollback: jest.fn() };
        transactionMock.mockResolvedValue(trx);

        await expect(drainOutbox()).rejects.toThrow("lock timeout");
        expect(trx.rollback).toHaveBeenCalled();
    });
});