import type { IncomingMessage, ServerResponse } from 'node:http';
import { createBackend } from '../server/app';
let app:ReturnType<typeof createBackend>|undefined;
export default async function handler(req:IncomingMessage,res:ServerResponse){
  app??=createBackend();
  await app.handler(req,res);
}
