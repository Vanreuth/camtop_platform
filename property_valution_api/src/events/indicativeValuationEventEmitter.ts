import { EventEmitter } from "events";

export enum IndicativeValuationEvents {
  SUBMITTED = "indicative-valuation.submitted",
  APPROVED = "indicative-valuation.approved",
  REJECTED = "indicative-valuation.rejected",
}

export interface IndicativeValuationSubmittedData {
  valuation: any;
  submittedBy: number;
}

export interface IndicativeValuationApprovedData {
  valuation: any;
  approvedBy: number;
  notes?: string;
}

export interface IndicativeValuationRejectedData {
  valuation: any;
  rejectedBy: number;
  rejectionReason: string;
}

export const indicativeValuationEmitter = new EventEmitter();
indicativeValuationEmitter.setMaxListeners(20);
