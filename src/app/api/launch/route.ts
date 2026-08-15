import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
// Vanity-salt search + IPFS pinning can take up to ~60s; raise the Vercel
// function timeout accordingly (Hobby plan caps at 60, Pro/Enterprise higher).
export const maxDuration = 60;

// Known Flap Portal custom error selectors
const FLAP_ERRORS: Record<string, { name: string; description: string }> = {
  // Sourced from Portal's official IPortalTypes custom-error list
  // (https://docs.flap.sh/flap/developers/token-launcher-developers/launch-token-through-portal),
  // with selectors computed as keccak256(signature).slice(0,10).
  "0xec3d13a4": { name: "DEXCannotBeBothPancakeAndAlgebra1_9", description: "Portal contract reverted with this custom error." },
  "0x7e4d388e": { name: "PortalLensCannotBeZero", description: "Portal contract reverted with this custom error." },
  "0x1df03a72": { name: "PortalLensV2CannotBeZero", description: "Portal contract reverted with this custom error." },
  "0xd20be21e": { name: "MultiDexRouterCannotBeZero", description: "Portal contract reverted with this custom error." },
  "0xde6137d1": { name: "TokenNotFound", description: "Portal contract reverted with this custom error." },
  "0xe2fae90a": { name: "AmountTooSmall", description: "Portal contract reverted with this custom error." },
  "0x76baadda": { name: "SlippageTooHigh", description: "Portal contract reverted with this custom error." },
  "0x85196747": { name: "SameToken", description: "Portal contract reverted with this custom error." },
  "0xc80dcb17": { name: "TokenKilled", description: "Portal contract reverted with this custom error." },
  "0x6e8698f2": { name: "TokenNotTradable", description: "Portal contract reverted with this custom error." },
  "0xa3e58085": { name: "TokenInDuel", description: "Portal contract reverted with this custom error." },
  "0x2a1b25fc": { name: "TokenNotKilled", description: "Portal contract reverted with this custom error." },
  "0x1aa01ec1": { name: "TokenAlreadyDEXed", description: "Portal contract reverted with this custom error." },
  "0x524b4af7": { name: "TokenAlreadyStaged", description: "A token has already been staged/created at this address (salt collision) - retry salt generation." },
  "0x41c77261": { name: "TokenNotStaged", description: "Portal contract reverted with this custom error." },
  "0xffe6d071": { name: "TokenNotDEXed", description: "Portal contract reverted with this custom error." },
  "0xa2db0bee": { name: "NoConversionPath", description: "Portal contract reverted with this custom error." },
  "0xf8ae8137": { name: "RoundNotFound", description: "Portal contract reverted with this custom error." },
  "0x3d2a623f": { name: "InvalidRoundID", description: "Portal contract reverted with this custom error." },
  "0x9bb58380": { name: "LastRoundNotResolved", description: "Portal contract reverted with this custom error." },
  "0x423c8d4c": { name: "InvalidTokenForBattle", description: "Portal contract reverted with this custom error." },
  "0xbf18af43": { name: "InvalidSigner", description: "Portal contract reverted with this custom error." },
  "0x27b13bb0": { name: "SeqNotFound", description: "Portal contract reverted with this custom error." },
  "0xd6234725": { name: "NotImplemented", description: "Portal contract reverted with this custom error." },
  "0xcddb9e00": { name: "TokenAlreadyInGame", description: "Portal contract reverted with this custom error." },
  "0xbbdf0a77": { name: "CallReverted", description: "Portal contract reverted with this custom error." },
  "0x9b9bf411": { name: "PermissionlessCreateDisabled", description: "Public token creation is currently disabled on this Portal deployment." },
  "0x56c2a20a": { name: "TradeDisabled", description: "Portal contract reverted with this custom error." },
  "0x931b4858": { name: "ProtocolDisabled", description: "The protocol's circuit breaker is currently off - all trading/creation disabled." },
  "0xfc4b30f9": { name: "InvalidGameSupplyThreshold", description: "Portal contract reverted with this custom error." },
  "0x7cacc18a": { name: "InvalidDEXSupplyThreshold", description: "Portal contract reverted with this custom error." },
  "0x717c15cd": { name: "MismatchedAddressInProof", description: "Portal contract reverted with this custom error." },
  "0xfa5ee3df": { name: "NoQuotaForCreator", description: "Portal contract reverted with this custom error." },
  "0xdecde364": { name: "InvalidPiggybackLength", description: "Portal contract reverted with this custom error." },
  "0xdd3bdb5a": { name: "TaxProcessorUniV4Required", description: "Portal contract reverted with this custom error." },
  "0xac5f6092": { name: "FeatureDisabled", description: "This entry point is disabled on the current Portal deployment." },
  "0xbb8bf932": { name: "OnlySaleForge", description: "Portal contract reverted with this custom error." },
  "0x9a5c8a92": { name: "QuoteTokenNotAllowed", description: "This quote token isn't allowed for launches." },
  "0x6a855977": { name: "NativeToQuoteSwapNotSupported", description: "Portal contract reverted with this custom error." },
  "0xca1c4a99": { name: "NativeToQuoteSwapFeeTierNotSupported", description: "Portal contract reverted with this custom error." },
  "0x5f23b726": { name: "DirtyBits", description: "Portal contract reverted with this custom error." },
  "0x3f14d62d": { name: "PriceAMustLTPriceB", description: "Portal contract reverted with this custom error." },
  "0xa183feff": { name: "ActualAmountMustLTEAmount", description: "Portal contract reverted with this custom error." },
  "0x1b7cd413": { name: "NotUniswapV3Pool", description: "Portal contract reverted with this custom error." },
  "0x6d9acbf6": { name: "UniswapV2PoolNotZero", description: "Portal contract reverted with this custom error." },
  "0x015dc756": { name: "RequiredTokenMustLTE", description: "Portal contract reverted with this custom error." },
  "0xd9fba47a": { name: "UniswapV3Slot0Failed", description: "Portal contract reverted with this custom error." },
  "0xdf759181": { name: "NonPositionNFTReceived", description: "Portal contract reverted with this custom error." },
  "0x18adb6e1": { name: "InvalidDexThreshold", description: "DEX threshold value invalid." },
  "0x399e9809": { name: "InvalidPoolAddress", description: "Portal contract reverted with this custom error." },
  "0xbed58990": { name: "InvalidLocks", description: "Portal contract reverted with this custom error." },
  "0x87c5d02a": { name: "StakingDisabled", description: "Portal contract reverted with this custom error." },
  "0xb418bccc": { name: "NotRoller", description: "Portal contract reverted with this custom error." },
  "0x8ba823be": { name: "cannotCheckInUntil", description: "Portal contract reverted with this custom error." },
  "0xdf3a6581": { name: "MetaAlreadyUsedByOtherToken", description: "This metadata CID is already used by another token - each token needs a unique meta CID (this is why fabricated/reused CIDs are unsafe)." },
  "0x273cc575": { name: "InsufficientCreationFee", description: "Not enough native token sent to cover the required creation fee." },
  "0xa458261b": { name: "InsufficientFee", description: "Not enough native token sent to cover the required protocol fee." },
  "0xca4c5b2d": { name: "VanityAddressRequirementNotMet", description: "The generated salt does not produce the required vanity suffix (8888 standard / 7777 tax) for this token address." },
  "0x89128f26": { name: "TokenNotInDEXStatus", description: "Portal contract reverted with this custom error." },
  "0x91689cc6": { name: "CallerNotBeneficiary", description: "Portal contract reverted with this custom error." },
  "0x49234c2d": { name: "NoLocksAvailable", description: "Portal contract reverted with this custom error." },
  "0x3ebbc337": { name: "InsufficientEth", description: "Not enough native token (BNB/ETH) sent for this call." },
  "0x929d8da4": { name: "InvalidTaxBps", description: "Tax rate invalid - max is 1000 bps (10%)." },
  "0xca7f5f0e": { name: "TransferFromFailed", description: "An ERC20 transferFrom failed - check quote-token allowance/balance." },
  "0x4fd0ffbb": { name: "InvalidMigratorType", description: "Migrator type not supported for this token version/entry point." },
  "0x127a76fb": { name: "QuoteTokenNotNativeButNotUsingTradeV2", description: "Portal contract reverted with this custom error." },
  "0xa735ace3": { name: "InsufficientValueForTaxTokenCreation", description: "When using an ERC20 quote token for a tax token, an extra ~1 gwei of native token is required in msg.value." },
  "0xa252c151": { name: "NotGuardian", description: "Portal contract reverted with this custom error." },
  "0x07a86b14": { name: "UnsupportedExtensionVersion", description: "The extension version referenced by extensionID isn't supported." },
  "0x3a80ea5e": { name: "TokenWithExtensionNotSupported", description: "This token uses an extension not supported by the call path used." },
  "0xdd44145a": { name: "InvalidParamsForToshiMart", description: "Portal contract reverted with this custom error." },
  "0xe5f5ed50": { name: "InvalidParamsForXLayer", description: "Portal contract reverted with this custom error." },
  "0xb07f6501": { name: "InvalidQuoteTokenConfiguration", description: "The quote token isn't configured/allowed on this Portal deployment." },
  "0xc782ece1": { name: "ErrShouldUsePortalTradeV2", description: "Portal contract reverted with this custom error." },
  "0x3d24ab78": { name: "NoSupportedDEX", description: "Portal contract reverted with this custom error." },
  "0x1f541609": { name: "InvalidFeeTierForDEX", description: "Portal contract reverted with this custom error." },
  "0xf8d94a75": { name: "InvalidTaxDistribution", description: "mktBps + deflationBps + dividendBps + lpBps must sum to exactly 10000." },
  "0xd036fb98": { name: "TaxDurationTooLong", description: "taxDuration exceeds the maximum allowed." },
  "0xaef851bb": { name: "TaxDurationTooShort", description: "taxDuration is below the minimum allowed." },
  "0x2269dd1a": { name: "AntiFarmerDurationTooLong", description: "antiFarmerDuration exceeds the maximum allowed (365 days)." },
  "0x01edd3fb": { name: "DividendSwapNotSupported", description: "No swap path exists from the quote token to the chosen dividend token." },
  "0x6b9099a1": { name: "MinimumShareBalanceTooLow", description: "minimumShareBalance is below the required minimum for dividend eligibility." },
  "0x1eaf8408": { name: "DividendParametersRequired", description: "Dividend parameters are required but missing (dividendBps > 0 needs a valid dividendToken)." },
  "0x8dd5267b": { name: "DividendTokenMustEqualQuoteToken", description: "dividendToken must equal quoteToken while custom dividend conversion is disabled." },
  "0xf990f04a": { name: "InvalidFeeConfigBps", description: "A newTokenV7 feeConfigs slot with a non-NONE type has bps == 0." },
  "0x35d0934c": { name: "DuplicateFeeSlot", description: "newTokenV7 feeConfigs has more than one slot of the same fee type." },
  "0x77912f78": { name: "ZeroMarketingAddress", description: "A MARKETING_OR_VAULT feeConfigs slot has a zero marketing/vault address." },
  "0x16fba6af": { name: "NewTokenV7RuleViolation", description: "newTokenV7 called with an unsupported combination for the current rollout (e.g. tax token via V7 - use newTokenV6 for tax tokens)." },
  "0xe19ac169": { name: "UnsupportedV7TokenV3PermitFeeType", description: "This feeConfigs fee type isn't enabled yet for TOKEN_V3_PERMIT on newTokenV7." },
  "0xa7382e9b": { name: "RateLimitExceeded", description: "This wallet is rate-limited from creating tokens right now - wait before retrying." },
  "0x148e6157": { name: "SpammerBlocked", description: "This wallet is blocked from creating tokens on Flap." },
  "0x20beb318": { name: "SaltLockFeeMismatch", description: "msg.value doesn't match the required salt-lock fee." },
  "0x0a6ec6aa": { name: "SaltAlreadyLockedByAnotherUser", description: "This salt is already locked by a different wallet - generate a new salt." },
  "0x4415bd06": { name: "SaltAlreadyLockedBySelf", description: "This salt is already locked by this wallet." },
  "0xe28f4b71": { name: "FlapSaltLockedByAnotherUser", description: "This salt is locked by a different wallet than the caller." },
  "0x6d70fbd3": { name: "SaltLockTokenVersionMismatch", description: "The locked token version for this salt doesn't match the one being launched." },
  "0x0139660b": { name: "UnsupportedTokenVersion", description: "This tokenVersion value isn't supported for salt locking." },
  "0xd5f11840": { name: "InvalidCurveType", description: "Portal contract reverted with this custom error." },
  "0x77146b42": { name: "InvalidDexThresholdType", description: "DEX threshold enum value invalid." },
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
        // A short invisible nonce keeps each upload's metadata content unique,
        // so retries (or two launches with the same image/description) never
        // collide on the same content-addressed CID and hit Flap's
        // MetaAlreadyUsedByOtherToken error.
        description: `${params.description || `${params.name} token deployed via Flap Token Launcher`}\u200b`.slice(0, 500) + ` \u200b${Date.now().toString(36)}`,
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
      // Same uniqueness guard as the Flap upload path above.
      nonce: Date.now().toString(36),
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
