import { describe, expect, it } from "vitest";

import {
  adaptLegacyToV2Canonical,
  assertVerificationForSettlement,
  buildVerificationRequest,
  computeTtmHash,
  createInMemorySettlementReplayStore,
  executeSettlement,
  InvoiceExpiredError,
  InvoiceSignatureInvalidError,
  type SettlementExecutionRecord,
  parsePaymentRequiredHeader,
  ProtocolCompatibilityError,
  SettlementProofInvalidError,
  validatePaymentRequirementTtmHash,
  VerificationDeclinedError,
  verifyBiometricAssertion,
  mapProofToOrderConfirmation,
  parse402Header
} from "../../src/index.js";

function encodePaymentRequired(value: unknown): string {
  const encoded = JSON.stringify(value);
  const bytes = new TextEncoder().encode(encoded);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  if (typeof globalThis.btoa !== "function") {
    throw new Error("Runtime does not support base64 encoding");
  }

  return globalThis
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createInvoice() {
  return {
    invoiceId: "iv_1",
    merchantId: "merchant_1",
    orderRef: "ord_1",
    lineItems: [],
    totalAmount: 50000,
    currency: "KRW",
    issuedAt: "2026-02-01T00:00:00.000Z",
    expiry: "2026-03-01T00:00:00.000Z",
    signature: "sig"
  };
}

function createProof(overrides?: Partial<{ confirmedAt: string }>) {
  return {
    txHash: "0xabc",
    chainId: "base-mainnet",
    payer: "0x1",
    payee: "0x2",
    amount: 50000,
    confirmedAt: overrides?.confirmedAt ?? "2026-02-15T12:00:00.000Z",
    proofType: "transfer"
  };
}

function createTtm(policy?: Record<string, unknown>) {
  return {
    ttmVersion: "2.0",
    intentId: "intent_1",
    merchantId: "merchant_1",
    buyerId: "buyer_1",
    lineItems: [
      {
        itemType: "physical" as const,
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
    policy:
      policy ?? {
        legalPolicyId: "legal-default",
        webauthnPolicyId: "webauthn-default",
        retentionPolicyId: "retention-default",
        runbookPolicyId: "runbook-default",
        finalityPolicyId: "finality-default"
      },
    termsVersion: "v1"
  };
}

describe("sdk contract", () => {
  it("exports documented error classes", () => {
    expect(new InvoiceExpiredError().name).toBe("InvoiceExpiredError");
    expect(new InvoiceSignatureInvalidError().name).toBe("InvoiceSignatureInvalidError");
    expect(new VerificationDeclinedError().name).toBe("VerificationDeclinedError");
    expect(new SettlementProofInvalidError().name).toBe("SettlementProofInvalidError");
    expect(new ProtocolCompatibilityError().name).toBe("ProtocolCompatibilityError");
  });

  it("keeps order confirmation status stable", () => {
    const output = mapProofToOrderConfirmation(
      {
        txHash: "0xabc",
        chainId: "base-mainnet",
        payer: "0x1",
        payee: "0x2",
        amount: 50000,
        confirmedAt: "2026-02-15T12:00:00.000Z",
        proofType: "transfer"
      },
      {
        invoiceId: "iv_1",
        merchantId: "merchant_1",
        orderRef: "ord_1",
        lineItems: [],
        totalAmount: 50000,
        currency: "KRW",
        issuedAt: "2026-02-01T00:00:00.000Z",
        expiry: "2026-03-01T00:00:00.000Z",
        signature: "sig"
      }
    );

    expect(output.status).toBe("confirmed");
  });

  it("replays the same settlement result for duplicate idempotency key", async () => {
    const replayStore = createInMemorySettlementReplayStore();
    let verifyCalls = 0;
    let settleCalls = 0;

    const adapter = {
      verify: async () => {
        verifyCalls += 1;
        return {
          status: "approved" as const,
          verificationId: "vr_contract_1",
          verifiedAt: "2026-02-15T12:30:00.000Z"
        };
      },
      settle: async () => {
        settleCalls += 1;
        return {
          status: "settled" as const,
          settlementId: "st_contract_1",
          txHash: "0xcontract",
          settledAt: "2026-02-15T12:31:00.000Z"
        };
      }
    };

    const invoice = {
      invoiceId: "iv_1",
      merchantId: "merchant_1",
      orderRef: "ord_1",
      lineItems: [],
      totalAmount: 50000,
      currency: "KRW",
      issuedAt: "2026-02-01T00:00:00.000Z",
      expiry: "2026-03-01T00:00:00.000Z",
      signature: "sig"
    };
    const proof = {
      txHash: "0xabc",
      chainId: "base-mainnet",
      payer: "0x1",
      payee: "0x2",
      amount: 50000,
      confirmedAt: "2026-02-15T12:00:00.000Z",
      proofType: "transfer"
    };

    const first = await executeSettlement(
      {
        invoice,
        proof,
        idempotencyKey: "idem_contract_1",
        ttmHash: "ttm_contract_1"
      },
      adapter,
      replayStore
    );
    const second = await executeSettlement(
      {
        invoice,
        proof,
        idempotencyKey: "idem_contract_1",
        ttmHash: "ttm_contract_1"
      },
      adapter,
      replayStore
    );

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.receipt.receiptId).toBe(first.receipt.receiptId);
    expect(verifyCalls).toBe(1);
    expect(settleCalls).toBe(1);
  });

  it("rejects settlement contract when SR required field is absent", async () => {
    await expect(
      executeSettlement(
        {
          invoice: {
            invoiceId: "iv_1",
            merchantId: "merchant_1",
            orderRef: "ord_1",
            lineItems: [],
            totalAmount: 50000,
            currency: "KRW",
            issuedAt: "2026-02-01T00:00:00.000Z",
            expiry: "2026-03-01T00:00:00.000Z",
            signature: "sig"
          },
          proof: {
            txHash: "0xabc",
            chainId: "base-mainnet",
            payer: "0x1",
            payee: "0x2",
            amount: 50000,
            confirmedAt: "2026-02-15T12:00:00.000Z",
            proofType: "transfer"
          },
          idempotencyKey: "idem_contract_missing_sr",
          ttmHash: "ttm_contract_missing_sr"
        },
        {
          verify: async () => ({
            status: "approved",
            verificationId: "vr_contract_2",
            verifiedAt: "2026-02-15T12:35:00.000Z"
          }),
          settle: async () =>
            ({
              status: "settled",
              settlementId: "st_contract_2",
              settledAt: "2026-02-15T12:36:00.000Z"
            }) as never
        },
        createInMemorySettlementReplayStore()
      )
    ).rejects.toThrow(ProtocolCompatibilityError);
  });

  it("requires invoice field in x402 challenge", () => {
    expect(() => parse402Header('L402 amount=100, currency="KRW"')).toThrow(
      ProtocolCompatibilityError
    );
  });

  it("binds verification result to consent receipt and ttmHash", async () => {
    const ttm = {
      ttmVersion: "2.0",
      intentId: "intent_1",
      merchantId: "merchant_1",
      buyerId: "buyer_1",
      lineItems: [
        {
          itemType: "physical" as const,
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
    const request = buildVerificationRequest(
      {
        invoiceId: "iv_1",
        merchantId: "merchant_1",
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

    expect(verification.consentReceipt.ttmHash).toBe(computeTtmHash(ttm));
    expect(verification.consentReceipt.invoiceId).toBe("iv_1");
  });

  it("blocks settlement contract when approval is missing", () => {
    expect(() =>
      assertVerificationForSettlement(undefined, {
        invoiceId: "iv_1",
        termsVersion: "v1",
        ttmHash: "ttm_hash"
      })
    ).toThrow(VerificationDeclinedError);
  });

  it("blocks settlement contract when approved invoiceId is mismatched", async () => {
    const request = buildVerificationRequest(
      {
        invoiceId: "iv_1",
        merchantId: "merchant_1",
        orderRef: "ord_1",
        lineItems: [],
        totalAmount: 50000,
        currency: "KRW",
        issuedAt: "2026-02-01T00:00:00.000Z",
        expiry: "2026-03-01T00:00:00.000Z",
        signature: "sig"
      },
      {
        ttmVersion: "2.0",
        intentId: "intent_1",
        merchantId: "merchant_1",
        buyerId: "buyer_1",
        lineItems: [
          {
            itemType: "physical" as const,
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
      }
    );

    expect(() =>
      assertVerificationForSettlement(verification, {
        invoiceId: "iv_mismatch",
        termsVersion: "v1",
        ttmHash: request.ttmHash
      })
    ).toThrow(VerificationDeclinedError);
  });

  it("blocks settlement contract when approved termsVersion is mismatched", async () => {
    const request = buildVerificationRequest(
      {
        invoiceId: "iv_1",
        merchantId: "merchant_1",
        orderRef: "ord_1",
        lineItems: [],
        totalAmount: 50000,
        currency: "KRW",
        issuedAt: "2026-02-01T00:00:00.000Z",
        expiry: "2026-03-01T00:00:00.000Z",
        signature: "sig"
      },
      {
        ttmVersion: "2.0",
        intentId: "intent_1",
        merchantId: "merchant_1",
        buyerId: "buyer_1",
        lineItems: [
          {
            itemType: "physical" as const,
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

  it("blocks settlement contract when approved ttmHash is mismatched", async () => {
    const request = buildVerificationRequest(
      {
        invoiceId: "iv_1",
        merchantId: "merchant_1",
        orderRef: "ord_1",
        lineItems: [],
        totalAmount: 50000,
        currency: "KRW",
        issuedAt: "2026-02-01T00:00:00.000Z",
        expiry: "2026-03-01T00:00:00.000Z",
        signature: "sig"
      },
      {
        ttmVersion: "2.0",
        intentId: "intent_1",
        merchantId: "merchant_1",
        buyerId: "buyer_1",
        lineItems: [
          {
            itemType: "physical" as const,
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
      }
    );

    expect(() =>
      assertVerificationForSettlement(verification, {
        invoiceId: request.invoiceId,
        termsVersion: "v1",
        ttmHash: "ttm_hash_mismatch"
      })
    ).toThrow(VerificationDeclinedError);
  });

  it("keeps v2 parser and ttm hook in public API contract", () => {
    const encoded = encodePaymentRequired({
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: "eip155:1",
          maxAmountRequired: "10",
          payTo: "0xabc",
          resource: "https://api.example.com/r",
          asset: "USDC"
        }
      ],
      ttmHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    });

    const parsed = parsePaymentRequiredHeader(encoded);
    expect(parsed.x402Version).toBe(2);
    expect(
      validatePaymentRequirementTtmHash(
        parsed,
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      )
    ).toBe(true);
  });

  it("keeps legacy to v2 adapter output contract stable", () => {
    const adapted = adaptLegacyToV2Canonical(
      'L402 invoice="https://gateway.example.com/invoices/iv_legacy", amount=100, network="base-mainnet", pay_to="0xdef", resource="https://api.example.com/r", asset="USDC"'
    );

    expect(adapted.x402Version).toBe(2);
    expect(adapted.accepts[0]?.network).toBe("eip155:8453");
    expect(adapted.accepts[0]?.maxAmountRequired).toBe("100");
  });
});

describe("phase2 app integration decisions contract coverage", () => {
  it("[D-001] computes deterministic lowercase SHA-256 hash for canonical-equivalent TTM", () => {
    const ttmA = createTtm({
      webauthnPolicyId: "webauthn-1",
      legalPolicyId: "legal-1",
      retentionPolicyId: "retention-1",
      runbookPolicyId: "runbook-1",
      finalityPolicyId: "finality-1"
    });
    const ttmB = {
      termsVersion: "v1",
      currency: "KRW",
      lineItems: [
        {
          amount: "50000",
          unitPrice: "50000",
          quantity: "1",
          itemRef: "sku_1",
          unit: "ea",
          itemType: "physical" as const
        }
      ],
      policy: {
        runbookPolicyId: "runbook-1",
        finalityPolicyId: "finality-1",
        retentionPolicyId: "retention-1",
        legalPolicyId: "legal-1",
        webauthnPolicyId: "webauthn-1"
      },
      buyerId: "buyer_1",
      idempotencyKey: "idem_1",
      merchantId: "merchant_1",
      ttmVersion: "2.0",
      maxAllowedAmount: "50000",
      totalAmount: "50000",
      intentId: "intent_1",
      expiresAt: "2026-03-01T00:00:00.000Z"
    };

    const hashA = computeTtmHash(ttmA);
    const hashB = computeTtmHash(ttmB);
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[0-9a-f]{64}$/);
  });

  it("[D-002] rejects scientific-notation amount to avoid implicit rounding", () => {
    const encoded = encodePaymentRequired({
      x402Version: 2,
      accepts: [
        {
          scheme: "exact",
          network: "eip155:8453",
          maxAmountRequired: "1e-3",
          payTo: "0xabc",
          resource: "https://api.example.com/r",
          asset: "USDC"
        }
      ]
    });

    expect(() => parsePaymentRequiredHeader(encoded)).toThrow(ProtocolCompatibilityError);
    expect(() => parsePaymentRequiredHeader(encoded)).toThrow("Invalid amount in x402 field");
  });

  it("[D-003] preserves custom unit strings without SDK-level taxonomy lock-in", () => {
    const request = buildVerificationRequest(
      createInvoice(),
      {
        ...createTtm(),
        lineItems: [
          {
            itemType: "service",
            itemRef: "svc_1",
            quantity: "12",
            unit: "custom/minute.bundle.v2",
            unitPrice: "100",
            amount: "1200"
          }
        ],
        totalAmount: "1200",
        maxAllowedAmount: "1200"
      }
    );

    expect(request.ttm.lineItems[0]?.unit).toBe("custom/minute.bundle.v2");
  });

  it("[D-004] supports fail-closed deny-by-default evaluation via external validation hook", () => {
    const requirement = parsePaymentRequiredHeader(
      encodePaymentRequired({
        x402Version: 2,
        accepts: [
          {
            scheme: "exact",
            network: "eip155:8453",
            maxAmountRequired: "10",
            payTo: "0xabc",
            resource: "https://api.example.com/r",
            asset: "USDC"
          }
        ],
        ttmHash: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
      })
    );

    expect(() =>
      validatePaymentRequirementTtmHash(
        requirement,
        "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        () => false
      )
    ).toThrow("TTM hash validation failed");
  });

  it("[D-005] forwards idempotencyKey and ttmHash to facilitator verify/settle contract", async () => {
    let verifyInput: Record<string, unknown> | undefined;
    let settleInput: Record<string, unknown> | undefined;

    await executeSettlement(
      {
        invoice: createInvoice(),
        proof: createProof(),
        idempotencyKey: "idem_d005",
        ttmHash: "ttm_d005"
      },
      {
        verify: async (request) => {
          verifyInput = request as unknown as Record<string, unknown>;
          return {
            status: "approved",
            verificationId: "vr_d005",
            verifiedAt: "2026-02-15T12:40:00.000Z"
          };
        },
        settle: async (request) => {
          settleInput = request as unknown as Record<string, unknown>;
          return {
            status: "settled",
            settlementId: "st_d005",
            txHash: "0xd005",
            settledAt: "2026-02-15T12:41:00.000Z"
          };
        }
      },
      createInMemorySettlementReplayStore()
    );

    expect(verifyInput).toMatchObject({
      invoiceId: "iv_1",
      idempotencyKey: "idem_d005",
      ttmHash: "ttm_d005"
    });
    expect(settleInput).toMatchObject({
      invoiceId: "iv_1",
      idempotencyKey: "idem_d005",
      ttmHash: "ttm_d005",
      verificationId: "vr_d005"
    });
  });

  it("[D-006] keeps verification-declined path fail-closed without confirmation record", async () => {
    const replayStore = createInMemorySettlementReplayStore();

    await expect(
      executeSettlement(
        {
          invoice: createInvoice(),
          proof: createProof(),
          idempotencyKey: "idem_d006",
          ttmHash: "ttm_d006"
        },
        {
          verify: async () => ({
            status: "declined",
            verificationId: "vr_d006",
            verifiedAt: "2026-02-15T12:45:00.000Z",
            reason: "policy_denied"
          }),
          settle: async () => ({
            status: "settled",
            settlementId: "st_d006",
            txHash: "0xd006",
            settledAt: "2026-02-15T12:46:00.000Z"
          })
        },
        replayStore
      )
    ).rejects.toThrow(VerificationDeclinedError);

    expect(await replayStore.get("idem_d006")).toBeNull();
  });

  it("[D-007] allows policy values to be injected through TTM policy object", () => {
    const request = buildVerificationRequest(
      createInvoice(),
      createTtm({
        legalPolicyId: "legal-policy-custom",
        webauthnPolicyId: "webauthn-policy-custom",
        retentionPolicyId: "retention-policy-custom",
        runbookPolicyId: "runbook-policy-custom",
        finalityPolicyId: "finality-policy-custom"
      })
    );

    expect(request.ttm.policy).toMatchObject({
      legalPolicyId: "legal-policy-custom",
      webauthnPolicyId: "webauthn-policy-custom",
      retentionPolicyId: "retention-policy-custom",
      runbookPolicyId: "runbook-policy-custom",
      finalityPolicyId: "finality-policy-custom"
    });
  });

  it("[D-008] emits auditLogId contract for downstream retention/audit policy systems", async () => {
    const result = await executeSettlement(
      {
        invoice: createInvoice(),
        proof: createProof(),
        idempotencyKey: "idem_d008",
        ttmHash: "ttm_d008"
      },
      {
        verify: async () => ({
          status: "approved",
          verificationId: "vr_d008",
          verifiedAt: "2026-02-15T12:50:00.000Z"
        }),
        settle: async () => ({
          status: "settled",
          settlementId: "st_d008",
          txHash: "0xd008",
          settledAt: "2026-02-15T12:51:00.000Z"
        })
      },
      createInMemorySettlementReplayStore()
    );

    expect(result.receipt.auditLogId).toBe("vr_d008:st_d008");
  });

  it("[D-009] propagates settle failure reason for manual runbook escalation", async () => {
    await expect(
      executeSettlement(
        {
          invoice: createInvoice(),
          proof: createProof(),
          idempotencyKey: "idem_d009",
          ttmHash: "ttm_d009"
        },
        {
          verify: async () => ({
            status: "approved",
            verificationId: "vr_d009",
            verifiedAt: "2026-02-15T12:52:00.000Z"
          }),
          settle: async () => ({
            status: "failed",
            settlementId: "st_d009",
            txHash: "0xd009",
            settledAt: "2026-02-15T12:53:00.000Z",
            reason: "manual_action_required"
          })
        },
        createInMemorySettlementReplayStore()
      )
    ).rejects.toThrow("manual_action_required");
  });

  it("[D-010] fails closed when consent receipt minimum schema is violated", async () => {
    const request = buildVerificationRequest(createInvoice(), createTtm());
    const verification = await verifyBiometricAssertion(
      request,
      { credential: "assertion" },
      {
        verify: async () => ({
          signerDeviceId: "device_d010",
          signedAt: "2026-02-15T12:54:00.000Z",
          ttmHash: request.ttmHash
        })
      }
    );

    const tampered = {
      ...verification,
      consentReceipt: {
        ...verification.consentReceipt,
        signerDeviceId: ""
      }
    };

    expect(() =>
      assertVerificationForSettlement(tampered, {
        invoiceId: request.invoiceId,
        termsVersion: request.ttm.termsVersion,
        ttmHash: request.ttmHash
      })
    ).toThrow(VerificationDeclinedError);
  });

  it("[D-011] defaults to fail-closed when WebAuthn binding does not match requested ttmHash", async () => {
    const request = buildVerificationRequest(createInvoice(), createTtm());

    await expect(
      verifyBiometricAssertion(
        request,
        { credential: "assertion" },
        {
          verify: async () => ({
            signerDeviceId: "device_d011",
            signedAt: "2026-02-15T12:55:00.000Z",
            ttmHash: "ttm_hash_mismatch_d011"
          })
        }
      )
    ).rejects.toThrow(VerificationDeclinedError);
  });

  it("[D-012] keeps finality threshold outside SDK by preserving settlement proof timestamp", () => {
    const proof = createProof({ confirmedAt: "2026-02-15T12:59:59.000Z" });
    const confirmation = mapProofToOrderConfirmation(proof, createInvoice());

    expect(confirmation.confirmedAt).toBe("2026-02-15T12:59:59.000Z");
  });

  it("[D-013] supports injected idempotency persistence adapter semantics", async () => {
    const records = new Map<string, SettlementExecutionRecord>();
    const observedGets: string[] = [];
    let setCount = 0;
    let verifyCalls = 0;
    let settleCalls = 0;

    const replayStore = {
      get: (idempotencyKey: string) => {
        observedGets.push(idempotencyKey);
        return records.get(idempotencyKey) ?? null;
      },
      set: (idempotencyKey: string, record: SettlementExecutionRecord) => {
        setCount += 1;
        records.set(idempotencyKey, record);
      }
    };

    const adapter = {
      verify: async () => {
        verifyCalls += 1;
        return {
          status: "approved" as const,
          verificationId: "vr_d013",
          verifiedAt: "2026-02-15T13:00:00.000Z"
        };
      },
      settle: async () => {
        settleCalls += 1;
        return {
          status: "settled" as const,
          settlementId: "st_d013",
          txHash: "0xd013",
          settledAt: "2026-02-15T13:01:00.000Z"
        };
      }
    };

    const first = await executeSettlement(
      {
        invoice: createInvoice(),
        proof: createProof(),
        idempotencyKey: "idem_d013",
        ttmHash: "ttm_d013"
      },
      adapter,
      replayStore
    );
    const second = await executeSettlement(
      {
        invoice: createInvoice(),
        proof: createProof(),
        idempotencyKey: "idem_d013",
        ttmHash: "ttm_d013"
      },
      adapter,
      replayStore
    );

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(observedGets).toEqual(["idem_d013", "idem_d013"]);
    expect(setCount).toBe(1);
    expect(verifyCalls).toBe(1);
    expect(settleCalls).toBe(1);
  });
});
