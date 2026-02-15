# Domain Study Protocol (Mandatory Before Implementation)

## 목적
x402 도메인 구현 전에 에이전트가 공식 문서를 동일 기준으로 숙지하도록 강제한다.

## 적용 범위
- Protocol, Verification, Settlement, Integrations, Infra를 포함한 모든 구현 작업
- 코드 작성/수정 전 단계에 필수 적용

## Canonical Sources (필수)
1. https://docs.cdp.coinbase.com/x402/docs/welcome
2. https://docs.cdp.coinbase.com/x402/docs/core-concepts
3. https://docs.cdp.coinbase.com/x402/docs/troubleshooting#x402-facilitator-v2-migration-guide
4. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-verify
5. https://docs.cdp.coinbase.com/x402/reference/post_facilitator-settle
6. https://www.x402.org/docs/whitepaper/
7. https://github.com/coinbase/x402

## Pre-Implementation Gate
아래 4개 산출물이 없으면 구현을 시작할 수 없다.

1. Source Review Log
- 위 7개 링크 각각에 대해 읽은 날짜, 핵심 포인트 1~2줄 기록

2. Protocol Notes
- v2 기준 헤더/필드 요약
- v1/legacy와의 차이점 및 호환 범위

3. Architecture Notes
- Resource Server / Client / Facilitator 역할 분리
- verify/settle 호출이 시스템에서 어디에 위치하는지

4. Risk Notes
- 현재 작업에서 발생 가능한 결제 리스크 3개와 방어 방식

## Required Output Location
- `SCRUM/09_AGENT_OPERATIONS/DOMAIN_STUDY_LOG.md`에 작업 단위별로 기록한다.

## Implementation Start Checklist
1. Canonical Sources 7개를 모두 검토했다.
2. 이번 변경의 Problem Link(1~6)를 정의했다.
3. 적용할 x402 버전(v2 기본, legacy 여부)을 명시했다.
4. Facilitator verify/settle와의 연계를 설계에 반영했다.
5. conformance 테스트 영향 범위를 확인했다.

## Review/Handoff Rule
- PR 설명 또는 핸드오프 문서에 `DOMAIN_STUDY_LOG.md` 섹션 링크가 없으면 리뷰 진행을 중단한다.
