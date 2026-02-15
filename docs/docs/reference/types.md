---
title: 주요 타입
---

# 주요 타입

이 페이지는 자주 사용하는 타입만 빠르게 정리합니다.

## Discovery 관련

- `X402Challenge`
- `PaymentRequirement`
- `InvoicePayload`

핵심 필드 예시:

```ts
interface InvoicePayload {
  invoiceId: string;
  merchantId: string;
  orderRef: string;
  totalAmount: number;
  currency: string;
  expiry: string;
  signature: string;
}
```

## Verification 관련

- `TransactionTermsManifest`
- `VerificationRequest`
- `VerificationResult`
- `ConsentReceipt`

핵심 포인트:

- 금액 계열은 문자열 필드가 많음 (`totalAmount`, `unitPrice`, `amount`)
- `ttmHash`는 문자열(64 hex)로 다룸

## Settlement 관련

- `SettlementProof`
- `SettlementExecutionResult`
- `SettlementReceipt`
- `OrderConfirmation`
- `SettlementReplayStore`

`SettlementReplayStore` 계약:

```ts
interface SettlementReplayStore {
  get(idempotencyKey: string): Promise<SettlementExecutionRecord | null>;
  set(idempotencyKey: string, record: SettlementExecutionRecord): Promise<void>;
}
```

## Adapter 인터페이스

- `AssertionVerifier`
- `InvoiceTrustStore`
- `SettlementProofProvider`
- `FacilitatorSettlementAdapter`

실무에서는 이 인터페이스 구현체가 서비스 품질을 결정합니다.
