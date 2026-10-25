import { requestJson, NotConfiguredError } from "./server";
export interface RpcReceipt {
  hash: string;
  chainId: number;
  status: 0 | 1;
  blockNumber: number;
}
export interface FundingStatus {
  chainId: number;
  facility: string;
  funded: string;
  target: string;
  state: number;
}
export class QuickNodeAdapter {
  constructor(private base: string) {}
  async balance(address: string) {
    if (!this.base) throw new NotConfiguredError("QuickNode");
    return requestJson<{ address: string; balance: string; chainId: number }>(
      `/api/blockchain/balance?address=${encodeURIComponent(address)}`,
      {},
      this.base,
    );
  }
  async receipt(hash: string) {
    if (!this.base) throw new NotConfiguredError("QuickNode");
    const r = await requestJson<RpcReceipt>(
      `/api/blockchain/receipts/${encodeURIComponent(hash)}`,
      {},
      this.base,
    );
    if (
      r.chainId !== 1449000 ||
      r.hash.toLowerCase() !== hash.toLowerCase() ||
      ![0, 1].includes(r.status) ||
      !Number.isSafeInteger(r.blockNumber)
    )
      throw new Error(
        "RPC gateway returned an invalid receipt or wrong chain.",
      );
    return r;
  }
  async funding(facility: string) {
    if (!this.base) throw new NotConfiguredError("QuickNode");
    const r = await requestJson<FundingStatus>(
      `/api/blockchain/facilities/${encodeURIComponent(facility)}`,
      {},
      this.base,
    );
    if (r.chainId !== 1449000)
      throw new Error("RPC gateway is not on XRPL EVM Testnet.");
    return r;
  }
  async history(facility: string) {
    if (!this.base) throw new NotConfiguredError("QuickNode");
    return requestJson<RpcReceipt[]>(
      `/api/blockchain/facilities/${encodeURIComponent(facility)}/transactions`,
      {},
      this.base,
    );
  }
}
