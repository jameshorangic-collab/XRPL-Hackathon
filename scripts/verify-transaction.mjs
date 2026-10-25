import { JsonRpcProvider, isHexString } from "ethers";
const hash = process.argv[2];
if (!hash || !isHexString(hash, 32))
  throw new Error("Usage: npm run verify:tx -- <genuine transaction hash>");
const rpc =
  process.env.QUICKNODE_RPC_URL ||
  process.env.XRPL_EVM_RPC_URL ||
  "http://127.0.0.1:8545";
const provider = new JsonRpcProvider(rpc);
try {
  const chainId = Number((await provider.getNetwork()).chainId);
  if (![31337, 1449000].includes(chainId))
    throw new Error("Unsupported verification network.");
  const receipt = await provider.getTransactionReceipt(hash);
  if (!receipt)
    throw new Error(
      "No receipt found. Transaction may be pending or on a different network.",
    );
  console.log(
    JSON.stringify(
      {
        chainId,
        hash: receipt.hash,
        status: receipt.status,
        blockNumber: receipt.blockNumber,
        contractAddress: receipt.contractAddress,
        gasUsed: receipt.gasUsed.toString(),
        confirmed: receipt.status === 1,
      },
      null,
      2,
    ),
  );
} catch {
  console.error(
    "Receipt verification failed. Check the network, endpoint configuration, and transaction hash. RPC credentials are not printed.",
  );
  process.exitCode = 1;
} finally {
  provider.destroy();
}
