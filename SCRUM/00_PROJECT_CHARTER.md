# Project Charter

## 프로젝트명
XIGNET x402 Transaction Trust SDK

## 목표
AI 기반 커머스 결제 흐름에서 `402 invoice -> 모바일 검증 -> 온체인 정산 -> 주문 반영`을 신뢰 가능하게 구현하는 TypeScript SDK를 제공한다.

## 최상위 기획 기준
- 문제 중심 기획 원칙은 `SCRUM/00A_PROBLEM_DEFINITION_AND_PLANNING_PRINCIPLES.md`를 따른다.
- 신규 기능/스토리는 위 문서의 Feature Gate Criteria를 통과해야 Sprint 후보가 될 수 있다.

## 비즈니스 가치
- AI 응답을 신뢰하지 않고 서버 발행 invoice를 신뢰 원천으로 고정
- 사용자 모바일 생체 인증으로 승인 UX 단순화
- Gateway와 Legacy Mall DB 연결 리스크 감소

## 성공 기준
- v0에서 Discovery/Verification/Settlement 핵심 API 안정화
- Node.js + Browser에서 동일 계약 동작
- CI 품질 게이트(타입/테스트/보안) 필수 통과

## 제약
- v0 범위는 SDK + 검증 유틸로 제한
- UI 제품화와 풀스택 템플릿은 후속 단계
