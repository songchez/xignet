---
title: 트러블슈팅
---

# 트러블슈팅

## 1) `Invalid WWW-Authenticate format`

원인:

- 헤더 문자열이 토큰 + 파라미터 형식을 지키지 않음

해결:

- 원문 헤더를 로그로 남기고 이스케이프/따옴표 여부 확인

## 2) `Invalid CAIP-2 network`

원인:

- `network` 값이 CAIP-2 패턴에 맞지 않음

해결:

- `eip155:8453`처럼 표준값 사용
- alias(`base-mainnet`)를 입력해도 SDK가 정규화 가능

## 3) `Invoice has expired`

원인:

- 인보이스 조회 시점이 만료시간 이후

해결:

- 결제 UI에서 만료 카운트다운 제공
- 만료 시 새 인보이스 재발급

## 4) `WebAuthn assertion is not bound to requested ttmHash`

원인:

- 인증 결과의 해시가 요청 해시와 다름

해결:

- 인증 요청 payload가 중간에 변경되었는지 확인
- verifier 구현이 request.ttmHash를 그대로 검증하는지 점검

## 5) `Idempotency key already used with a different settlement request`

원인:

- 동일 키로 다른 결제 파라미터를 보냄

해결:

- 키 생성 규칙을 주문 단위로 고정
- 주문 변경 시 새 idempotency key 발급

## 6) finality 미확정 상태가 자주 발생

원인:

- 체인 finality 정책이 너무 엄격하거나 확인 시점이 너무 빠름

해결:

- `retry` 정책과 finality polling 전략을 분리
- 체인별 확정 블록 수 정책 명시
