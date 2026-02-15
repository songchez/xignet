import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

import { VerificationDeclinedError } from "./errors/index.js";
import {
  AssertionVerifier,
  ConsentReceipt,
  InvoicePayload,
  TransactionTermsManifest,
  VerificationRequest,
  VerificationResult
} from "./types.js";

export interface VerificationPolicyRefs {
  legalPolicyId?: string;
  webauthnPolicyId?: string;
}

export interface BuildVerificationRequestOptions {
  policyRefs?: VerificationPolicyRefs;
  webauthnOptions?: Record<string, unknown>;
  failClosedOnMissingPolicyRefs?: boolean;
}

export interface VerifyBiometricAssertionOptions {
  failClosedOnMissingPolicyRefs?: boolean;
}

function getStringProperty(
  record: Record<string, unknown>,
  key: string
): string | undefined {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return value.trim();
}

function getObjectProperty(
  record: Record<string, unknown>,
  key: string
): Record<string, unknown> | undefined {
  const value = record[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function getPolicyRefsFromTtmPolicy(
  policy: Record<string, unknown>
): VerificationPolicyRefs {
  const nestedPolicyRefs = getObjectProperty(policy, "policyRefs");
  const legalPolicyId =
    getStringProperty(policy, "legalPolicyId") ??
    (nestedPolicyRefs ? getStringProperty(nestedPolicyRefs, "legalPolicyId") : undefined);
  const webauthnPolicyId =
    getStringProperty(policy, "webauthnPolicyId") ??
    (nestedPolicyRefs ? getStringProperty(nestedPolicyRefs, "webauthnPolicyId") : undefined);
  const refs: VerificationPolicyRefs = {};

  if (legalPolicyId) {
    refs.legalPolicyId = legalPolicyId;
  }
  if (webauthnPolicyId) {
    refs.webauthnPolicyId = webauthnPolicyId;
  }

  return refs;
}

function resolvePolicyRefs(
  ttm: TransactionTermsManifest,
  options?: BuildVerificationRequestOptions
): VerificationPolicyRefs {
  const fromTtm = getPolicyRefsFromTtmPolicy(ttm.policy);
  const fromOptions = options?.policyRefs;
  const legalPolicyId = fromOptions?.legalPolicyId ?? fromTtm.legalPolicyId;
  const webauthnPolicyId = fromOptions?.webauthnPolicyId ?? fromTtm.webauthnPolicyId;
  const refs: VerificationPolicyRefs = {};

  if (legalPolicyId) {
    refs.legalPolicyId = legalPolicyId;
  }
  if (webauthnPolicyId) {
    refs.webauthnPolicyId = webauthnPolicyId;
  }

  return refs;
}

function readPolicyRefsFromWebauthnOptions(
  webauthnOptions: VerificationRequest["webauthnOptions"]
): VerificationPolicyRefs {
  if (!webauthnOptions || typeof webauthnOptions !== "object") {
    return {};
  }

  const record = webauthnOptions as Record<string, unknown>;
  const nestedPolicyRefs = getObjectProperty(record, "policyRefs");

  const legalPolicyId =
    getStringProperty(record, "legalPolicyId") ??
    (nestedPolicyRefs ? getStringProperty(nestedPolicyRefs, "legalPolicyId") : undefined);
  const webauthnPolicyId =
    getStringProperty(record, "webauthnPolicyId") ??
    (nestedPolicyRefs ? getStringProperty(nestedPolicyRefs, "webauthnPolicyId") : undefined);
  const refs: VerificationPolicyRefs = {};

  if (legalPolicyId) {
    refs.legalPolicyId = legalPolicyId;
  }
  if (webauthnPolicyId) {
    refs.webauthnPolicyId = webauthnPolicyId;
  }

  return refs;
}

function assertPolicyRefsForFailClosed(
  policyRefs: VerificationPolicyRefs,
  context: "buildVerificationRequest" | "verifyBiometricAssertion"
): void {
  if (!policyRefs.legalPolicyId) {
    throw new VerificationDeclinedError(
      `${context} missing required policy reference: legalPolicyId`
    );
  }
  if (!policyRefs.webauthnPolicyId) {
    throw new VerificationDeclinedError(
      `${context} missing required policy reference: webauthnPolicyId`
    );
  }
}

export function buildVerificationRequest(
  invoice: InvoicePayload,
  ttm: TransactionTermsManifest,
  options?: BuildVerificationRequestOptions
): VerificationRequest {
  const ttmHash = computeTtmHash(ttm);
  const policyRefs = resolvePolicyRefs(ttm, options);
  if (options?.failClosedOnMissingPolicyRefs) {
    assertPolicyRefsForFailClosed(policyRefs, "buildVerificationRequest");
  }

  const webauthnOptions: Record<string, unknown> = {
    ...(options?.webauthnOptions ?? {}),
    challengeBinding: "ttmHash"
  };
  if (policyRefs.legalPolicyId || policyRefs.webauthnPolicyId) {
    webauthnOptions.policyRefs = policyRefs;
  }

  return {
    invoiceId: invoice.invoiceId,
    displayText: `${invoice.merchantId}에 ${invoice.totalAmount} ${invoice.currency} 결제를 승인합니다.`,
    challenge: ttmHash,
    ttm,
    ttmHash,
    webauthnOptions
  };
}

function assertJsonNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new VerificationDeclinedError("TTM canonicalization requires finite numbers");
  }
  if (Object.is(value, -0)) {
    return "0";
  }

  return JSON.stringify(value);
}

