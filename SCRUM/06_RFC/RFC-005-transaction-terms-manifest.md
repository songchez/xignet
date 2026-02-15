# RFC-005: Transaction Terms Manifest (TTM) Standard

## 목적
결제 대상/수량/금액/조건을 사람이 읽고 기계가 검증할 수 있는 단일 계약 포맷으로 고정한다.  
핵심 목표는 "AI 실행"과 "사용자 의도"를 강하게 바인딩하는 것이다.

## 범위
- x402 결제 프로토콜 위에서 동작하는 상위 도메인 표준
- Resource Server, Client SDK, Verifier, Facilitator 연동에 공통 적용

## 비범위
- 관할별 최종 법률 해석/자문
- 업종별 세부 필드의 전부를 본 RFC에서 고정하지 않음(확장 필드 사용)

## 핵심 개념
1. TTM (Transaction Terms Manifest)
- 결제 실행 전 확정되는 거래 조건 원문(JSON)
- 결제 대상, 수량, 단가, 총액, 정책, 만료, 중복방지 키를 포함

2. TTM Hash
- TTM 정규화(canonicalization) 후 계산되는 해시
- 승인/검증/정산/주문반영 전 단계에서 동일성 검증 기준

3. Consent Receipt (CR)
- 사용자가 어떤 TTM에 동의했는지 증빙하는 레코드
- WebAuthn assertion과 TTM Hash를 연결

4. Settlement Receipt (SR)
- 결제 검증/정산 결과 증빙 레코드
- Facilitator verify/settle 결과와 tx 식별자를 포함

## 표준 데이터 모델
### TTM 필수 필드 (MUST)
- `ttmVersion`: string
- `intentId`: string
- `merchantId`: string
- `buyerId`: string
- `lineItems`: array
- `totalAmount`: string (decimal string)
- `currency`: string (ISO 4217 또는 asset symbol)
- `maxAllowedAmount`: string (decimal string)
- `expiresAt`: string (ISO-8601)
- `idempotencyKey`: string
- `policy`: object
- `termsVersion`: string
- `policyRefs`: object
  - `legalPolicyId`: string
  - `webauthnPolicyId`: string
  - `retentionPolicyId`: string
  - `runbookPolicyId`: string
  - `finalityPolicyId`: string

### lineItems 필수 필드 (MUST)
- `itemType`: `physical` | `digital` | `content` | `token` | `service`
- `itemRef`: string
- `quantity`: string (decimal string)
- `unit`: string (자유 문자열, non-empty)
- `unitPrice`: string (decimal string)
- `amount`: string (decimal string)

### 확장 필드 (MAY)
- `metadata`
- `shipping`
- `fulfillment`
- `jurisdiction`
- `taxBreakdown`

## 정규화 및 해시 규칙
1. TTM canonicalization은 `RFC 8785 (JCS)`로 고정한다.
2. 해시는 `SHA-256(hex lowercase)`를 사용해 `ttmHash`를 계산한다.
3. `ttmHash`는 CR/SR/감사로그의 공통 참조 키로 사용한다.

## 금액/수량 정밀도 규칙
1. 외부 입력/표시는 decimal string을 허용한다.
2. 내부 결제/검증은 atomic integer string(BigInt)만 사용한다.
3. decimal -> atomic 변환은 통화/자산 scale(ISO-4217 exponent 또는 token decimals) 기준으로 수행한다.
4. 결제 경로 라운딩은 금지하며, scale 초과 소수점은 즉시 reject 한다.
5. 정합성 불변식:
- `lineItem.amount == quantity * unitPrice`
- `totalAmount == sum(lineItems.amount)`
- `totalAmount <= maxAllowedAmount`

## x402 연계 규칙
1. 서버가 `402 + PAYMENT-REQUIRED`를 반환하면 클라이언트는 해당 결제 요구를 TTM과 대조한다.
2. TTM과 결제 요구가 불일치하면 결제 진행을 중단한다.
3. 사용자 승인(WebAuthn)은 `ttmHash`를 포함한 challenge에 서명해야 한다.
4. Facilitator verify/settle 전후로 `ttmHash`가 보존되는지 검증한다.

## 보안 규칙
1. 승인 우회 금지: CR 없이는 settle/order-confirm 금지
2. 의도 무결성: `lineItems/totalAmount/maxAllowedAmount` 불일치 시 즉시 실패
3. 사칭 방지: 강한 인증(WebAuthn) 결과와 signer context를 기록
4. 중복 방지: 동일 `idempotencyKey` 재실행 차단
5. 실패 기본값: 불확실 상태에서는 결제 중단/주문 미생성

## 법적/감사 증빙 규칙
1. CR에는 최소 `ttmHash`, `approvedAt`, `authMethod`, `termsVersion`, `signerContextRef`, `consentArtifactId` 포함
2. SR에는 최소 `verifyResult`, `settleResult`, `txHash(or equivalent)` 포함
3. 감사로그는 `who/what/how-much/when/why(approval basis)`를 복원 가능해야 한다.

## 권한 경계 규칙 (Delegation First)
1. 플랫폼은 불변식 검증(변조 차단, 승인 필수, 중복 방지)만 강제한다.
2. 운영값(보관기간, WebAuthn 세부 옵션, finality threshold, runbook 절차)은 정책 ID 기반 외부 설정으로 위임한다.
3. 정책값 누락 시 SDK는 `fail-closed`(결제 중단) 모드를 제공해야 한다.

## 수용 기준
1. TTM이 없으면 결제 요청을 허용하지 않는다.
2. TTM Hash 불일치 시 결제를 차단한다.
3. CR/SR이 모두 존재해야 주문을 `confirmed` 상태로 전이한다.
4. 동일 idempotency key 재시도는 동일 결과를 반환한다.

## 테스트 시나리오
1. 1개 상품 intent를 100개로 변조 시도 -> hash mismatch로 차단
2. 승인 없는 settle 시도 -> 거절
3. 동일 idempotency key 재전송 -> 중복 결제 없음
4. 토큰 소수점 수량(`0.015`) 처리 -> 금액 정합성 유지
5. termsVersion 변경 후 구버전 CR 제출 -> 정책에 따라 거절 또는 재승인 요구
