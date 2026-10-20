# RecallScope

**Evidence before the next handoff.**

RecallScope is an inspection desk for comparing a secondhand product with one official CPSC recall notice. It separates product identity, model/batch scope, original sale period and region, then preserves a readable record of what matches and what remains uncertain.

## Try it

Open [the inspection desk](https://gqzy1.github.io/recallscope-genlayer/) and select **View worked example**. It is labelled illustrative and never presents edited form fields as a newly evaluated result.

For development, Node.js 20+:

```sh
npm ci
npm test
npm run build
```

Serve `dist/` through any static HTTP server. There is no application backend or API key.

## Design

The interface draws on Leonardo da Vinci’s notebooks: warm parchment, sepia ink, original vector engineering studies, compass geometry and marginal annotations. Slow ambient light, pointer parallax, scroll reveals and a compass cursor support the visual language. Motion can be disabled and respects the operating system’s reduced-motion preference. The artwork is an original composition, not a scan of a historical manuscript.

**Release 0.2 · [Deployed contract](https://explorer-studio.genlayer.com/address/0x5EbaD2E0dA70e9aCd8f50C6837cb060965257F70) · Stable Studionet / 61999**

## Use GenLayer

1. Open the desk and select **Read finalized inspection** for a wallet-free chain read. To create your own inspection, open **Network settings**; the canonical address is already filled.
2. Open **Network settings**, paste the deployed contract address and select **Verify contract source**. The source SHA256 must match `deployment.json`.
3. Connect a browser wallet on Stable Studionet, or select **Open deployed contract in Studio** to use the official Studio development signer. Complete the official CPSC notice URL and product facts, using a new request ID for a new inspection.
4. Select **Submit to GenLayer** and sign once. Keep the returned transaction ID.
5. Use **Check saved transaction** until finalization. The app verifies transaction sender, contract, method and exact input, then reads the matching finalized record and checks its hashes.
6. Download the JSON or read an existing record by owner and request ID.

For a Studio-created transaction, verify the contract source in the desk, paste its transaction ID into **Track / recover transaction ID**, and select **Track & check**. The app decodes its call and binds owner, contract, method, request ID and input hash before reading any result. This path does not require a browser wallet extension.

If sending returns an uncertain outcome, the request remains saved and new submissions are blocked. Recover the transaction ID from the wallet or Studio, attach it in the desk, and check it. Do not resubmit an uncertain transaction. Wallet account/network changes require reconnecting.

The local pending-request record exists in this browser profile only. Clearing browser storage or moving to another device removes that recovery context; retain the transaction ID independently.

## Results

- **Potential match:** supplied facts match this notice's scope; use the official recall and manufacturer process.
- **Needs details:** missing or ambiguous information prevents a complete comparison.
- **Outside this notice:** explicit evidence excludes this notice, without ruling out other recalls or certifying safety.

User-supplied facts are not authenticated. A secondhand purchase date is not an original sale date. Manufacturer serial-number checks cannot be inferred from a model match.

## Source and validation

The identical reusable contract is included under `contracts/`. The canonical address and exact source hash are configured in `deployment.json`. The interface supports real GenLayer reads, transaction tracking and browser-wallet writes. Desktop page rendering, example interaction, motion toggle, network dialog and JSON export have been checked on the public website. Mobile signing and the optional browser-wallet signing path remain unverified. Sixteen automated JavaScript tests cover the DOM example, hash verification, wallet changes, pending recovery and duplicate prevention. The contract has 26 CPython harness tests and real SDK storage/callback checks; see its README for the precise limits.

The CPSC source is fetched inside the contract, not supplied as a browser-generated summary. Web text is agreed before semantic classification. Independent validators must agree on all four material labels and audit the leader's evidence. The resulting record is immutable and owner-scoped.

## Static hosting

The Pages workflow builds and publishes `dist/` when the main branch changes. Configure the repository's Pages source as GitHub Actions. An independent CI workflow runs contract and application checks on pushes and pull requests.

The built `dist/` directory can also be hosted on any static host. All assets and links are relative to support repository subpaths.

Official reference: https://www.cpsc.gov/Recalls/2025/More-than-One-Million-Anker-Power-Banks-Recalled-Due-to-Fire-and-Burn-Hazards-Manufactured-by-Anker-Innovations

MIT License.

## Read-only network verification

```sh
node verification/verify-live.mjs
```

This checks deployed source identity and each configured finalized case, then validates the exact stored input and notice hashes. It sends no transactions.
