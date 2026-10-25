import {
  Contract,
  Interface,
  JsonRpcProvider,
  getAddress,
  isAddress,
  formatUnits,
} from "ethers";
import { ApiError, type Config } from "./config";
// Exact event fragment from the official @ap4m/sdk participant-requests ABI.
const participantLedgerInterface = new Interface([
  "event VoucherRedeemed(bytes32 indexed channelId,bytes32 indexed claimId,bytes32 indexed voucherDigest,bytes32 allocationId,address agent,bytes32 merchantId,address payout,address submitter,uint256 previousCumulativeAmount,uint256 cumulativeAmount,uint256 amount)",
]);
const facilityAbi = [
  "function token() view returns(address)",
  "function funded() view returns(uint256)",
  "function target() view returns(uint256)",
  "function state() view returns(uint8)",
];
export class RpcService {
  readonly provider: JsonRpcProvider | undefined;
  constructor(readonly config: Config) {
    if (config.rpc)
      this.provider = new JsonRpcProvider(config.rpc, undefined, {
        staticNetwork: false,
        batchMaxCount: 1,
      });
  }
  async network() {
    if (!this.provider)
      throw new ApiError(503, "Blockchain RPC is not configured.");
    const n = await this.provider.getNetwork();
    if (n.chainId !== 1449000n)
      throw new ApiError(
        503,
        "RPC is on the wrong network. Expected XRPL EVM Testnet 1449000.",
      );
    return this.provider;
  }
  async health() {
    const p = await this.network();
    return {
      chainId: 1449000,
      blockNumber: await p.getBlockNumber(),
      provider: this.config.quicknode ? "QuickNode" : "Configured XRPL RPC",
    };
  }
  async balance(address: string) {
    if (!isAddress(address)) throw new ApiError(400, "Invalid wallet address.");
    const p = await this.network();
    return {
      address: getAddress(address),
      balance: (await p.getBalance(address)).toString(),
      chainId: 1449000,
    };
  }
  async receipt(hash: string) {
    if (!/^0x[0-9a-f]{64}$/i.test(hash))
      throw new ApiError(400, "Invalid transaction hash.");
    const p = await this.network();
    const receipt = await p.getTransactionReceipt(hash);
    if (!receipt)
      throw new ApiError(
        404,
        "Transaction has not been mined on XRPL EVM Testnet.",
      );
    const block = await p.getBlock(receipt.blockNumber);
    if (block?.hash !== receipt.blockHash)
      throw new ApiError(409, "Transaction block is no longer canonical.");
    return {
      hash: receipt.hash,
      chainId: 1449000,
      status: receipt.status,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      confirmations: await receipt.confirmations(),
      from: receipt.from,
      to: receipt.to,
      gasUsed: receipt.gasUsed.toString(),
      explorerUrl: `https://explorer.testnet.xrplevm.org/tx/${receipt.hash}`,
      logs: receipt.logs.map((l) => ({
        address: l.address,
        topics: l.topics,
        data: l.data,
        index: l.index,
      })),
      verifiedBy: this.config.quicknode ? "QuickNode" : "Configured XRPL RPC",
    };
  }
  async funding(address: string) {
    if (!isAddress(address))
      throw new ApiError(400, "Invalid facility address.");
    const p = await this.network();
    if ((await p.getCode(address)) === "0x")
      throw new ApiError(404, "No contract exists at this address.");
    const c = new Contract(address, facilityAbi, p);
    const [funded, target, state] = await Promise.all([
      c.funded(),
      c.getFunction("target")(),
      c.state(),
    ]);
    return {
      chainId: 1449000,
      facility: getAddress(address),
      funded: funded.toString(),
      target: target.toString(),
      state: Number(state),
    };
  }
  async history(address: string) {
    if (!isAddress(address))
      throw new ApiError(400, "Invalid facility address.");
    const p = await this.network();
    const toBlock = await p.getBlockNumber();
    const logs = [];
    // The existing QuickNode Discover endpoint permits only five blocks per query.
    for (let from = Math.max(0, toBlock - 99); from <= toBlock; from += 5)
      logs.push(
        ...(await p.getLogs({
          address,
          fromBlock: from,
          toBlock: Math.min(from + 4, toBlock),
        })),
      );
    const hashes = [...new Set(logs.map((l) => l.transactionHash))].slice(-30);
    return Promise.all(hashes.map((h) => this.receipt(h)));
  }
  async ap4mPayout(hash: string, expectedChannel?: string) {
    const p = await this.network();
    const receipt = await this.receipt(hash);
    if (receipt.status !== 1)
      throw new ApiError(409, "AP4M redemption reverted.");
    const network = await (
      await fetch("https://hackathon.ap4m.build/public/config", {
        signal: AbortSignal.timeout(5000),
      })
    ).json();
    if (network.network?.chainId !== 1449000)
      throw new ApiError(
        503,
        "Official AP4M configuration is on the wrong chain.",
      );
    const ledger = String(network.contracts?.paymentLedger);
    const vault = String(network.contracts?.pooledEscrowVault);
    const token = String(network.contracts?.rlusdToken);
    const redemption = receipt.logs
      .filter((l) => l.address.toLowerCase() === ledger.toLowerCase())
      .flatMap((l) => {
        try {
          const e = participantLedgerInterface.parseLog(l);
          return e?.name === "VoucherRedeemed" ? [e] : [];
        } catch {
          return [];
        }
      })[0];
    if (
      !redemption ||
      (expectedChannel && redemption.args.channelId !== expectedChannel)
    )
      throw new ApiError(
        409,
        "Receipt does not contain the expected AP4M VoucherRedeemed event.",
      );
    const event = new Interface([
      "event ClaimPaid(bytes32 indexed claimId,bytes32 indexed payoutId,bytes32 indexed channelId,address payout,uint256 amount,uint256 cumulativeDisbursed,uint64 paidAt)",
    ]);
    const last = await p.getBlockNumber();
    const start = receipt.blockNumber;
    if (last - start > 1000)
      throw new ApiError(
        409,
        "Use the recorded payout receipt for older AP4M payments.",
      );
    for (let from = start; from <= last; from += 5) {
      const logs = await p.getLogs({
        address: vault,
        topics: [
          event.getEvent("ClaimPaid")!.topicHash,
          redemption.args.claimId,
        ],
        fromBlock: from,
        toBlock: Math.min(last, from + 4),
      });
      for (const log of logs) {
        const paid = event.parseLog(log)!;
        if (
          paid.args.channelId !== redemption.args.channelId ||
          getAddress(paid.args.payout) !== getAddress(redemption.args.payout) ||
          paid.args.amount !== redemption.args.amount
        )
          continue;
        const payout = await this.receipt(log.transactionHash);
        const transfer = new Interface([
          "event Transfer(address indexed from,address indexed to,uint256 value)",
        ]);
        const confirmed = payout.logs
          .filter((l) => l.address.toLowerCase() === token.toLowerCase())
          .some((l) => {
            try {
              const e = transfer.parseLog(l);
              return (
                e &&
                getAddress(e.args.from) === getAddress(vault) &&
                getAddress(e.args.to) === getAddress(paid.args.payout) &&
                e.args.value === paid.args.amount
              );
            } catch {
              return false;
            }
          });
        if (payout.status === 1 && confirmed)
          return {
            settled: true,
            payoutHash: payout.hash,
            redemptionHash: hash,
            channelId: paid.args.channelId,
            claimId: paid.args.claimId,
            amountWei: paid.args.amount.toString(),
              amountRlusd: formatUnits(paid.args.amount, 18),
            token,
            payout: getAddress(paid.args.payout),
            verifiedBy: receipt.verifiedBy,
            blockNumber: payout.blockNumber,
          };
      }
    }
    return {
      settled: false,
      redemptionHash: hash,
      channelId: redemption.args.channelId,
      claimId: redemption.args.claimId,
      amountWei: redemption.args.amount.toString(),
      token,
      payout: getAddress(redemption.args.payout),
      verifiedBy: receipt.verifiedBy,
    };
  }
  async verifyToken(address: string, expectedDecimals: number) {
    if (!isAddress(address))
      throw new ApiError(400, "Invalid payment token address.");
    const p = await this.network();
    if ((await p.getCode(address)) === "0x")
      throw new ApiError(503, "Payment token has no contract code.");
    const c = new Contract(
      address,
      [
        "function decimals() view returns(uint8)",
        "function symbol() view returns(string)",
      ],
      p,
    );
    const decimals = Number(await c.decimals());
    if (decimals !== expectedDecimals)
      throw new ApiError(
        503,
        "Payment token decimals differ from the official AP4M context.",
      );
    return {
      address: getAddress(address),
      decimals,
      symbol: await c.symbol(),
      chainId: 1449000,
    };
  }
  close() {
    this.provider?.destroy();
  }
}
