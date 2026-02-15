# Problem Definition and Planning Principles

## 문서 목적
이 문서는 XIGNET 프로젝트의 최상위 기획 기준이다. 기능 아이디어보다 먼저, 해결하려는 근본문제를 기준으로 우선순위를 결정한다.

## Root Problem Statement
AI가 결제를 실행하는 환경에서, 사용자의 의도와 통제권이 손실될 수 있다.  
프로젝트의 본질은 "AI 결제 자동화"가 아니라 "사용자 의도 기반 결제 통제"다.

## 핵심 문제정의 (Must Solve)
1. 의도 통제 불가: AI가 사용자가 원하는 결제를 정확히 수행하는지 보장하기 어렵다.
2. 할루시네이션 리스크: 수량/금액/상품이 왜곡되어 대형 오결제로 이어질 수 있다.
3. 명시적 동의 부재: 결제 직전 사용자 허락 단계가 생략되는 구조가 존재한다.
4. 사용자 사칭 가능성: 본인이 아닌 지시자 요청에도 결제가 실행될 수 있다.
5. 중복 실행 리스크: 버그/재시도로 원치 않는 다중 결제가 발생할 수 있다.
6. 통제 UX 부재: 사용자가 AI 결제 행위를 직관적으로 제한/관리하기 어렵다.

## Planning Principles (Non-Negotiable)
1. Trust Source First
- AI 요약/메시지가 아니라 서버 발행 invoice를 단일 결제 진실로 사용한다.

2. Consent Before Settlement
- 결제 정산 전에 사용자 명시적 승인(모바일 검증 + 생체 인증)이 반드시 선행되어야 한다.

3. Intent Binding
- 상품/수량/금액/가맹점을 승인 단위로 고정하고, 승인 후 변경을 금지한다.

4. Strong Authentication
- 사용자 인증은 비밀번호 공유가 아니라 WebAuthn 기반 강한 인증을 우선한다.

5. Idempotency by Default
- 모든 결제 요청은 idempotency key, nonce, expiry를 통해 중복 실행을 차단한다.

6. User-Controlled Policy
- 사용자가 한도, 가맹점, 카테고리, 시간대 정책을 설정/변경/중단할 수 있어야 한다.

7. Auditability
- "누가, 언제, 무엇을, 얼마에, 어떤 승인으로" 결제했는지 추적 가능해야 한다.

8. x402 Standards Alignment
- x402 공식 문서와 스펙을 우선 기준으로 적용하고, 프로토콜 변경(v1/v2, 헤더/필드 변화)은 RFC/ADR로 즉시 반영한다.
- 신규 구현은 v2 헤더(`PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE`)를 기본으로 하고, v1(`X-PAYMENT`)은 호환 계층으로만 지원한다.
- 네트워크 식별자는 v2 기준(CAIP-2)으로 관리한다.

9. Delegation First
- 플랫폼이 고정하는 범위는 결제 안전 불변식(invariants)으로 제한한다.
- 운영 파라미터(보관기간, retry 수치, 정책 카탈로그, 복구/런북 세부)는 개발자/운영팀 설정으로 위임한다.
- SDK는 interface/validation boundary를 제공하고, 값 자체는 policy id 기반 외부 주입을 기본으로 한다.

## Feature Gate Criteria
아래 질문 중 하나라도 "No"이면 기능은 백로그에 올려도 구현 우선순위를 부여하지 않는다.

1. 이 기능이 위 6개 핵심 문제 중 최소 1개를 직접 완화하는가?
2. 신뢰 원천(invoice)과 사용자 승인 흐름을 우회하지 않는가?
3. 중복 결제/사칭/무단 결제 위험을 증가시키지 않는가?
4. 감사 로그와 운영 가시성을 저해하지 않는가?

## Story 작성 규칙
모든 유저 스토리/태스크는 다음 템플릿 필드를 필수로 가진다.

- Problem Link: 어떤 핵심 문제(1~6)에 대응하는가
- Risk if Missing: 미구현 시 발생하는 보안/금전 리스크
- Control Point: Discovery / Verification / Settlement 중 어디서 통제되는가
- Evidence: 테스트 혹은 로그로 어떤 증거를 남기는가

## Definition of Done 추가 조건
아래는 기존 DoD에 추가되는 결제 도메인 안전 조건이다.

1. 승인 우회 경로가 없어야 한다.
2. 중복 실행 방지 조건(idempotency/nonce/expiry)이 테스트로 검증되어야 한다.
3. 실패 시 안전한 기본값(결제 중단, 주문 미생성)을 보장해야 한다.
4. 운영자/사용자 관점에서 감사 가능한 이벤트를 남겨야 한다.
