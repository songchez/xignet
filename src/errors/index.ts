export class InvoiceExpiredError extends Error {
  constructor(message = "Invoice has expired") {
    super(message);
    this.name = "InvoiceExpiredError";
  }
}

export class InvoiceSignatureInvalidError extends Error {
  constructor(message = "Invoice signature validation failed") {
    super(message);
    this.name = "InvoiceSignatureInvalidError";
  }
}

export class VerificationDeclinedError extends Error {
  constructor(message = "Verification was declined or invalid") {
    super(message);
    this.name = "VerificationDeclinedError";
  }
}

export class SettlementProofInvalidError extends Error {
  constructor(message = "Settlement proof validation failed") {
    super(message);
    this.name = "SettlementProofInvalidError";
  }
}

export class ProtocolCompatibilityError extends Error {
  constructor(message = "Protocol format is not compatible") {
    super(message);
    this.name = "ProtocolCompatibilityError";
  }
}