function canonicalizeForHash(value: unknown, inArray = false): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    return assertJsonNumber(value);
  }

  if (typeof value === "bigint") {
    throw new VerificationDeclinedError("TTM canonicalization does not support bigint values");
  }

  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    if (inArray) {
      return "null";
    }
    throw new VerificationDeclinedError("TTM canonicalization does not support non-JSON values");
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeForHash(item, true)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, nestedValue]) => {
        return !(
          nestedValue === undefined ||
          typeof nestedValue === "function" ||
          typeof nestedValue === "symbol"
        );
      })
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));

    return `{${entries
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${canonicalizeForHash(nestedValue)}`)
      .join(",")}}`;
  }

  throw new VerificationDeclinedError("TTM canonicalization encountered unsupported value");
}

export function computeTtmHash(ttm: TransactionTermsManifest): string {
  return bytesToHex(sha256(utf8ToBytes(canonicalizeForHash(ttm))));
}

export function createConsentReceipt(
  request: VerificationRequest,
  signedContext: { signerDeviceId: string; signedAt: string },
  assertion: unknown
): ConsentReceipt {
  const policyRefs = readPolicyRefsFromWebauthnOptions(request.webauthnOptions);
  const consentArtifactId = bytesToHex(
    sha256(
      utf8ToBytes(
        `${request.invoiceId}:${request.ttmHash}:${signedContext.signedAt}:${signedContext.signerDeviceId}`
      )
    )
  );

  const receipt: ConsentReceipt & {
    signerContextRef: string;
    consentArtifactId: string;
    legalPolicyId?: string;
    webauthnPolicyId?: string;
  } = {
    receiptVersion: "1.0",
    invoiceId: request.invoiceId,
    intentId: request.ttm.intentId,
    ttmHash: request.ttmHash,
    approvedAt: signedContext.signedAt,
    authMethod: "webauthn",
    termsVersion: request.ttm.termsVersion,
    signerDeviceId: signedContext.signerDeviceId,
    assertion,
    signerContextRef: signedContext.signerDeviceId,
    consentArtifactId
  };

  if (policyRefs.legalPolicyId) {
    receipt.legalPolicyId = policyRefs.legalPolicyId;
  }
  if (policyRefs.webauthnPolicyId) {
    receipt.webauthnPolicyId = policyRefs.webauthnPolicyId;
  }

  return receipt;
}

function readRequiredReceiptField(
  receipt: ConsentReceipt,
  field: string
): string {
  const value = (receipt as unknown as Record<string, unknown>)[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    return "";
  }

  return value.trim();
}

export function validateConsentReceipt(
  receipt: ConsentReceipt,
  expected: {
    invoiceId: string;
    ttmHash: string;
    termsVersion: string;
    legalPolicyId?: string;
    webauthnPolicyId?: string;
  }
): boolean {
  const signerContextRef = readRequiredReceiptField(receipt, "signerContextRef");
  const consentArtifactId = readRequiredReceiptField(receipt, "consentArtifactId");

  if (expected.legalPolicyId) {
    const legalPolicyId = readRequiredReceiptField(receipt, "legalPolicyId");
    if (legalPolicyId !== expected.legalPolicyId) {
      return false;
    }
  }

  if (expected.webauthnPolicyId) {
    const webauthnPolicyId = readRequiredReceiptField(receipt, "webauthnPolicyId");
    if (webauthnPolicyId !== expected.webauthnPolicyId) {
      return false;
    }
  }

  return (
    receipt.receiptVersion === "1.0" &&
    receipt.authMethod === "webauthn" &&
    receipt.invoiceId === expected.invoiceId &&
    receipt.ttmHash === expected.ttmHash &&
    receipt.termsVersion === expected.termsVersion &&
    receipt.signerDeviceId.length > 0 &&
    receipt.approvedAt.length > 0 &&
    signerContextRef.length > 0 &&
    /^[0-9a-f]{64}$/.test(consentArtifactId)
  );
}

export function assertVerificationForSettlement(
  verification: VerificationResult | null | undefined,
  expected: {
    invoiceId: string;
    termsVersion: string;
    ttmHash: string;
    legalPolicyId?: string;
    webauthnPolicyId?: string;
  }
): ConsentReceipt {
  if (!verification || !verification.approved) {
    throw new VerificationDeclinedError("Settlement requires explicit user approval");
  }
  if (verification.ttmHash !== expected.ttmHash) {
    throw new VerificationDeclinedError("Verification result ttmHash does not match settlement terms");
  }

  const receipt = verification.consentReceipt;
  if (receipt.invoiceId !== expected.invoiceId) {
    throw new VerificationDeclinedError("Consent receipt invoiceId does not match settlement terms");
  }
  if (receipt.termsVersion !== expected.termsVersion) {
    throw new VerificationDeclinedError("Consent receipt termsVersion does not match settlement terms");
  }
  if (receipt.ttmHash !== expected.ttmHash) {
    throw new VerificationDeclinedError("Consent receipt ttmHash does not match settlement terms");
  }
  if (!validateConsentReceipt(receipt, expected)) {
    throw new VerificationDeclinedError("Consent receipt schema validation failed");
  }

  return receipt;
}

export async function verifyBiometricAssertion(
  request: VerificationRequest,
  assertion: unknown,
  verifier: AssertionVerifier,
  options?: VerifyBiometricAssertionOptions
): Promise<VerificationResult> {
  const policyRefs = readPolicyRefsFromWebauthnOptions(request.webauthnOptions);
  if (options?.failClosedOnMissingPolicyRefs) {
    assertPolicyRefsForFailClosed(policyRefs, "verifyBiometricAssertion");
  }

  const result = await verifier.verify(request, assertion);
  if (!result) {
    throw new VerificationDeclinedError();
  }
  if (result.ttmHash !== request.ttmHash) {
    throw new VerificationDeclinedError("WebAuthn assertion is not bound to requested ttmHash");
  }

  const consentReceipt = createConsentReceipt(request, result, assertion);
  if (
    !validateConsentReceipt(consentReceipt, {
      invoiceId: request.invoiceId,
      ttmHash: request.ttmHash,
      termsVersion: request.ttm.termsVersion,
      ...(options?.failClosedOnMissingPolicyRefs
        ? {
            legalPolicyId: policyRefs.legalPolicyId,
            webauthnPolicyId: policyRefs.webauthnPolicyId
          }
        : {})
    })
  ) {
    throw new VerificationDeclinedError("Generated consent receipt is invalid");
  }

  return {
    approved: true,
    assertion,
    signerDeviceId: result.signerDeviceId,
    signedAt: result.signedAt,
    ttmHash: request.ttmHash,
    consentReceipt
  };
}
