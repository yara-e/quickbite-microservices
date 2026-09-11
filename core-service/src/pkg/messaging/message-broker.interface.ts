export interface IMessageBroker {
    connect(): Promise<void>;
    close(): Promise<void>;
    declareExchange(exchange: string): Promise<void>;
    publishConfirmed(exchange: string, routingKey: string, body: Buffer): Promise<void>;

}