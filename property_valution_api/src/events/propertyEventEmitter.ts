import { EventEmitter } from 'events';

export enum PropertyEvents {
  SUBMITTED = 'property:submitted',
  APPROVED = 'property:approved',
  REJECTED = 'property:rejected',
}

export interface PropertySubmittedData {
  property: any;
  submittedBy: number;
}

export interface PropertyApprovedData {
  property: any;
  approvedBy: number;
  notes?: string;
}

export interface PropertyRejectedData {
  property: any;
  rejectedBy: number;
  reason: string;
}

export const propertyEmitter = new EventEmitter();
propertyEmitter.setMaxListeners(20);

