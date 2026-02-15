import {
  ProtocolCompatibilityError,
  SettlementProofInvalidError,
  VerificationDeclinedError
} from "./errors/index.js";
import {
  ExecuteSettlementInput,
  FacilitatorSettleResponse,
  FacilitatorSettlementAdapter,
  FacilitatorVerifyResponse,
  InvoicePayload,
  OrderConfirmation,
  SettlementExecutionRecord,
  SettlementExecutionResult,
  SettlementProof,
  SettlementProofProvider,
  SettlementReceipt,
  SettlementReplayStore
} from "./types.js";

const IDEMPOTENCY_FINGERPRINT_FIELD = "__xignetIdempotencyFingerprint";
const replayFingerprintRegistry = new WeakMap<SettlementReplayStore, Map<string, string>>();

export type SettlementFailureReasonCode =
  | "VERIFY_DECLINED"
  | "VERIFY_CALL_FAILED"
  | "SETTLE_FAILED"
  | "SETTLE_CALL_FAILED"
  | "REORG_DETECTED"
  | "FINALITY_NOT_CONFIRMED"
  | "FINALITY_CHECK_FAILED"
  | "IDEMPOTENCY_KEY_COLLISION";

export interface SettlementRetryOptions {
  maxAttempts: number;
  timeoutMs: number;
  backoffMs: number;
  jitterMs?: number;
}

export interface SettlementFinalityHook {
  checkFinality(input: {
    txHash: string;
    chainId: string;
    invoiceId: string;
    idempotencyKey: string;
    ttmHash: string;
    intentId: string;
    finalityPolicyId: string;
  }): Promise<{ finalized: boolean; reorgDetected?: boolean; reason?: string }>;
  onReorg?: (input: {
    txHash: string;
    chainId: string;
    invoiceId: string;
    idempotencyKey: string;
    ttmHash: string;
    intentId: string;
    finalityPolicyId: string;
  }) => Promise<void> | void;
}

export interface SettlementExecutionOptions {
  facilitatorPolicyId: string;
  runbookPolicyId: string;
  retry: {
    verify: SettlementRetryOptions;
    settle: SettlementRetryOptions;
  };
  recommendedActions?: Partial<Record<SettlementFailureReasonCode, string>>;
  finality: {
    finalityPolicyId: string;
    hook: SettlementFinalityHook;
  };
}

export interface SettlementRunbookDirective {
  runbookPolicyId: string;
  manualActionRequired: boolean;
  recommendedAction: string;
  reasonCode: SettlementFailureReasonCode;
}

export async function verifySettlementProof(
  proof: SettlementProof,
  provider: SettlementProofProvider
): Promise<boolean> {
  const isValid = await provider.verifyProof(proof);
  if (!isValid) {
    throw new SettlementProofInvalidError();
  }

  return true;
}

function assertRequiredString(
  value: unknown,
  field: string,
  context: string
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProtocolCompatibilityError(`${context} missing required field: ${field}`);
  }

  return value;
}

function getReplayFingerprintMap(store: SettlementReplayStore): Map<string, string> {
  const existing = replayFingerprintRegistry.get(store);
  if (existing) {
    return existing;
  }
  const created = new Map<string, string>();
  replayFingerprintRegistry.set(store, created);
  return created;
}

function computeIdempotencyFingerprint(input: ExecuteSettlementInput): string {
  return JSON.stringify({
    invoiceId: input.invoice.invoiceId,
    orderRef: input.invoice.orderRef,
    ttmHash: input.ttmHash,
    proof: {
      txHash: input.proof.txHash,
      chainId: input.proof.chainId,
      payer: input.proof.payer,
      payee: input.proof.payee,
      amount: input.proof.amount,
      proofType: input.proof.proofType
    }
  });
}

function readStoredFingerprint(record: SettlementExecutionRecord): string | null {
  const withInternal = record as SettlementExecutionRecord & {
    [IDEMPOTENCY_FINGERPRINT_FIELD]?: string;
  };
  return typeof withInternal[IDEMPOTENCY_FINGERPRINT_FIELD] === "string"
    ? withInternal[IDEMPOTENCY_FINGERPRINT_FIELD]
    : null;
}

function attachRunbookDirective<TError extends Error>(
  error: TError,
  options: SettlementExecutionOptions | null,
  reasonCode: SettlementFailureReasonCode
): TError & Partial<SettlementRunbookDirective> {
  if (!options) {
    return error as TError & Partial<SettlementRunbookDirective>;
  }

  const enriched = error as TError & Partial<SettlementRunbookDirective>;
  enriched.runbookPolicyId = options.runbookPolicyId;
  enriched.manualActionRequired = true;
  enriched.reasonCode = reasonCode;
  enriched.recommendedAction =
    options.recommendedActions?.[reasonCode] ??
    `manual_review_${reasonCode.toLowerCase()}`;

  return enriched;
}

