import { NextRequest, NextResponse } from "next/server";
import { getChainByKey } from "@/lib/chains";

// Confirmed USDT BEP-20 contract address and decimals (18, not 6).
// Source: https://bscscan.com/token/0x55d398326f99059ff775485246999027b3197955
const USDT_BEP20 = {
  address: "0x55d398326f99059fF775485246999027B3197955",
  decimals: 18,
};

// Minimal ERC-20 balanceOf ABI - only what we need.
const BALANCE_OF_ABI = ["function balanceOf(address) view returns (uint256)"];

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

// Calls each RPC independently so one slow/down chain doesn't block the others.
// Returns whatever it can fetch, surfaces per-chain errors clearly.
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const { JsonRpcProvider, Contract, formatEther, formatUnits } = await import("ethers");

  const bscRpc = getChainByKey("BSC")?.rpcUrl;
  const baseRpc = getChainByKey("BASE")?.rpcUrl;
  const ethRpc = getChainByKey("ETHEREUM")?.rpcUrl;

  // Fetch all 4 balances independently and in parallel.
  // Resolve instead of reject on individual failures so partial data still reaches the client.
  const [bnbResult, usdtResult, baseResult, ethResult] = await Promise.allSettled([
    (async () => {
      const p = new JsonRpcProvider(bscRpc);
      const wei = await p.getBalance(address);
      return Number(formatEther(wei));
    })(),
    (async () => {
      const p = new JsonRpcProvider(bscRpc);
      const contract = new Contract(USDT_BEP20.address, BALANCE_OF_ABI, p);
      const raw = await contract.balanceOf(address) as bigint;
      return Number(formatUnits(raw, USDT_BEP20.decimals));
    })(),
    (async () => {
      const p = new JsonRpcProvider(baseRpc);
      const wei = await p.getBalance(address);
      return Number(formatEther(wei));
    })(),
    (async () => {
      const p = new JsonRpcProvider(ethRpc);
      const wei = await p.getBalance(address);
      return Number(formatEther(wei));
    })(),
  ]);

  const pick = (r: PromiseSettledResult<number>) =>
    r.status === "fulfilled" ? { value: r.value, error: null } : { value: null, error: (r.reason as Error)?.message || "Failed" };

  return NextResponse.json({
    address,
    bnb: pick(bnbResult),
    usdtBep20: pick(usdtResult),
    ethBase: pick(baseResult),
    ethMainnet: pick(ethResult),
  });
}
