# Domain Study Log

## 사용 규칙
- 모든 구현 작업은 시작 전에 아래 템플릿으로 1개 항목을 추가한다.
- 항목 제목은 `YYYY-MM-DD / 작업명 / 담당 스쿼드` 형식을 따른다.

## 템플릿
### YYYY-MM-DD / 작업명 / 담당 스쿼드
- Scope:
- Problem Link (1~6):
- Target x402 Version: v2 / legacy compatibility

- Source Review
1. https://docs.cdp.coinbase.com/x402/docs/welcome
   - 핵심 포인트:
2. https://docs.cdp.coinbase.com/x402/docs/core-concepts
   - 핵심 포인트:
3. https://docs.cdp.coinbase.com/x402/docs/troubleshooting#x402-facilitator-v2-migration-guide
   - 핵심 포인트:
4. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-verify
   - 핵심 포인트:
5. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-settle
   - 핵심 포인트:
6. https://www.x402.org/docs/whitepaper/
   - 핵심 포인트:
7. https://github.com/coinbase/x402
   - 핵심 포인트:

- Architecture Notes:
- Protocol Notes:
- Risk Notes:
- Test Impact:

### 2026-02-15 / P2-D-001~013 contract-docs sync / Squad D
- Scope: D-001~D-013 결정사항을 contract 테스트 매트릭스/품질 문서/CI 게이트에 반영하고 불일치 제거
- Problem Link (1~6): 1, 2, 3, 5, 6
- Target x402 Version: v2 / legacy compatibility

- Source Review
1. https://docs.cdp.coinbase.com/x402/docs/welcome
   - 핵심 포인트: x402는 machine-readable 계약 기반으로 해석 불일치를 줄여 결제 안전성을 높인다.
2. https://docs.cdp.coinbase.com/x402/docs/core-concepts
   - 핵심 포인트: Resource Server/Client/Facilitator 경계별 계약 검증이 필요하며 테스트는 경계마다 분리되어야 한다.
3. https://docs.cdp.coinbase.com/x402/docs/troubleshooting#x402-facilitator-v2-migration-guide
   - 핵심 포인트: migration 단계에서 v2 표준 경로와 legacy 호환 경로를 병행 검증해야 한다.
4. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-verify
   - 핵심 포인트: verify 입력/응답 계약 안정성이 승인 우회와 재시도 오류를 줄인다.
5. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-settle
   - 핵심 포인트: settle은 idempotency 및 실패 처리 규칙이 명확해야 중복 결제를 차단할 수 있다.
6. https://www.x402.org/docs/whitepaper/
   - 핵심 포인트: 에이전트 결제 환경에서 결정적 계약과 감사 가능성이 핵심 신뢰 요건이다.
7. https://github.com/coinbase/x402
   - 핵심 포인트: 레퍼런스 구현은 v2 우선/legacy 호환 분리 및 계약 테스트 중심 접근을 따른다.

- Architecture Notes:
  Squad D 범위는 SDK 내부 구현 수정이 아니라 공개 계약 경계(프로토콜 파싱/검증/정산 인터페이스)를 contract 테스트로 고정하는 역할이다.
- Protocol Notes:
  v2(`PAYMENT-REQUIRED`) 파싱 성공/실패 규칙, legacy(L402) canonical 변환 규칙, verification fail-closed, settlement idempotency/finality 훅 계약을 테스트로 고정한다.
- Risk Notes:
  1) D-001~013 결정이 테스트에 반영되지 않으면 회귀 시 안전 불변식이 깨질 수 있음 -> 결정별 contract 케이스 추가.
  2) 문서-테스트 불일치 시 운영 판단 오류 발생 -> TEST_STRATEGY/ACCEPTANCE_CRITERIA 동기화.
  3) CI에서 신규 계약이 누락되면 병합 전 검출 실패 -> contract matrix 실행 단계 유지.
