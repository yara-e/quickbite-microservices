import express from "express";
import {env} from "./lib/config/env";
import {routes} from "./routes";
import {correlationId} from "./lib/correlation/correlationId";
import {errorHandler} from "./lib/error/errorHandler";
import cookieParser from 'cookie-parser'
import cors from "cors";
import helmet from "helmet";

// localhost:3000/api/
export function createApp() {
    const app = express();
    app.use(helmet())
    app.use(cors({origin: env.cors.origins, credentials: true}));
    app.set('query parser', 'extended');
    app.use(express.json());
    app.use(cookieParser())
    app.use(correlationId);
    app.use('/api', routes)
    app.use(errorHandler);
    app.use(express.urlencoded({ extended: true }));
    return app;
}
