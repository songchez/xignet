import { useCallback, useMemo, useRef, useState } from "react";
import {
  assertVerificationForSettlement,
  buildVerificationRequest,
  computeTtmHash,
  createInMemorySettlementReplayStore,
  executeSettlement,
  parsePaymentRequiredHeader,
  validatePaymentRequirementTtmHash,
  verifyBiometricAssertion
} from "@xignet/x402-sdk";

const DEFAULT_PRICE_KRW = 50000;
const DEFAULT_QUANTITY = 1;

const POLICY_REFS = Object.freeze({
  legalPolicyId: "legal-v1",
  webauthnPolicyId: "webauthn-v1",
  retentionPolicyId: "retention-v1",
  runbookPolicyId: "runbook-v1",
  finalityPolicyId: "finality-v1"
});

function encodePaymentRequiredPayload(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function readError(error) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return "Unknown error";
}

function toPrettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function createFixtures(quantity, idempotencyKey) {
  const totalAmount = quantity * DEFAULT_PRICE_KRW;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 15).toISOString();
  const invoiceId = `iv_demo_${idempotencyKey}`;

  const ttm = {
    ttmVersion: "2.0",
    intentId: `intent_${idempotencyKey}`,
    merchantId: "Coupang",
    buyerId: "buyer_demo",
    lineItems: [
      {
        itemType: "physical",
        itemRef: "sku-sneaker",
        quantity: String(quantity),
        unit: "ea",
        unitPrice: String(DEFAULT_PRICE_KRW),
        amount: String(totalAmount)
      }
    ],
    totalAmount: String(totalAmount),
    currency: "KRW",
    maxAllowedAmount: String(totalAmount),
    expiresAt,
    idempotencyKey,
    policy: {
      policyRefs: POLICY_REFS,
      legalPolicyId: POLICY_REFS.legalPolicyId,
      webauthnPolicyId: POLICY_REFS.webauthnPolicyId
    },
    policyRefs: POLICY_REFS,
    termsVersion: "v1"
  };

  const invoice = {
    invoiceId,
    merchantId: "Coupang",
    orderRef: `order_${idempotencyKey}`,
    lineItems: [
      {
        sku: "sku-sneaker",
        name: "XIGNET Runner",
        quantity,
        unitPrice: DEFAULT_PRICE_KRW,
        totalPrice: totalAmount
      }
    ],
    totalAmount,
    currency: "KRW",
    issuedAt: now.toISOString(),
    expiry: expiresAt,
    signature: "signed-by-gateway"
  };

  const proof = {
    txHash: `0x${idempotencyKey.padEnd(16, "0")}`,
    chainId: "eip155:8453",
    payer: "0xBuyer",
    payee: "0xMallTreasury",
    amount: totalAmount,
    confirmedAt: new Date().toISOString(),
    proofType: "transfer"
  };

  return { invoice, ttm, proof };
}

function ResultCard({ title, value }) {
  return (
    <section className="card">
      <h3>{title}</h3>
      <pre>{value ? toPrettyJson(value) : "아직 실행되지 않았습니다."}</pre>
    </section>
  );
}

