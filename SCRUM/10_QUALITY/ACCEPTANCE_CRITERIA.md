# Acceptance Criteria

## AC-1 Discovery
- 402 header에서 invoice URL 필수 추출 성공
- v2 `PAYMENT-REQUIRED` 파싱에서 필수 필드/형식 오류는 fail-closed로 차단
- conformance matrix에서 legacy(v1/L402)와 v2 케이스를 분리 관리

## AC-2 Verification
- verification request 생성 및 declined 경로 예외 처리
- `ttmHash`는 `RFC 8785 (JCS) + SHA-256(hex lowercase)` 규칙을 만족해야 함
- consent receipt 최소 스키마 위반 시 fail-closed
- WebAuthn `ttmHash` binding 불일치 시 fail-closed

## AC-3 Settlement
- proof 검증 실패 시 주문 확정 미생성
- 동일 `idempotencyKey` 재시도는 동일 결과 반환
- 정책 미설정 시 fail-closed 동작(결제 중단)
- facilitator verify/settle 호출에는 `idempotencyKey`, `ttmHash`가 필수 전달
- settlement 실패 reason은 수동 runbook 판단 입력으로 전파
- finality threshold 값은 SDK 하드코딩 없이 정책 주입/외부 처리

## AC-4 Governance
- CI 필수 게이트 전부 성공해야 병합 가능
- 운영 파라미터는 policy id 기반 주입으로 관리되어야 함
- D-001~D-013 결정 항목은 `tests/contract/sdk-contract.test.ts` 또는 `tests/contract/conformance-matrix.contract.test.ts`에서 최소 1개 이상 회귀 시나리오를 가진다.
- `npm run test:contract`가 CI에서 실행되어 Phase 2 contract 회귀를 차단한다.
