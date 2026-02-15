---
title: Settlement 단계
---

# Settlement 단계

Settlement의 목표는 "정산이 유효하게 완료되었고, 주문을 확정해도 안전한가"를 판단하는 것입니다.

## 1) 단순 정산 증명 검증

```ts
import {verifySettlementProof} from '@xignet/x402-sdk';

await verifySettlementProof(proof, {
  verifyProof: async (p) => {
    // TODO: 체인/브릿지/인덱서 기반 검증
    return p.txHash.length > 0;
  },
});
```

## 2) 고급 정산 실행(executeSettlement)

`executeSettlement`는 실무에서 필요한 운영 기능을 한 번에 제공합니다.

- facilitator verify/settle 호출
- retry + timeout + backoff + jitter
- finality 체크 및 reorg 핸들링
- 멱등성 replay 저장소

```ts
import {
  createInMemorySettlementReplayStore,
  executeSettlement,
} from '@xignet/x402-sdk';

const replayStore = createInMemorySettlementReplayStore();

const result = await executeSettlement(
  {
    invoice,
    proof,
    idempotencyKey: 'idem_001',
    ttmHash: verification.ttmHash,
  },
  adapter,
  replayStore,
  {
    facilitatorPolicyId: 'facilitator-policy-v1',
    runbookPolicyId: 'runbook-v1',
    retry: {
      verify: {maxAttempts: 3, timeoutMs: 3000, backoffMs: 200, jitterMs: 100},
      settle: {maxAttempts: 3, timeoutMs: 5000, backoffMs: 300, jitterMs: 100},
    },
    finality: {
      finalityPolicyId: 'finality-v1',
      hook: {
        checkFinality: async () => ({finalized: true}),
      },
    },
  },
);

console.log(result.replayed); // false면 신규 처리, true면 재실행 응답
```

## 3) 주문 확정 데이터로 매핑

```ts
import {mapProofToOrderConfirmation} from '@xignet/x402-sdk';

const confirmation = mapProofToOrderConfirmation(proof, invoice);
```

## 운영에서 꼭 보는 실패 코드

- `VERIFY_DECLINED`
- `VERIFY_CALL_FAILED`
- `SETTLE_FAILED`
- `SETTLE_CALL_FAILED`
- `REORG_DETECTED`
- `FINALITY_NOT_CONFIRMED`
- `FINALITY_CHECK_FAILED`
- `IDEMPOTENCY_KEY_COLLISION`

## 운영 팁

- `idempotencyKey`는 주문/결제 단위로 유일하게 발급
- finality 정책은 체인별로 다르게 분리
- runbook 정책 ID를 로그/알람 시스템과 연결
