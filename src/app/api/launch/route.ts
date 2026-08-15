import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
// Vanity-salt search + IPFS pinning can take up to ~60s; raise the Vercel
// function timeout accordingly (Hobby plan caps at 60, Pro/Enterprise higher).
export const maxDuration = 60;

// Known Flap Portal custom error selectors
const FLAP_ERRORS: Record<string, { name: string; description: string }> = {
  "0xac5f6092": { name: "FeatureDisabled", description: "This entry point is disabled on the current Portal deployment." },
  "0x4fd0ffbb": { name: "InvalidMigratorType", description: "Migrator type not supported for this token version." },
  "0x13b3e6a5": { name: "InvalidTaxRate", description: "Tax rate invalid (max 1000 bps = 10%)." },
  "0x7dc2862b": { name: "InvalidDexThresh", description: "DEX threshold invalid." },
  "0x3728b83d": { name: "InvalidSalt", description: "Salt invalid or doesn't produce the required vanity suffix." },
  "0x8baa579f": { name: "InvalidName", description: "Token name invalid." },
  "0x4e9f1fb5": { name: "InvalidSymbol", description: "Token symbol invalid." },
  "0xe6c4247b": { name: "InvalidMeta", description: "Metadata CID invalid. Use a valid, pinned IPFS metadata CID." },
  "0xf4d678b8": { name: "InsufficientValue", description: "Not enough BNB/ETH sent for the requested buy + fee." },
  "0x2e07630b": { name: "TokenExists", description: "Token with this salt/address already exists." },
  "0xe450d38c": { name: "InsufficientBalance", description: "Wallet balance too low." },
  "0xfb8f41b2": { name: "InvalidBeneficiary", description: "Beneficiary address invalid." },
  "0xd92e233d": { name: "ZeroAddress", description: "A required address is the zero address." },
  "0x82b42900": { name: "Unauthorized", description: "Caller isn't authorized for this action." },
  "0x3ee5aeb5": { name: "InvalidQuoteToken", description: "Quote token not supported." },
  "0x1425ea42": { name: "Paused", description: "Contract paused." },
  "0xaef851bb": { name: "InvalidTokenVersion", description: "Token version not supported for this entry point." },
  "0x16fba6af": { name: "InvalidFeeConfig", description: "Fee config invalid." },
  "0xca4c5b2d": { name: "TaxConfigError", description: "Tax configuration error (e.g. distribution doesn't sum to 100%)." },
  "0x0f1b693f": { name: "OnlyV3TaxTokenAllowed", description: "This entry point only accepts TOKEN_TAXED_V3." },
  "0x8b921010": { name: "DividendSwapNotSupported", description: "No swap path from quoteToken to the chosen dividendToken." },
};

// ---------------------------------------------------------------------------
// Flap's official metadata/image pinning API. This is the ONLY endpoint that
// actually gets your file pinned on Flap's IPFS gateway - Flap's own docs are
// explicit that tokens will not show their image unless the metadata is
// pinned here:
//   "You must upload the image to IPFS and pin the metadata using our API:
//    https://funcs.flap.sh/api/upload. Our indexer will not be able to fetch
//    your file if it is not pinned on our gateway."
//   (https://docs.flap.sh/flap/developers/token-launcher-developers/launch-token-through-portal)
//
// The four-flap-meme-sdk package ships a same-shaped `uploadTokenMeta` helper,
// but its bundled default endpoint (https://api.flap.sh/graphql) is
// explicitly documented in the SDK's own source as an unverified placeholder
// - that mismatch (not your image, not your parameters) is why uploads were
// silently failing and the launcher was falling back to a fabricated,
// non-resolving CID.
// ---------------------------------------------------------------------------
const FLAP_UPLOAD_ENDPOINT = "https://funcs.flap.sh/api/upload";

function decodeCustomError(errorData: string): string | null {
  if (!errorData || errorData.length < 10) return null;
  const selector = errorData.slice(0, 10).toLowerCase();
  const known = FLAP_ERRORS[selector];
  if (known) return `${known.name} [${selector}] - ${known.description}`;
  return `UnknownError [${selector}]`;
}

