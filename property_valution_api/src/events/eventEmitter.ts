import { EventEmitter } from "events";

export enum ValuationEvents {
    SUBMITTED  = "valuation.submitted",
    APPROVED   = "valuation.approved",
    REJECTED   = "valuation.rejected",
}

export const valuationEmitter = new EventEmitter();
valuationEmitter.setMaxListeners(20);

export interface ValuationSubmittedData{
    valuation: any;
    submittedBy: number;
}

export interface ValuationApprovedData{
    valuation: any;
    approvedBy: number;
    notes?: string;
}

export interface ValuationRejectedData{
    valuation: any;
    rejectedBy: number;
    rejectionReason: string;
}