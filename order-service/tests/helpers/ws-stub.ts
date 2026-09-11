import {container} from "../../src/lib/di/container";
import {TOKENS} from "../../src/lib/di/tokens";

/**
 * The OrderService / SettlementService / AssignmentService / AgentService
 * emit socket.io events through the DI-resolved WsServer. In tests (no real
 * http.Server + socket.io) we register a stub that records the emissions so
 * we can assert on fan-out without a network socket.
 */
export interface WsEmission {
    room: string;
    event: string;
    payload: unknown;
}

export interface WsServerStub {
    to: (room: string) => {
        emit: (event: string, payload: unknown) => void;
    };
    emissions: WsEmission[];
    reset: () => void;
}

export function registerWsServerStub(): WsServerStub {
    const emissions: WsEmission[] = [];
    const io = {
        to: (room: string) => ({
            emit: (event: string, payload: unknown) => {
                emissions.push({room, event, payload});
            },
        }),
    };
    container.registerInstance(TOKENS.WsServer, io);
    return {
        to: io.to,
        emissions,
        reset: () => emissions.length = 0,
    };
}