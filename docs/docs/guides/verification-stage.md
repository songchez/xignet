---
title: Verification 단계
---

# Verification 단계

Verification의 목표는 "사용자가 이 거래 조건을 실제로 승인했는지"를 증명하는 것입니다.

## 1) TTM 준비

`TransactionTermsManifest`는 사용자가 동의하는 계약 문서입니다.

```ts
import type {TransactionTermsManifest} from '@xignet/x402-sdk';

const ttm: TransactionTermsManifest = {
  ttmVersion: '2.0',
  intentId: 'intent_001',
  merchantId: invoice.merchantId,
  buyerId: 'buyer_001',
  lineItems: [
    {
      itemType: 'digital',
      itemRef: 'sku_001',
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
  idempotencyKey: 'idem_001',
  policy: {},
  termsVersion: 'v1',
};
```

## 2) 인증 요청 생성

```ts
import {buildVerificationRequest} from '@xignet/x402-sdk';

const request = buildVerificationRequest(invoice, ttm, {
  failClosedOnMissingPolicyRefs: false,
});
```

결과에 포함되는 값:

- `challenge`: `ttmHash`
- `displayText`: 사용자에게 보여줄 결제 문구
- `webauthnOptions.challengeBinding = "ttmHash"`

## 3) WebAuthn 검증 결과 확인

```ts
import {verifyBiometricAssertion} from '@xignet/x402-sdk';

const verification = await verifyBiometricAssertion(
  request,
  assertion,
  {
    verify: async () => ({
      signerDeviceId: 'device_1',
      signedAt: new Date().toISOString(),
      ttmHash: request.ttmHash,
    }),
  },
  {
    failClosedOnMissingPolicyRefs: false,
  },
);
```

SDK는 내부에서 아래를 강제합니다.

- 검증기가 `null` 반환 시 실패
- 반환된 `ttmHash`가 요청값과 다르면 실패
- 생성된 `ConsentReceipt` 스키마 검증

## 4) Settlement 전 검증 결과 고정

```ts
import {assertVerificationForSettlement} from '@xignet/x402-sdk';

const consentReceipt = assertVerificationForSettlement(verification, {
  invoiceId: invoice.invoiceId,
  termsVersion: ttm.termsVersion,
  ttmHash: request.ttmHash,
});
```

이 단계는 Settlement에서 잘못된 인증 결과가 섞이는 것을 막습니다.

## 실무 체크포인트

- 사용자에게 보여준 금액/통화와 TTM 내용이 정확히 같은지 확인
- 인증 시각(`signedAt`)과 결제 처리 시각 차이를 모니터링
- fail-closed 모드 활성화 여부를 보안 정책으로 명확히 정의
