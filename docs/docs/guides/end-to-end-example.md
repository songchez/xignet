---
title: 종단 간 예제 (E2E)
---

# 종단 간 예제 (E2E)

이 예제는 "실서비스 구조를 단순화한 서버 코드" 형태입니다.

```ts
import {
  adaptLegacyToV2Canonical,
  buildVerificationRequest,
  createInMemorySettlementReplayStore,
  executeSettlement,
  fetchInvoice,
  parse402Header,
  validateInvoiceSignature,
  verifyBiometricAssertion,
  type TransactionTermsManifest,
} from '@xignet/x402-sdk';

const replayStore = createInMemorySettlementReplayStore();

export async function checkout(rawHeader: string) {
  // A. Discovery
  const challenge = parse402Header(rawHeader);
  const canonicalRequirement = adaptLegacyToV2Canonical(rawHeader);
  const invoice = await fetchInvoice(challenge);
  await validateInvoiceSignature(invoice, {
    verifyInvoiceSignature: async () => true,
  });

  // B. Terms + Verification
  const ttm: TransactionTermsManifest = {
    ttmVersion: '2.0',
    intentId: invoice.orderRef,
    merchantId: invoice.merchantId,
    buyerId: 'buyer_42',
    lineItems: invoice.lineItems.map((item) => ({
      itemType: 'digital',
      itemRef: item.sku,
      quantity: String(item.quantity),
      unit: 'unit',
      unitPrice: String(item.unitPrice),
      amount: String(item.totalPrice),
    })),
    totalAmount: String(invoice.totalAmount),
    currency: invoice.currency,
    maxAllowedAmount: String(invoice.totalAmount),
    expiresAt: invoice.expiry,
    idempotencyKey: `idem_${invoice.invoiceId}`,
    policy: {
      policyRefs: {
        legalPolicyId: 'legal-v1',
        webauthnPolicyId: 'webauthn-v1',
      },
    },
    termsVersion: 'v1',
  };

  const verificationRequest = buildVerificationRequest(invoice, ttm, {
    failClosedOnMissingPolicyRefs: true,
  });

  const verification = await verifyBiometricAssertion(
    verificationRequest,
    {credential: 'assertion-value'},
    {
      verify: async (request) => ({
        signerDeviceId: 'device_a',
        signedAt: new Date().toISOString(),
        ttmHash: request.ttmHash,
      }),
    },
    {
      failClosedOnMissingPolicyRefs: true,
    },
  );

  // C. Settlement
  const proof = {
    txHash: '0xabc123',
    chainId: canonicalRequirement.accepts[0].network,
    payer: '0xpayer',
    payee: canonicalRequirement.accepts[0].payTo,
    amount: Number(canonicalRequirement.accepts[0].maxAmountRequired),
    confirmedAt: new Date().toISOString(),
    proofType: 'transfer',
  };

  const settlement = await executeSettlement(
    {
      invoice,
      proof,
      idempotencyKey: ttm.idempotencyKey,
      ttmHash: verification.ttmHash,
    },
    {
      verify: async () => ({
        status: 'approved',
        verificationId: 'ver_1',
        verifiedAt: new Date().toISOString(),
      }),
      settle: async (request) => ({
        status: 'settled',
        settlementId: 'set_1',
        txHash: request.proof.txHash,
        settledAt: new Date().toISOString(),
      }),
    },
    replayStore,
    {
      facilitatorPolicyId: 'facilitator-v1',
      runbookPolicyId: 'runbook-v1',
      retry: {
        verify: {maxAttempts: 2, timeoutMs: 3000, backoffMs: 100},
        settle: {maxAttempts: 2, timeoutMs: 5000, backoffMs: 200},
      },
      finality: {
        finalityPolicyId: 'finality-v1',
        hook: {
          checkFinality: async () => ({finalized: true}),
        },
      },
    },
  );

  return {
    invoiceId: invoice.invoiceId,
    intentId: ttm.intentId,
    verificationApproved: verification.approved,
    order: settlement.confirmation,
    receipt: settlement.receipt,
  };
}
```

## 이 예제에서 배울 수 있는 것

- 헤더 포맷이 달라도 내부 정규화로 통일 가능
- 정책 참조를 강제하는 fail-closed 운영 방식
- 정산 단계에서 재시도/파이널리티까지 한 번에 처리 가능
- replay store로 중복 요청을 안전하게 처리 가능

다음은 각 API를 함수 단위로 자세히 보는 레퍼런스 문서입니다.
