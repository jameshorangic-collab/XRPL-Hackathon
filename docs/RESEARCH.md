# Technical research

Checked October 24, 2026 (America/New_York). Network state can change. Primary sources and captured evidence follow.

## Native XRPL status

The [known-amendments reference](https://xrpl.org/resources/known-amendments) identifies `LendingProtocol` and `SingleAssetVault`. Its rendered status is dynamic, so documentation presence alone was not treated as proof of activation.

A live `feature` JSON-RPC query to `https://s1.ripple.com:51234/` reported `enabled: false` for both amendments, and also for `LendingProtocolV1_1`. This is a timestamped observation from that mainnet server, not a guarantee about every network or future state. The selected fields and query metadata are saved in [evidence/xrpl-amendments.json](evidence/xrpl-amendments.json).

The [XLS-65 specification](https://xls.xrpl.org/xls/XLS-0065-single-asset-vault.html) describes a tokenized single-asset vault. The [XLS-66 specification](https://xls.xrpl.org/xls/XLS-0066-lending-protocol.html) describes broker-managed loans and cover. The [official broker tutorial](https://xrpl.org/docs/tutorials/defi/lending/use-the-lending-protocol/create-a-loan-broker) and [cover tutorial](https://xrpl.org/docs/tutorials/defi/lending/use-the-lending-protocol/deposit-and-withdraw-cover) show broker ownership and control of the first-loss facility. BACKSTOP does not assume external junior investors can directly treat this native cover account as its own independent tranche.

## EVM network

The [XRPL EVM interaction guide](https://docs.xrplevm.org/pages/developers/interacting-with-evm/interact-with-the-smart-contract) lists testnet RPC `https://rpc.testnet.xrplevm.org`, chain ID `1449000`, and explorer `https://explorer.testnet.xrplevm.org`. Its compatibility guidance supports earlier EVM targets. This build uses Solidity 0.8.28 with a Paris target, verified locally. No public testnet wallet, funds, or transaction have been used by this build.

The [XRPL sidechains overview](https://xrpl.org/docs/concepts/xrpl-sidechains) describes sidechains as independent ledgers. EVM contract events cannot be presented as native XRPL loan events. This prototype makes no cross-chain or authentic testnet RLUSD availability claim.

## Future integration path

A broker-mediated deployment would require verified amendment support on the actual target network, authorized broker control, compatible asset denomination, explicit custody and bridge arrangements, and separate legal/accounting treatment of any broker cover. The current junior funding is inside the portfolio principal. Moving it to a separately funded guarantee reserve changes the financing identity and cannot be achieved by renaming fields.
