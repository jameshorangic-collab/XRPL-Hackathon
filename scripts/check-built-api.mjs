import { createServer } from 'node:http';
process.env.VERCEL='1';
for(const key of ['DATABASE_URL','SESSION_SECRET','AWS_AGENTCORE_HARNESS_ARN','AWS_BEDROCK_MODEL_ID','QUICKNODE_RPC_URL','XRPL_EVM_RPC_URL','AP4M_WORKER_URL'])delete process.env[key];
const {default:handler}=await import('../api/index.js');
const server=createServer((req,res)=>{void handler(req,res);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try {
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const path of ['/api/health','/api/index?route=health','/api/index?route=integrations/status']){
    const response=await fetch(base+path);const body=await response.json();
    if(!response.ok||!body.ok&&!body.services)throw new Error(`Compiled API smoke failed: ${path}`);
  }
  console.log('Compiled deployment API: health, rewrite and nested status routes passed.');
}finally{await new Promise(resolve=>server.close(resolve));}
