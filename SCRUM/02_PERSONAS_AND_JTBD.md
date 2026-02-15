# Personas and JTBD

## 문제정의 연결 원칙
- 본 문서의 모든 JTBD는 `SCRUM/00A_PROBLEM_DEFINITION_AND_PLANNING_PRINCIPLES.md`의 핵심 문제(1~6)와 직접 연결되어야 한다.
- Persona별 요구사항은 기능 요구가 아니라 "의도 통제/무결성/동의/인증/중복방지/통제 UX" 개선 관점으로 기술한다.

## Persona A: Gateway Engineer
- JTBD: 결제 필요 요청을 402 + 표준 invoice로 안전하게 반환하고 싶다.
- Pain: 헤더 포맷 불일치, 만료 invoice 처리 누락.
- Problem Link: 1(의도 통제), 2(할루시네이션 무결성), 5(중복 실행 방지)
- Success Signal: invoice 원문이 필수 필드와 만료/nonce 조건을 만족하지 않으면 결제가 진행되지 않는다.

## Persona B: Verifier Engineer
- JTBD: 사용자가 모바일에서 직관적으로 결제 내용을 확인하고 승인하게 하고 싶다.
- Pain: assertion 결과 모델이 서비스마다 달라 재사용이 어렵다.
- Problem Link: 3(명시적 동의), 4(사칭 방지), 6(통제 UX)
- Success Signal: 사용자는 모바일에서 결제 핵심정보를 확인하고 생체인증으로만 승인할 수 있다.

## Persona C: Security Reviewer
- JTBD: AI/UI 변조 가능성을 시스템적으로 차단하고 싶다.
- Pain: 증빙 데이터와 코드 계약이 분리되어 감사가 어렵다.
- Problem Link: 2(무결성), 4(인증), 5(중복 방지), 6(운영 통제)
- Success Signal: 승인/정산/주문 반영 전 과정에서 감사 가능한 증거가 남고 우회 경로가 없다.
