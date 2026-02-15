# RFC-001: x402 Payment Requirement Lifecycle (v2 Baseline)

## 목적
Discovery 단계에서 AI 텍스트가 아닌 서버 발행 결제 요구(payload)를 신뢰 원천으로 고정한다.

## Contract
1. 클라이언트가 보호 리소스 호출
2. 서버는 `402 Payment Required`와 함께 `PAYMENT-VERSION: 2`, `PAYMENT-REQUIRED: <base64url>` 헤더를 반환
3. 클라이언트는 `PAYMENT-REQUIRED`를 디코딩해 `accepts[]` 항목을 검증
4. 클라이언트는 선택한 결제 스킴으로 서명된 payment payload를 생성해 `PAYMENT-SIGNATURE` 헤더로 재요청
5. 서버/Facilitator가 결제 유효성을 검증하고 정산 후 리소스를 반환

## v2 핵심 필드
- `x402Version`
- `accepts[]`
- `accepts[].scheme`
- `accepts[].network` (CAIP-2)
- `accepts[].maxAmountRequired`
- `accepts[].payTo`
- `accepts[].resource`
- `accepts[].asset`

## 호환 정책
- v2를 표준으로 채택한다.
- v1(`X-PAYMENT`)과 기존 `L402/WWW-Authenticate`는 compatibility adapter에서만 허용한다.
- 문서별 헤더 표기 차이(`PAYMENT`, `PAYMENT-SIGNATURE`)는 릴리즈별 matrix 테스트로 관리한다.

## 오류 규약
- 필수 필드 누락/포맷 오류: `ProtocolCompatibilityError`
- 만료: `InvoiceExpiredError`
