# App Integration Decisions Snapshot

## 목적
앱 적용 단계에서 확정된 핵심 의사결정(D-001~D-013)을 스크럼 문서 집합 안에서 빠르게 참조할 수 있도록 요약한다.

## 확정 원칙
1. `JCS(RFC 8785) + SHA-256(hex lowercase)`로 `ttmHash` 고정
2. 결제 경로 라운딩 금지, 내부 계산은 atomic integer(BigInt) 강제
3. 단위(unit)는 자유 문자열 허용, 의미 검증은 도메인 위임
4. 정책 충돌은 `deny-overrides` + deny-by-default
5. Facilitator timeout/retry 규칙은 표준 계약 제공, 운영값은 정책 주입
6. 주문 상태머신 분리(`created -> ... -> order_confirmed/failed/cancelled`)
7. 감사/런북/WebAuthn/finality/idempotency는 불변식만 고정, 운영값은 위임

## Delegation Boundary
- 플랫폼 강제:
  - 변조 차단(`ttmHash`), 승인 필수, 중복 방지 의미론, fail-closed
- 개발자/운영팀 위임:
  - retention 기간, WebAuthn 세부 옵션, finality threshold, runbook 절차, storage/TTL/scope

## 소스 문서
- 루트 상세 로그:
  - `APP_INTEGRATION_PLANNING_GAPS.md`
  - `APP_INTEGRATION_DECISIONS.md`
- 연관 RFC:
  - `SCRUM/06_RFC/RFC-005-transaction-terms-manifest.md`
  - `SCRUM/06_RFC/RFC-003-settlement-proof-model.md`
