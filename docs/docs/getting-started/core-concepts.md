---
title: 핵심 개념
---

# 핵심 개념

이 문서는 SDK를 "왜 이렇게" 사용해야 하는지 이해하는 데 초점을 둡니다.

## 1) Discovery: "무엇을 결제해야 하는가"

- 서버가 응답으로 결제 요구를 보냅니다.
- 클라이언트는 요구를 파싱하고 정상 형식인지 확인합니다.
- 인보이스를 조회해 만료/서명 유효성을 검증합니다.

핵심 함수:

- `parse402Header` (legacy L402)
- `parsePaymentRequiredHeader` (x402 v2)
- `fetchInvoice`
- `validateInvoiceSignature`

## 2) Verification: "누가 승인했는가"

- 사용자가 볼 거래 조건(TTM)을 만듭니다.
- TTM 해시를 계산하고 WebAuthn 요청에 결합합니다.
- 인증 결과가 같은 `ttmHash`를 가리키는지 검증합니다.

핵심 함수:

- `buildVerificationRequest`
- `computeTtmHash`
- `verifyBiometricAssertion`
- `validateConsentReceipt`

## 3) Settlement: "정산이 실제로 완료되었는가"

- 온체인 결제 증명을 검증합니다.
- 필요하면 facilitator 어댑터와 함께 재시도/타임아웃/파이널리티 검사를 수행합니다.
- 주문 확정 객체로 변환해 비즈니스 시스템에 반영합니다.

핵심 함수:

- `verifySettlementProof`
- `executeSettlement`
- `mapProofToOrderConfirmation`

## 꼭 이해해야 하는 보안 포인트

### TTM Hash 바인딩

`ttmHash`는 "사용자가 무엇에 동의했는지"를 고정하는 기준값입니다.

- Verification 단계에서 해시가 다르면 즉시 실패
- Settlement 단계에서 같은 해시를 사용해야 안전

### Idempotency Key

같은 요청이 중복으로 들어와도 결제가 두 번 처리되지 않도록 보장합니다.

- `executeSettlement`는 replay store를 통해 재실행을 제어
- 같은 키로 다른 요청을 보내면 충돌 오류 발생

### Fail Closed 정책

정책 참조값(`policyRefs`)이 없으면 아예 실패 처리하는 모드입니다.

- 보안 우선 서비스에서 권장
- 옵션: `failClosedOnMissingPolicyRefs: true`

## 운영 시 추천 아키텍처

- 클라이언트: 헤더 파싱 + 인증 UI 트리거
- API 서버: 인보이스 검증 + TTM 생성 + 정산 orchestration
- 보안/인증 서비스: WebAuthn 검증
- 결제 네트워크 연동 서비스: settlement proof / finality 검증

다음 문서에서 단계별로 실제 코드를 자세히 살펴봅니다.
