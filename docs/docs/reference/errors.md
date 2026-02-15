---
title: 오류 타입
---

# 오류 타입

SDK는 단계별 오류를 구분하기 위해 도메인 오류 클래스를 제공합니다.

## `ProtocolCompatibilityError`

형식/스키마/필수 필드 문제

대표 상황:

- 잘못된 헤더 형식
- 필수 필드 누락
- x402 버전 불일치

## `InvoiceExpiredError`

인보이스 만료 시간 경과

## `InvoiceSignatureInvalidError`

인보이스 서명 검증 실패

## `VerificationDeclinedError`

사용자 인증 실패 또는 검증 결과 부적합

대표 상황:

- verifier가 null 반환
- 요청/응답 `ttmHash` 불일치
- consent receipt 검증 실패

## `SettlementProofInvalidError`

정산 증명 검증 실패 또는 정산 처리 실패

대표 상황:

- `verifyProof`가 false
- facilitator settle 실패
- finality 검증 실패

## 권장 처리 방식

```ts
try {
  // ...payment flow
} catch (error) {
  if (error instanceof ProtocolCompatibilityError) {
    // 입력/프로토콜 문제
  } else if (error instanceof VerificationDeclinedError) {
    // 사용자 승인 실패
  } else if (error instanceof SettlementProofInvalidError) {
    // 정산 실패
  } else {
    // 예외 케이스
  }
}
```

운영 로그에는 `error.name`과 함께 `invoiceId`, `intentId`, `idempotencyKey`를 항상 같이 남기세요.
