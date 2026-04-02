import {
  propertyEmitter,
  PropertyEvents,
  PropertyApprovedData,
  PropertyRejectedData,
  PropertySubmittedData,
} from '../propertyEventEmitter';
import { NotificationService } from '../../modules/notification/notification.service';
import { logger } from '../../config/logger';

const notificationService = new NotificationService();

// Submitted
propertyEmitter.on(
  PropertyEvents.SUBMITTED,
  async (data: PropertySubmittedData) => {
    try {
      const { property, submittedBy } = data;

      logger.info({ propertyId: property.propertyId }, 'Property submitted event');

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
          type: 'PROPERTY_SUBMITTED',
          title: 'New Property Submitted for Review',
          message: `Property "${property.propertyName}" (${property.propertyCode}) has been submitted for review.`,
          entityType: 'PROPERTY',
          entityId: property.propertyId,
          actionUrl: `/dashboard/property/${property.propertyId}`,
        }))
      );

      logger.info(
        { propertyId: property.propertyId, count: notifyUsers.length },
        'Submission notifications created'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to handle submission event');
    }
  }
);

// Approved
propertyEmitter.on(
  PropertyEvents.APPROVED,
  async (data: PropertyApprovedData) => {
    try {
      const { property, approvedBy } = data;

      logger.info({ propertyId: property.propertyId }, 'Property approved event');

      if (!property.createdBy || property.createdBy === approvedBy) {
        return;
      }

      await notificationService.createNotification({
        userId: property.createdBy,
        createdById: approvedBy,
        type: 'PROPERTY_APPROVED',
        title: 'Property Approved',
        message: `Your property "${property.propertyName}" (${property.propertyCode}) has been approved.`,
        entityType: 'PROPERTY',
        entityId: property.propertyId,
        actionUrl: `/dashboard/property/${property.propertyId}`,
      });

      logger.info({ propertyId: property.propertyId }, 'Approval notification created');
    } catch (error) {
      logger.error({ error }, 'Failed to handle approval event');
    }
  }
);

// Rejected
propertyEmitter.on(
  PropertyEvents.REJECTED,
  async (data: PropertyRejectedData) => {
    try {
      const { property, rejectedBy, reason } = data;

      logger.info({ propertyId: property.propertyId }, 'Property rejected event');

      if (!property.createdBy || property.createdBy === rejectedBy) {
        return;
      }

      await notificationService.createNotification({
        userId: property.createdBy,
        createdById: rejectedBy,
        type: 'PROPERTY_REJECTED',
        title: 'Property Rejected',
        message: `Your property "${property.propertyName}" (${property.propertyCode}) has been rejected. Reason: ${reason}`,
        entityType: 'PROPERTY',
        entityId: property.propertyId,
        actionUrl: `/dashboard/property/${property.propertyId}`,
      });

      logger.info({ propertyId: property.propertyId }, 'Rejection notification created');
    } catch (error) {
      logger.error({ error }, 'Failed to handle rejection event');
    }
  }
);
