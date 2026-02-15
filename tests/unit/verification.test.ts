import { describe, expect, it } from "vitest";

import {
  assertVerificationForSettlement,
  buildVerificationRequest,
  computeTtmHash,
  createConsentReceipt,
  validateConsentReceipt,
  verifyBiometricAssertion
} from "../../src/verification.js";
import { VerificationDeclinedError } from "../../src/errors/index.js";
import { TransactionTermsManifest } from "../../src/types.js";

const ttm: TransactionTermsManifest = {
  ttmVersion: "2.0",
  intentId: "intent_1",
  merchantId: "Coupang",
  buyerId: "buyer_1",
  lineItems: [
    {
      itemType: "physical",
      itemRef: "sku_1",
      quantity: "1",
      unit: "ea",
      unitPrice: "50000",
      amount: "50000"
    }
  ],
  totalAmount: "50000",
  currency: "KRW",
  maxAllowedAmount: "50000",
  expiresAt: "2026-03-01T00:00:00.000Z",
  idempotencyKey: "idem_1",
  policy: {},
  termsVersion: "v1"
};

const ttmWithPolicyRefs: TransactionTermsManifest = {
  ...ttm,
  policy: {
    policyRefs: {
      legalPolicyId: "legal_policy_v1",
      webauthnPolicyId: "webauthn_policy_v1"
    }
  }
};

