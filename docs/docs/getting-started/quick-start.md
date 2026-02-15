---
title: 5분 Quick Start
---

# 5분 Quick Start

아래 코드는 Discovery -> Verification -> Settlement 전체 흐름을 한 파일에서 보여주는 최소 예제입니다.

```ts
import {
  parse402Header,
  fetchInvoice,
  validateInvoiceSignature,
  buildVerificationRequest,
  verifyBiometricAssertion,
  verifySettlementProof,
  mapProofToOrderConfirmation,
  type TransactionTermsManifest,
} from '@xignet/x402-sdk';

async function run() {
  // 1) 결제 요구 헤더 파싱
  const challenge = parse402Header(
    'L402 invoice="https://gateway.example.com/invoices/iv_123", amount=50000, currency="KRW", merchant="Coupang"',
  );

  // 2) 인보이스 조회
  const invoice = await fetchInvoice(challenge);

  // 3) 인보이스 서명 검증 (실서비스에서는 실제 검증 로직 필요)
  await validateInvoiceSignature(invoice, {
    verifyInvoiceSignature: async (payload) => payload.signature.length > 0,
  });

  // 4) 사용자가 동의할 거래 조건(TTM) 구성
  const ttm: TransactionTermsManifest = {
    ttmVersion: '2.0',
    intentId: 'intent_1',
    merchantId: invoice.merchantId,
    buyerId: 'buyer_1',
    lineItems: [
      {
        itemType: 'digital',
        itemRef: 'sku_pro_001',
        quantity: '1',
        unit: 'license',
        unitPrice: '50000',
        amount: '50000',
      },
    ],
    totalAmount: '50000',
    currency: 'KRW',
    maxAllowedAmount: '50000',
    expiresAt: invoice.expiry,
    idempotencyKey: 'idem_1',
    policy: {},
    termsVersion: 'v1',
  };

  // 5) 인증 요청 생성 + WebAuthn 결과 검증
  const request = buildVerificationRequest(invoice, ttm);
  const verification = await verifyBiometricAssertion(
    request,
    {credential: 'webauthn-assertion'},
    {
      verify: async (req) => ({
        signerDeviceId: 'device_1',
        signedAt: new Date().toISOString(),
        ttmHash: req.ttmHash,
      }),
    },
  );

  if (!verification.approved) {
    throw new Error('사용자 인증 실패');
  }

  // 6) 정산 증명 검증
  const proof = {
    txHash: '0xabc',
    chainId: 'base-mainnet',
    payer: '0x111',
    payee: '0x222',
    amount: 50000,
    confirmedAt: new Date().toISOString(),
    proofType: 'transfer',
  };
  await verifySettlementProof(proof, {
    verifyProof: async () => true,
  });

  // 7) 주문 확정 데이터 생성
  const confirmation = mapProofToOrderConfirmation(proof, invoice);
  console.log('주문 확정:', confirmation);
}

run().catch(console.error);
```

## 코드 이해 포인트

- `parse402Header`: 헤더에서 최소 결제 요구 읽기
- `fetchInvoice`: 서버 인보이스를 직접 조회
- `validateInvoiceSignature`: 위변조 방지를 위한 신뢰 검증
- `buildVerificationRequest`: WebAuthn에 전달할 요청 생성
- `verifyBiometricAssertion`: 사용자가 정말 승인했는지 확인
- `verifySettlementProof`: 온체인 증명 확인
- `mapProofToOrderConfirmation`: 최종 주문 상태로 매핑

## 다음 학습 추천

- 구조를 이해하려면 [핵심 개념](/docs/getting-started/core-concepts)
- 실제 운영형 구조는 [단계별 가이드](/docs/guides/payment-flow-overview)
