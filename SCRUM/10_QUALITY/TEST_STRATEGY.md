# Test Strategy

## Unit Tests
- v2 parser 정상/비정상 포맷
- legacy(v1/L402) -> v2 변환
- invoice expiry/signature 경로
- verification/settlement 함수 단위 검증
- JCS canonicalization + SHA-256 해시 일치
- decimal -> atomic 변환 및 라운딩 금지(reject) 검증
- policy id 누락 시 fail-closed 경로 검증

## Contract Tests
- public API 에러/상태값 안정성
- 타입 계약 기반 회귀 방지
- x402 헤더 호환성(`PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE`, `X-PAYMENT`) 검증
- idempotency 의미론(동일 키 동일 결과) 검증
- finality/reorg hook 계약 검증
- runbook/recommendedAction 인터페이스 검증

## Conformance Matrix (v2 / legacy)
- `tests/contract/conformance-matrix.contract.test.ts`에서 `legacy(v1/L402)`와 `v2` 케이스를 분리 관리한다.
- `legacy(v1/L402)`는 canonical v2 변환 성공과 필수 필드 누락 실패를 검증한다.
- `v2(PAYMENT-REQUIRED)`는 base64url JSON 파싱 성공(`x402Version`, `accepts`, CAIP-2 정규화)과 필수 필드 누락/포맷 오류 실패를 함께 검증한다.
- CI는 `test:contract`와 conformance matrix 단독 실행을 모두 유지해 회귀 감지 범위를 고정한다.

## Phase 2 Decision Coverage (D-001~D-013)
- D-001: JCS+SHA-256 해시 결정성/hex 형식 검증 (`sdk-contract`, `conformance-matrix`)
- D-002: 정밀도 규칙(과학 표기 reject, implicit rounding 금지) 검증 (`sdk-contract`, `conformance-matrix`)
- D-003: unit taxonomy 자유 문자열 허용 계약 검증 (`sdk-contract`)
- D-004: 정책 deny-by-default/fail-closed 경로(외부 hook false) 검증 (`sdk-contract`)
- D-005: facilitator verify/settle 호출에 `idempotencyKey`/`ttmHash` 전달 계약 검증 (`sdk-contract`)
- D-006: verification declined 시 fail-closed 및 confirmation 미생성 검증 (`sdk-contract`)
- D-007: 운영 정책값은 `ttm.policy` 외부 주입 계약으로 처리되는지 검증 (`sdk-contract`)
- D-008: settlement receipt의 감사 연계 필드(`auditLogId`) 계약 검증 (`sdk-contract`)
- D-009: settle 실패 reason 전파(수동 runbook 에스컬레이션 입력) 검증 (`sdk-contract`)
- D-010: consent receipt 최소 스키마 위반 시 fail-closed 검증 (`sdk-contract`)
- D-011: WebAuthn `ttmHash` 바인딩 불일치 시 fail-closed 검증 (`sdk-contract`)
- D-012: finality 임계치 하드코딩 없이 proof timestamp 보존 계약 검증 (`sdk-contract`)
- D-013: 주입형 idempotency persistence adapter 의미론 검증 (`sdk-contract`)

## Future
- integration/e2e: gateway mock + facilitator mock + verifier mock + chain mock