function extractErrorSelector(errorMsg: string): string | null {
  const match = errorMsg.match(/data="(0x[a-fA-F0-9]+)"/);
  if (match) return match[1];
  const match2 = errorMsg.match(/(0x[a-fA-F0-9]{8})/);
  if (match2) return match2[1];
  return null;
}

function addLog(requestLogs: string[], message: string) {
  const timestamp = new Date().toISOString().slice(11, 23);
  requestLogs.push(`[${timestamp}] ${message}`);
  console.log(`[Launch] ${message}`);
}

function normalizeImageMime(contentType: string | null): string {
  if (!contentType) return "image/png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "image/jpeg";
  if (contentType.includes("webp")) return "image/webp";
  if (contentType.includes("gif")) return "image/gif";
  if (contentType.includes("svg")) return "image/svg+xml";
  return "image/png";
}

function extensionFromMime(mime: string): string {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("svg")) return "svg";
  return "png";
}

// Pure Web-API base64 encoder (no Buffer) so this runs unmodified under
// Node.js (Vercel), the Vercel/Node Edge runtime, and Cloudflare Workers/Pages.
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function fetchImageAsFile(imageUrl: string, symbol: string): Promise<File | null> {
  const imageRes = await fetch(imageUrl, {
    headers: {
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,image/svg+xml,image/*,*/*;q=0.8",
      "User-Agent": "Flap-Token-Launcher/1.0",
    },
  });
  if (!imageRes.ok) return null;

  const mime = normalizeImageMime(imageRes.headers.get("content-type"));
  const arrayBuffer = await imageRes.arrayBuffer();
  return new File([arrayBuffer], `${symbol || "token"}.${extensionFromMime(mime)}`, { type: mime });
}

// Upload image + metadata to Flap's real IPFS pinning API (see FLAP_UPLOAD_ENDPOINT above).
async function uploadMetadataToFlap(params: {
  file: File;
  name: string;
  symbol: string;
  description: string;
  creator: string;
  website?: string;
  twitter?: string;
  telegram?: string;
}): Promise<{ cid: string | null; error: string | null }> {
  try {
    const { uploadTokenMeta } = await import("four-flap-meme-sdk");
    const cid = await uploadTokenMeta(
      params.file,
      {
        description: params.description || `${params.name} token deployed via Flap Token Launcher`,
        creator: params.creator,
        website: params.website || null,
        twitter: params.twitter || null,
        telegram: params.telegram || null,
      },
      FLAP_UPLOAD_ENDPOINT
    );
    if (typeof cid === "string" && cid.length > 0) return { cid, error: null };
    return { cid: null, error: "Flap upload API returned an empty CID" };
  } catch (error) {
    return { cid: null, error: error instanceof Error ? error.message : String(error) };
  }
}

// Optional secondary pin via Pinata, only used if the user has set PINATA_JWT.
// This is a real, working IPFS pin (unlike the old fake-CID fallback) - it's
// just a different pinning service than Flap's own, so it's tried second.
async function uploadMetadataToPinata(params: {
  file: File;
  name: string;
  symbol: string;
  description: string;
  creator: string;
  website?: string;
  twitter?: string;
  telegram?: string;
}): Promise<{ cid: string | null; error: string | null }> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return { cid: null, error: "PINATA_JWT not configured" };

  try {
    const imageForm = new FormData();
    imageForm.append("file", params.file, params.file.name);
    const imageRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: imageForm,
    });
    if (!imageRes.ok) {
      return { cid: null, error: `Pinata image pin failed: ${imageRes.status} ${await imageRes.text()}` };
    }
    const imageData = await imageRes.json();
    const imageCid = imageData.IpfsHash || imageData.cid;
    if (!imageCid) return { cid: null, error: "Pinata image pin returned no CID" };

    const metaJson = {
      name: params.name,
      symbol: params.symbol,
      description: params.description || `${params.name} token`,
      image: `ipfs://${imageCid}`,
      creator: params.creator,
      website: params.website || null,
      twitter: params.twitter || null,
      telegram: params.telegram || null,
    };
    const metaBlob = new Blob([JSON.stringify(metaJson)], { type: "application/json" });
    const metaForm = new FormData();
    metaForm.append("file", metaBlob, "metadata.json");
    const metaRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: metaForm,
    });
    if (!metaRes.ok) {
      return { cid: null, error: `Pinata metadata pin failed: ${metaRes.status} ${await metaRes.text()}` };
    }
    const metaData = await metaRes.json();
    const metaCid = metaData.IpfsHash || metaData.cid;
    return metaCid ? { cid: metaCid, error: null } : { cid: null, error: "Pinata metadata pin returned no CID" };
  } catch (error) {
    return { cid: null, error: error instanceof Error ? error.message : String(error) };
  }
}

