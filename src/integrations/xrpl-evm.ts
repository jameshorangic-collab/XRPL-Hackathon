import {
  BrowserProvider,
  Contract,
  getAddress,
  formatEther,
  type Eip1193Provider,
  type TransactionReceipt,
  type ContractEventPayload,
} from "ethers";
export const TESTNET_CHAIN_ID = 1449000;
export type WalletSession = {
  address: string;
  chainId: number;
  nativeBalance: string;
};
export type FacilityDescriptor = {
  opportunityId: string;
  address: string;
  token: string;
  termsHash: string;
  chainId: 1449000;
  fromBlock: number;
};
const tokenAbi = [
  "function balanceOf(address) view returns(uint256)",
  "function decimals() view returns(uint8)",
  "function allowance(address,address) view returns(uint256)",
  "function approve(address,uint256) returns(bool)",
];
const facilityAbi = [
  "function allocation(address) view returns(uint256)",
  "function funded(address) view returns(bool)",
  "function state() view returns(uint8)",
  "function token() view returns(address)",
  "function termsHash() view returns(bytes32)",
  "function totalFunded() view returns(uint256)",
  "function target() view returns(uint256)",
  "function fundingDeadline() view returns(uint256)",
  "function commit()",
  "event CapitalCommitted(address indexed investor,uint256 amount)",
  "event Settled(uint256 collections,uint256 fee)",
];
export class WalletError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletError";
  }
}
export function walletMessage(error: unknown): string {
  const e = error as {
    code?: number | string;
    info?: { error?: { code?: number } };
  };
  if (
    e?.code === 4001 ||
    e?.code === "ACTION_REJECTED" ||
    e?.info?.error?.code === 4001
  )
    return "Wallet request rejected. No commitment was recorded. You can retry or use simulated commitment mode.";
  return error instanceof WalletError
    ? error.message
    : "Wallet request failed. Check your wallet, network, balance, and contract configuration. No commitment was recorded.";
}
export function toTokenUnits(cents: number, decimals: number): bigint {
  if (
    !Number.isSafeInteger(cents) ||
    cents <= 0 ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 18
  )
    throw new WalletError("Invalid token amount or decimals.");
  const numerator = BigInt(cents) * 10n ** BigInt(decimals);
  if (numerator % 100n)
    throw new WalletError("This token cannot represent the requested cents.");
  return numerator / 100n;
}
export class XrplEvmAdapter {
  private provider: BrowserProvider;
  constructor(private injected: Eip1193Provider) {
    this.provider = new BrowserProvider(injected, "any");
  }
  async connect(): Promise<WalletSession> {
    try {
      await this.injected.request({
        method: "eth_requestAccounts",
        params: [],
      });
      const signer = await this.provider.getSigner();
      const network = await this.provider.getNetwork();
      const address = await signer.getAddress();
      return {
        address,
        chainId: Number(network.chainId),
        nativeBalance: formatEther(await this.provider.getBalance(address)),
      };
    } catch (e) {
      throw new WalletError(walletMessage(e));
    }
  }
  async switchToTestnet() {
    try {
      await this.injected.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x" + TESTNET_CHAIN_ID.toString(16) }],
      });
    } catch (e) {
      throw new WalletError(walletMessage(e));
    }
  }
  async verifyChain() {
    if (Number((await this.provider.getNetwork()).chainId) !== TESTNET_CHAIN_ID)
      throw new WalletError(
        "Select XRPL EVM Testnet, chain 1449000, before any transaction.",
      );
  }
  async tokenBalance(token: string, address: string) {
    await this.verifyChain();
    const c = new Contract(getAddress(token), tokenAbi, this.provider);
    return {
      balance: BigInt(await c.balanceOf(getAddress(address))),
      decimals: Number(await c.decimals()),
    };
  }
  private async verifiedFacility(d: FacilityDescriptor) {
    await this.verifyChain();
    if (
      d.chainId !== TESTNET_CHAIN_ID ||
      !/^0x[0-9a-f]{64}$/i.test(d.termsHash)
    )
      throw new WalletError(
        "No verified testnet facility descriptor is linked to this opportunity.",
      );
    const c = new Contract(getAddress(d.address), facilityAbi, this.provider);
    if (
      getAddress(await c.token()) !== getAddress(d.token) ||
      (await c.termsHash()).toLowerCase() !== d.termsHash.toLowerCase()
    )
      throw new WalletError(
        "Deployed facility terms do not match the accepted opportunity.",
      );
    return c;
  }
  async funding(d: FacilityDescriptor) {
    const c = await this.verifiedFacility(d);
    return {
      funded: BigInt(await c.totalFunded()),
      target: BigInt(await c.getFunction("target")()),
      state: Number(await c.state()),
    };
  }
  async commit(
    d: FacilityDescriptor,
    amountCents: number,
    tranche: "senior" | "junior",
    onReceipt?: (action: string, r: TransactionReceipt) => void,
  ) {
    // The preserved contract has no mezzanine or standalone whole-loan facility.
    if (!["senior", "junior"].includes(tranche))
      throw new WalletError(
        "The deployed two-layer facility does not support this tranche.",
      );
    try {
      const c = await this.verifiedFacility(d);
      const signer = await this.provider.getSigner();
      const account = await signer.getAddress();
      const token = new Contract(getAddress(d.token), tokenAbi, signer);
      const units = toTokenUnits(amountCents, Number(await token.decimals()));
      if (
        Number(await c.state()) !== 0 ||
        Boolean(await c.funded(account)) ||
        BigInt(await c.allocation(account)) !== units
      )
        throw new WalletError(
          "This wallet has no matching uncommitted contract allocation.",
        );
      if (BigInt(await token.balanceOf(account)) < units)
        throw new WalletError("Insufficient test-token balance.");
      if (BigInt(await token.allowance(account, d.address)) < units) {
        const approval = await token.approve(d.address, units);
        const receipt = await approval.wait();
        if (!receipt || receipt.status !== 1)
          throw new WalletError("Token approval did not succeed.");
        onReceipt?.("Token approval", receipt);
      }
      const writable = new Contract(d.address, facilityAbi, signer);
      const tx = await writable.commit();
      const receipt: TransactionReceipt | null = await tx.wait();
      if (!receipt || receipt.status !== 1)
        throw new WalletError("Commitment did not succeed.");
      onReceipt?.("Testnet commitment", receipt);
      return receipt;
    } catch (e) {
      throw new WalletError(walletMessage(e));
    }
  }
  async receipt(hash: string) {
    await this.verifyChain();
    if (!/^0x[0-9a-f]{64}$/i.test(hash))
      throw new WalletError("Invalid transaction hash.");
    return this.provider.getTransactionReceipt(hash);
  }
  async history(d: FacilityDescriptor) {
    const c = await this.verifiedFacility(d);
    return c.queryFilter(c.filters.CapitalCommitted(), d.fromBlock, "latest");
  }
  async watch(
    d: FacilityDescriptor,
    listener: (event: ContractEventPayload) => void,
  ) {
    const c = await this.verifiedFacility(d);
    const receive = (...args: unknown[]) =>
      listener(args[args.length - 1] as ContractEventPayload);
    await c.on("CapitalCommitted", receive);
    return () => {
      void c.off("CapitalCommitted", receive);
    };
  }
  destroy() {
    this.provider.destroy();
  }
}
export function injectedWallet(): Eip1193Provider | undefined {
  return (window as Window & { ethereum?: Eip1193Provider }).ethereum;
}
