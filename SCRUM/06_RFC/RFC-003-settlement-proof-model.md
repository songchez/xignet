# RFC-003: Settlement Proof Model

## 목적
온체인 결제 증명을 주문 확정 이벤트로 안전하게 매핑한다.

## Contract
- `verifySettlementProof(proof, provider)`
- 성공 시 `mapProofToOrderConfirmation(proof, invoice)` 호출
- settlement 경로는 `idempotencyKey`, `ttmHash`, `intentId`를 필수 포함한다.

## 최소 검증 요소
- txHash 존재
- chainId 일치
- amount 일치
- confirmedAt 기록

## finality/reorg 규칙
1. 플랫폼은 finality 검증 인터페이스와 reorg 처리 훅만 고정한다.
2. confirmations 수치와 reorg 감시 윈도우는 `finalityPolicyId` 기반 외부 설정으로 위임한다.
3. `order_confirmed` 이후 체인 이상 이벤트는 기본적으로 `dispute_open` 경로로 처리한다.

## retry/idempotency 규칙
1. verify/settle timeout/retry 수치는 정책 주입으로 관리한다.
2. idempotency 의미론(동일 키는 동일 결과)은 플랫폼 불변식으로 강제한다.
3. persistence 구현체(storage/TTL/scope)는 애플리케이션 어댑터가 주입한다.

## 오류 규약
- 증명 실패: `SettlementProofInvalidError`