// Free non-IPFS image hosting - for showing a nicer preview thumbnail in this
// app's own UI/history only. This does NOT affect what Flap displays (Flap
// reads the `image` field baked into the pinned metadata JSON above), so its
// failure is never fatal to a launch.
async function uploadImageToFreeHost(imageUrl: string): Promise<string | null> {
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;

    const arrayBuffer = await imgRes.arrayBuffer();
    const base64 = uint8ToBase64(new Uint8Array(arrayBuffer));
    const formData = new FormData();
    formData.append("image", base64);

    const uploadRes = await fetch(
      "https://api.imgbb.com/1/upload?key=d36eb6591370ae7f9089d85875571556",
      { method: "POST", body: formData }
    );

    if (uploadRes.ok) {
      const data = await uploadRes.json();
      return data.data?.url || data.data?.display_url || null;
    }

    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const requestLogs: string[] = [];

  try {
    const body = await req.json();

    const {
      chain = "BSC",
      rpcUrl,
      privateKey,
      name,
      symbol,
      metaCid,
      dexThresh = 1,
      migratorType = 1,
      taxRate = 0,
      initialBuy = "0",
      imageUrl = "",
      description = "",
      website = "",
      twitter = "",
      telegram = "",
    } = body;

    if (!privateKey || !name || !symbol) {
      return NextResponse.json(
        { error: "Missing required fields: privateKey, name, symbol" },
        { status: 400 }
      );
    }

    if (!rpcUrl) {
      return NextResponse.json({ error: "RPC URL required" }, { status: 400 });
    }

    if (!metaCid && !imageUrl) {
      return NextResponse.json(
        {
          error:
            "Provide either a Metadata CID or a Token Image URL. Without an image, Flap has nothing real to pin and display.",
        },
        { status: 400 }
      );
    }

    const taxRateNum = Number(taxRate);
    const hasTax = taxRateNum > 0;

    addLog(requestLogs, `🚀 Starting Flap Token Launcher on ${chain}`);
    addLog(requestLogs, `📝 Token: ${name} (${symbol})`);
    addLog(requestLogs, `⚙️ DEX: ${dexThresh}, Migrator: ${migratorType}, Tax: ${taxRateNum}bps`);
    addLog(requestLogs, "🗄️ Database: disabled (no database required)");

    addLog(requestLogs, "📚 Loading SDK...");
    const {
      FLAP_PORTAL_ABI,
      ZERO_ADDRESS,
      ADDRESSES,
      findSaltEndingByChain,
      getVanitySuffix,
    } = await import("four-flap-meme-sdk");
    const { parseEther, Wallet, JsonRpcProvider, Contract } = await import("ethers");
    addLog(requestLogs, "✅ SDK loaded");

    const wallet = new Wallet(privateKey);
    const deployerAddress = wallet.address;
    addLog(requestLogs, `👤 Deployer: ${deployerAddress}`);

    const provider = new JsonRpcProvider(rpcUrl);
    const connectedWallet = wallet.connect(provider);

    addLog(requestLogs, "💰 Checking balance...");
    const balance = await provider.getBalance(deployerAddress);
    const balanceEth = Number(balance) / 1e18;
    const currency = chain === "BSC" ? "BNB" : "ETH";
    addLog(requestLogs, `💰 Balance: ${balanceEth.toFixed(6)} ${currency}`);

    if (balance === BigInt(0)) {
      throw new Error("Wallet has zero balance.");
    }

    const buyAmtWei = initialBuy && Number(initialBuy) > 0 ? parseEther(String(initialBuy)) : BigInt(0);
    if (buyAmtWei > BigInt(0)) {
      addLog(requestLogs, `🛒 Initial buy: ${initialBuy} ${currency}`);
    } else {
      addLog(requestLogs, "🛒 Initial buy: None");
    }

    let finalImageUrl = imageUrl;
    let finalMetaCid = metaCid || "";

    if (imageUrl) {
      addLog(requestLogs, "🖼️ Fetching image...");
      const file = await fetchImageAsFile(imageUrl, symbol);

      if (!file) {
        addLog(requestLogs, "❌ Could not fetch the image from the provided URL.");
      } else {
        addLog(requestLogs, "📌 Pinning image + metadata to Flap's IPFS API (funcs.flap.sh)...");
        const flapResult = await uploadMetadataToFlap({
          file,
          name,
          symbol,
          description,
          creator: deployerAddress,
          website,
          twitter,
          telegram,
        });

        if (flapResult.cid) {
          finalMetaCid = flapResult.cid;
          addLog(requestLogs, `✅ Pinned on Flap's gateway: ${flapResult.cid}`);
        } else {
          addLog(requestLogs, `⚠️ Flap upload failed: ${flapResult.error}`);

          if (process.env.PINATA_JWT) {
            addLog(requestLogs, "📌 Retrying via Pinata (PINATA_JWT is set)...");
            const pinataResult = await uploadMetadataToPinata({
              file,
              name,
              symbol,
              description,
              creator: deployerAddress,
              website,
              twitter,
              telegram,
            });
            if (pinataResult.cid) {
              finalMetaCid = pinataResult.cid;
              addLog(requestLogs, `✅ Pinned via Pinata: ${pinataResult.cid}`);
              addLog(
                requestLogs,
                "ℹ️ This CID is pinned on Pinata's public gateway, not Flap's own gateway - per Flap's docs, their indexer may take longer to pick it up (or not at all) versus funcs.flap.sh."
              );
            } else {
              addLog(requestLogs, `⚠️ Pinata upload also failed: ${pinataResult.error}`);
            }
          } else if (!metaCid) {
            addLog(
              requestLogs,
              "💡 Tip: set PINATA_JWT as a backup pinning service, or retry - no metadata CID was produced, so this launch will use an unpinned/blank meta field and your image will not display on Flap."
            );
          }
        }

        // Best-effort preview thumbnail for this app's own UI only (never blocks the launch).
        if (!imageUrl.includes("i.ibb.co") && !imageUrl.includes("imgur.com")) {
          const hostedImage = await uploadImageToFreeHost(imageUrl);
          if (hostedImage) {
            finalImageUrl = hostedImage;
          }
        }
      }
    }

    if (finalMetaCid) {
      addLog(requestLogs, `📦 Using metadata CID: ${finalMetaCid}`);
    } else {
      addLog(
        requestLogs,
        "⚠️ No metadata CID available. Launching without one - your token will have no image/description on Flap until you update it."
      );
    }

    const chainAddresses = ADDRESSES[chain as keyof typeof ADDRESSES];
    if (!chainAddresses || !("FlapPortal" in chainAddresses)) {
      throw new Error(`Chain ${chain} not supported`);
    }
    const portalAddress = (chainAddresses as { FlapPortal: string }).FlapPortal;
    addLog(requestLogs, `📍 Portal: ${portalAddress}`);

    const vanitySuffix = getVanitySuffix(chain, hasTax);
    addLog(requestLogs, `🎯 Vanity suffix: ${vanitySuffix} (${hasTax ? "taxed" : "standard"})`);
    addLog(requestLogs, "🔑 Generating vanity salt (10-60 seconds)...");

    let saltResult: { salt: string; address: string; iterations: number };
    try {
      saltResult = await findSaltEndingByChain({
        chain,
        taxed: hasTax,
        maxIterations: 1000000,
      });
      addLog(requestLogs, `✅ Salt found in ${saltResult.iterations} iterations`);
      addLog(requestLogs, `🏷️ Token address: ${saltResult.address}`);
    } catch (saltErr) {
      addLog(requestLogs, `❌ Salt generation failed: ${saltErr instanceof Error ? saltErr.message : String(saltErr)}`);
      throw new Error("Could not generate vanity salt. Try again.");
    }

    const salt = saltResult.salt;
    const portalContract = new Contract(portalAddress, FLAP_PORTAL_ABI, connectedWallet);

    const migratorTypeNum = Number(migratorType);
    const dexThreshNum = Number(dexThresh);

    type MethodAttempt = { name: string; fn: () => Promise<unknown> };

    addLog(requestLogs, "📋 Methods: V3 → V2");

    const methodAttempts: MethodAttempt[] = [
      {
        name: "newTokenV3",
        fn: async () => {
          addLog(requestLogs, "📤 [V3] Sending...");
          const params = {
            name,
            symbol,
            meta: finalMetaCid,
            dexThresh: dexThreshNum,
            salt,
            taxRate: taxRateNum,
            migratorType: migratorTypeNum,
            quoteToken: ZERO_ADDRESS,
            quoteAmt: buyAmtWei,
            beneficiary: deployerAddress,
            permitData: "0x",
            extensionID: "0x" + "0".repeat(64),
            extensionData: "0x",
          };
          const tx = await portalContract.newTokenV3(params, { value: buyAmtWei });
          addLog(requestLogs, `📤 TX: ${tx.hash}`);
          addLog(requestLogs, "⏳ Confirming...");
          return tx.wait();
        },
      },
      {
        name: "newTokenV2",
        fn: async () => {
          addLog(requestLogs, "📤 [V2] Sending...");
          const params = {
            name,
            symbol,
            meta: finalMetaCid,
            dexThresh: dexThreshNum,
            salt,
            taxRate: taxRateNum,
            migratorType: migratorTypeNum,
            quoteToken: ZERO_ADDRESS,
            quoteAmt: buyAmtWei,
            beneficiary: deployerAddress,
            permitData: "0x",
          };
          const tx = await portalContract.newTokenV2(params, { value: buyAmtWei });
          addLog(requestLogs, `📤 TX: ${tx.hash}`);
          return tx.wait();
        },
      },
    ];

    let receipt: { hash?: string; transactionHash?: string } | null = null;
    let successMethod = "";
    let lastError = "";

    for (let i = 0; i < methodAttempts.length; i++) {
      const attempt = methodAttempts[i];
      try {
        addLog(requestLogs, `── ${attempt.name} ──`);
        receipt = (await attempt.fn()) as { hash?: string; transactionHash?: string };
        successMethod = attempt.name;
        addLog(requestLogs, `✅ ${attempt.name} success!`);
        break;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const selector = extractErrorSelector(errMsg);
        if (selector) {
          const decoded = decodeCustomError(selector);
          lastError = decoded || errMsg;
          addLog(requestLogs, `❌ ${attempt.name}: ${decoded}`);
        } else {
          lastError = errMsg.slice(0, 200);
          addLog(requestLogs, `❌ ${attempt.name}: ${errMsg.slice(0, 150)}`);
        }
        if (i < methodAttempts.length - 1) {
          addLog(requestLogs, "🔄 Next method...");
        }
      }
    }

    if (!receipt) {
      throw new Error(lastError || "All methods failed");
    }

    const txHash = receipt.hash || receipt.transactionHash || "unknown";
    addLog(requestLogs, `📋 TX: ${txHash}`);
    addLog(requestLogs, `🏷️ Token: ${saltResult.address}`);
    addLog(requestLogs, `🎯 Method: ${successMethod}`);
    addLog(requestLogs, "🎉 Token deployed successfully!");

    return NextResponse.json({
      success: true,
      txHash,
      deployer: deployerAddress,
      tokenAddress: saltResult.address,
      imageUrl: finalImageUrl,
      metaCid: finalMetaCid,
      chain,
      method: successMethod,
      logs: requestLogs,
    });
  } catch (error: unknown) {
    let errMsg = error instanceof Error ? error.message : "Transaction failed.";
    const selector = extractErrorSelector(errMsg);
    if (selector) {
      const decoded = decodeCustomError(selector);
      if (decoded) errMsg = decoded;
    }

    addLog(requestLogs, `❌ Failed: ${errMsg}`);
    return NextResponse.json({ error: errMsg, logs: requestLogs }, { status: 500 });
  }
}
