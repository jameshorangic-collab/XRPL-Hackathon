// Stateful official AP4M x402 worker. Run on a persistent local host, never an
// ephemeral Vercel filesystem. Keys are optional: the registered wallet can sign
// through the operator-only browser bridge instead, with explicit wallet prompts.
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { AbstractSigner, Contract, JsonRpcProvider, Wallet, getAddress, hexlify, parseUnits, verifyMessage, verifyTypedData } from 'ethers';
import sdk from './vendor/ap4m/ap4m-hackathon-sdk.cjs';
import { buyResource, createX402Merchant, loadX402Context } from './vendor/ap4m/ap4m-x402.mjs';

const api=process.env.AP4M_API_URL||'https://hackathon.ap4m.build';
if(api!=='https://hackathon.ap4m.build') throw new Error('Only the official hackathon AP4M service is allowed.');
const token=process.env.AP4M_WORKER_TOKEN;
if(!token||token.length<32)throw new Error('Set a server-only AP4M_WORKER_TOKEN of at least 32 characters.');
const address=getAddress(process.env.AP4M_AGENT_WALLET_ADDRESS||'');
const payout=getAddress(process.env.AP4M_MERCHANT_WALLET_ADDRESS||'');
const merchantId=process.env.AP4M_MERCHANT_ID;
if(!/^0x[0-9a-f]{64}$/i.test(merchantId||'')||address===payout)throw new Error('Separate registered agent and merchant identities are required.');
const provider=new JsonRpcProvider(process.env.QUICKNODE_RPC_URL||process.env.XRPL_EVM_RPC_URL);
if((await provider.getNetwork()).chainId!==1449000n)throw new Error('AP4M worker requires testnet chain 1449000.');
const context=await loadX402Context(api);
if(context.network!=='eip155:1449000'||context.participantRequest.chainId!==1449000n&&String(context.participantRequest.chainId)!=='1449000')throw new Error('Official AP4M context is on the wrong chain.');
const paymentToken=new Contract(context.x402.token,['function decimals() view returns(uint8)','function symbol() view returns(string)','function balanceOf(address) view returns(uint256)'],provider);
if(await provider.getCode(context.x402.token)==='0x'||Number(await paymentToken.decimals())!==18)throw new Error('Official AP4M token verification failed.');
const directory='.backstop/ap4m';mkdirSync(directory,{recursive:true,mode:0o700});
const stateFile=directory+'/operations.json';
let saved=existsSync(stateFile)?JSON.parse(readFileSync(stateFile,'utf8')):{operations:{},channelId:null};
function persist(){writeFileSync(stateFile+'.tmp',JSON.stringify(saved),{mode:0o600});renameSync(stateFile+'.tmp',stateFile);}
const pending=new Map();
const targets=new Set([context.participantRequest.ledger,context.participantRequest.vault].map(x=>x.toLowerCase()));
async function ask(method,params,description){
  const id=randomUUID();
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error('WalletApprovalTimedOut'));},600000);
    pending.set(id,{id,method,params,description,address,chainId:1449000,resolve:v=>{clearTimeout(timer);pending.delete(id);resolve(v);},reject:e=>{clearTimeout(timer);pending.delete(id);reject(e);}});
  });
}
class InteractiveSigner extends AbstractSigner {
  address=address;
  constructor(){super(provider);}
  connect(){return this;}
  async getAddress(){return address;}
  async signMessage(message){
    const text=typeof message==='string'?message:hexlify(message);
    const signature=await ask('signMessage',{message:text},'Sign in to the official Mastercard AP4M hackathon service. No on-chain transfer.');
    if(getAddress(verifyMessage(message,signature))!==address)throw new Error('WrongAgentSignature');return signature;
  }
  async signTypedData(domain,types,value){
    if(Number(domain.chainId)!==1449000||!targets.has(String(domain.verifyingContract).toLowerCase()))throw new Error('UnapprovedTypedDataDomain');
    if(value.cumulativeAmount&&BigInt(value.cumulativeAmount)>parseUnits('1',18))throw new Error('VoucherBudgetExceeded');
    const clean=JSON.parse(JSON.stringify({domain,types,value},(_,v)=>typeof v==='bigint'?v.toString():v));
    const signature=await ask('signTypedData',clean,'Authorize a cumulative AP4M voucher. Report price 0.01 test RLUSD; total channel cap 1 test RLUSD.');
    if(getAddress(verifyTypedData(domain,types,value,signature))!==address)throw new Error('WrongAgentSignature');return signature;
  }
  async sendTransaction(transaction){
    const to=String(await transaction.to);const data=String(transaction.data||'0x');
    if(!targets.has(to.toLowerCase())||BigInt(transaction.value||0)!==0n)throw new Error('UnapprovedAP4MTransaction');
    const hash=await ask('sendTransaction',{to,data,value:'0x0'},'Submit an AP4M testnet channel request or voucher redemption. Native value 0; test XRP is used only for gas.');
    if(!/^0x[0-9a-f]{64}$/i.test(hash))throw new Error('InvalidTransactionHash');
    for(let i=0;i<30;i++){
      const tx=await provider.getTransaction(hash);
      if(tx){if(getAddress(tx.from)!==address||tx.to?.toLowerCase()!==to.toLowerCase()||tx.data.toLowerCase()!==data.toLowerCase()||tx.value!==0n)throw new Error('WalletTransactionMismatch');return tx;}
      await new Promise(r=>setTimeout(r,1000));
    }
    throw new Error('SubmittedTransactionNotYetVisible');
  }
  async signTransaction(){throw new Error('RawTransactionSigningDisabled');}
}
const wallet=process.env.AGENT_PRIVATE_KEY?new Wallet(process.env.AGENT_PRIVATE_KEY,provider):new InteractiveSigner();
if(getAddress(await wallet.getAddress())!==address)throw new Error('Configured signer differs from registered agent.');
const resourceUrl='http://127.0.0.1:4308/resource';
const report={source:'BACKSTOP synthetic demonstration dataset',fixture:'consistent',business:'Harbor Bakery',monthlyDeposits:1780000,monthlyOutflows:1290000,negativeBalanceDays:1,months:6,recurringDebt:'Present; reconcile against the self-reported $1,500 monthly debt. Fictional dataset.'};
const merchant=createX402Merchant({context,provider,submitter:wallet,stateDirectory:directory+'/merchant',resourceUrl,merchantParticipantId:merchantId,payout,amount:parseUnits('0.01',18).toString(),content:report});
await new Promise(resolve=>merchant.server.listen(4308,'127.0.0.1',resolve));
let busy=false;
async function purchase(input){
  if(!/^[a-zA-Z0-9_-]{1,128}$/.test(input.requestId||'')||!/^[a-zA-Z0-9_-]{1,128}$/.test(input.applicationId||''))throw new Error('InvalidOperation');
  const operation='report-'+createHash('sha256').update(input.applicationId).digest('hex').slice(0,40);
  if(saved.operations[operation]?.complete)return saved.operations[operation].result;
  if(busy)throw new Error('PaymentAlreadyRunning');busy=true;
  try{
    const {token:teamToken}=await sdk.signIn(api,process.env.AP4M_TEAM_NAME||'Just Create Something',wallet);
    const channels=await sdk.listChannels(api,teamToken);
    const existing=channels.find(c=>c.channel_status==='open'&&c.merchant_id?.toLowerCase()===merchantId.toLowerCase()&&c.payout?.toLowerCase()===payout.toLowerCase()&&BigInt(c.cap_wei)<=parseUnits('1',18));
    let channelId=existing?.channel_id||saved.channelId;
    if(channelId&&!channels.some(c=>c.channel_id===channelId&&c.channel_status==='open'))channelId=null;
    if(!channelId){
      if(saved.channelRequestPending)throw new Error('PriorChannelRequestNeedsReconciliation');
      saved.channelRequestPending=true;persist();
      const channel=await sdk.requestChannel(api,teamToken,wallet,{capRlusd:'1',merchantId,timeoutMs:120000});
      channelId=channel.channel_id;saved.channelId=channelId;saved.channelRequestPending=false;persist();
    }else{saved.channelId=channelId;saved.channelRequestPending=false;persist();}
    const before=await paymentToken.balanceOf(payout);
    const purchase=await buyResource({context,provider,wallet,stateDirectory:directory+'/agent',resourceUrl,channelId,maximumAmount:parseUnits('0.01',18).toString(),operation});
    // SDK independently validates the exact VoucherRedeemed event and claim before returning content.
    const base={report:purchase.resource,channelId,redemptionHash:purchase.transactionHash,claimId:purchase.claimId,amountRlusd:'0.01',settled:false,token:context.x402.token,ledger:context.participantRequest.ledger,payout};
    saved.operations[operation]={complete:false,result:base};persist();
    const record=await fetch(api+'/public/participant/record-redemption',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${teamToken}`},body:JSON.stringify({tx_hash:purchase.transactionHash}),signal:AbortSignal.timeout(15000)});
    if(!record.ok)throw new Error('RedemptionRecordedOnChainButPortalRecordPending');
    try{
      const settlement=await sdk.settle(api,teamToken,channelId);
      if(settlement.payout_tx){
        const receipt=await provider.getTransactionReceipt(settlement.payout_tx);
        const amount=parseUnits('0.01',18);
        const transferTopic='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
        const transferred=receipt?.logs.some(l=>l.address.toLowerCase()===context.x402.token.toLowerCase()&&l.topics[0]===transferTopic&&l.topics[2]?.slice(-40).toLowerCase()===payout.slice(2).toLowerCase()&&BigInt(l.data)>=amount);
        if(receipt?.status===1&&transferred){base.settled=true;base.payoutHash=settlement.payout_tx;base.receiptUrl=settlement.receipt_url?new URL(settlement.receipt_url,api).href:undefined;base.merchantBalanceAfter=(await paymentToken.balanceOf(payout)).toString();base.merchantBalanceBefore=before.toString();}
      }
    }catch{/* Confirmed redemption remains real; never claim a pending payout settled. */}
    saved.operations[operation]={complete:true,result:base};persist();return base;
  }finally{busy=false;}
}
function authorized(req){const supplied=req.headers.authorization||'';const expected='Bearer '+token;return supplied.length===expected.length&&timingSafeEqual(Buffer.from(supplied),Buffer.from(expected));}
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
const server=createServer(async(req,res)=>{
  if(!authorized(req))return send(res,403,{error:'Operator authorization required'});
  try{
    if(req.url==='/health'&&req.method==='GET')return send(res,200,{ready:true,chainId:1449000,token:context.x402.token,merchantId,payout,agent:address,priceRlusd:'0.01',channelCapRlusd:'1',signing:process.env.AGENT_PRIVATE_KEY?'designated-testnet-key':'interactive-wallet',pending:pending.size});
    if(req.url==='/wallet/next'&&req.method==='GET'){const request=[...pending.values()][0];return send(res,200,request?{id:request.id,method:request.method,params:request.params,description:request.description,address,chainId:1449000}:null);}
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>65536)throw new Error('RequestTooLarge');}const input=JSON.parse(raw||'{}');
    if(req.url==='/wallet/respond'&&req.method==='POST'){
      const request=pending.get(input.id);if(!request)return send(res,409,{error:'Signing request is no longer pending'});
      if(input.error)request.reject(new Error('WalletRejected'));else if(typeof input.result==='string')request.resolve(input.result);else throw new Error('InvalidSigningResponse');
      return send(res,200,{accepted:true});
    }
    if(req.url==='/purchase'&&req.method==='POST')return send(res,200,await purchase(input));
    return send(res,404,{error:'NotFound'});
  }catch(e){send(res,503,{error:e.name==='Error'?String(e.message).replace(/https?:\/\/\S+/g,'[endpoint]').slice(0,160):e.name,resumeOriginalOperation:true});}
});
server.listen(4239,'127.0.0.1',()=>console.log('AP4M official x402 worker ready at loopback :4239; merchant :4308; max report price 0.01 test RLUSD, channel cap 1. Wallet prompts require the registered Account 2.'));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{for(const request of pending.values())request.reject(new Error('WorkerStopping'));server.close();void merchant.close().finally(()=>{provider.destroy();process.exit(0);});});
