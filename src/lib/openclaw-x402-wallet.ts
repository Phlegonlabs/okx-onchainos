import {
  createPublicClient,
  defineChain,
  encodePacked,
  http,
  keccak256,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { PaymentPayload, PaymentRequirements } from "./x402";
import {
  WALLET_AUTH_ADDRESS_HEADER,
  WALLET_AUTH_NONCE_HEADER,
  WALLET_AUTH_SIGNATURE_HEADER,
  WALLET_AUTH_TIMESTAMP_HEADER,
  buildWalletAuthBodyHash,
  buildWalletAuthMessage,
} from "./wallet-auth";

const DEFAULT_XLAYER_CHAIN_ID = 196;
const DEFAULT_XLAYER_RPC_URL = "https://rpc.xlayer.tech";

const TOKEN_METADATA_ABI = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "version",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;

type TransferAuthorization = {
  from: `0x${string}`;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: `0x${string}`;
};

type TokenMetadata = {
  name: string;
  version: string;
};

type WalletSigner = {
  address: `0x${string}`;
  signMessage: (params: {
    message: string | { raw: `0x${string}` };
  }) => Promise<`0x${string}`>;
  signTypedData: (params: {
    domain: {
      name: string;
      version: string;
      chainId: bigint;
      verifyingContract: `0x${string}`;
    };
    types: {
      TransferWithAuthorization: readonly {
        name: string;
        type: string;
      }[];
    };
    primaryType: "TransferWithAuthorization";
    message: {
      from: `0x${string}`;
      to: `0x${string}`;
      value: bigint;
      validAfter: bigint;
      validBefore: bigint;
      nonce: `0x${string}`;
    };
  }) => Promise<`0x${string}`>;
};

export type OpenClawX402WalletOptions = {
  privateKey?: `0x${string}`;
  signer?: WalletSigner;
  fetchImpl?: typeof fetch;
  chainId?: number;
  rpcUrl?: string;
  nowSeconds?: () => number;
  nonceFactory?: (address: `0x${string}`, nowSeconds: number) => `0x${string}`;
  resolveTokenMetadata?: (
    assetAddress: `0x${string}`,
    chainId: number
  ) => Promise<TokenMetadata>;
};

export type X402AutoPayResult = {
  response: Response;
  paid: boolean;
  paymentRequirements?: PaymentRequirements;
  paymentPayload?: PaymentPayload;
};

export type WalletRequestAuthResult = {
  headers: Headers;
  auth: {
    address: `0x${string}`;
    timestamp: string;
    nonce: `0x${string}`;
    signature: `0x${string}`;
  };
};

function parseChainId(chainIndex: string | number | undefined): number {
  const parsed = Number(chainIndex);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.round(parsed);
  }
  return DEFAULT_XLAYER_CHAIN_ID;
}

function defaultNowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function defaultNonceFactory(
  address: `0x${string}`,
  now: number
): `0x${string}` {
  return keccak256(
    encodePacked(
      ["address", "uint256", "uint256"],
      [address, BigInt(now), BigInt(Math.floor(Math.random() * 1_000_000_000))]
    )
  );
}

async function parsePaymentRequirementsFrom402(
  response: Response
): Promise<PaymentRequirements> {
  const fromHeader = response.headers.get("X-Payment-Requirements");
  if (fromHeader) {
    try {
      return JSON.parse(fromHeader) as PaymentRequirements;
    } catch {
      throw new Error("Invalid X-Payment-Requirements header JSON");
    }
  }

  const body = await response.clone().json().catch(() => null);
  if (body && typeof body === "object" && "paymentRequirements" in body) {
    return (body as { paymentRequirements: PaymentRequirements })
      .paymentRequirements;
  }

  throw new Error("HTTP 402 received but no paymentRequirements were found");
}

function createTokenMetadataResolver(rpcUrl: string, chainId: number) {
  const chain = defineChain({
    id: chainId,
    name: chainId === DEFAULT_XLAYER_CHAIN_ID ? "X Layer" : `Chain ${chainId}`,
    nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
  });

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  return async (assetAddress: `0x${string}`): Promise<TokenMetadata> => {
    let name = "USD Coin";
    try {
      name = await publicClient.readContract({
        address: assetAddress,
        abi: TOKEN_METADATA_ABI,
        functionName: "name",
      });
    } catch {}

    let version = "1";
    try {
      version = await publicClient.readContract({
        address: assetAddress,
        abi: TOKEN_METADATA_ABI,
        functionName: "version",
      });
    } catch {}

    return { name, version };
  };
}

