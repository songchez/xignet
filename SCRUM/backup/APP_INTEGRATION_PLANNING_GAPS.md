# App Integration Planning Gaps

이 문서는 현재 SDK를 실제 애플리케이션에 적용하기 전, 반드시 구체화해야 하는 기획 공백을 정리한 문서다.

## 상태 정의
- `OPEN`: 미결정
- `IN_DISCUSSION`: 논의 중
- `DECIDED`: 결정 완료

## 권한 경계 원칙 (Delegation First)
- 우리가 고정하는 것은 결제 안전 불변식(invariants)만이다.
- 운영 파라미터(보관기간, 재시도 횟수 세부값, 정책 카탈로그, 복구절차 세부)는 개발자/운영팀 설정으로 위임한다.
- SDK/표준은 기본적으로 `interface + validation boundary`를 제공하고, 값 자체는 외부 설정 주입을 우선한다.

## 1) TTM Canonicalization Standard
- Status: `DECIDED`
- Why:
  - `ttmHash`가 승인/정산/감사의 기준점이므로 정규화 규격 불일치 시 상호 검증 실패가 발생한다.
- Decision Needed:
  - JSON canonicalization 방식을 무엇으로 고정할지 (JCS/RFC 8785 vs 커스텀).
- Decision:
  - `RFC 8785 (JCS) + SHA-256(hex lowercase)`로 고정.
- Impact:
  - `src/verification.ts` 해시 구현, 서버/클라이언트/모바일 간 상호운용성.

## 2) Amount and Quantity Precision Rules
- Status: `DECIDED`
- Why:
  - fiat, token, content 과금 단위가 혼재되어 반올림 규칙 미정 시 과금 불일치가 발생한다.
- Decision Needed:
  - decimal string 표준, 통화/자산별 scale, rounding mode.
- Decision:
  - 결제 경로 라운딩은 금지한다.
  - 외부 입력/표시는 decimal string을 허용한다.
  - 내부 결제/검증 경로는 atomic integer string(BigInt)만 허용한다.
  - decimal -> atomic 변환은 통화/자산 scale(ISO-4217 exponent 또는 token decimals)에 의존한다.
  - scale 초과 소수점은 반올림/버림 없이 즉시 reject 한다.
  - 정합성은 `lineItem.amount == quantity * unitPrice`, `totalAmount == sum(lineItems)`, `totalAmount <= maxAllowedAmount`를 강제한다.

## 3) Unit Taxonomy Standard
- Status: `DECIDED`
- Why:
  - `ea/license/minute/token` 외 확장 단위를 어떻게 검증할지 필요하다.
- Decision Needed:
  - 기본 단위 사전 + 커스텀 단위 허용 정책.
- Decision:
  - 단위(unit)는 완전 자유 문자열로 허용한다.
  - 단위 의미 검증은 서비스/상품 도메인에서 수행한다.
  - SDK 레벨에서는 단위 문자열의 존재(비어있지 않음)만 검증한다.

## 4) Policy Engine Schema
- Status: `DECIDED`
- Why:
  - 사용자 통제 UX 핵심(한도/가맹점/시간/카테고리)이 스키마화되어야 한다.
- Decision Needed:
  - 정책 필드, 우선순위, 충돌 시 처리 규칙(deny-overrides 등).
- Decision:
  - 정책 충돌 시 `deny-overrides`를 적용한다.
  - 기본값은 `deny`이며, 명시적으로 허용된 경우만 실행한다.
  - 정책 평가는 다음 순서로 수행한다: 글로벌 -> 사용자 -> 세션/요청.
  - 평가 결과는 `allow | deny | reasonCode`로 남기고 감사 로그에 기록한다.

## 5) Legal Consent Artifact Scope
- Status: `DECIDED`
- Why:
  - CR의 법적 증빙력 확보를 위해 포함 필드 범위를 고정해야 한다.
- Decision Needed:
  - 관할, terms hash, displayed summary hash, consent text version 포함 여부.
- Decision:
  - 플랫폼은 최소 증빙 필드만 강제한다: `ttmHash`, `termsVersion`, `approvedAt`, `authMethod`, `signerContextRef`, `consentArtifactId`.
  - 법무/규제별 문구 및 관할 세부값은 개발자/운영팀 정책으로 위임한다.
  - SDK는 `legalPolicyId` 참조만 제공하고, 법적 문구/관할 값은 외부 정책 레지스트리에서 주입한다.
  - 최소 증빙 필드가 없으면 결제 진행을 차단한다.

## 6) WebAuthn Operational Policy
- Status: `DECIDED`
- Why:
  - 등록/복구/디바이스 분실 정책이 없으면 운영 단계에서 승인 체인이 깨진다.
- Decision Needed:
  - RP ID, UV 정책, resident key, recovery flow.
- Decision:
  - 플랫폼은 WebAuthn 검증 결과 계약(`approved`, `signerDeviceId`, `signedAt`, `ttmHash-bound`)만 강제한다.
  - RP ID, UV 옵션, authenticator 제한, 등록/복구/분실 정책은 개발자/운영팀으로 위임한다.
  - SDK는 `webauthnPolicyId` 참조를 제공하고 운영값은 외부 설정 주입으로 처리한다.
  - 정책 누락 시 `fail-closed` 모드(승인 거절)를 기본 지원한다.

