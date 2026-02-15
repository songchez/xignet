import { describe, expect, it } from "vitest";

import {
  createInMemorySettlementReplayStore,
  executeSettlement,
  SettlementExecutionOptions,
  mapProofToOrderConfirmation,
  verifySettlementProof
} from "../../src/settlement.js";
import {
  ProtocolCompatibilityError,
  SettlementProofInvalidError,
  VerificationDeclinedError
} from "../../src/errors/index.js";

const baseProof = {
  txHash: "0xabc",
  chainId: "base-mainnet",
  payer: "0x1",
  payee: "0x2",
  amount: 50000,
  confirmedAt: "2026-02-15T12:00:00.000Z",
  proofType: "transfer"
};

const baseInvoice = {
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

function strictOptions(
  override?: Partial<SettlementExecutionOptions>
): SettlementExecutionOptions {
  return {
    facilitatorPolicyId: "facilitator_policy_v1",
    runbookPolicyId: "runbook_policy_v1",
    retry: {
      verify: {
        maxAttempts: 2,
        timeoutMs: 25,
        backoffMs: 0
      },
      settle: {
        maxAttempts: 1,
        timeoutMs: 25,
        backoffMs: 0
      }
    },
    finality: {
      finalityPolicyId: "finality_policy_v1",
      hook: {
        checkFinality: async () => ({
          finalized: true
        })
      }
    },
    ...override
  };
}

describe("settlement", () => {
  it("maps settlement proof to order confirmation", () => {
    const confirmation = mapProofToOrderConfirmation(
      baseProof,
      baseInvoice
    );

    expect(confirmation.status).toBe("confirmed");
    expect(confirmation.orderId).toBe("ord_1");
  });

  it("throws when settlement proof is invalid", async () => {
    await expect(
      verifySettlementProof(
        baseProof,
        {
          verifyProof: async () => false
        }
      )
    ).rejects.toThrow(SettlementProofInvalidError);
  });

  it("separates verify failure from settle failure", async () => {
    const replayStore = createInMemorySettlementReplayStore();
    let settleCalled = false;

    await expect(
      executeSettlement(
        {
          invoice: baseInvoice,
          proof: baseProof,
          idempotencyKey: "idem_verify_fail",
          ttmHash: "ttm_hash_1"
        },
        {
          verify: async () => ({
            status: "declined",
            verificationId: "vr_1",
            verifiedAt: "2026-02-15T12:01:00.000Z",
            reason: "signature mismatch"
          }),
          settle: async () => {
            settleCalled = true;
            return {
              status: "settled",
              settlementId: "st_1",
              txHash: "0xsettled",
              settledAt: "2026-02-15T12:02:00.000Z"
            };
          }
        },
        replayStore
      )
    ).rejects.toThrow(VerificationDeclinedError);

    expect(settleCalled).toBe(false);

    await expect(
      executeSettlement(
        {
          invoice: baseInvoice,
          proof: baseProof,
          idempotencyKey: "idem_settle_fail",
          ttmHash: "ttm_hash_2"
        },
        {
          verify: async () => ({
            status: "approved",
            verificationId: "vr_2",
            verifiedAt: "2026-02-15T12:03:00.000Z"
          }),
          settle: async () => ({
            status: "failed",
            settlementId: "st_2",
            txHash: "0xfailed",
            settledAt: "2026-02-15T12:04:00.000Z",
            reason: "insufficient funds"
          })
        },
        replayStore
      )
    ).rejects.toThrow(SettlementProofInvalidError);
  });

  it("prevents duplicate processing for same idempotency key", async () => {
    const replayStore = createInMemorySettlementReplayStore();
    let verifyCalls = 0;
    let settleCalls = 0;

    const adapter = {
      verify: async () => {
        verifyCalls += 1;
        return {
          status: "approved" as const,
          verificationId: "vr_3",
          verifiedAt: "2026-02-15T12:05:00.000Z"
        };
      },
      settle: async () => {
        settleCalls += 1;
        return {
          status: "settled" as const,
          settlementId: "st_3",
          txHash: "0xstable",
          settledAt: "2026-02-15T12:06:00.000Z"
        };
      }
    };

    const first = await executeSettlement(
      {
        invoice: baseInvoice,
        proof: baseProof,
        idempotencyKey: "idem_replay",
        ttmHash: "ttm_hash_3"
      },
      adapter,
      replayStore
    );
    const second = await executeSettlement(
      {
        invoice: baseInvoice,
        proof: baseProof,
        idempotencyKey: "idem_replay",
        ttmHash: "ttm_hash_3"
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

  it("fails when settlement receipt required fields are missing", async () => {
    const replayStore = createInMemorySettlementReplayStore();

    await expect(
      executeSettlement(
        {
          invoice: baseInvoice,
          proof: baseProof,
          idempotencyKey: "idem_sr_missing",
          ttmHash: "ttm_hash_4"
        },
        {
          verify: async () => ({
            status: "approved",
            verificationId: "vr_4",
            verifiedAt: "2026-02-15T12:07:00.000Z"
          }),
          settle: async () =>
            ({
              status: "settled",
              settlementId: "st_4",
              settledAt: "2026-02-15T12:08:00.000Z"
            }) as never
        },
        replayStore
      )
    ).rejects.toThrow(ProtocolCompatibilityError);
  });

  it("treats failed settle without txHash as settlement failure, not contract violation", async () => {
    const replayStore = createInMemorySettlementReplayStore();

    await expect(
      executeSettlement(
        {
          invoice: baseInvoice,
          proof: baseProof,
          idempotencyKey: "idem_failed_without_tx",
          ttmHash: "ttm_hash_5"
        },
        {
          verify: async () => ({
            status: "approved",
            verificationId: "vr_5",
            verifiedAt: "2026-02-15T12:09:00.000Z"
          }),
          settle: async () =>
            ({
              status: "failed",
              settlementId: "st_5",
              settledAt: "2026-02-15T12:10:00.000Z",
              reason: "chain reverted"
            }) as never
        },
        replayStore
      )
    ).rejects.toThrow(SettlementProofInvalidError);
  });

  it("throws protocol error for settle contract violations", async () => {
    const replayStore = createInMemorySettlementReplayStore();

    await expect(
      executeSettlement(
        {
          invoice: baseInvoice,
          proof: baseProof,
          idempotencyKey: "idem_settle_contract_violation",
          ttmHash: "ttm_hash_6"
        },
        {
          verify: async () => ({
            status: "approved",
            verificationId: "vr_6",
            verifiedAt: "2026-02-15T12:11:00.000Z"
          }),
          settle: async () =>
            ({
              status: "unknown",
              settlementId: "st_6",
              settledAt: "2026-02-15T12:12:00.000Z"
            }) as never
        },
        replayStore
      )
    ).rejects.toThrow(ProtocolCompatibilityError);
  });

  it("keeps idempotency invariant by rejecting same key with different request fingerprint", async () => {
    const replayStore = createInMemorySettlementReplayStore();
    const adapter = {
      verify: async () => ({
        status: "approved" as const,
        verificationId: "vr_7",
        verifiedAt: "2026-02-15T12:13:00.000Z"
      }),
      settle: async () => ({
        status: "settled" as const,
        settlementId: "st_7",
        txHash: "0xidem",
        settledAt: "2026-02-15T12:14:00.000Z"
      })
    };

    await executeSettlement(
      {
        invoice: baseInvoice,
        proof: baseProof,
        idempotencyKey: "idem_collision",
        ttmHash: "ttm_hash_7"
      },
      adapter,
      replayStore,
      strictOptions()
    );

    await expect(
      executeSettlement(
        {
          invoice: baseInvoice,
          proof: {
            ...baseProof,
            amount: 49000
          },
          idempotencyKey: "idem_collision",
          ttmHash: "ttm_hash_7"
        },
        adapter,
        replayStore,
        strictOptions()
      )
    ).rejects.toThrow(ProtocolCompatibilityError);
  });

  it("retries verify call based on injected timeout/retry policy", async () => {
    const replayStore = createInMemorySettlementReplayStore();
    let verifyCalls = 0;

    const result = await executeSettlement(
      {
        invoice: baseInvoice,
        proof: baseProof,
        idempotencyKey: "idem_retry_verify",
        ttmHash: "ttm_hash_8"
      },
      {
        verify: async () => {
          verifyCalls += 1;
          if (verifyCalls === 1) {
            const timeoutError = new Error("verify timeout");
            timeoutError.name = "TimeoutError";
            throw timeoutError;
          }
          return {
            status: "approved" as const,
            verificationId: "vr_8",
            verifiedAt: "2026-02-15T12:15:00.000Z"
          };
        },
        settle: async () => ({
          status: "settled" as const,
          settlementId: "st_8",
          txHash: "0xretry",
          settledAt: "2026-02-15T12:16:00.000Z"
        })
      },
      replayStore,
      strictOptions()
    );

    expect(verifyCalls).toBe(2);
    expect(result.replayed).toBe(false);
  });

  it("calls finality reorg hook and carries runbook recommendation on failure", async () => {
    const replayStore = createInMemorySettlementReplayStore();
    let reorgHookCalls = 0;

    await expect(
      executeSettlement(
        {
          invoice: baseInvoice,
          proof: baseProof,
          idempotencyKey: "idem_reorg",
          ttmHash: "ttm_hash_9"
        },
        {
          verify: async () => ({
            status: "approved",
            verificationId: "vr_9",
            verifiedAt: "2026-02-15T12:17:00.000Z"
          }),
          settle: async () => ({
            status: "settled",
            settlementId: "st_9",
            txHash: "0xreorg",
            settledAt: "2026-02-15T12:18:00.000Z"
          })
        },
        replayStore,
        strictOptions({
          recommendedActions: {
            REORG_DETECTED: "manual_dispute_open"
          },
          finality: {
            finalityPolicyId: "finality_policy_v1",
            hook: {
              checkFinality: async () => ({
                finalized: false,
                reorgDetected: true
              }),
              onReorg: async () => {
                reorgHookCalls += 1;
              }
            }
          }
        })
      )
    ).rejects.toMatchObject({
      name: "SettlementProofInvalidError",
      runbookPolicyId: "runbook_policy_v1",
      manualActionRequired: true,
      recommendedAction: "manual_dispute_open"
    });

    expect(reorgHookCalls).toBe(1);
  });

  it("fails closed when required settlement policy options are missing", async () => {
    const replayStore = createInMemorySettlementReplayStore();

    await expect(
      executeSettlement(
        {
          invoice: baseInvoice,
          proof: baseProof,
          idempotencyKey: "idem_missing_policy",
          ttmHash: "ttm_hash_10"
        },
        {
          verify: async () => ({
            status: "approved",
            verificationId: "vr_10",
            verifiedAt: "2026-02-15T12:19:00.000Z"
          }),
          settle: async () => ({
            status: "settled",
            settlementId: "st_10",
            txHash: "0xpolicy",
            settledAt: "2026-02-15T12:20:00.000Z"
          })
        },
        replayStore,
        {
          ...strictOptions(),
          runbookPolicyId: ""
        } as SettlementExecutionOptions
      )
    ).rejects.toThrow(ProtocolCompatibilityError);
  });
});