async function buildPaymentPayload(params: {
  signer: WalletSigner;
  paymentRequirements: PaymentRequirements;
  tokenMetadata: TokenMetadata;
  nowSeconds: number;
  nonceFactory: (address: `0x${string}`, nowSeconds: number) => `0x${string}`;
}): Promise<PaymentPayload> {
  const chainId = parseChainId(params.paymentRequirements.chainIndex);
  const authorization: TransferAuthorization = {
    from: params.signer.address,
    to: params.paymentRequirements.payTo,
    value: params.paymentRequirements.maxAmountRequired,
    validAfter: String(params.nowSeconds - 60),
    validBefore: String(params.nowSeconds + 3600),
    nonce: params.nonceFactory(params.signer.address, params.nowSeconds),
  };

  const signature = await params.signer.signTypedData({
    domain: {
      name: params.tokenMetadata.name,
      version: params.tokenMetadata.version,
      chainId: BigInt(chainId),
      verifyingContract: params.paymentRequirements.asset as `0x${string}`,
    },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    message: {
      from: authorization.from,
      to: authorization.to as `0x${string}`,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    },
  });

  return {
    x402Version: params.paymentRequirements.x402Version || "1",
    chainIndex: chainId,
    scheme: params.paymentRequirements.scheme || "exact",
    payload: {
      signature,
      authorization,
    },
  };
}

async function buildWalletAuthHeaders(params: {
  signer: WalletSigner;
  request: Request;
  nowMs: number;
  nonceFactory: (address: `0x${string}`, nowSeconds: number) => `0x${string}`;
}): Promise<WalletRequestAuthResult> {
  const rawBody = await params.request.clone().text();
  const timestamp = String(params.nowMs);
  const nonce = params.nonceFactory(
    params.signer.address,
    Math.floor(params.nowMs / 1000)
  );
  const path = new URL(params.request.url).pathname;
  const message = buildWalletAuthMessage({
    address: params.signer.address,
    method: params.request.method,
    path,
    timestamp,
    nonce,
    bodySha256: buildWalletAuthBodyHash(rawBody),
  });
  const signature = await params.signer.signMessage({ message });

  const headers = new Headers(params.request.headers);
  headers.set(WALLET_AUTH_ADDRESS_HEADER, params.signer.address);
  headers.set(WALLET_AUTH_TIMESTAMP_HEADER, timestamp);
  headers.set(WALLET_AUTH_NONCE_HEADER, nonce);
  headers.set(WALLET_AUTH_SIGNATURE_HEADER, signature);

  return {
    headers,
    auth: {
      address: params.signer.address,
      timestamp,
      nonce,
      signature,
    },
  };
}

export function createOpenClawX402Wallet(options: OpenClawX402WalletOptions) {
  const signer =
    options.signer ||
    (options.privateKey ? privateKeyToAccount(options.privateKey) : null);
  if (!signer) {
    throw new Error("Provide either privateKey or signer");
  }

  const fetchImpl = options.fetchImpl || fetch;
  const chainId = options.chainId || DEFAULT_XLAYER_CHAIN_ID;
  const nowSeconds = options.nowSeconds || defaultNowSeconds;
  const nowMs = () => nowSeconds() * 1000;
  const nonceFactory = options.nonceFactory || defaultNonceFactory;

  const defaultTokenMetadataResolver = createTokenMetadataResolver(
    options.rpcUrl || DEFAULT_XLAYER_RPC_URL,
    chainId
  );

  const resolveTokenMetadata =
    options.resolveTokenMetadata ||
    (async (assetAddress: `0x${string}`) =>
      defaultTokenMetadataResolver(assetAddress));

  return {
    address: signer.address,
    async buildWalletAuthHeaders(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<WalletRequestAuthResult> {
      return buildWalletAuthHeaders({
        signer,
        request: new Request(input, init),
        nowMs: nowMs(),
        nonceFactory,
      });
    },
    async requestWithWalletAuth(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const request = new Request(input, init);
      const signed = await buildWalletAuthHeaders({
        signer,
        request,
        nowMs: nowMs(),
        nonceFactory,
      });

      return fetchImpl(new Request(request, { headers: signed.headers }));
    },
    async requestWithAutoPayment(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<X402AutoPayResult> {
      const request = new Request(input, init);
      const firstResponse = await fetchImpl(request.clone());
      if (firstResponse.status !== 402) {
        return { response: firstResponse, paid: false };
      }

      const paymentRequirements = await parsePaymentRequirementsFrom402(
        firstResponse
      );

      const paymentPayload = await buildPaymentPayload({
        signer,
        paymentRequirements,
        tokenMetadata: await resolveTokenMetadata(
          paymentRequirements.asset as `0x${string}`,
          parseChainId(paymentRequirements.chainIndex)
        ),
        nowSeconds: nowSeconds(),
        nonceFactory,
      });

      const retryHeaders = new Headers(request.headers);
      retryHeaders.set("X-Payment", JSON.stringify(paymentPayload));
      const paidRequest = new Request(request, { headers: retryHeaders });
      const paidResponse = await fetchImpl(paidRequest);

      return {
        response: paidResponse,
        paid: true,
        paymentRequirements,
        paymentPayload,
      };
    },
  };
}
