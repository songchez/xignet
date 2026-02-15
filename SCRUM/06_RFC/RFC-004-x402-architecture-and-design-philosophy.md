# RFC-004: x402 Architecture and Design Philosophy

## 목적
프로젝트 기획/구현이 x402 공식 철학과 아키텍처 원칙을 벗어나지 않도록 기준을 고정한다.

## x402 설계 철학 (적용 기준)
1. HTTP 네이티브 결제
- 결제는 별도 결제창이 아니라 HTTP 트랜잭션(`402`) 흐름 안에서 처리한다.

2. 표준화된 결제 요구/응답
- 결제 요청/증빙은 표준 헤더(payload)로 교환되어야 하며, 임의 포맷을 금지한다.

3. Facilitator 분리
- 리소스 서버는 비즈니스 로직에 집중하고, 결제 검증/정산은 Facilitator 계층으로 분리한다.

4. 에코시스템 확장성
- 단일 결제 방식에 잠기지 않도록 스킴/네트워크/자산을 확장 가능한 계약으로 유지한다.

5. 에이전트 시대 적합성
- 인간-UI 중심이 아닌 에이전트 호출에서도 안전하게 동작하도록 machine-readable 계약을 우선한다.

## 아키텍처 기준선
1. Resource Server (Gateway)
- 역할: `402 + PAYMENT-REQUIRED` 발행, 결제 검증 결과 반영, 주문 상태 전이.

2. x402 Client (AI Agent / SDK Consumer)
- 역할: 결제 요구 디코딩, 스킴 선택, `PAYMENT-SIGNATURE` 제출.

3. Facilitator
- 역할: payment payload 검증, 필요 시 정산(settlement), 증빙 반환.

4. Verification Surface (Mobile)
- 역할: 사용자 명시적 승인/강한 인증(WebAuthn) 수행.

## 구현 지침
1. SDK는 v2 헤더를 기본 파서/모델로 채택한다.
2. 레거시(v1, L402)는 변환 어댑터로 분리해 코어 모델 오염을 방지한다.
3. 네트워크 표현은 CAIP-2를 기본 키로 사용한다.
4. 결제 재시도/중복 요청은 idempotency 정책과 결합해 통제한다.
5. 운영 이벤트는 감사 가능하도록 표준 필드를 로그에 남긴다.

## 검증 지침
1. 프로토콜 conformance 테스트를 필수 CI 항목으로 유지한다.
2. 헤더명/필드명 변화는 문서와 테스트를 동시에 업데이트한다.
3. Hosted Facilitator와 Self-hosted Facilitator 시나리오를 분리 검증한다.