## 7) Facilitator Integration Contract
- Status: `DECIDED`
- Why:
  - verify/settle 실패/재시도 규칙 미정 시 중복 결제 또는 유실 위험이 있다.
- Decision Needed:
  - timeout/retry/backoff, error mapping, idempotency header policy.
- Decision:
  - timeout은 `verify 3s`, `settle 8s`로 고정한다.
  - retry는 `verify 최대 2회`, `settle 최대 1회`로 제한한다.
  - backoff는 `exponential + jitter`를 사용한다.
  - 에러 매핑은 `4xx=reject(비재시도)`, `5xx/timeout=retry 후보`로 고정한다.
  - 모든 호출에 `idempotencyKey`, `ttmHash`, `intentId`를 필수 포함한다.

## 8) Settlement Finality and Reorg Policy
- Status: `DECIDED`
- Why:
  - 체인 확정성 기준 미정 시 주문 확정 후 롤백 리스크가 남는다.
- Decision Needed:
  - confirmations 기준, reorg 대응 상태 전이, 알림 정책.
- Decision:
  - 플랫폼은 finality 검증 인터페이스와 reorg 이벤트 처리 훅만 고정한다.
  - confirmations 수, reorg 감시 윈도우, 알림 임계치는 개발자/운영팀 정책으로 위임한다.
  - 확정 상태 이후 즉시 롤백 대신 `dispute_open` 처리 경로를 기본으로 한다.
  - SDK는 `finalityPolicyId` 기반 설정 주입 방식을 제공한다.

## 9) Idempotency Persistence Policy
- Status: `DECIDED`
- Why:
  - 현재 메모리 스토어는 운영환경에서 중복결제 방어에 불충분하다.
- Decision Needed:
  - 저장소 종류, TTL, key scope(user/merchant/intent), collision policy.
- Decision:
  - 플랫폼은 idempotency 의미론(동일 키 = 동일 결과)과 원자적 저장 계약(compare-and-set)을 강제한다.
  - 저장소 종류, TTL, key scope, 보존기간은 개발자/운영팀 정책으로 위임한다.
  - SDK는 persistence adapter 인터페이스만 제공하며 구현체는 애플리케이션이 주입한다.
  - 충돌/중복 케이스는 표준 reasonCode로 반환한다.

## 10) Order State Machine
- Status: `DECIDED`
- Why:
  - 상태 전이가 명확하지 않으면 운영/CS/회계 정합성이 깨진다.
- Decision Needed:
  - 상태 집합, 전이 조건, 재시도/보상 트랜잭션 규칙.
- Decision:
  - 상태는 다음 집합으로 고정한다:
    - `created`
    - `payment_required`
    - `approval_pending`
    - `approved`
    - `verify_pending`
    - `verified`
    - `settle_pending`
    - `settled`
    - `order_confirmed`
    - `failed`
    - `cancelled`
  - 종결 상태는 `order_confirmed`, `failed`, `cancelled`로 고정한다.
  - `approval_pending` 타임아웃은 `cancelled`로 전이한다.
  - `settle_pending`은 D-005 재시도 정책 소진 후 `failed`로 전이한다.
  - `order_confirmed` 이후 체인 이슈는 즉시 롤백하지 않고 후속 상태(`dispute_open`)로 관리한다(후속 RFC).

## 11) Audit Log and Retention Policy
- Status: `DECIDED`
- Why:
  - 분쟁 대응과 컴플라이언스를 위해 필수 로그와 보관기준이 필요하다.
- Decision Needed:
  - 필수 필드, 마스킹, 보관 기간, 접근 제어.
- Decision:
  - 감사 로그 필드 스키마/무결성 규칙은 플랫폼 표준으로 고정한다.
  - 보관기간 값(retention days/years)은 개발자/운영팀 정책으로 위임한다.
  - SDK는 `retentionPolicyId` 참조만 다루고, 정책 값은 외부 정책 레지스트리에서 조회한다.
  - 정책 미설정 환경에서는 경고 또는 배포 차단(운영 정책에 따름) 모드를 제공한다.

## 12) Failure and Manual Operations Runbook
- Status: `DECIDED`
- Why:
  - 부분 실패/지연 시 수동 개입 절차가 없으면 운영 장애가 장기화된다.
- Decision Needed:
  - 수동 settle, 환불, 재처리, 고객 커뮤니케이션 프로토콜.
- Decision:
  - 플랫폼은 실패 이벤트 코드 체계와 안전한 상태 전이 규칙만 고정한다.
  - Runbook 내용(수동 재처리, 환불, 고객 커뮤니케이션, 온콜/에스컬레이션)은 개발자/운영팀 정책으로 위임한다.
  - SDK는 실행 가이드 필드만 제공한다: `runbookPolicyId`, `manualActionRequired`, `recommendedAction`.
  - 종결 상태 이후 무단 재시도는 금지하며, 수동 조치는 운영 승인 체계 하에서만 수행한다.

## Priority for Next Discussion
1. Integration Hardening Checklist
2. RFC/Code Sync Backlog
3. Contract Test Expansion
4. Rollout and Migration Plan
5. Observability Dashboard Scope
6. Release Readiness Review