function assertRetryOptions(options: SettlementRetryOptions, label: "verify" | "settle"): void {
  if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1) {
    throw new ProtocolCompatibilityError(
      `settlement ${label} retry.maxAttempts must be a positive integer`
    );
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1) {
    throw new ProtocolCompatibilityError(
      `settlement ${label} retry.timeoutMs must be a positive integer`
    );
  }
  if (!Number.isInteger(options.backoffMs) || options.backoffMs < 0) {
    throw new ProtocolCompatibilityError(
      `settlement ${label} retry.backoffMs must be a non-negative integer`
    );
  }
  if (
    options.jitterMs !== undefined &&
    (!Number.isInteger(options.jitterMs) || options.jitterMs < 0)
  ) {
    throw new ProtocolCompatibilityError(
      `settlement ${label} retry.jitterMs must be a non-negative integer`
    );
  }
}

function assertExecutionOptions(
  options: SettlementExecutionOptions | undefined
): SettlementExecutionOptions | null {
  if (!options) {
    return null;
  }

  assertRequiredString(options.facilitatorPolicyId, "facilitatorPolicyId", "settlement options");
  assertRequiredString(options.runbookPolicyId, "runbookPolicyId", "settlement options");

  if (!options.retry) {
    throw new ProtocolCompatibilityError("settlement options missing required field: retry");
  }
  assertRetryOptions(options.retry.verify, "verify");
  assertRetryOptions(options.retry.settle, "settle");

  if (!options.finality) {
    throw new ProtocolCompatibilityError("settlement options missing required field: finality");
  }
  assertRequiredString(
    options.finality.finalityPolicyId,
    "finalityPolicyId",
    "settlement options"
  );
  if (
    !options.finality.hook ||
    typeof options.finality.hook.checkFinality !== "function"
  ) {
    throw new ProtocolCompatibilityError(
      "settlement options missing required field: finality.hook.checkFinality"
    );
  }

  return options;
}

function createTimeoutError(phase: "verify" | "settle", timeoutMs: number): Error {
  const error = new Error(`Facilitator ${phase} timed out after ${timeoutMs}ms`);
  error.name = "TimeoutError";
  return error;
}

function readErrorStatusCode(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const withStatus = error as { status?: unknown; statusCode?: unknown };
  if (typeof withStatus.status === "number") {
    return withStatus.status;
  }
  if (typeof withStatus.statusCode === "number") {
    return withStatus.statusCode;
  }
  return null;
}

function isRetryableError(error: unknown): boolean {
  if (
    error instanceof ProtocolCompatibilityError ||
    error instanceof VerificationDeclinedError ||
    error instanceof SettlementProofInvalidError
  ) {
    return false;
  }

  if (error instanceof Error && error.name === "TimeoutError") {
    return true;
  }

  const statusCode = readErrorStatusCode(error);
  if (statusCode === null) {
    return true;
  }
  if (statusCode >= 500) {
    return true;
  }
  if (statusCode >= 400) {
    return false;
  }

  return true;
}