- Test Impact:
  `tests/contract/sdk-contract.test.ts`, `tests/contract/conformance-matrix.contract.test.ts`에 D-001~D-013 매핑 케이스를 추가하고 `npm run test:contract`에서 검증한다.

### 2026-02-15 / FEAT-403 x402 conformance matrix(v2/legacy) / Squad D
- Scope: `tests/contract`에 v2/legacy 분리 conformance 매트릭스 초안 추가, CI contract 게이트 강화, 테스트 전략 문서 동기화
- Problem Link (1~6): 1, 2, 5
- Target x402 Version: v2 / legacy compatibility

- Source Review
1. https://docs.cdp.coinbase.com/x402/docs/welcome
   - 핵심 포인트: x402는 HTTP 402 기반 결제 표준이며 에이전트-친화적 machine-readable 결제 요구를 중심으로 동작한다.
2. https://docs.cdp.coinbase.com/x402/docs/core-concepts
   - 핵심 포인트: Resource Server / Client / Facilitator 분리와 payment requirement -> payment response 흐름이 핵심 계약이다.
3. https://docs.cdp.coinbase.com/x402/docs/troubleshooting#x402-facilitator-v2-migration-guide
   - 핵심 포인트: v2 마이그레이션 시 헤더/필드 변경점과 legacy 호환 경계를 명시적으로 관리해야 한다.
4. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-verify
   - 핵심 포인트: verify 단계는 결제 payload의 유효성 확인과 거절 사유의 표준화된 반환이 중요하다.
5. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-settle
   - 핵심 포인트: settle 단계는 검증 완료 후 정산 증빙을 생성하며 idempotent 처리와 재시도 안전성이 필요하다.
6. https://www.x402.org/docs/whitepaper/
   - 핵심 포인트: 개방형 결제 상호운용성과 에이전트 환경에서의 신뢰 가능한 결제 계약이 설계 원칙이다.
7. https://github.com/coinbase/x402
   - 핵심 포인트: 레퍼런스 구현/예제를 통해 헤더 및 결제 플로우 호환성 테스트 항목을 실무적으로 검증할 수 있다.

- Architecture Notes:
  Resource Server는 `402`와 결제 요구를 발행하고, Client는 요구 해석/응답 제출을 수행하며, Facilitator는 verify/settle를 담당한다. conformance 매트릭스는 이 중 Client SDK의 헤더 계약 해석 경계를 검증한다.
- Protocol Notes:
  신규 기준은 v2(`PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE`)이며 legacy(v1/L402, `X-PAYMENT`)는 호환 계층으로 분리 관리한다. 이번 초안은 테스트를 v2/legacy 케이스로 분리해 지원/비지원 경계를 명시한다.
- Risk Notes:
  1) v2/legacy 헤더 혼용 시 오파싱으로 잘못된 결제 흐름이 발생할 수 있음 -> 매트릭스 테스트로 조기 감지.
  2) CI에서 contract 범위 누락 시 회귀가 main에 유입될 수 있음 -> CI 전용 conformance 단계 추가.
  3) 문서와 실제 테스트 케이스 불일치 시 운영 판단 오류가 발생할 수 있음 -> TEST_STRATEGY 동기화.
- Test Impact:
  `tests/contract`에 conformance matrix 테스트를 추가하고 CI에서 contract + matrix를 함께 검증한다.

### 2026-02-15 / FEAT-403 conformance matrix follow-up(v2 implemented) / Squad D
- Scope: 타 모듈 구현 반영 여부 재검증 후 conformance matrix를 v2/legacy 실제 지원 계약으로 재정렬
- Problem Link (1~6): 1, 2, 5
- Target x402 Version: v2 / legacy compatibility

- Source Review
1. https://docs.cdp.coinbase.com/x402/docs/welcome
   - 핵심 포인트: x402는 machine-readable 결제 계약을 통해 파싱 오해를 줄이는 것이 핵심이다.
2. https://docs.cdp.coinbase.com/x402/docs/core-concepts
   - 핵심 포인트: v2 payment requirement 해석과 legacy 호환 계층을 분리해 관리해야 한다.
