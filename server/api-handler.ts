import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { createServer } from "http";

let handler: any;

export default async function (req: any, res: any) {
  if (!handler) {
    const app = express();
    const httpServer = createServer(app);

    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: false }));

    await registerRoutes(httpServer, app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    handler = app;
  }
  return handler(req, res);
}
