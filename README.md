# XIGNET x402 SDK

`@xignet/x402-sdk`는 x402 결제 챌린지 기반 트랜잭션의 핵심 단계(Discovery, Verification, Settlement)를 TypeScript로 안전하게 구현하기 위한 라이브러리입니다.

## Security Model

- 신뢰 원천은 `402 Payment Required` 응답의 서버 발행 invoice 입니다.
- 최종 결제 동의는 분리된 모바일 검증 화면에서 수행됩니다.
- 생체인증(WebAuthn) 승인 결과와 온체인 결제 증명으로 주문 확정을 진행합니다.

## Package Scope (v0)

- `protocol`: x402 v2(`PAYMENT-REQUIRED`) 파싱, legacy(v1/L402) 호환, payload 검증
- `verification`: 모바일 검증 요청 모델 구성, assertion 검증 위임
- `settlement`: 온체인 결제 증명 검증 및 주문 확정 매핑
- `errors`: 도메인 전용 오류 타입

## Install

```bash
npm install @xignet/x402-sdk
```

## Quick Start

```ts
import {
  parse402Header,
  fetchInvoice,
  validateInvoiceSignature,
  buildVerificationRequest,
  verifyBiometricAssertion,
  verifySettlementProof,
  mapProofToOrderConfirmation,
  type TransactionTermsManifest
} from "@xignet/x402-sdk";

const challenge = parse402Header(
  'L402 invoice="https://gateway.example.com/invoices/iv_123", amount=50000, currency="KRW", merchant="Coupang"'
);

const invoice = await fetchInvoice(challenge);
const isTrusted = await validateInvoiceSignature(invoice, {
  verifyInvoiceSignature: async (payload) => payload.signature.length > 0
});

if (!isTrusted) throw new Error("Invalid invoice");

const ttm: TransactionTermsManifest = {
  ttmVersion: "2.0",
  intentId: "intent_1",
  merchantId: invoice.merchantId,
  buyerId: "buyer_1",
  lineItems: [
    {
      itemType: "digital",
      itemRef: "sku_pro_001",
      quantity: "1",
      unit: "license",
      unitPrice: "50000",
      amount: "50000"
    }
  ],
  totalAmount: "50000",
  currency: "KRW",
  maxAllowedAmount: "50000",
  expiresAt: invoice.expiry,
  idempotencyKey: "idem_1",
  policy: {},
  termsVersion: "v1"
};
const verificationReq = buildVerificationRequest(invoice, ttm);
const verification = await verifyBiometricAssertion(
  verificationReq,
  { credential: "webauthn-assertion" },
  {
    verify: async (request) => ({
      signerDeviceId: "device_1",
      signedAt: new Date().toISOString(),
      ttmHash: request.ttmHash
    })
  }
);

if (!verification.approved) throw new Error("Verification failed");

const proof = {
  txHash: "0xabc",
  chainId: "base-mainnet",
  payer: "0x111",
  payee: "0x222",
  amount: 50000,
  confirmedAt: new Date().toISOString(),
  proofType: "transfer"
};
const proofIsValid = await verifySettlementProof(
  proof,
  {
    verifyProof: async () => true
  }
);

if (proofIsValid) {
  const confirmation = mapProofToOrderConfirmation(proof, invoice);

  console.log(confirmation.orderId);
}
```

## Development

```bash
npm run typecheck
npm run lint
npm run test
npm run security
npm run build
```

## Scrum Documents

프로젝트 운영 문서는 `SCRUM/` 디렉토리에서 관리합니다.

핵심 문제정의와 기획 지침은 `SCRUM/00A_PROBLEM_DEFINITION_AND_PLANNING_PRINCIPLES.md`를 기준으로 합니다.
x402 아키텍처/설계 철학 기준은 `SCRUM/06_RFC/RFC-004-x402-architecture-and-design-philosophy.md`를 기준으로 합니다.
거래 조건 표준(TTM/CR/SR)은 `SCRUM/06_RFC/RFC-005-transaction-terms-manifest.md`를 기준으로 합니다.
