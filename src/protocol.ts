import { InvoiceExpiredError, InvoiceSignatureInvalidError, ProtocolCompatibilityError } from "./errors/index.js";
import {
  AtomicAmountString,
  DecimalAmountString,
  Fetcher,
  InvoicePayload,
  InvoiceTrustStore,
  ParsePaymentRequiredOptions,
  PaymentRequirement,
  PaymentRequirementAcceptance,
  PolicyRefs,
  TtmHashHex,
  TtmHashValidationHook,
  X402Challenge
} from "./types.js";

const TOKEN_PATTERN = /^\s*([^\s]+)\s+(.+)$/;
const CAIP2_PATTERN = /^[a-z0-9-]{3,8}:[a-zA-Z0-9-]{1,32}$/;
const DECIMAL_PATTERN = /^(0|[1-9]\d*)(\.\d+)?$/;
const TTM_HASH_HEX_PATTERN = /^[a-f0-9]{64}$/;

const NETWORK_ALIASES: Record<string, string> = {
  base: "eip155:8453",
  "base-mainnet": "eip155:8453",
  "base-sepolia": "eip155:84532",
  ethereum: "eip155:1",
  "ethereum-mainnet": "eip155:1",
  "eth-mainnet": "eip155:1",
  polygon: "eip155:137",
  "polygon-mainnet": "eip155:137",
  arbitrum: "eip155:42161",
  "arbitrum-mainnet": "eip155:42161"
};

function parseAuthParams(params: string): Record<string, string> {
  const normalized = params.replace(/;/g, ",");
  const chunks = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const result: Record<string, string> = {};

  for (const chunk of chunks) {
    const [key, ...rest] = chunk.split("=");
    if (!key || rest.length === 0) continue;
    const value = rest.join("=").trim().replace(/^"|"$/g, "");
    result[key.trim().toLowerCase()] = value;
  }

  return result;
}

function assertRequired(value: string | undefined, field: string): string {
  if (!value) {
    throw new ProtocolCompatibilityError(`Missing required x402 field: ${field}`);
  }
  return value;
}

function assertObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProtocolCompatibilityError(`Invalid x402 field: ${field} must be an object`);
  }

  return value as Record<string, unknown>;
}

function readRequiredString(
  record: Record<string, unknown>,
  key: string,
  field: string
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProtocolCompatibilityError(`Missing required x402 field: ${field}`);
  }

  return value.trim();
}

function normalizeAmount(value: unknown, field: string): DecimalAmountString {
  const parsed =
    typeof value === "number"
      ? Number.isFinite(value)
        ? String(value)
        : ""
      : typeof value === "string"
        ? value.trim()
        : "";

  if (!DECIMAL_PATTERN.test(parsed)) {
    throw new ProtocolCompatibilityError(`Invalid amount in x402 field: ${field}`);
  }

  return parsed as DecimalAmountString;
}

function normalizeScale(value: unknown, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 36) {
    throw new ProtocolCompatibilityError(
      `Invalid amount scale in x402 field: ${field} (expected integer 0-36)`
    );
  }

  return value;
}

function assertRequiredPolicyId(
  value: unknown,
  field: keyof PolicyRefs
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProtocolCompatibilityError(`Missing required x402 field: policyRefs.${field}`);
  }

  return value.trim();
}

function normalizePolicyRefs(
  value: unknown,
  required: boolean
): PolicyRefs | undefined {
  if (value === undefined) {
    if (required) {
      throw new ProtocolCompatibilityError("Missing required x402 field: policyRefs");
    }
    return undefined;
  }

  const record = assertObject(value, "policyRefs");
  return {
    legalPolicyId: assertRequiredPolicyId(record.legalPolicyId, "legalPolicyId"),
    webauthnPolicyId: assertRequiredPolicyId(record.webauthnPolicyId, "webauthnPolicyId"),
    retentionPolicyId: assertRequiredPolicyId(record.retentionPolicyId, "retentionPolicyId"),
    runbookPolicyId: assertRequiredPolicyId(record.runbookPolicyId, "runbookPolicyId"),
    finalityPolicyId: assertRequiredPolicyId(record.finalityPolicyId, "finalityPolicyId")
  };
}

export function decimalToAtomicAmount(
  decimalAmount: string,
  scale: number,
  field = "amount"
): AtomicAmountString {
  const normalizedAmount = normalizeAmount(decimalAmount, field);
  const normalizedScale = normalizeScale(scale, `${field}Scale`);
  if (normalizedScale === undefined) {
    throw new ProtocolCompatibilityError(`Invalid amount scale in x402 field: ${field}Scale`);
  }

  const [integerPart, fractionPart = ""] = normalizedAmount.split(".");
  if (fractionPart.length > normalizedScale) {
    throw new ProtocolCompatibilityError(
      `Invalid amount in x402 field: ${field} scale overflow (fraction=${fractionPart.length}, scale=${normalizedScale})`
    );
  }

  const atomicRaw = `${integerPart}${fractionPart.padEnd(normalizedScale, "0")}`;
  return BigInt(atomicRaw).toString() as AtomicAmountString;
}

