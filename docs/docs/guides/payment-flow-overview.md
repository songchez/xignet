---
title: 결제 플로우 전체 보기
---

# 결제 플로우 전체 보기

SDK 기준으로 보면 결제는 아래 7단계로 진행됩니다.

## 7단계 시나리오

1. 서버가 `402 Payment Required` 또는 `PAYMENT-REQUIRED`를 반환
2. 앱이 헤더를 파싱해 결제 요구를 구조화
3. 인보이스 조회 후 만료/서명 검증
4. TTM 생성 후 사용자 인증 요청 구성
5. WebAuthn 검증 성공 + 동의 영수증 생성
6. 온체인 정산 증명 검증(필요 시 facilitator 호출)
7. 주문 확정 데이터 저장

## 책임 분리 표

| 단계 | 권장 실행 위치 | SDK 함수 |
| --- | --- | --- |
| 헤더 파싱 | API 서버 또는 BFF | `parse402Header`, `parsePaymentRequiredHeader` |
| 인보이스 조회/서명 검증 | 서버 | `fetchInvoice`, `validateInvoiceSignature` |
| 인증 요청 생성 | 서버 | `buildVerificationRequest` |
| 생체 인증 결과 검증 | 서버 | `verifyBiometricAssertion` |
| 정산 증명 검증 | 서버 | `verifySettlementProof` |
| 고급 정산 실행 | 서버 | `executeSettlement` |
| 주문 확정 매핑 | 서버 | `mapProofToOrderConfirmation` |

## 왜 서버 중심이 권장되는가

- 신뢰 검증(서명/정산/정책)은 서버가 더 안전하게 수행 가능
- 비밀키, 내부 정책 ID, 감사 로그를 서버에서 관리 가능
- 재시도/멱등성/최종성 같은 운영 로직을 중앙 집중 관리 가능

## 단계별 상세 문서

- [Discovery 단계](./discovery-stage.md)
- [Verification 단계](./verification-stage.md)
- [Settlement 단계](./settlement-stage.md)
- [종단 간 예제](./end-to-end-example.md)
