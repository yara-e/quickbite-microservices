import amqp from "amqp-connection-manager";
import { RabbitMQClient } from "../../../../src/pkg/messaging/rabbitmq.client";

jest.mock("amqp-connection-manager", () => {
  const channelMock = {
    waitForConnect: jest.fn().mockResolvedValue(undefined),
    addSetup: jest.fn(),
    publish: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(undefined),
  };
  const connectionMock = {
    createChannel: jest.fn().mockReturnValue(channelMock),
    close: jest.fn().mockResolvedValue(undefined),
  };
  return {
    __esModule: true,
    default: {
      connect: jest.fn(() => connectionMock),
    },
    connect: jest.fn(() => connectionMock),
  };
});

const amqpConnectMock = amqp.connect as jest.Mock;

describe("RabbitMQClient", () => {
  beforeEach(() => jest.clearAllMocks());

  it("connect creates a channel and waits for it", async () => {
    const client = new RabbitMQClient({ url: "amqp://x" });
    await client.connect();

    expect(amqpConnectMock).toHaveBeenCalledWith(
      ["amqp://x"],
      expect.objectContaining({ reconnectTimeInSeconds: 1 })
    );
    const conn = amqpConnectMock.mock.results[0].value;
    expect(conn.createChannel).toHaveBeenCalledWith({ json: false });
    expect(conn.createChannel().waitForConnect).toHaveBeenCalled();
  });

  it("reuses an existing connection on repeated connect calls", async () => {
    const client = new RabbitMQClient({ url: "amqp://x" });
    await client.connect();
    await client.connect();
    expect(amqpConnectMock).toHaveBeenCalledTimes(1);
  });

  it("declares a durable topic exchange via addSetup", async () => {
    const client = new RabbitMQClient({ url: "amqp://x" });
    await client.declareExchange("core.events");

    const channel = amqpConnectMock.mock.results[0].value.createChannel();
    const setupFn = channel.addSetup.mock.calls[0][0];
    const fakeCh = { assertExchange: jest.fn() };
    setupFn(fakeCh);

    expect(fakeCh.assertExchange).toHaveBeenCalledWith("core.events", "topic", {
      durable: true,
    });
  });

  it("publishes with persistent application/json options", async () => {
    const client = new RabbitMQClient({ url: "amqp://x" });
    await client.publishConfirmed("core.events", "routing", Buffer.from("body"));

    const channel = amqpConnectMock.mock.results[0].value.createChannel();
    expect(channel.publish).toHaveBeenCalledWith(
      "core.events",
      "routing",
      Buffer.from("body"),
      { persistent: true, contentType: "application/json" }
    );
  });

  it("close tears down channel and connection and resets state", async () => {
    const client = new RabbitMQClient({ url: "amqp://x" });
    await client.connect();
    await client.close();

    const conn = amqpConnectMock.mock.results[0].value;
    expect(conn.createChannel().close).toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalled();

    await expect(client.close()).resolves.toBeUndefined();
  });
});