3. https://docs.cdp.coinbase.com/x402/docs/troubleshooting#x402-facilitator-v2-migration-guide
   - 핵심 포인트: migration 기간에는 v2 정상 경로 + legacy 호환 경로를 동시에 테스트해야 한다.
4. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-verify
   - 핵심 포인트: verify 이전 입력 계약이 안정적이어야 결제 승인 실패 원인을 추적할 수 있다.
5. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-settle
   - 핵심 포인트: settle 단계의 안전성은 선행 계약 검증(파싱/검증) 신뢰도에 의존한다.
6. https://www.x402.org/docs/whitepaper/
   - 핵심 포인트: 표준 계약 기반 상호운용성은 구현 간 conformance 테스트로 보장해야 한다.
7. https://github.com/coinbase/x402
   - 핵심 포인트: 레퍼런스 구현도 v2 우선 + 호환 계층 분리를 권장한다.

- Architecture Notes:
  SDK 경계에서 `parsePaymentRequiredHeader`(v2)와 `adaptLegacyToV2Canonical`(legacy)을 분리 테스트해 지원/비지원이 아닌 정상/실패 계약으로 검증한다.
- Protocol Notes:
  v2는 `PAYMENT-REQUIRED` base64url JSON 파싱 성공을 기준으로, legacy는 `WWW-Authenticate/L402`를 canonical v2 구조로 변환하는 경로를 기준으로 관리한다.
- Risk Notes:
  1) 구현 완료 후에도 매트릭스가 비지원 기준에 머무르면 회귀 감지가 왜곡됨 -> 테스트 기대값 갱신.
  2) 문서가 기존 비지원 문구를 유지하면 운영 판단 오류 가능 -> 전략 문서 동기화.
  3) legacy/v2 분리 기준이 흐려지면 호환성 버그 추적이 어려움 -> describe/케이스 테이블 분리 유지.
- Test Impact:
  conformance matrix의 v2 블록을 성공 경로 + 실패 경로로 전환하고 CI 실행 게이트를 유지한다.

### 2026-02-15 / FEAT-101-102-104-105 Protocol SDK / Squad A
- Scope:
  - FEAT-101: x402 v2 `PAYMENT-REQUIRED` parser
  - FEAT-102: legacy(v1/L402) -> v2 canonical adapter
  - FEAT-104: CAIP-2 network normalization
  - FEAT-105: TTM hash validation hook
- Problem Link (1~6): 1, 2, 5
- Target x402 Version: v2 / legacy compatibility

- Source Review
1. https://docs.cdp.coinbase.com/x402/docs/welcome
   - 핵심 포인트: x402는 HTTP `402` 기반 결제 표준이며 v2 헤더 중심으로 기계 판독 가능한 결제 요구를 전달한다.
2. https://docs.cdp.coinbase.com/x402/docs/core-concepts
   - 핵심 포인트: Resource Server / Client / Facilitator 역할 분리가 핵심이며 verify/settle 경계가 명확해야 한다.
3. https://docs.cdp.coinbase.com/x402/docs/troubleshooting#x402-facilitator-v2-migration-guide
   - 핵심 포인트: v1/L402에서 v2(`PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`)로의 헤더/필드 전환과 호환 계층이 필요하다.
4. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-verify
   - 핵심 포인트: verify 단계에서 payment payload 유효성 확인과 결과 증빙 구조를 안정적으로 처리해야 한다.
5. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-settle
   - 핵심 포인트: settle 단계는 검증 이후 정산 증빙을 반환하며 idempotent 처리와 상태 일관성이 중요하다.
6. https://www.x402.org/docs/whitepaper/
   - 핵심 포인트: 프로토콜 상호운용성과 에이전트 친화적 기계판독 계약이 설계 목표다.
7. https://github.com/coinbase/x402
   - 핵심 포인트: reference 구현은 v2 우선 구조와 legacy 호환 분리를 권장한다.

