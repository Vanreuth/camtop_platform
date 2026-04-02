import {
  indicativeValuationEmitter,
  IndicativeValuationEvents,
  IndicativeValuationApprovedData,
  IndicativeValuationRejectedData,
  IndicativeValuationSubmittedData,
} from "../indicativeValuationEventEmitter";
import { NotificationService } from "../../modules/notification/notification.service";
import { logger } from "../../config/logger";

const notificationService = new NotificationService();

indicativeValuationEmitter.on(
  IndicativeValuationEvents.SUBMITTED,
  async (data: IndicativeValuationSubmittedData) => {
    try {
      const { valuation, submittedBy } = data;

      logger.info(
        { indicationId: valuation.indicationId },
        "Indicative valuation submitted event"
      );

      const privilegedUsers = await notificationService.getPrivilegedUsers();
      const notifyUsers = privilegedUsers.filter((id) => id !== submittedBy);

      if (notifyUsers.length === 0) {
        logger.warn("No reviewers to notify for indicative valuation");
        return;
      }

      await notificationService.createManyNotifications(
        notifyUsers.map((userId) => ({
          userId,
          createdById: submittedBy,
          type: "INDICATIVE_VALUATION_SUBMITTED",
          title: "New Indicative Valuation Submitted for Review",
          message: `Indicative valuation ${valuation.indicationNo} for ${valuation.property?.propertyName || "property"} has been submitted for review.`,
          entityType: "INDICATIVE_VALUATION",
          entityId: valuation.indicationId,
          actionUrl: `/dashboard/propertyIndicativeValuation/${valuation.indicationId}`,
        }))
      );

      logger.info(
        { indicationId: valuation.indicationId, count: notifyUsers.length },
        "Indicative submission notifications created"
      );
    } catch (error) {
      logger.error({ error }, "Failed to handle indicative submission event");
    }
  }
);

indicativeValuationEmitter.on(
  IndicativeValuationEvents.APPROVED,
  async (data: IndicativeValuationApprovedData) => {
    try {
      const { valuation, approvedBy } = data;

      logger.info(
        { indicationId: valuation.indicationId },
        "Indicative valuation approved event"
      );

      if (!valuation.valuerId || valuation.valuerId === approvedBy) {
        return;
      }

      await notificationService.createNotification({
        userId: valuation.valuerId,
        createdById: approvedBy,
        type: "INDICATIVE_VALUATION_APPROVED",
        title: "Indicative Valuation Approved",
        message: `Your indicative valuation ${valuation.indicationNo} for ${valuation.property?.propertyName || "property"} has been approved.`,
        entityType: "INDICATIVE_VALUATION",
        entityId: valuation.indicationId,
        actionUrl: `/dashboard/propertyIndicativeValuation/${valuation.indicationId}`,
      });

      logger.info(
        { indicationId: valuation.indicationId },
        "Indicative approval notification created"
      );
    } catch (error) {
      logger.error({ error }, "Failed to handle indicative approval event");
    }
  }
);

indicativeValuationEmitter.on(
  IndicativeValuationEvents.REJECTED,
  async (data: IndicativeValuationRejectedData) => {
    try {
      const { valuation, rejectedBy, rejectionReason } = data;

      logger.info(
        { indicationId: valuation.indicationId },
        "Indicative valuation rejected event"
      );

      if (!valuation.valuerId || valuation.valuerId === rejectedBy) {
        return;
      }

      await notificationService.createNotification({
        userId: valuation.valuerId,
        createdById: rejectedBy,
        type: "INDICATIVE_VALUATION_REJECTED",
        title: "Indicative Valuation Rejected",
        message: `Your indicative valuation ${valuation.indicationNo} has been rejected. Reason: ${rejectionReason}`,
        entityType: "INDICATIVE_VALUATION",
        entityId: valuation.indicationId,
        actionUrl: `/dashboard/propertyIndicativeValuation/${valuation.indicationId}`,
      });

      logger.info(
        { indicationId: valuation.indicationId },
        "Indicative rejection notification created"
      );
    } catch (error) {
      logger.error({ error }, "Failed to handle indicative rejection event");
    }
  }
);
