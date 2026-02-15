import { describe, expect, it } from "vitest";

import {
  adaptLegacyToV2Canonical,
  decimalToAtomicAmount,
  fetchInvoice,
  parsePaymentRequiredHeader,
  parse402Header,
  validateTtmHashJcsSha256,
  validatePaymentRequirementTtmHash,
  validateInvoiceSignature
} from "../../src/protocol.js";
import { InvoiceExpiredError, InvoiceSignatureInvalidError, ProtocolCompatibilityError } from "../../src/errors/index.js";

function encodePaymentRequired(value: unknown): string {
  if (typeof globalThis.btoa !== "function") {
    throw new Error("Runtime does not support base64 encoding");
  }

  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return globalThis.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const TTM_HASH_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TTM_HASH_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TTM_HASH_C = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

describe("protocol", () => {
  it("parses x402 challenge from WWW-Authenticate header", () => {
    const challenge = parse402Header(
      'L402 invoice="https://gateway.example.com/invoices/iv_123", amount=50000, currency="KRW", merchant="Coupang", nonce="abc123", expires_at="2030-01-01T00:00:00.000Z"'
    );

    expect(challenge.scheme).toBe("L402");
    expect(challenge.invoiceUrl).toContain("iv_123");
    expect(challenge.amount).toBe(50000);
    expect(challenge.currency).toBe("KRW");
    expect(challenge.merchant).toBe("Coupang");
  });

  it("throws on invalid challenge format", () => {
    expect(() => parse402Header("invalid")).toThrow(ProtocolCompatibilityError);
  });

  it("throws when invoice is expired", async () => {
    await expect(
      fetchInvoice(
        {
          scheme: "L402",
          invoiceUrl: "https://gateway.example.com/invoices/expired",
          rawHeader: "raw"
        },
        async () => ({
          ok: true,
          status: 200,
          async json() {
            return {
              invoiceId: "iv_1",
              merchantId: "coupang",
              orderRef: "order_1",
              lineItems: [],
              totalAmount: 50000,
              currency: "KRW",
              issuedAt: "2025-01-01T00:00:00.000Z",
              expiry: "2025-01-01T00:00:00.000Z",
              signature: "sig"
            };
          }
        })
      )
    ).rejects.toThrow(InvoiceExpiredError);
  });

  it("throws when invoice signature verification fails", async () => {
    await expect(
      validateInvoiceSignature(
        {
          invoiceId: "iv_1",
          merchantId: "merchant_1",
          orderRef: "ord_1",
          lineItems: [],
          totalAmount: 50000,
          currency: "KRW",
          issuedAt: "2026-01-01T00:00:00.000Z",
          expiry: "2026-12-01T00:00:00.000Z",
          signature: "sig"
        },
        {
          verifyInvoiceSignature: async () => false
        }
      )
    ).rejects.toThrow(InvoiceSignatureInvalidError);
  });

  it("parses PAYMENT-REQUIRED v2 header and normalizes CAIP-2 network", () => {
    const encoded = encodePaymentRequired({
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: "base-mainnet",
          maxAmountRequired: "0.015",
          payTo: "0xabc123",
          resource: "https://api.example.com/protected/resource",
          asset: "USDC"
        }
      ],
      ttmHash: TTM_HASH_A
    });

    const parsed = parsePaymentRequiredHeader(encoded);
    expect(parsed.x402Version).toBe(2);
    expect(parsed.accepts[0]?.network).toBe("eip155:8453");
    expect(parsed.accepts[0]?.maxAmountRequired).toBe("0.015");
  });

  it("throws when PAYMENT-REQUIRED has missing required field", () => {
    const encoded = encodePaymentRequired({
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          maxAmountRequired: "10",
          resource: "https://api.example.com/protected/resource",
          asset: "USDC"
        }
      ]
    });

    expect(() => parsePaymentRequiredHeader(encoded)).toThrowError(
      /accepts\[0\]\.payTo/
    );
  });

  it("throws when PAYMENT-REQUIRED has invalid amount", () => {
    const encoded = encodePaymentRequired({
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          maxAmountRequired: "invalid-amount",
          payTo: "0xabc123",
          resource: "https://api.example.com/protected/resource",
          asset: "USDC"
        }
      ]
    });

    expect(() => parsePaymentRequiredHeader(encoded)).toThrowError(
      /Invalid amount/
    );
  });

  it("throws when PAYMENT-REQUIRED has invalid network", () => {
    const encoded = encodePaymentRequired({
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: "bad network",
          maxAmountRequired: "10",
          payTo: "0xabc123",
          resource: "https://api.example.com/protected/resource",
          asset: "USDC"
        }
      ]
    });

    expect(() => parsePaymentRequiredHeader(encoded)).toThrowError(
      /Invalid CAIP-2 network/
    );
  });

  it("adapts legacy L402 challenge to v2 canonical requirement", () => {
    const requirement = adaptLegacyToV2Canonical(
      'L402 invoice="https://gateway.example.com/invoices/iv_legacy", amount=50000, currency="USDC", network="base-mainnet", pay_to="0xdef456", resource="https://api.example.com/protected/resource", asset="USDC"'
    );

    expect(requirement.x402Version).toBe(2);
    expect(requirement.accepts[0]?.network).toBe("eip155:8453");
    expect(requirement.accepts[0]?.maxAmountRequired).toBe("50000");
    expect(requirement.accepts[0]?.payTo).toBe("0xdef456");
  });

  it("throws clear error when legacy challenge misses network", () => {
    expect(() =>
      adaptLegacyToV2Canonical(
        'L402 invoice="https://gateway.example.com/invoices/iv_legacy", amount=50000, currency="USDC", pay_to="0xdef456", resource="https://api.example.com/protected/resource", asset="USDC"'
      )
    ).toThrowError(/Missing required x402 field: network/);
  });

  it("validates TTM hash with default validator", () => {
    const requirement = parsePaymentRequiredHeader(
      encodePaymentRequired({
        x402Version: 2,
        accepts: [
          {
            scheme: "exact",
            network: "eip155:8453",
            maxAmountRequired: "1",
            payTo: "0xabc",
            resource: "https://api.example.com/r",
            asset: "USDC"
          }
        ],
        ttmHash: TTM_HASH_B
      })
    );

    expect(validatePaymentRequirementTtmHash(requirement, TTM_HASH_B)).toBe(true);
    expect(() => validatePaymentRequirementTtmHash(requirement, TTM_HASH_C)).toThrow(
      ProtocolCompatibilityError
    );
  });

  it("supports custom TTM hash validation hook", () => {
    const requirement = parsePaymentRequiredHeader(
      encodePaymentRequired({
        x402Version: 2,
        accepts: [
          {
            scheme: "exact",
            network: "eip155:8453",
            maxAmountRequired: "1",
            payTo: "0xabc",
            resource: "https://api.example.com/r",
            asset: "USDC"
          }
        ],
        ttmHash: TTM_HASH_A
      })
    );

    expect(
      validatePaymentRequirementTtmHash(requirement, TTM_HASH_B, ({ receivedTtmHash }) => {
        return receivedTtmHash === TTM_HASH_A;
      })
    ).toBe(true);
  });

  it("rejects ttmHash that is not lowercase sha256 hex", () => {
    expect(() => validateTtmHashJcsSha256("ABCDEF")).toThrowError(
      /64-char lowercase hex/
    );
  });

  it("converts decimal amount to atomic without rounding", () => {
    expect(decimalToAtomicAmount("1.23", 2)).toBe("123");
    expect(decimalToAtomicAmount("1", 6)).toBe("1000000");
  });

  it("rejects scale-overflow decimal in atomic conversion", () => {
    expect(() => decimalToAtomicAmount("1.234", 2)).toThrowError(
      /scale overflow/
    );
  });

  it("rejects PAYMENT-REQUIRED when amount precision exceeds assetScale", () => {
    const encoded = encodePaymentRequired({
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          maxAmountRequired: "1.234",
          assetScale: 2,
          payTo: "0xabc123",
          resource: "https://api.example.com/protected/resource",
          asset: "USDC"
        }
      ]
    });

    expect(() => parsePaymentRequiredHeader(encoded)).toThrowError(
      /scale overflow/
    );
  });

  it("fails closed when policy refs are required but missing", () => {
    const encoded = encodePaymentRequired({
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          maxAmountRequired: "10",
          payTo: "0xabc123",
          resource: "https://api.example.com/protected/resource",
          asset: "USDC"
        }
      ],
      ttmHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    });

    expect(() =>
      parsePaymentRequiredHeader(encoded, {
        requirePolicyRefs: true
      })
    ).toThrowError(/Missing required x402 field: policyRefs/);
  });

  it("accepts policy refs when fail-closed option is enabled", () => {
    const encoded = encodePaymentRequired({
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          maxAmountRequired: "10",
          payTo: "0xabc123",
          resource: "https://api.example.com/protected/resource",
          asset: "USDC"
        }
      ],
      ttmHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      policyRefs: {
        legalPolicyId: "legal.default.v1",
        webauthnPolicyId: "webauthn.strict.v1",
        retentionPolicyId: "retention.default.v1",
        runbookPolicyId: "runbook.default.v1",
        finalityPolicyId: "finality.base.v1"
      }
    });

    const parsed = parsePaymentRequiredHeader(encoded, {
      requirePolicyRefs: true
    });

    expect(parsed.policyRefs?.legalPolicyId).toBe("legal.default.v1");
  });
});
