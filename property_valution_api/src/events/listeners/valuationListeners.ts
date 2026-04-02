import {
  valuationEmitter,
  ValuationEvents,
  ValuationSubmittedData,
  ValuationApprovedData,
  ValuationRejectedData,
} from '../eventEmitter';
import { NotificationService } from '../../modules/notification/notification.service';
import { logger } from '../../config/logger';

const notificationService = new NotificationService();

// Submitted
valuationEmitter.on(
  ValuationEvents.SUBMITTED,
  async (data: ValuationSubmittedData) => {
    try {
      const { valuation, submittedBy } = data;

      logger.info({ valuationId: valuation.valuationId }, 'Valuation submitted event');

      const privilegedUsers = await notificationService.getPrivilegedUsers();
      const notifyUsers = privilegedUsers.filter(id => id !== submittedBy);

      if (notifyUsers.length === 0) {
        logger.warn('No reviewers to notify');
        return;
      }

      await notificationService.createManyNotifications(
        notifyUsers.map(userId => ({
          userId,
          createdById: submittedBy,
          type: 'VALUATION_SUBMITTED',
          title: 'New Valuation Submitted for Review',
          message: `Valuation ${valuation.valuationNo} for ${valuation.property?.propertyName || 'property'} has been submitted for review.`,
          entityType: 'VALUATION',
          entityId: valuation.valuationId,
          actionUrl: `/dashboard/propertyValuation/${valuation.valuationId}`,
        }))
      );

      logger.info(
        { valuationId: valuation.valuationId, count: notifyUsers.length },
        'Submission notifications created'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to handle submission event');
    }
  }
);

// Approved
valuationEmitter.on(
  ValuationEvents.APPROVED,
  async (data: ValuationApprovedData) => {
    try {
      const { valuation, approvedBy } = data;

      logger.info({ valuationId: valuation.valuationId }, 'Valuation approved event');

      if (!valuation.valuerId || valuation.valuerId === approvedBy) {
        return;
      }

      await notificationService.createNotification({
        userId: valuation.valuerId,
        createdById: approvedBy,
        type: 'VALUATION_APPROVED',
        title: 'Valuation Approved',
        message: `Your valuation ${valuation.valuationNo} for ${valuation.property?.propertyName || 'property'} has been approved.`,
        entityType: 'VALUATION',
        entityId: valuation.valuationId,
        actionUrl: `/dashboard/propertyValuation/${valuation.valuationId}`,
      });

      logger.info({ valuationId: valuation.valuationId }, 'Approval notification created');
    } catch (error) {
      logger.error({ error }, 'Failed to handle approval event');
    }
  }
);

// Rejected
valuationEmitter.on(
  ValuationEvents.REJECTED,
  async (data: ValuationRejectedData) => {
    try {
      const { valuation, rejectedBy,  rejectionReason } = data;

      logger.info({ valuationId: valuation.valuationId }, 'Valuation rejected event');

      if (!valuation.valuerId || valuation.valuerId === rejectedBy) {
        return;
      }

      await notificationService.createNotification({
        userId: valuation.valuerId,
        createdById: rejectedBy,
        type: 'VALUATION_REJECTED',
        title: 'Valuation Rejected',
        message: `Your valuation ${valuation.valuationNo} has been rejected. Reason: ${ rejectionReason}`,
        entityType: 'VALUATION',
        entityId: valuation.valuationId,
        actionUrl: `/dashboard/propertyValuation/${valuation.valuationId}`,
      });

      logger.info({ valuationId: valuation.valuationId }, 'Rejection notification created');
    } catch (error) {
      logger.error({ error }, 'Failed to handle rejection event');
    }
  }
);
