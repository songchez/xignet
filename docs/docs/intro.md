---
title: 소개
slug: /intro
---

# XIGNET x402 SDK 문서

`@xignet/x402-sdk`는 x402 결제 요구를 처리할 때 필요한 핵심 3단계를 TypeScript로 안전하게 구현하도록 도와주는 라이브러리입니다.

- Discovery: 서버가 보낸 결제 요구(헤더/인보이스)를 읽고 신뢰성 검증
- Verification: 사용자 생체 인증(WebAuthn)과 결제 의도를 연결
- Settlement: 온체인 결제 증명 확인 후 주문 확정

## 이 문서가 필요한 사람

- 결제 도메인을 처음 접하는 프론트엔드/백엔드 개발자
- x402 구조는 알고 싶지만 실제 코드 연결이 어려운 개발자
- 오류 처리, 멱등성(idempotency), 정산 재시도까지 한 번에 정리하고 싶은 팀

## 먼저 알아두면 좋은 핵심 용어

- `Invoice`: 결제 금액/만료시간/서명 정보가 담긴 청구서
- `TTM(TransactionTermsManifest)`: 사용자가 동의할 거래 조건 문서
- `ttmHash`: TTM을 정규화해 계산한 64자리 해시
- `ConsentReceipt`: 사용자 동의 결과를 남긴 영수증
- `SettlementProof`: 온체인 결제가 일어났다는 증명 데이터

## 문서 읽는 추천 순서

1. [설치하기](/docs/getting-started/installation)
2. [Quick Start](/docs/getting-started/quick-start)
3. [핵심 개념](/docs/getting-started/core-concepts)
4. [단계별 가이드](/docs/guides/payment-flow-overview)
5. [API 레퍼런스](/docs/reference/api-overview)
6. [트러블슈팅](/docs/troubleshooting)

## 시스템 흐름 한눈에 보기

```text
merchant server
  -> (402 / PAYMENT-REQUIRED)
client app
  -> parse / normalize / fetch invoice / signature verify
verification device (WebAuthn)
  -> user approval + consent receipt
settlement service
  -> verify on-chain proof + finalize order
```

## 이 SDK의 강점

- x402 v2(`PAYMENT-REQUIRED`) + legacy(`L402`) 호환 처리
- TTM 해시 바인딩으로 위변조 방지 강화
- 정산 실행 시 재시도/타임아웃/파이널리티/멱등성 지원
- 도메인 전용 오류 타입으로 운영 대응이 쉬움

다음 문서에서 실제 설치부터 시작합니다.
