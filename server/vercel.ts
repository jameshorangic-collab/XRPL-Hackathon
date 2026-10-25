import type { IncomingMessage, ServerResponse } from 'node:http';
import { createBackend } from './app';
let app:ReturnType<typeof createBackend>|undefined;
export default async function handler(req:IncomingMessage,res:ServerResponse){
  const url=new URL(req.url??'/', 'https://backstop.invalid');
  const route=url.searchParams.get('route');
  if(route){
    url.searchParams.delete('route');
    req.url='/api/'+route+url.search;
  }
  app??=createBackend();
  await app.handler(req,res);
}
