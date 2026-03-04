import { createApp } from "./index";

let handler: any;

export default async function (req: any, res: any) {
  if (!handler) {
    const { app } = await createApp(true);
    handler = app;
  }
  return handler(req, res);
}
