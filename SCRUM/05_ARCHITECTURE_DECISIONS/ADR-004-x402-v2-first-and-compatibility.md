# ADR-004: x402 v2 우선 + 하위호환 계층

## Status
Accepted

## Context
x402는 빠르게 진화 중이며 문서/SDK가 v1(`X-PAYMENT`)에서 v2(`PAYMENT-*`)로 이동했다.  
프로젝트는 공식 스펙과의 정렬이 핵심이며, 기존 통합체를 즉시 깨지 않도록 호환 전략이 필요하다.

## Decision
1. 프로토콜 표준 구현은 v2를 기본으로 채택한다.
2. v1 및 기존 `L402/WWW-Authenticate` 형태는 compatibility adapter로만 처리한다.
3. 공개 SDK API는 `x402Version`과 네트워크(CAIP-2) 기반 모델을 기본값으로 설계한다.
4. 문서/RFC/테스트는 "v2 기준 + 레거시 호환 범위 명시" 형식으로 유지한다.

## Consequences
- 장점: 공식 생태계(Coinbase-hosted Facilitator, 최신 SDK)와 정렬된다.
- 장점: 프로토콜 업데이트 추적과 릴리즈 의사결정이 명확해진다.
- 단점: 초기 구현에서 헤더/필드 변환 계층 추가 비용이 발생한다.
