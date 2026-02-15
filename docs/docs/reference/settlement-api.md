---
title: Settlement API
---

# Settlement API

## `verifySettlementProof(proof, provider): Promise<boolean>`

정산 증명 검증기를 호출합니다.

```ts
await verifySettlementProof(proof, {
  verifyProof: async (input) => isOnChainPaymentValid(input),
});
```

실패 시:

- `SettlementProofInvalidError`

## `createInMemorySettlementReplayStore(): SettlementReplayStore`

테스트/개발용 메모리 기반 replay store입니다.

운영에서는 Redis/DB 기반 구현으로 교체하세요.

## `executeSettlement(input, adapter, replayStore, options?): Promise<SettlementExecutionResult>`

가장 강력한 정산 오케스트레이션 함수입니다.

입력:

- `invoice`, `proof`, `idempotencyKey`, `ttmHash`

adapter 계약:

- `verify(request) -> { status: approved|declined, verificationId, verifiedAt }`
- `settle(request) -> { status: settled|failed, settlementId, txHash, settledAt }`

옵션(주요):

- `retry.verify`, `retry.settle`
- `finality.hook.checkFinality`
- `runbookPolicyId`, `facilitatorPolicyId`

반환:

- `confirmation`: 주문 확정 정보
- `receipt`: 정산 영수증
- `replayed`: 기존 결과 재사용 여부

실패 시 첨부될 수 있는 reason code:

- `VERIFY_DECLINED`, `VERIFY_CALL_FAILED`
- `SETTLE_FAILED`, `SETTLE_CALL_FAILED`
- `REORG_DETECTED`, `FINALITY_NOT_CONFIRMED`, `FINALITY_CHECK_FAILED`
- `IDEMPOTENCY_KEY_COLLISION`

## `mapProofToOrderConfirmation(proof, invoice, receipt?): OrderConfirmation`

정산 증명/영수증을 주문 확정 객체로 변환합니다.

- receipt가 있으면 `settlementReceiptId`, `auditLogId`, `idempotencyKey` 포함
