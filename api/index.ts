import "dotenv/config";
import { createApp } from "../server/index";

let handler: any;

export default async function (req: any, res: any) {
  if (!handler) {
    const { app } = await createApp();
    handler = app;
  }
  return handler(req, res);
}
