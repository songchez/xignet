export interface X402Challenge {
  scheme: string;
  invoiceUrl: string;
  amount?: number;
  currency?: string;
  merchant?: string;
  network?: string;
  payTo?: string;
  resource?: string;
  asset?: string;
  nonce?: string;
  expiresAt?: string;
  rawHeader: string;
}

// Canonical hash contract: JCS(RFC 8785) + SHA-256, 64-char lowercase hex.
export type TtmHashHex = string;

// External input/display representation.
export type DecimalAmountString = string;

// Internal settlement/verification representation.
export type AtomicAmountString = string;

export interface PolicyRefs {
  legalPolicyId: string;
  webauthnPolicyId: string;
  retentionPolicyId: string;
  runbookPolicyId: string;
  finalityPolicyId: string;
}

export interface ParsePaymentRequiredOptions {
  requirePolicyRefs?: boolean;
  requireTtmHash?: boolean;
}

export interface PaymentRequirementAcceptance {
  scheme: string;
  network: string;
  maxAmountRequired: DecimalAmountString;
  maxAmountRequiredAtomic?: AtomicAmountString;
  assetScale?: number;
  payTo: string;
  resource: string;
  asset: string;
}

export interface PaymentRequirement {
  x402Version: 2;
  accepts: PaymentRequirementAcceptance[];
  ttmHash?: TtmHashHex;
  policyRefs?: PolicyRefs;
}

export interface CompatibilityParsedChallenge {
  source: "v2" | "legacy";
  paymentRequirement: PaymentRequirement;
  rawHeader: string;
}

export type TtmHashValidationHook = (input: {
  paymentRequirement: PaymentRequirement;
  expectedTtmHash: TtmHashHex;
  receivedTtmHash: TtmHashHex | undefined;
}) => boolean;

export interface InvoiceLineItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface InvoicePayload {
  invoiceId: string;
  merchantId: string;
  orderRef: string;
  lineItems: InvoiceLineItem[];
  totalAmount: number;
  currency: string;
  issuedAt: string;
  expiry: string;
  signature: string;
}

export interface VerificationRequest {
  invoiceId: string;
  displayText: string;
  challenge: string;
  ttm: TransactionTermsManifest;
  ttmHash: string;
  webauthnOptions?: Record<string, unknown>;
}

export interface VerificationResult {
  approved: true;
  assertion: unknown;
  signerDeviceId: string;
  signedAt: string;
  ttmHash: string;
  consentReceipt: ConsentReceipt;
}

export type TransactionItemType = "physical" | "digital" | "content" | "token" | "service";

export interface TransactionTermsLineItem {
  itemType: TransactionItemType;
  itemRef: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  amount: string;
}

export interface TransactionTermsManifest {
  ttmVersion: string;
  intentId: string;
  merchantId: string;
  buyerId: string;
  lineItems: TransactionTermsLineItem[];
  totalAmount: string;
  currency: string;
  maxAllowedAmount: string;
  expiresAt: string;
  idempotencyKey: string;
  policy: Record<string, unknown>;
  policyRefs?: PolicyRefs;
  termsVersion: string;
  metadata?: Record<string, unknown>;
  shipping?: Record<string, unknown>;
  fulfillment?: Record<string, unknown>;
  jurisdiction?: Record<string, unknown>;
  taxBreakdown?: Record<string, unknown>;
}

export interface ConsentReceipt {
  receiptVersion: "1.0";
  invoiceId: string;
  intentId: string;
  ttmHash: TtmHashHex;
  approvedAt: string;
  authMethod: "webauthn";
  termsVersion: string;
  signerDeviceId: string;
  assertion: unknown;
}

export interface SettlementProof {
  txHash: string;
  chainId: string;
  payer: string;
  payee: string;
  amount: number;
  confirmedAt: string;
  proofType: string;
}

export interface OrderConfirmation {
  orderId: string;
  invoiceId: string;
  status: "confirmed";
  confirmedAt: string;
  settlementTxHash?: string;
  settlementReceiptId?: string;
  auditLogId?: string;
  idempotencyKey?: string;
}

export interface FacilitatorVerifyRequest {
  invoiceId: string;
  idempotencyKey: string;
  ttmHash: TtmHashHex;
}

export interface FacilitatorVerifyResponse {
  status: "approved" | "declined";
  verificationId: string;
  verifiedAt: string;
  reason?: string;
}

export interface FacilitatorSettleRequest {
  invoiceId: string;
  idempotencyKey: string;
  verificationId: string;
  ttmHash: TtmHashHex;
  proof: SettlementProof;
}

export interface FacilitatorSettleResponse {
  status: "settled" | "failed";
  settlementId: string;
  txHash: string;
  settledAt: string;
  reason?: string;
}

export interface FacilitatorSettlementAdapter {
  verify(request: FacilitatorVerifyRequest): Promise<FacilitatorVerifyResponse>;
  settle(request: FacilitatorSettleRequest): Promise<FacilitatorSettleResponse>;
}

export interface SettlementReceipt {
  receiptId: string;
  invoiceId: string;
  idempotencyKey: string;
  ttmHash: TtmHashHex;
  verifyResult: "approved";
  settleResult: "settled";
  txHash: string;
  auditLogId: string;
  createdAt: string;
}

export interface SettlementExecutionRecord {
  confirmation: OrderConfirmation;
  receipt: SettlementReceipt;
}

export interface SettlementExecutionResult extends SettlementExecutionRecord {
  replayed: boolean;
}

export interface SettlementReplayStore {
  get(
    idempotencyKey: string
  ): Promise<SettlementExecutionRecord | null> | SettlementExecutionRecord | null;
  set(
    idempotencyKey: string,
    record: SettlementExecutionRecord
  ): Promise<void> | void;
}

export interface ExecuteSettlementInput {
  invoice: InvoicePayload;
  proof: SettlementProof;
  idempotencyKey: string;
  ttmHash: TtmHashHex;
}

export interface InvoiceTrustStore {
  verifyInvoiceSignature(invoice: InvoicePayload): Promise<boolean> | boolean;
}

export interface AssertionVerifier {
  verify(
    request: VerificationRequest,
    assertion: unknown
  ): Promise<{ signerDeviceId: string; signedAt: string; ttmHash: TtmHashHex } | null>;
}

export interface SettlementProofProvider {
  verifyProof(proof: SettlementProof): Promise<boolean> | boolean;
}

export type Fetcher = (
  input: string,
  init?: RequestInit
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
