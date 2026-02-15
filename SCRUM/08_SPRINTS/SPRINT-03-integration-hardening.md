# Sprint 03 Integration Hardening (2 weeks)

## Sprint Goal
settlement proof와 주문 확정 매핑을 통합 안정화한다.

## Planned Items
- facilitator verify/settle contract 강화
- idempotency/replay guard contract 적용
- JCS canonicalization + precision(atomic/no-rounding) 계약 반영
- policy id 기반 운영값 주입 경로(`legal/webauthn/finality/retention/runbook`) 확정
- contract tests 확장
- prerelease -> stable 릴리즈 절차 검증

## Risks
- 체인 지연/reorg 대응 정책 미완성
