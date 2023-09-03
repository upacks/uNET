import express from 'express';
import httpProxy from 'http-proxy';
export { express, httpProxy, Proxy, };
declare class Proxy {
    apiProxy: any;
    constructor();
    http: (req: any, res: any, url: any) => any;
    ws: (req: any, socket: any, head: any, url: any) => any;
}
interface iCore {
    port?: number;
    redisChannel?: string;
    keepAliveTimeout?: number;
    headersTimeout?: number;
}
export declare class Core {
    config: iCore;
    store: {};
    redis: any;
    constructor(conf?: iCore);
    start: () => void;
    stop: () => void;
}
//# sourceMappingURL=proxy.d.ts.map