export function validateTtmHashJcsSha256(
  ttmHash: unknown,
  field = "ttmHash"
): TtmHashHex {
  if (typeof ttmHash !== "string" || !TTM_HASH_HEX_PATTERN.test(ttmHash.trim())) {
    throw new ProtocolCompatibilityError(
      `Invalid x402 field: ${field} must be 64-char lowercase hex (JCS RFC8785 + SHA-256)`
    );
  }

  return ttmHash.trim() as TtmHashHex;
}

function decodeBase64Url(payload: string): string {
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${normalized}${"=".repeat((4 - (normalized.length % 4)) % 4)}`;

  if (typeof globalThis.atob !== "function") {
    throw new ProtocolCompatibilityError("Runtime does not support base64 decoding");
  }

  try {
    const binary = globalThis.atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new TextDecoder().decode(bytes);
  } catch {
    throw new ProtocolCompatibilityError("Invalid PAYMENT-REQUIRED base64url payload");
  }
}

function normalizeTtmHash(
  value: unknown,
  required: boolean,
  enforceFormat: boolean
): TtmHashHex | undefined {
  if (value === undefined) {
    if (required) {
      throw new ProtocolCompatibilityError("Missing required x402 field: ttmHash");
    }
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProtocolCompatibilityError("Invalid x402 field: ttmHash must be a non-empty string");
  }

  if (enforceFormat || required) {
    return validateTtmHashJcsSha256(value);
  }

  return value.trim() as TtmHashHex;
}

function normalizeAcceptance(
  input: unknown,
  index: number
): PaymentRequirementAcceptance {
  const acceptance = assertObject(input, `accepts[${index}]`);
  const scheme = readRequiredString(acceptance, "scheme", `accepts[${index}].scheme`);
  const network = normalizeCaip2Network(
    readRequiredString(acceptance, "network", `accepts[${index}].network`)
  );
  const maxAmountRequired = normalizeAmount(
    acceptance.maxAmountRequired,
    `accepts[${index}].maxAmountRequired`
  );
  const assetScale = normalizeScale(
    acceptance.assetScale,
    `accepts[${index}].assetScale`
  );
  const maxAmountRequiredAtomic =
    assetScale === undefined
      ? undefined
      : decimalToAtomicAmount(
          maxAmountRequired,
          assetScale,
          `accepts[${index}].maxAmountRequired`
        );
  const payTo = readRequiredString(acceptance, "payTo", `accepts[${index}].payTo`);
  const resource = readRequiredString(
    acceptance,
    "resource",
    `accepts[${index}].resource`
  );
  const asset = readRequiredString(acceptance, "asset", `accepts[${index}].asset`);

  return {
    scheme,
    network,
    maxAmountRequired,
    ...(assetScale !== undefined ? { assetScale } : {}),
    ...(maxAmountRequiredAtomic !== undefined ? { maxAmountRequiredAtomic } : {}),
    payTo,
    resource,
    asset
  };
}

export function normalizeCaip2Network(network: string): string {
  const normalized = network.trim().toLowerCase();
  const aliased = NETWORK_ALIASES[normalized] ?? normalized;

  if (!CAIP2_PATTERN.test(aliased)) {
    throw new ProtocolCompatibilityError(`Invalid CAIP-2 network: ${network}`);
  }

  return aliased;
}

export function parse402Header(wwwAuthenticate: string): X402Challenge {
  const matched = TOKEN_PATTERN.exec(wwwAuthenticate);
  if (!matched?.[1] || !matched[2]) {
    throw new ProtocolCompatibilityError("Invalid WWW-Authenticate format");
  }

  const scheme = matched[1];
  const params = parseAuthParams(matched[2]);

  const invoiceUrl = assertRequired(params.invoice, "invoice");
  const amount = params.amount ? Number(params.amount) : undefined;

  if (amount !== undefined && Number.isNaN(amount)) {
    throw new ProtocolCompatibilityError("Invalid amount in x402 challenge");
  }

  const challenge: X402Challenge = {
    scheme,
    invoiceUrl,
    rawHeader: wwwAuthenticate
  };

  if (amount !== undefined) challenge.amount = amount;
  if (params.currency !== undefined) challenge.currency = params.currency;
  if (params.merchant !== undefined) challenge.merchant = params.merchant;
  if (params.network !== undefined) challenge.network = params.network;
  if (params.pay_to !== undefined) challenge.payTo = params.pay_to;
  if (params.payto !== undefined && challenge.payTo === undefined) {
    challenge.payTo = params.payto;
  }
  if (params.resource !== undefined) challenge.resource = params.resource;
  if (params.asset !== undefined) challenge.asset = params.asset;
  if (params.nonce !== undefined) challenge.nonce = params.nonce;
  if (params.expires_at !== undefined) challenge.expiresAt = params.expires_at;

  return challenge;
}

export function parsePaymentRequiredHeader(
  paymentRequiredHeader: string,
  options?: ParsePaymentRequiredOptions
): PaymentRequirement {
  if (!paymentRequiredHeader || paymentRequiredHeader.trim().length === 0) {
    throw new ProtocolCompatibilityError("Missing required x402 field: PAYMENT-REQUIRED");
  }

  const decoded = decodeBase64Url(paymentRequiredHeader);
  let payload: unknown;
  try {
    payload = JSON.parse(decoded);
  } catch {
    throw new ProtocolCompatibilityError("Invalid PAYMENT-REQUIRED JSON payload");
  }

  const requirement = assertObject(payload, "PAYMENT-REQUIRED");
  const x402Version = requirement.x402Version;
  if (x402Version !== 2 && x402Version !== "2") {
    throw new ProtocolCompatibilityError("Invalid x402 field: x402Version must be 2");
  }

  if (!Array.isArray(requirement.accepts) || requirement.accepts.length === 0) {
    throw new ProtocolCompatibilityError("Missing required x402 field: accepts");
  }

  const accepts = requirement.accepts.map((item, index) =>
    normalizeAcceptance(item, index)
  );
  const ttmHash = normalizeTtmHash(
    requirement.ttmHash,
    options?.requireTtmHash ?? false,
    options?.requireTtmHash ?? false
  );
  const policyRefs = normalizePolicyRefs(requirement.policyRefs, options?.requirePolicyRefs ?? false);

  return {
    x402Version: 2,
    accepts,
    ...(policyRefs !== undefined ? { policyRefs } : {}),
    ...(ttmHash !== undefined ? { ttmHash } : {})
  };
}

export function adaptLegacyToV2Canonical(wwwAuthenticate: string): PaymentRequirement {
  const challenge = parse402Header(wwwAuthenticate);
  const network = normalizeCaip2Network(assertRequired(challenge.network, "network"));
  const amount = normalizeAmount(challenge.amount, "amount");
  const payTo = challenge.payTo ?? challenge.merchant;
  if (!payTo) {
    throw new ProtocolCompatibilityError("Missing required x402 field: pay_to");
  }

  const asset = challenge.asset ?? challenge.currency;
  if (!asset) {
    throw new ProtocolCompatibilityError("Missing required x402 field: asset");
  }

  return {
    x402Version: 2,
    accepts: [
      {
        scheme: challenge.scheme,
        network,
        maxAmountRequired: amount,
        payTo,
        resource: challenge.resource ?? challenge.invoiceUrl,
        asset
      }
    ]
  };
}

export function validatePaymentRequirementTtmHash(
  paymentRequirement: PaymentRequirement,
  expectedTtmHash: string,
  hook?: TtmHashValidationHook
): true {
  if (!expectedTtmHash || expectedTtmHash.trim().length === 0) {
    throw new ProtocolCompatibilityError("Missing required x402 field: expectedTtmHash");
  }

  const normalizedExpected = validateTtmHashJcsSha256(expectedTtmHash, "expectedTtmHash");
  const receivedTtmHash = paymentRequirement.ttmHash;
  const isValid = hook
    ? hook({ paymentRequirement, expectedTtmHash: normalizedExpected, receivedTtmHash })
    : receivedTtmHash === normalizedExpected;

  if (!isValid) {
    const receivedLabel = receivedTtmHash ?? "<missing>";
    throw new ProtocolCompatibilityError(
      `TTM hash validation failed: expected=${normalizedExpected}, received=${receivedLabel}`
    );
  }

  return true;
}

export async function fetchInvoice(
  challenge: X402Challenge,
  fetcher: Fetcher = globalThis.fetch as unknown as Fetcher
): Promise<InvoicePayload> {
  if (!fetcher) {
    throw new ProtocolCompatibilityError("No fetch implementation available");
  }

  const response = await fetcher(challenge.invoiceUrl, {
    method: "GET",
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new ProtocolCompatibilityError(
      `Unable to fetch invoice: HTTP ${response.status}`
    );
  }

  const payload = (await response.json()) as InvoicePayload;
  if (new Date(payload.expiry).getTime() <= Date.now()) {
    throw new InvoiceExpiredError();
  }

  return payload;
}

export async function validateInvoiceSignature(
  invoice: InvoicePayload,
  trustStore: InvoiceTrustStore
): Promise<boolean> {
  const isValid = await trustStore.verifyInvoiceSignature(invoice);
  if (!isValid) {
    throw new InvoiceSignatureInvalidError();
  }

  return true;
}
