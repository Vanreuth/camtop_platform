# Property Workflow Implementation Guide

## Overview
The property workflow system has been successfully implemented, mirroring the property valuation approval process. This provides status-based lifecycle management, role-based permissions, and automatic notifications.

## 🎉 What's Been Implemented

### Backend (Property Valuation API)

#### 1. **Database Schema** (`prisma/schema.prisma`)
- ✅ Updated `PropertyStatus` enum with workflow statuses
- ✅ Fixed `NotificationType` enum (PROPERTY_SUBMITTED, PROPERTY_APPROVED, PROPERTY_REJECTED)
- ✅ Added workflow timestamp fields

#### 2. **Service Layer** (`property.service.ts`)
- ✅ `submitPropertyForReview()` - Submit property for review
- ✅ `approveProperty()` - Approve pending property
- ✅ `rejectProperty()` - Reject property with reason
- ✅ `archiveProperty()` - Archive property
- ✅ `restoreProperty()` - Restore archived property

#### 3. **Controller Layer** (`property.controller.ts`)
- ✅ POST `/api/properties/:id/submit-for-review`
- ✅ POST `/api/properties/:id/approve`
- ✅ POST `/api/properties/:id/reject`
- ✅ POST `/api/properties/:id/archive`
- ✅ POST `/api/properties/:id/restore`

#### 4. **Routes** (`property.routes.ts`)
- ✅ Workflow routes with proper authentication
- ✅ Permission-based middleware (hierarchyLevel checks)

#### 5. **Event System**
- ✅ `propertyEventEmitter.ts` - Event emitter for property lifecycle
- ✅ `propertyEventListeners.ts` - Notification handlers
- ✅ Automatic notifications on status changes

### Frontend (Property Valuation System)

#### 1. **API Layer** (`property.api.ts`)
- ✅ `submitForReview()` - API call to submit property
- ✅ `approveProperty()` - API call to approve
- ✅ `rejectProperty()` - API call to reject
- ✅ `archiveProperty()` - API call to archive
- ✅ `restoreProperty()` - API call to restore

#### 2. **React Hooks** (`useProperty.ts`)
- ✅ `useSubmitPropertyForReview()` - Submit mutation hook
- ✅ `useApproveProperty()` - Approve mutation hook
- ✅ `useRejectProperty()` - Reject mutation hook
- ✅ `useArchiveProperty()` - Archive mutation hook
- ✅ `useRestoreProperty()` - Restore mutation hook

#### 3. **Type Definitions**
- ✅ `ApprovePropertyInput` type
- ✅ `RejectPropertyInput` type
- ✅ Updated `Property` interface with workflow fields

#### 4. **Validation Schemas** (`property.schema.ts`)
- ✅ `approvePropertySchema` - Zod schema for approval
- ✅ `rejectPropertySchema` - Zod schema for rejection

#### 5. **UI Components**
- ✅ `PropertyWorkflowActions` - Workflow action buttons with dialogs
- ✅ `PropertyStatusBadge` - Status badge with icons and colors
- ✅ `usePropertyStatus` - Hook for status information

## 📋 Usage Examples

### Example 1: Using PropertyWorkflowActions Component

```tsx
import { PropertyWorkflowActions } from "@/components/property";

function PropertyDetailPage({ property }: { property: Property }) {
  const { data: user } = useUser();
  
  // Determine permissions based on user role
  const canSubmit = property.status === "ACTIVE" || property.status === "REJECTED";
  const canApprove = user?.hierarchyLevel <= 2; // Admin/Manager only
  const canReject = user?.hierarchyLevel <= 2;
  const canArchive = user?.hierarchyLevel <= 2;
  const canRestore = user?.hierarchyLevel <= 2 && property.status === "ARCHIVED";

  return (
    <div>
      <h1>{property.propertyName}</h1>
      
      <PropertyWorkflowActions
        propertyId={property.propertyId}
        status={property.status}
        canSubmit={canSubmit}
        canApprove={canApprove}
        canReject={canReject}
        canArchive={canArchive}
        canRestore={canRestore}
        onSuccess={() => {
          // Refresh property data or navigate
          console.log("Workflow action completed");
        }}
      />
    </div>
  );
}
```

### Example 2: Using PropertyStatusBadge Component

```tsx
import { PropertyStatusBadge } from "@/components/property";

function PropertyCard({ property }: { property: Property }) {
  return (
    <div className="property-card">
      <h3>{property.propertyName}</h3>
      <PropertyStatusBadge status={property.status} showIcon={true} />
    </div>
  );
}
```

### Example 3: Using Individual Workflow Hooks

```tsx
import {
  useSubmitPropertyForReview,
  useApproveProperty,
  useRejectProperty,
} from "@/hooks/property/useProperty";

function PropertyActions({ propertyId }: { propertyId: number }) {
  const submitMutation = useSubmitPropertyForReview();
  const approveMutation = useApproveProperty();
  const rejectMutation = useRejectProperty();

  const handleSubmit = () => {
    submitMutation.mutate(propertyId);
  };

  const handleApprove = () => {
    approveMutation.mutate({
      id: propertyId,
      data: { notes: "All requirements met" },
    });
  };

  const handleReject = () => {
    rejectMutation.mutate({
      id: propertyId,
      data: { reason: "Missing documentation" },
    });
  };

  return (
    <div>
      <button onClick={handleSubmit}>Submit for Review</button>
      <button onClick={handleApprove}>Approve</button>
      <button onClick={handleReject}>Reject</button>
    </div>
  );
}
```