export default function App() {
  const replayStore = useMemo(() => createInMemorySettlementReplayStore(), []);
  const latestExecutionRef = useRef(null);

  const [quantity, setQuantity] = useState(DEFAULT_QUANTITY);
  const [idempotencyKey, setIdempotencyKey] = useState("idem-demo-1");
  const [declineBiometric, setDeclineBiometric] = useState(false);
  const [tamperPaymentRequiredHash, setTamperPaymentRequiredHash] = useState(false);
  const [facilitatorDeclines, setFacilitatorDeclines] = useState(false);
  const [settlementFails, setSettlementFails] = useState(false);

  const [paymentRequirement, setPaymentRequirement] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [settlementResult, setSettlementResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [logs, setLogs] = useState([]);

  const appendLog = useCallback((message) => {
    const timestamp = new Date().toISOString().slice(11, 19);
    setLogs((prev) => [`${timestamp} ${message}`, ...prev].slice(0, 20));
  }, []);

  const runFlow = useCallback(async () => {
    setErrorMessage("");
    setSettlementResult(null);

    try {
      const { invoice, ttm, proof } = createFixtures(quantity, idempotencyKey);
      const expectedTtmHash = computeTtmHash(ttm);

      const requirementPayload = {
        x402Version: 2,
        accepts: [
          {
            scheme: "exact",
            network: "eip155:8453",
            maxAmountRequired: String(invoice.totalAmount),
            payTo: proof.payee,
            resource: "/orders",
            asset: "KRW"
          }
        ],
        policyRefs: POLICY_REFS,
        ttmHash: tamperPaymentRequiredHash
          ? `${"0".repeat(63)}1`
          : expectedTtmHash
      };

      const encoded = encodePaymentRequiredPayload(requirementPayload);
      const parsedRequirement = parsePaymentRequiredHeader(encoded, {
        requirePolicyRefs: true,
        requireTtmHash: true
      });
      validatePaymentRequirementTtmHash(parsedRequirement, expectedTtmHash);
      setPaymentRequirement(parsedRequirement);
      appendLog("Phase 1 완료: PAYMENT-REQUIRED 파싱 및 TTM 해시 검증 성공");

      const verificationRequest = buildVerificationRequest(invoice, ttm, {
        failClosedOnMissingPolicyRefs: true
      });

      const verification = await verifyBiometricAssertion(
        verificationRequest,
        { credentialId: "passkey-demo" },
        {
          verify: async (request) => {
            if (declineBiometric) {
              return null;
            }
            return {
              signerDeviceId: "iphone-user-device",
              signedAt: new Date().toISOString(),
              ttmHash: request.ttmHash
            };
          }
        },
        { failClosedOnMissingPolicyRefs: true }
      );

      assertVerificationForSettlement(verification, {
        invoiceId: invoice.invoiceId,
        termsVersion: ttm.termsVersion,
        ttmHash: expectedTtmHash,
        legalPolicyId: POLICY_REFS.legalPolicyId,
        webauthnPolicyId: POLICY_REFS.webauthnPolicyId
      });
      setVerificationResult(verification);
      appendLog("Phase 2 완료: 모바일 승인(WebAuthn) 검증 성공");

      const adapter = {
        verify: async () => {
          if (facilitatorDeclines) {
            return {
              status: "declined",
              verificationId: "vr-demo-declined",
              verifiedAt: new Date().toISOString(),
              reason: "Facilitator policy rejected request"
            };
          }

          return {
            status: "approved",
            verificationId: "vr-demo-approved",
            verifiedAt: new Date().toISOString()
          };
        },
        settle: async () => {
          if (settlementFails) {
            return {
              status: "failed",
              settlementId: "st-demo-failed",
              txHash: "",
              settledAt: new Date().toISOString(),
              reason: "Settlement simulation failure"
            };
          }

          return {
            status: "settled",
            settlementId: "st-demo-ok",
            txHash: proof.txHash,
            settledAt: new Date().toISOString()
          };
        }
      };

      const input = {
        invoice,
        proof,
        idempotencyKey,
        ttmHash: expectedTtmHash
      };

      const result = await executeSettlement(input, adapter, replayStore, {
        facilitatorPolicyId: "facilitator-v2",
        runbookPolicyId: POLICY_REFS.runbookPolicyId,
        retry: {
          verify: { maxAttempts: 2, timeoutMs: 5000, backoffMs: 50 },
          settle: { maxAttempts: 2, timeoutMs: 5000, backoffMs: 50 }
        },
        finality: {
          finalityPolicyId: POLICY_REFS.finalityPolicyId,
          hook: {
            checkFinality: async () => ({ finalized: true })
          }
        }
      });

      latestExecutionRef.current = { input, adapter };
      setSettlementResult(result);
      appendLog(
        `Phase 3 완료: 정산 성공 (replayed=${result.replayed ? "true" : "false"})`
      );
    } catch (error) {
      const readable = readError(error);
      setErrorMessage(readable);
      appendLog(`실패: ${readable}`);
    }
  }, [
    appendLog,
    declineBiometric,
    facilitatorDeclines,
    idempotencyKey,
    quantity,
    replayStore,
    settlementFails,
    tamperPaymentRequiredHash
  ]);

  const rerunWithSameIdempotencyKey = useCallback(async () => {
    setErrorMessage("");

    try {
      const latest = latestExecutionRef.current;
      if (!latest) {
        throw new Error("먼저 '전체 트랜잭션 실행'을 성공시켜 주세요.");
      }

      const replayedResult = await executeSettlement(
        latest.input,
        latest.adapter,
        replayStore
      );
      setSettlementResult(replayedResult);
      appendLog(
        `중복 실행 완료: idempotency replay 확인 (replayed=${
          replayedResult.replayed ? "true" : "false"
        })`
      );
    } catch (error) {
      const readable = readError(error);
      setErrorMessage(readable);
      appendLog(`중복 실행 실패: ${readable}`);
    }
  }, [appendLog, replayStore]);

  return (
    <main className="layout">
      <section className="hero">
        <p className="eyebrow">XIGNET x402 Demo</p>
        <h1>AI 결제 통제를 눈으로 검증하는 샌드박스</h1>
        <p>
          실제 SDK 함수로 Discovery(402), Mobile Verification(WebAuthn), Settlement +
          Idempotency Replay를 시뮬레이션합니다.
        </p>
      </section>

      <section className="controls card">
        <h2>Scenario Controls</h2>
        <label>
          수량
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10);
              setQuantity(Number.isNaN(parsed) ? 1 : Math.max(parsed, 1));
            }}
          />
        </label>

        <label>
          idempotencyKey
          <input
            type="text"
            value={idempotencyKey}
            onChange={(event) => setIdempotencyKey(event.target.value)}
          />
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={tamperPaymentRequiredHash}
            onChange={(event) => setTamperPaymentRequiredHash(event.target.checked)}
          />
          PAYMENT-REQUIRED의 ttmHash 변조 (실패 유도)
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={declineBiometric}
            onChange={(event) => setDeclineBiometric(event.target.checked)}
          />
          사용자 생체인증 거부 (실패 유도)
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={facilitatorDeclines}
            onChange={(event) => setFacilitatorDeclines(event.target.checked)}
          />
          Facilitator 검증 거절 (실패 유도)
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={settlementFails}
            onChange={(event) => setSettlementFails(event.target.checked)}
          />
          Settlement 실패 (실패 유도)
        </label>

        <div className="actions">
          <button type="button" onClick={runFlow}>
            전체 트랜잭션 실행
          </button>
          <button type="button" className="ghost" onClick={rerunWithSameIdempotencyKey}>
            같은 키로 재실행 (Replay 확인)
          </button>
        </div>

        {errorMessage ? <p className="error">{errorMessage}</p> : null}
      </section>

      <section className="results">
        <ResultCard title="Phase 1: Payment Requirement" value={paymentRequirement} />
        <ResultCard title="Phase 2: Verification Result" value={verificationResult} />
        <ResultCard title="Phase 3: Settlement Result" value={settlementResult} />
      </section>

      <section className="card">
        <h2>Execution Log</h2>
        <ul className="logs">
          {logs.length === 0 ? <li>실행 로그가 없습니다.</li> : null}
          {logs.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