- Architecture Notes:
  - SDK protocol 레이어에서 v2 canonical 모델을 생성해 상위 verification/settlement 모듈에 전달한다.
  - legacy 입력은 adapter로만 수용하고 코어 타입은 v2 기준으로 유지한다.
  - TTM hash 검증 포인트는 protocol 단계 hook으로 노출해 verify/settle 전 무결성 체크를 가능하게 한다.

- Protocol Notes:
  - v2 필수 헤더: `PAYMENT-VERSION: 2`, `PAYMENT-REQUIRED: <base64url-json>`.
  - 필수 검증 필드: `x402Version`, `accepts[].scheme/network/maxAmountRequired/payTo/resource/asset`.
  - legacy(`WWW-Authenticate`, `L402`, v1 스타일`)는 canonical `PAYMENT-REQUIRED` 구조로 변환한다.
  - network는 CAIP-2 형식(`namespace:reference`)으로 정규화하고 잘못된 포맷은 즉시 에러 처리한다.

- Risk Notes:
  - 잘못된 amount 파싱 시 과/소결제 리스크: decimal string 검증과 숫자 변환 실패 시 명시적 예외 처리.
  - network 오정규화 시 잘못된 체인 결제 리스크: CAIP-2 강제 검증 및 legacy alias 매핑 제한.
  - TTM hash 불일치 미검출 시 의도 변조 리스크: protocol hook에서 hash mismatch 즉시 중단.

- Test Impact:
  - unit: v2 파싱 성공/실패, legacy adapter, network normalization, ttm hash hook 검증.
  - contract: public API 호환성 및 에러 타입/메시지 안정성 확인.

### 2026-02-15 / FEAT-301~304 settlement contract hardening / Squad C
- Scope: facilitator verify adapter 계약 강화, settle->order confirmation 매핑 강화, idempotency/replay guard 계약 구현, Settlement Receipt(SR) 스키마 + 감사 연결
- Problem Link (1~6): 1, 5, 6
- Target x402 Version: v2 / legacy compatibility

- Source Review
1. https://docs.cdp.coinbase.com/x402/docs/welcome
   - 핵심 포인트: x402는 HTTP 402 기반 결제 흐름을 표준화하며 서버 발행 결제 요구를 신뢰 원천으로 둔다.
2. https://docs.cdp.coinbase.com/x402/docs/core-concepts
   - 핵심 포인트: Resource Server / Client / Facilitator 역할 분리가 핵심이며 verify와 settle을 분리된 단계로 다룬다.
3. https://docs.cdp.coinbase.com/x402/docs/troubleshooting#x402-facilitator-v2-migration-guide
   - 핵심 포인트: v2 헤더/필드 정합성이 마이그레이션 안정성의 핵심이며 어댑터 계층에서 호환을 흡수해야 한다.
4. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-verify
   - 핵심 포인트: verify 결과는 결제 승인 가능 여부와 사유를 기계가 검증 가능한 계약으로 반환해야 한다.
5. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-settle
   - 핵심 포인트: settle 결과는 트랜잭션 증빙 식별자와 상태를 포함해야 하며 후속 주문 확정 근거가 된다.
6. https://www.x402.org/docs/whitepaper/
   - 핵심 포인트: 에이전트 친화적 machine-readable 결제 계약과 재실행 안전성이 운영 신뢰성의 핵심이다.
7. https://github.com/coinbase/x402
   - 핵심 포인트: 레퍼런스 구현은 검증/정산 인터페이스와 오류 경계를 명시적으로 분리한다.

- Architecture Notes: settlement 모듈은 facilitator verify/settle 응답을 검증 후 주문 확정 모델로 매핑하는 경계 계층으로 유지한다.
- Protocol Notes: v2 기본 흐름에서 verify 실패, settle 실패, 성공 경로를 명시적으로 분기하고 SR을 감사 가능한 최소 필드 집합으로 강제한다.
- Risk Notes:
  1. 동일 idempotencyKey 재요청 시 중복 확정 위험 -> replay guard로 차단
  2. verify 응답 계약 불일치 시 무단 settle 위험 -> 필수 필드/상태 검증 실패 처리
  3. SR 필수 필드 누락 시 감사 불가 위험 -> strict schema 검증으로 실패 처리
- Test Impact: unit/contract 테스트에서 verify 실패/settle 실패/성공 분기, replay 차단, SR 스키마 검증을 추가한다.

### 2026-02-15 / FEAT-201-FEAT-203 Verification-CR 결합 / Squad B
- Scope: VerificationRequest를 TTM/ttmHash 중심으로 확장하고, Consent Receipt 스키마/검증을 추가해 approve->settle 경로를 강결합한다.
- Problem Link (1~6): 1, 3, 4
- Target x402 Version: v2 / legacy compatibility

- Source Review
1. https://docs.cdp.coinbase.com/x402/docs/welcome
   - 핵심 포인트: x402는 HTTP-native 402 결제 흐름이며 리소스 서버/클라이언트/facilitator 역할 분리가 전제다.
2. https://docs.cdp.coinbase.com/x402/docs/core-concepts
   - 핵심 포인트: payment requirement/response를 machine-readable 계약으로 처리해야 하며 검증과 정산 단계를 분리한다.
3. https://docs.cdp.coinbase.com/x402/docs/troubleshooting#x402-facilitator-v2-migration-guide
   - 핵심 포인트: v2 헤더/필드 기준으로 통일하고 legacy는 호환 계층에서만 수용한다.
4. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-verify
   - 핵심 포인트: verify는 payment payload 유효성 검증 단계이며 정산 전 결과를 안전하게 소비해야 한다.
5. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-settle
   - 핵심 포인트: settle은 verify 이후 실행되며 선행 검증/승인 근거 없는 호출을 금지해야 한다.
6. https://www.x402.org/docs/whitepaper/
   - 핵심 포인트: 에이전트 환경에서 결제 의도 무결성과 감사 가능성이 핵심 요구사항이다.
7. https://github.com/coinbase/x402
   - 핵심 포인트: 레퍼런스 구현도 verify/settle 분리와 표준 계약 중심 모델을 유지한다.

- Architecture Notes: Verification Surface(WebAuthn)에서 생성된 승인 증빙(CR)이 Gateway의 settle 판단에 필수 입력으로 연결되어야 한다.
- Protocol Notes: v2 baseline(`PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE`)을 유지하고 CR/ttmHash는 상위 도메인 무결성 계층으로 결합한다.
- Risk Notes: (1) ttmHash 위조/불일치로 의도 변조 가능 (2) 승인 없는 settle 우회 가능성 (3) WebAuthn 결과와 승인 레코드 분리 시 사칭/재사용 리스크.
- Test Impact: unit(contract) 테스트에 hash mismatch, missing consent, 승인-정산 결합 위반 경로를 실패 케이스로 추가한다.

### 2026-02-15 / Phase2 D-005,D-009,D-012,D-013 settlement hardening / Squad C
- Scope: settle timeout/retry 옵션화, finality/reorg hook 계약 반영, idempotency persistence 의미론(동일 키 동일 결과) 강화, runbook 인터페이스(runbookPolicyId/manualActionRequired/recommendedAction) 반영
- Problem Link (1~6): 1, 5, 6
- Target x402 Version: v2 / legacy compatibility

- Source Review
1. https://docs.cdp.coinbase.com/x402/docs/welcome
   - 핵심 포인트: 결제 계약은 machine-readable 경계에서 실패를 명확히 분기해야 하며 애플리케이션 정책 주입이 필요하다.
2. https://docs.cdp.coinbase.com/x402/docs/core-concepts
   - 핵심 포인트: Resource Server/Client/Facilitator 분리 하에서 verify/settle 재시도/실패 처리는 경계 계층 계약으로 관리한다.
3. https://docs.cdp.coinbase.com/x402/docs/troubleshooting#x402-facilitator-v2-migration-guide
   - 핵심 포인트: 운영 파라미터는 하드코딩보다 외부 주입으로 관리하고, 호환 경계는 fail-closed를 기본으로 해야 한다.
4. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-verify
   - 핵심 포인트: verify 호출 실패/거절을 구분 가능한 계약으로 다뤄야 하며 후속 settle 조건이 명시되어야 한다.
5. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-settle
   - 핵심 포인트: settle 결과의 성공/실패 분기와 idempotent 재호출 의미론이 주문 확정 안정성의 핵심이다.
6. https://www.x402.org/docs/whitepaper/
   - 핵심 포인트: 에이전트 결제 환경에서 재실행 안전성(idempotency)과 운영 수동 개입(runbook) 경계가 중요하다.
7. https://github.com/coinbase/x402
   - 핵심 포인트: 레퍼런스 구현은 verify/settle 경계와 에러 표준화를 분리해 처리한다.

- Architecture Notes:
  settlement 레이어에서 facilitator 호출 정책(retry/timeout), idempotency persistence 계약, finality/reorg hook을 통합하고 실패 시 runbook 정보를 에러에 전달한다.
- Protocol Notes:
  v2 baseline 유지, legacy 호환 경로를 깨지 않으면서 옵션 제공 시 strict policy 검증(fail-closed)을 적용한다.
- Risk Notes:
  1) 동일 idempotencyKey 충돌 시 다른 요청이 재실행될 리스크 -> request fingerprint 비교로 충돌 차단
  2) finality 미검증 상태에서 조기 확정 리스크 -> finality hook 결과 검증 후 확정
  3) 운영 정책 누락 시 임의 기본값 동작 리스크 -> policy/option 누락 시 명시적 ProtocolCompatibilityError
- Test Impact:
  unit settlement 테스트에 retry/timeout 옵션 경로, finality/reorg callback, runbook 필드 전달, idempotency 충돌 차단, 옵션 누락 fail-closed를 추가한다.

### 2026-02-15 / Phase2 D-001 D-002 D-007 Protocol-Types 계약 반영 / Squad A
- Scope:
  - D-001: `ttmHash` 규칙(`JCS RFC8785 + SHA-256 hex lowercase`) 타입/검증 계약 반영
  - D-002: decimal/atomic 정밀도 경계 타입 및 scale 검증 경계 반영
  - D-007: policy id 기반 설정 주입 타입 계약 및 정책 누락 fail-closed 경계 반영
- Problem Link (1~6): 1, 2, 6
- Target x402 Version: v2 / legacy compatibility

- Source Review
1. https://docs.cdp.coinbase.com/x402/docs/welcome
   - 핵심 포인트: 결제 계약은 machine-readable 경계에서 명확히 검증되어야 하며 파싱 실패는 즉시 차단되어야 한다.
2. https://docs.cdp.coinbase.com/x402/docs/core-concepts
   - 핵심 포인트: Resource Server/Client/Facilitator 경계에서 입력 계약이 안정적이어야 verify/settle 안전성이 유지된다.
3. https://docs.cdp.coinbase.com/x402/docs/troubleshooting#x402-facilitator-v2-migration-guide
   - 핵심 포인트: v2 중심 계약 유지와 legacy 호환 분리가 필요하며 필드 누락/포맷 오류를 명확히 다뤄야 한다.
4. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-verify
   - 핵심 포인트: verify 이전 단계에서 의도/금액/정책 참조 무결성이 보장되어야 한다.
5. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-settle
   - 핵심 포인트: settle 안정성은 선행 계약 검증 품질에 의존하며 fail-closed 경계가 중요하다.
6. https://www.x402.org/docs/whitepaper/
   - 핵심 포인트: 에이전트 결제에서 표준화된 계약과 안전 기본값(deny-by-default)이 핵심이다.
7. https://github.com/coinbase/x402
   - 핵심 포인트: 레퍼런스 구현도 v2 계약 검증과 호환 계층 분리를 유지한다.

- Architecture Notes:
  - Protocol 경계에서 `PAYMENT-REQUIRED`를 canonical 모델로 정규화하면서 금액 정밀도/정책 주입 참조 계약을 동시에 검증한다.
  - 정책값 자체는 외부 주입이므로 SDK는 policy id 참조의 존재성/형식만 fail-closed로 검증한다.

- Protocol Notes:
  - `ttmHash`는 JCS+SHA256 결과물 형식(64자 hex lowercase)으로 검증한다.
  - 금액은 decimal string(표시/입력)과 atomic integer string(내부 계산)을 분리하고, scale 초과 소수점은 즉시 reject 한다.
  - 정책 누락 경로는 옵션 기반 fail-closed 경계(`requirePolicyRefs`)로 차단한다.

- Risk Notes:
  - 잘못된 ttmHash 형식 허용 시 의도 바인딩 검증 약화 -> 형식 검증 추가.
  - scale 초과 소수점 허용 시 금액 왜곡 리스크 -> decimal->atomic 변환 시 reject.
  - policy id 누락 허용 시 운영 정책 우회 리스크 -> 프로토콜 경계 fail-closed 옵션 제공.

- Test Impact:
  - protocol unit 테스트에 scale 초과 reject, policy 누락 fail-closed reject, ttmHash 형식 reject를 추가한다.

### 2026-02-15 / P2-D010-D011 Verification Consent/WebAuthn 위임 / Squad B
- Scope: 법적 동의 최소 필드 fail-closed, WebAuthn 운영값 정책 주입/누락 fail-closed, Verification 경계 canonical hash 규칙(D-001) 준수를 강화한다.
- Problem Link (1~6): 1, 3, 4
- Target x402 Version: v2 / legacy compatibility

- Source Review
1. https://docs.cdp.coinbase.com/x402/docs/welcome
   - 핵심 포인트: x402는 machine-readable 계약으로 승인/정산 경로를 일관되게 검증해야 한다.
2. https://docs.cdp.coinbase.com/x402/docs/core-concepts
   - 핵심 포인트: verification은 settle 전에 무결성/승인 근거를 강제하는 경계 계층이다.
3. https://docs.cdp.coinbase.com/x402/docs/troubleshooting#x402-facilitator-v2-migration-guide
   - 핵심 포인트: 표준 계약 필드 누락/비호환은 fail-closed로 처리해야 회귀 위험이 낮다.
4. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-verify
   - 핵심 포인트: verify 결과는 승인 여부와 결제 의도 바인딩 근거를 제공해야 한다.
5. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-settle
   - 핵심 포인트: settle은 유효한 승인 증빙이 있을 때만 허용되어야 한다.
6. https://www.x402.org/docs/whitepaper/
   - 핵심 포인트: 에이전트 결제 환경에서 명시적 승인과 감사 가능 증빙이 핵심 안전요건이다.
7. https://github.com/coinbase/x402
   - 핵심 포인트: 표준 구현은 계약 검증 실패 시 안전한 중단을 우선한다.

- Architecture Notes: Verification 모듈은 CR 최소 증빙 필드와 WebAuthn 정책 참조를 강제하고, Settlement 진입 전에 외부 기대값(invoiceId/termsVersion/ttmHash)으로 승인 결과를 검증한다.
- Protocol Notes: D-001에 따라 TTM hash는 canonicalization 기반 결정적 계산을 유지하고, D-010/D-011에 따라 정책 ID 누락/증빙 누락 경로는 fail-closed로 거절한다.
- Risk Notes: (1) 정책 ID 누락 시 운영 정책 우회 위험 (2) CR 최소 필드 누락 시 법적/감사 증빙 훼손 (3) 자기참조 검증 시 위변조 탐지 실패.
- Test Impact: `tests/unit/verification.test.ts`에 policy 누락/consent 필드 누락/정합 성공 경로를 추가하고 fail-closed를 검증한다.