### Example 4: Using usePropertyStatus Hook

```tsx
import { usePropertyStatus } from "@/components/property";

function PropertyInfo({ property }: { property: Property }) {
  const statusInfo = usePropertyStatus(property.status);

  return (
    <div>
      <p>Status: {statusInfo.label}</p>
      {statusInfo.isPendingReview && (
        <p>⏳ This property is awaiting review</p>
      )}
      {statusInfo.canApprove && (
        <button>You can approve this property</button>
      )}
    </div>
  );
}
```

## 🔑 Permission Requirements

| Action | Required Permission | Hierarchy Level |
|--------|-------------------|----------------|
| Submit for Review | `property:manage` | ≤4 (any user) |
| Approve Property | `property:approve` | ≤2 (admin/manager) |
| Reject Property | `property:approve` | ≤2 (admin/manager) |
| Archive Property | `property:manage` | ≤2 (admin/manager) |
| Restore Property | `property:manage` | ≤2 (admin/manager) |

## 📊 Status Flow Diagram

```
ACTIVE ─────────┬──────► PENDING_REVIEW
                │               │
REJECTED ───────┘               ├────► IN_REVIEW
                                │          │
                                ├──────────┼────► APPROVED
                                │          │
                                └──────────┴────► REJECTED
                                                      │
ANY STATUS ──────────────────────────► ARCHIVED      │
                                           │          │
ARCHIVED ──────────────────────────► ACTIVE ◄────────┘
```

## 🔔 Notification System

### Automatic Notifications Sent:

1. **Property Submitted** (`PROPERTY_SUBMITTED`)
   - Sent to: Property creator
   - When: Property is submitted for review
   - Message: "Your property [name] has been submitted for review"

2. **Property Approved** (`PROPERTY_APPROVED`)
   - Sent to: Property creator
   - When: Property is approved
   - Message: "Your property [name] has been approved!"

3. **Property Rejected** (`PROPERTY_REJECTED`)
   - Sent to: Property creator
   - When: Property is rejected
   - Message: "Your property [name] has been rejected. Reason: [reason]"

## 🔧 Configuration

### Environment Variables
No additional environment variables required.

### Middleware Configuration
The workflow routes use existing authentication and authorization middleware:

```typescript
// Example route configuration
propertyRoutes.post(
  "/:id/approve",
  authenticate,
  authorize(2, ["property:approve"]),
  validate(propertyIdParamSchema, "params"),
  PropertyController.approveProperty
);
```

## 📝 API Endpoints

### Submit Property for Review
```http
POST /api/properties/:id/submit-for-review
Authorization: Bearer <token>

Response:
{
  "status": "success",
  "message": "Property submitted for review successfully",
  "data": {
    "propertyId": 123,
    "status": "PENDING_REVIEW",
    "submittedForReviewAt": "2025-01-17T10:30:00Z"
  }
}
```

### Approve Property
```http
POST /api/properties/:id/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "notes": "All requirements verified" // Optional
}

Response:
{
  "status": "success",
  "message": "Property approved successfully",
  "data": {
    "propertyId": 123,
    "status": "APPROVED",
    "approvedAt": "2025-01-17T11:00:00Z",
    "approvedBy": 5
  }
}
```

### Reject Property
```http
POST /api/properties/:id/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Missing title documents" // Required
}

Response:
{
  "status": "success",
  "message": "Property rejected successfully",
  "data": {
    "propertyId": 123,
    "status": "REJECTED",
    "rejectedAt": "2025-01-17T11:15:00Z",
    "rejectedBy": 5
  }
}
```

## 🚀 Next Steps

### Immediate Actions:
1. ✅ Backend workflow implementation - **COMPLETE**
2. ✅ Frontend API integration - **COMPLETE**
3. ✅ UI components creation - **COMPLETE**
4. ⏭️ Integrate components into property detail pages
5. ⏭️ Add workflow status filters to property list
6. ⏭️ Test permission checks
7. ⏭️ Test notification delivery

### Future Enhancements:
- [ ] Add reviewer assignment functionality
- [ ] Implement comment/review system
- [ ] Add bulk workflow operations
- [ ] Create analytics dashboard for approval metrics
- [ ] Add email notifications
- [ ] Implement workflow history tracking

## 🐛 Troubleshooting

### Issue: Workflow buttons not showing
**Solution:** Check user permissions and property status. Ensure `canSubmit`, `canApprove`, etc. props are set correctly.

### Issue: Notifications not received
**Solution:** Verify event listeners are initialized in `app.ts`. Check notification service is working.

### Issue: Permission denied error
**Solution:** Verify user `hierarchyLevel` and permissions array. Admin/Manager needs level ≤ 2.

## 📚 Related Documentation

- [Property Approval Workflow](../property_valution_api/PROPERTY_APPROVAL_WORKFLOW.md) - Complete backend documentation
- [Property Valuation Workflow](./docs/valuation-workflow.md) - Similar implementation pattern

## 💡 Tips

1. **Status Checks**: Always check the property status before enabling workflow buttons
2. **Permissions**: Use `hierarchyLevel` to determine what actions users can perform
3. **Notifications**: Users receive automatic notifications - no manual notification calls needed
4. **Form Validation**: Rejection reason is required - forms include validation
5. **Optimistic Updates**: Hooks automatically update cache on successful mutations

---

**Implementation Status**: ✅ Complete and Ready to Use

For questions or issues, refer to the backend documentation or check the component source code for inline documentation.