async function waitMs(durationMs: number): Promise<void> {
  if (durationMs <= 0) {
    return;
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function computeBackoffDelay(
  options: SettlementRetryOptions,
  attemptNumber: number
): number {
  if (options.backoffMs <= 0) {
    return 0;
  }
  const base = options.backoffMs * 2 ** Math.max(0, attemptNumber - 1);
  const jitterMax = options.jitterMs ?? 0;
  const jitter =
    jitterMax > 0 ? Math.floor(Math.random() * (jitterMax + 1)) : 0;
  return base + jitter;
}

async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  phase: "verify" | "settle"
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<T>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        reject(createTimeoutError(phase, timeoutMs));
      }, timeoutMs);
    });
    return await Promise.race([work, timeoutPromise]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

async function callFacilitatorWithRetry<T>(
  phase: "verify" | "settle",
  options: SettlementExecutionOptions | null,
  operation: () => Promise<T>
): Promise<T> {
  if (!options) {
    return operation();
  }

  const retryOptions = phase === "verify" ? options.retry.verify : options.retry.settle;
  let lastError: unknown;

  for (let attempt = 1; attempt <= retryOptions.maxAttempts; attempt += 1) {
    try {
      return await withTimeout(operation(), retryOptions.timeoutMs, phase);
    } catch (error) {
      lastError = error;
      if (attempt === retryOptions.maxAttempts || !isRetryableError(error)) {
        throw error;
      }
      const backoffDelay = computeBackoffDelay(retryOptions, attempt);
      await waitMs(backoffDelay);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Unknown ${phase} facilitator failure`);
}

function assertVerifyResponseContract(response: FacilitatorVerifyResponse): void {
  if (response.status !== "approved" && response.status !== "declined") {
    throw new ProtocolCompatibilityError(
      "facilitator verify response has invalid status"
    );
  }
  assertRequiredString(response.verificationId, "verificationId", "facilitator verify response");
  assertRequiredString(response.verifiedAt, "verifiedAt", "facilitator verify response");
}

function assertSettleResponseContract(response: FacilitatorSettleResponse): void {
  if (response.status !== "settled" && response.status !== "failed") {
    throw new ProtocolCompatibilityError(
      "facilitator settle response has invalid status"
    );
  }
  assertRequiredString(response.settlementId, "settlementId", "facilitator settle response");
  assertRequiredString(response.settledAt, "settledAt", "facilitator settle response");
  if (response.status === "settled") {
    assertRequiredString(response.txHash, "txHash", "facilitator settle response");
  }
}

function assertSettlementReceiptContract(receipt: SettlementReceipt): void {
  assertRequiredString(receipt.receiptId, "receiptId", "settlement receipt");
  assertRequiredString(receipt.invoiceId, "invoiceId", "settlement receipt");
  assertRequiredString(receipt.idempotencyKey, "idempotencyKey", "settlement receipt");
  assertRequiredString(receipt.ttmHash, "ttmHash", "settlement receipt");
  assertRequiredString(receipt.txHash, "txHash", "settlement receipt");
  assertRequiredString(receipt.auditLogId, "auditLogId", "settlement receipt");
  assertRequiredString(receipt.createdAt, "createdAt", "settlement receipt");
  if (receipt.verifyResult !== "approved" || receipt.settleResult !== "settled") {
    throw new ProtocolCompatibilityError(
      "settlement receipt requires approved verifyResult and settled settleResult"
    );
  }
}

export function createInMemorySettlementReplayStore(): SettlementReplayStore {
  const cache = new Map<string, SettlementExecutionRecord>();

  return {
    get: (idempotencyKey) => cache.get(idempotencyKey) ?? null,
    set: (idempotencyKey, record) => {
      cache.set(idempotencyKey, record);
    }
  };
}

export async function executeSettlement(
  input: ExecuteSettlementInput,
  adapter: FacilitatorSettlementAdapter,
  replayStore: SettlementReplayStore,
  options?: SettlementExecutionOptions
): Promise<SettlementExecutionResult> {
  const idempotencyKey = assertRequiredString(
    input.idempotencyKey,
    "idempotencyKey",
    "settlement request"
  );
  const ttmHash = assertRequiredString(input.ttmHash, "ttmHash", "settlement request");
  const executionOptions = assertExecutionOptions(options);
  const idempotencyFingerprint = computeIdempotencyFingerprint(input);
  const fingerprintMap = getReplayFingerprintMap(replayStore);
  const intentId =
    (typeof (input as { intentId?: unknown }).intentId === "string" &&
      (input as { intentId?: string }).intentId?.trim().length
      ? (input as { intentId?: string }).intentId
      : undefined) ?? input.invoice.orderRef;

  const existing = await replayStore.get(idempotencyKey);
  if (existing) {
    const existingFingerprint =
      readStoredFingerprint(existing) ?? fingerprintMap.get(idempotencyKey) ?? null;
    if (existingFingerprint !== null && existingFingerprint !== idempotencyFingerprint) {
      throw attachRunbookDirective(
        new ProtocolCompatibilityError(
          "Idempotency key already used with a different settlement request"
        ),
        executionOptions,
        "IDEMPOTENCY_KEY_COLLISION"
      );
    }
    fingerprintMap.set(idempotencyKey, existingFingerprint ?? idempotencyFingerprint);
    return {
      ...existing,
      replayed: true
    };
  }

  const verifyResponse = await callFacilitatorWithRetry("verify", executionOptions, async () =>
    adapter.verify({
      invoiceId: input.invoice.invoiceId,
      idempotencyKey,
      ttmHash,
      intentId,
      facilitatorPolicyId: executionOptions?.facilitatorPolicyId
    } as never)
  ).catch((error: unknown) => {
    if (error instanceof ProtocolCompatibilityError) {
      throw error;
    }
    const wrapped =
      error instanceof Error
        ? error
        : new VerificationDeclinedError("Facilitator verify call failed");
    throw attachRunbookDirective(
      wrapped,
      executionOptions,
      "VERIFY_CALL_FAILED"
    );
  });
  assertVerifyResponseContract(verifyResponse);

  if (verifyResponse.status === "declined") {
    throw attachRunbookDirective(
      new VerificationDeclinedError(
        verifyResponse.reason ?? "Facilitator verification declined"
      ),
      executionOptions,
      "VERIFY_DECLINED"
    );
  }

  const settleResponse = await callFacilitatorWithRetry("settle", executionOptions, async () =>
    adapter.settle({
      invoiceId: input.invoice.invoiceId,
      idempotencyKey,
      verificationId: verifyResponse.verificationId,
      ttmHash,
      intentId,
      facilitatorPolicyId: executionOptions?.facilitatorPolicyId,
      proof: input.proof
    } as never)
  ).catch((error: unknown) => {
    if (error instanceof ProtocolCompatibilityError) {
      throw error;
    }
    throw attachRunbookDirective(
      new SettlementProofInvalidError(
        error instanceof Error ? error.message : "Facilitator settlement call failed"
      ),
      executionOptions,
      "SETTLE_CALL_FAILED"
    );
  });
  assertSettleResponseContract(settleResponse);

  if (settleResponse.status === "failed") {
    throw attachRunbookDirective(
      new SettlementProofInvalidError(
        settleResponse.reason ?? "Facilitator settlement failed"
      ),
      executionOptions,
      "SETTLE_FAILED"
    );
  }

  if (executionOptions) {
    const finalityInput = {
      txHash: settleResponse.txHash,
      chainId: input.proof.chainId,
      invoiceId: input.invoice.invoiceId,
      idempotencyKey,
      ttmHash,
      intentId,
      finalityPolicyId: executionOptions.finality.finalityPolicyId
    };
    const finalityResult = await executionOptions.finality.hook
      .checkFinality(finalityInput)
      .catch((error: unknown) => {
        throw attachRunbookDirective(
          new SettlementProofInvalidError(
            error instanceof Error ? error.message : "Finality check failed"
          ),
          executionOptions,
          "FINALITY_CHECK_FAILED"
        );
      });

    if (finalityResult.reorgDetected) {
      if (executionOptions.finality.hook.onReorg) {
        await executionOptions.finality.hook.onReorg(finalityInput);
      }
      throw attachRunbookDirective(
        new SettlementProofInvalidError(
          finalityResult.reason ?? "Reorg detected after settlement confirmation"
        ),
        executionOptions,
        "REORG_DETECTED"
      );
    }
    if (!finalityResult.finalized) {
      throw attachRunbookDirective(
        new SettlementProofInvalidError(
          finalityResult.reason ?? "Settlement finality is not confirmed"
        ),
        executionOptions,
        "FINALITY_NOT_CONFIRMED"
      );
    }
  }

  const receipt: SettlementReceipt = {
    receiptId: settleResponse.settlementId,
    invoiceId: input.invoice.invoiceId,
    idempotencyKey,
    ttmHash,
    verifyResult: "approved",
    settleResult: "settled",
    txHash: settleResponse.txHash,
    auditLogId: `${verifyResponse.verificationId}:${settleResponse.settlementId}`,
    createdAt: settleResponse.settledAt
  };
  assertSettlementReceiptContract(receipt);

  const confirmation = mapProofToOrderConfirmation(
    {
      ...input.proof,
      txHash: settleResponse.txHash,
      confirmedAt: settleResponse.settledAt
    },
    input.invoice,
    receipt
  );

  const record: SettlementExecutionRecord = {
    confirmation,
    receipt
  };
  const withFingerprint = {
    ...record,
    [IDEMPOTENCY_FINGERPRINT_FIELD]: idempotencyFingerprint
  };
  await replayStore.set(idempotencyKey, withFingerprint as SettlementExecutionRecord);
  fingerprintMap.set(idempotencyKey, idempotencyFingerprint);

  return {
    ...record,
    replayed: false
  };
}

export function mapProofToOrderConfirmation(
  proof: SettlementProof,
  invoice: InvoicePayload,
  receipt?: SettlementReceipt
): OrderConfirmation {
  const confirmation: OrderConfirmation = {
    orderId: invoice.orderRef,
    invoiceId: invoice.invoiceId,
    status: "confirmed",
    confirmedAt: proof.confirmedAt,
    settlementTxHash: receipt ? receipt.txHash : proof.txHash
  };

  if (receipt) {
    confirmation.settlementReceiptId = receipt.receiptId;
    confirmation.auditLogId = receipt.auditLogId;
    confirmation.idempotencyKey = receipt.idempotencyKey;
  }

  return confirmation;
}
