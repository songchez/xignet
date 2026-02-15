---
title: API 개요
---

# API 개요

SDK는 4개 모듈로 나뉩니다.

```ts
import {
  // protocol
  parse402Header,
  parsePaymentRequiredHeader,
  adaptLegacyToV2Canonical,
  fetchInvoice,
  validateInvoiceSignature,

  // verification
  buildVerificationRequest,
  verifyBiometricAssertion,
  computeTtmHash,

  // settlement
  verifySettlementProof,
  executeSettlement,
  createInMemorySettlementReplayStore,
  mapProofToOrderConfirmation,

  // errors
  ProtocolCompatibilityError,
  VerificationDeclinedError,
} from '@xignet/x402-sdk';
```

## 모듈별 책임

| 모듈 | 책임 | 대표 함수 |
| --- | --- | --- |
| `protocol` | 헤더/인보이스 해석, 호환성 검증 | `parse402Header`, `parsePaymentRequiredHeader` |
| `verification` | 사용자 동의/인증 처리 | `buildVerificationRequest`, `verifyBiometricAssertion` |
| `settlement` | 정산 증명, 재시도, 멱등성 | `executeSettlement`, `verifySettlementProof` |
| `errors` | 도메인 오류 타입 | `ProtocolCompatibilityError` 등 |

## 추천 사용 패턴

1. `protocol`로 결제 요구를 먼저 정리
2. `verification`으로 사용자 승인 증명
3. `settlement`로 결제 완료와 주문 확정
4. `errors`로 단계별 오류 처리 분기

세부 시그니처는 아래 문서를 참고하세요.

- [Protocol API](./protocol-api.md)
- [Verification API](./verification-api.md)
- [Settlement API](./settlement-api.md)
- [Types](./types.md)
- [Errors](./errors.md)