describe("verification", () => {
  it("builds verification request from invoice", () => {
    const req = buildVerificationRequest({
      invoiceId: "iv_123",
      merchantId: "Coupang",
      orderRef: "ord_1",
      lineItems: [],
      totalAmount: 50000,
      currency: "KRW",
      issuedAt: "2026-02-01T00:00:00.000Z",
      expiry: "2026-03-01T00:00:00.000Z",
      signature: "sig"
    }, ttm);

    expect(req.invoiceId).toBe("iv_123");
    expect(req.ttmHash).toBe(computeTtmHash(ttm));
    expect(req.challenge).toBe(req.ttmHash);
    expect(req.displayText).toContain("50000");
  });

  it("returns verification result when assertion is valid", async () => {
    const request = buildVerificationRequest(
      {
        invoiceId: "iv_1",
        merchantId: "Coupang",
        orderRef: "ord_1",
        lineItems: [],
        totalAmount: 50000,
        currency: "KRW",
        issuedAt: "2026-02-01T00:00:00.000Z",
        expiry: "2026-03-01T00:00:00.000Z",
        signature: "sig"
      },
      ttm
    );

    const result = await verifyBiometricAssertion(
      request,
      { credential: "webauthn-assertion" },
      {
        verify: async (req) => ({
          signerDeviceId: "device_1",
          signedAt: "2026-02-15T00:00:00.000Z",
          ttmHash: req.ttmHash
        })
      }
    );

    expect(result.approved).toBe(true);
    expect(result.ttmHash).toBe(request.ttmHash);
    expect(result.signerDeviceId).toBe("device_1");
    expect(result.consentReceipt.ttmHash).toBe(request.ttmHash);
    expect(result.consentReceipt.authMethod).toBe("webauthn");
  });

  it("throws when assertion is declined", async () => {
    await expect(
      verifyBiometricAssertion(
        buildVerificationRequest(
          {
            invoiceId: "iv_1",
            merchantId: "Coupang",
            orderRef: "ord_1",
            lineItems: [],
            totalAmount: 50000,
            currency: "KRW",
            issuedAt: "2026-02-01T00:00:00.000Z",
            expiry: "2026-03-01T00:00:00.000Z",
            signature: "sig"
          },
          ttm
        ),
        {},
        {
          verify: async () => null
        }
      )
    ).rejects.toThrow(VerificationDeclinedError);
  });

  it("throws when WebAuthn result is not bound to request ttmHash", async () => {
    await expect(
      verifyBiometricAssertion(
        buildVerificationRequest(
          {
            invoiceId: "iv_1",
            merchantId: "Coupang",
            orderRef: "ord_1",
            lineItems: [],
            totalAmount: 50000,
            currency: "KRW",
            issuedAt: "2026-02-01T00:00:00.000Z",
            expiry: "2026-03-01T00:00:00.000Z",
            signature: "sig"
          },
          ttm
        ),
        {},
        {
          verify: async () => ({
            signerDeviceId: "device_1",
            signedAt: "2026-02-15T00:00:00.000Z",
            ttmHash: "mismatch-hash"
          })
        }
      )
    ).rejects.toThrow(VerificationDeclinedError);
  });

  it("creates and validates consent receipt", () => {
    const request = buildVerificationRequest(
      {
        invoiceId: "iv_1",
        merchantId: "Coupang",
        orderRef: "ord_1",
        lineItems: [],
        totalAmount: 50000,
        currency: "KRW",
        issuedAt: "2026-02-01T00:00:00.000Z",
        expiry: "2026-03-01T00:00:00.000Z",
        signature: "sig"
      },
      ttm
    );

    const receipt = createConsentReceipt(
      request,
      {
        signerDeviceId: "device_1",
        signedAt: "2026-02-15T00:00:00.000Z"
      },
      { credential: "assertion" }
    );

    expect(
      validateConsentReceipt(receipt, {
        invoiceId: request.invoiceId,
        ttmHash: request.ttmHash,
        termsVersion: request.ttm.termsVersion
      })
    ).toBe(true);
  });

  it("fails settlement assertion when expected invoiceId is mismatched", async () => {
    const request = buildVerificationRequest(
      {
        invoiceId: "iv_1",
        merchantId: "Coupang",
        orderRef: "ord_1",
        lineItems: [],
        totalAmount: 50000,
        currency: "KRW",
        issuedAt: "2026-02-01T00:00:00.000Z",
        expiry: "2026-03-01T00:00:00.000Z",
        signature: "sig"
      },
      ttm
    );
    const verification = await verifyBiometricAssertion(
      request,
      { credential: "assertion" },
      {
        verify: async () => ({
          signerDeviceId: "device_1",
          signedAt: "2026-02-15T00:00:00.000Z",
          ttmHash: request.ttmHash
        })
      }
    );

    expect(() =>
      assertVerificationForSettlement(verification, {
        invoiceId: "iv_other",
        termsVersion: ttm.termsVersion,
        ttmHash: request.ttmHash
      })
    ).toThrow(VerificationDeclinedError);
  });

  it("fails settlement assertion when expected termsVersion is mismatched", async () => {
    const request = buildVerificationRequest(
      {
        invoiceId: "iv_1",
        merchantId: "Coupang",
        orderRef: "ord_1",
        lineItems: [],
        totalAmount: 50000,
        currency: "KRW",
        issuedAt: "2026-02-01T00:00:00.000Z",
        expiry: "2026-03-01T00:00:00.000Z",
        signature: "sig"
      },
      ttm
    );
    const verification = await verifyBiometricAssertion(
      request,
      { credential: "assertion" },
      {
        verify: async () => ({
          signerDeviceId: "device_1",
          signedAt: "2026-02-15T00:00:00.000Z",
          ttmHash: request.ttmHash
        })
      }
    );

    expect(() =>
      assertVerificationForSettlement(verification, {
        invoiceId: request.invoiceId,
        termsVersion: "v2",
        ttmHash: request.ttmHash
      })
    ).toThrow(VerificationDeclinedError);
  });

  it("fails settlement assertion when expected ttmHash is mismatched", async () => {
    const request = buildVerificationRequest(
      {
        invoiceId: "iv_1",
        merchantId: "Coupang",
        orderRef: "ord_1",
        lineItems: [],
        totalAmount: 50000,
        currency: "KRW",
        issuedAt: "2026-02-01T00:00:00.000Z",
        expiry: "2026-03-01T00:00:00.000Z",
        signature: "sig"
      },
      ttm
    );
    const verification = await verifyBiometricAssertion(
      request,
      { credential: "assertion" },
      {
        verify: async () => ({
          signerDeviceId: "device_1",
          signedAt: "2026-02-15T00:00:00.000Z",
          ttmHash: request.ttmHash
        })
      }
    );

    expect(() =>
      assertVerificationForSettlement(verification, {
        invoiceId: request.invoiceId,
        termsVersion: ttm.termsVersion,
        ttmHash: "ttm_hash_mismatch"
      })
    ).toThrow(VerificationDeclinedError);
  });

  it("passes settlement assertion when invoiceId termsVersion ttmHash all match", async () => {
    const request = buildVerificationRequest(
      {
        invoiceId: "iv_1",
        merchantId: "Coupang",
        orderRef: "ord_1",
        lineItems: [],
        totalAmount: 50000,
        currency: "KRW",
        issuedAt: "2026-02-01T00:00:00.000Z",
        expiry: "2026-03-01T00:00:00.000Z",
        signature: "sig"
      },
      ttm
    );
    const verification = await verifyBiometricAssertion(
      request,
      { credential: "assertion" },
      {
        verify: async () => ({
          signerDeviceId: "device_1",
          signedAt: "2026-02-15T00:00:00.000Z",
          ttmHash: request.ttmHash
        })
      }
    );

    const receipt = assertVerificationForSettlement(verification, {
      invoiceId: request.invoiceId,
      termsVersion: ttm.termsVersion,
      ttmHash: request.ttmHash
    });

    expect(receipt.invoiceId).toBe("iv_1");
    expect(receipt.termsVersion).toBe(ttm.termsVersion);
    expect(receipt.ttmHash).toBe(request.ttmHash);
  });

  it("computes same ttmHash for semantically identical manifests with different key order", () => {
    const reordered: TransactionTermsManifest = {
      buyerId: "buyer_1",
      currency: "KRW",
      expiresAt: "2026-03-01T00:00:00.000Z",
      idempotencyKey: "idem_1",
      intentId: "intent_1",
      lineItems: [
        {
          amount: "50000",
          itemRef: "sku_1",
          itemType: "physical",
          quantity: "1",
          unit: "ea",
          unitPrice: "50000"
        }
      ],
      maxAllowedAmount: "50000",
      merchantId: "Coupang",
      policy: {},
      termsVersion: "v1",
      totalAmount: "50000",
      ttmVersion: "2.0"
    };

    expect(computeTtmHash(reordered)).toBe(computeTtmHash(ttm));
  });

  it("fails closed when legalPolicyId is missing under strict policy mode", () => {
    expect(() =>
      buildVerificationRequest(
        {
          invoiceId: "iv_1",
          merchantId: "Coupang",
          orderRef: "ord_1",
          lineItems: [],
          totalAmount: 50000,
          currency: "KRW",
          issuedAt: "2026-02-01T00:00:00.000Z",
          expiry: "2026-03-01T00:00:00.000Z",
          signature: "sig"
        },
        {
          ...ttm,
          policy: {
            policyRefs: {
              webauthnPolicyId: "webauthn_policy_v1"
            }
          }
        },
        { failClosedOnMissingPolicyRefs: true }
      )
    ).toThrow(VerificationDeclinedError);
  });

  it("fails closed when webauthnPolicyId is missing under strict policy mode", () => {
    expect(() =>
      buildVerificationRequest(
        {
          invoiceId: "iv_1",
          merchantId: "Coupang",
          orderRef: "ord_1",
          lineItems: [],
          totalAmount: 50000,
          currency: "KRW",
          issuedAt: "2026-02-01T00:00:00.000Z",
          expiry: "2026-03-01T00:00:00.000Z",
          signature: "sig"
        },
        {
          ...ttm,
          policy: {
            policyRefs: {
              legalPolicyId: "legal_policy_v1"
            }
          }
        },
        { failClosedOnMissingPolicyRefs: true }
      )
    ).toThrow(VerificationDeclinedError);
  });

  it("fails closed in verify step when strict mode is enabled and policy refs are missing", async () => {
    const request = buildVerificationRequest(
      {
        invoiceId: "iv_1",
        merchantId: "Coupang",
        orderRef: "ord_1",
        lineItems: [],
        totalAmount: 50000,
        currency: "KRW",
        issuedAt: "2026-02-01T00:00:00.000Z",
        expiry: "2026-03-01T00:00:00.000Z",
        signature: "sig"
      },
      ttm
    );

    await expect(
      verifyBiometricAssertion(
        request,
        {},
        {
          verify: async () => ({
            signerDeviceId: "device_1",
            signedAt: "2026-02-15T00:00:00.000Z",
            ttmHash: request.ttmHash
          })
        },
        { failClosedOnMissingPolicyRefs: true }
      )
    ).rejects.toThrow(VerificationDeclinedError);
  });

  it("accepts strict mode when legalPolicyId and webauthnPolicyId are injected", async () => {
    const request = buildVerificationRequest(
      {
        invoiceId: "iv_1",
        merchantId: "Coupang",
        orderRef: "ord_1",
        lineItems: [],
        totalAmount: 50000,
        currency: "KRW",
        issuedAt: "2026-02-01T00:00:00.000Z",
        expiry: "2026-03-01T00:00:00.000Z",
        signature: "sig"
      },
      ttm,
      {
        policyRefs: {
          legalPolicyId: "legal_policy_v1",
          webauthnPolicyId: "webauthn_policy_v1"
        },
        webauthnOptions: {
          rpId: "example.com",
          userVerification: "required"
        },
        failClosedOnMissingPolicyRefs: true
      }
    );

    const verification = await verifyBiometricAssertion(
      request,
      { credential: "assertion" },
      {
        verify: async () => ({
          signerDeviceId: "device_1",
          signedAt: "2026-02-15T00:00:00.000Z",
          ttmHash: request.ttmHash
        })
      },
      { failClosedOnMissingPolicyRefs: true }
    );

    const receiptRecord = verification.consentReceipt as unknown as Record<string, unknown>;
    expect(receiptRecord.legalPolicyId).toBe("legal_policy_v1");
    expect(receiptRecord.webauthnPolicyId).toBe("webauthn_policy_v1");
    expect(receiptRecord.signerContextRef).toBe("device_1");
    expect(typeof receiptRecord.consentArtifactId).toBe("string");
  });

  it("fails closed when consent minimum proof fields are missing", () => {
    const request = buildVerificationRequest(
      {
        invoiceId: "iv_1",
        merchantId: "Coupang",
        orderRef: "ord_1",
        lineItems: [],
        totalAmount: 50000,
        currency: "KRW",
        issuedAt: "2026-02-01T00:00:00.000Z",
        expiry: "2026-03-01T00:00:00.000Z",
        signature: "sig"
      },
      ttmWithPolicyRefs
    );
    const receipt = createConsentReceipt(
      request,
      {
        signerDeviceId: "device_1",
        signedAt: "2026-02-15T00:00:00.000Z"
      },
      { credential: "assertion" }
    );

    const tampered = {
      ...(receipt as unknown as Record<string, unknown>)
    };
    delete tampered.signerContextRef;

    expect(
      validateConsentReceipt(tampered as unknown as typeof receipt, {
        invoiceId: request.invoiceId,
        ttmHash: request.ttmHash,
        termsVersion: request.ttm.termsVersion
      })
    ).toBe(false);
  });
});
