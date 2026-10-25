import {
  Contract,
  ContractFactory,
  JsonRpcProvider,
  keccak256,
  toUtf8Bytes,
  type TransactionResponse,
} from "ethers";
import { cashWaterfall } from "./domain/finance";
import type { Structure } from "./domain/types";
export type ChainRun = {
  token: string;
  facility: string;
  chainId: number;
  blockNumber: number;
  totalClaimed: number;
  transactions: { action: string; hash: string }[];
};
export async function runLocalChainDemo(
  s: Structure,
  collections: number,
  feeBps: number,
  progress: (message: string) => void,
): Promise<ChainRun> {
  if (
    !Number.isSafeInteger(collections) ||
    collections < 0 ||
    collections > 20000000
  )
    throw new Error("Collections must be between $0 and $200,000.");
  const provider = new JsonRpcProvider("http://127.0.0.1:8545", undefined, {
    staticNetwork: false,
  });
  provider.pollingInterval = 100;
  let chainId: number;
  try {
    chainId = Number((await provider.getNetwork()).chainId);
  } catch {
    provider.destroy();
    throw new Error(
      "Local chain is unavailable. Run npm run chain in the project terminal, then retry.",
    );
  }
  if (chainId !== 31337) {
    provider.destroy();
    throw new Error(
      "This automated wallet flow is restricted to local chain 31337.",
    );
  }
  try {
    const artifacts = await Promise.all(
      ["MockUSD", "BackstopFacility"].map(async (n) => {
        const r = await fetch(`/contracts/${n}.json`);
        if (!r.ok)
          throw new Error(
            "Compile contract artifacts with npm run contracts:compile.",
          );
        return r.json();
      }),
    );
    const originator = await provider.getSigner(0);
    const seniorSigner = await provider.getSigner(1);
    const juniorSigners = await Promise.all(
      s.junior.map((_, i) => provider.getSigner(i + 2)),
    );
    const feeSigner = await provider.getSigner(19);
    const txs: ChainRun["transactions"] = [];
    const mined = async (action: string, tx: TransactionResponse) => {
      progress(action);
      const r = await tx.wait();
      if (!r || r.status !== 1) throw new Error(`${action} reverted`);
      txs.push({ action, hash: r.hash });
    };
    progress("Deploying mock USD token…");
    const tokenDeployment = await new ContractFactory(
      artifacts[0].abi,
      artifacts[0].bytecode,
      originator,
    ).deploy();
    await mined("Deploy mock USD", tokenDeployment.deploymentTransaction()!);
    const tokenAddress = await tokenDeployment.getAddress();
    const token = new Contract(tokenAddress, artifacts[0].abi, originator);
    const juniors = await Promise.all(
      s.junior.map(async (a, i) => ({
        investor: await juniorSigners[i].getAddress(),
        principal: a.amount,
        rateBps: a.rateBps,
      })),
    );
    const block = await provider.getBlock("latest");
    const deployment = await new ContractFactory(
      artifacts[1].abi,
      artifacts[1].bytecode,
      originator,
    ).deploy(
      tokenAddress,
      await seniorSigner.getAddress(),
      s.senior.amount,
      s.senior.rateBps,
      s.retention,
      juniors,
      await feeSigner.getAddress(),
      feeBps,
      block!.timestamp + 3600,
      keccak256(toUtf8Bytes(JSON.stringify(s))),
    );
    await mined("Register accepted terms", deployment.deploymentTransaction()!);
    const facilityAddress = await deployment.getAddress();
    const facility = new Contract(
      facilityAddress,
      artifacts[1].abi,
      originator,
    );
    const participants = [
      { signer: seniorSigner, amount: s.senior.amount, name: "Senior" },
      ...s.junior.map((a, i) => ({
        signer: juniorSigners[i],
        amount: a.amount,
        name: `Junior ${i + 1}`,
      })),
      { signer: originator, amount: s.retention, name: "Originator" },
    ];
    for (const p of participants) {
      await mined(
        `Mint ${p.name} mock funds`,
        await token.mint(await p.signer.getAddress(), p.amount),
      );
      await mined(
        `Approve ${p.name} funds`,
        await new Contract(tokenAddress, artifacts[0].abi, p.signer).approve(
          facilityAddress,
          p.amount,
        ),
      );
      await mined(
        `Commit ${p.name} capital`,
        await new Contract(
          facilityAddress,
          artifacts[1].abi,
          p.signer,
        ).commit(),
      );
    }
    await mined("Activate funded facility", await facility.activate());
    if (collections > 0) {
      await mined(
        "Mint simulated collections",
        await token.mint(await originator.getAddress(), collections),
      );
      await mined(
        "Approve cash collection",
        await token.approve(facilityAddress, collections),
      );
      await mined(
        "Record mock collections",
        await facility.recordCollection(collections),
      );
    }
    progress("Advancing local chain to 12-month maturity…");
    await provider.send("evm_increaseTime", [365 * 24 * 60 * 60 + 1]);
    await provider.send("evm_mine", []);
    await mined("Settle maturity waterfall", await facility.settle());
    const model = cashWaterfall(s, collections, feeBps);
    const expected = [model.senior, ...model.junior, model.originator];
    for (let i = 0; i < participants.length; i++) {
      const address = await participants[i].signer.getAddress();
      if (
        Number(await facility.principalPaid(address)) !==
          expected[i].principal ||
        Number(await facility.interestPaid(address)) !== expected[i].interest
      )
        throw new Error(
          "Contract cash accounting differs from the domain model.",
        );
    }
    let totalClaimed = 0;
    for (const p of [
      ...participants,
      { signer: feeSigner, amount: 0, name: "Fee recipient" },
    ]) {
      const claim = Number(
        await facility.claimable(await p.signer.getAddress()),
      );
      if (claim > 0) {
        await mined(
          `Withdraw ${p.name} claim`,
          await new Contract(
            facilityAddress,
            artifacts[1].abi,
            p.signer,
          ).claim(),
        );
        totalClaimed += claim;
      }
    }
    if (totalClaimed !== collections)
      throw new Error("Cash reconciliation failed.");
    const latest = await provider.getBlock("latest");
    progress(
      "Complete. Mined receipts reconcile exactly to the financial model.",
    );
    return {
      token: tokenAddress,
      facility: facilityAddress,
      chainId,
      blockNumber: latest!.number,
      totalClaimed,
      transactions: txs,
    };
  } finally {
    provider.destroy();
  }
}
