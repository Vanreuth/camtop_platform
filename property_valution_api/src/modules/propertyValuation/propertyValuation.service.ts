import {
  CreatePropertyValuationDTO,
  valuationFiltersDTO,
  valuationPaginationOptionsDTO,
  ApproveValuationDTO,
  RejectValuationDTO,
  UpdatePropertyValuationDTO,
  ReassignValuationDTO,
} from "./propertyValuation.dto";
import { NotFoundError } from "../../common/errors/notFound.error";
import { BadRequestError } from "../../common/errors/badRequest.error";
import { ForbiddenError } from "../../common/errors/forbidden.error";
import {
  convertGeoJsonToWKT,
  normalizePolygonData,
} from "../../common/utils/geoHelpers";
import { prisma } from "../../db/prisma";
import {
  Prisma,
  ValuationMethod,
  PropertyValuationStatus,
  PropertyStatus,
  WorkflowStatus,
} from "@prisma/client";
import { createPropertyCodeService } from "../../services/property/propertyCode.service";
import { FileUploadService } from "../../services/fileUpload.service";
import { PropertyValuationRepository } from "./propertyValuation.respository";
import { valuationEmitter, ValuationEvents } from "../../events/eventEmitter";

const repository = new PropertyValuationRepository();
const propertyCodeService = createPropertyCodeService(prisma as any);

type CreateValuationPropertyInput = NonNullable<CreatePropertyValuationDTO["property"]>;

const valuationInclude = {
  property: {
    include: {
      propertyType: true,
      propertyAddress: {
        include: { province: true, district: true, commune: true, village: true },
      },
      propertyLocation: true,
      dataSource: {
        select: {
          dataSourceId: true,
          sourceType: true,
          contactName: true,
          phoneNumber: true,
          createdBy: true,
          updateBy: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      titleDocument: {
        select: {
          titleId: true,
          titleDeedType: true,
          titleDeedNo: true,
          issuedYear: true,
          parcelNo: true,
          totalSizeByTitleDeed: true,
          stampDate: true,
          coverPhotoUrl: true,
          backSidePhotoUrl: true,
          otherPhotoUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  },
  valuer: {
    select: { id: true, username: true, firstName: true, lastName: true },
  },
  documents: true,
  lastestDocument: true,
} as const;

const createAuditLog = async (
  tx: Prisma.TransactionClient,
  params: {
    userId: number;
    action: string;
    entityId: number;
    details?: any;
  }
) => {
  return tx.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entity: "PropertyValuation",
      entityId: params.entityId,
      details: params.details || {},
    },
  });
};

// ----------------- helpers -----------------
const toDateOrUndefined = (v: any) => {
  if (v === null || v === undefined || v === "") return undefined;
  if (v instanceof Date) return v;

  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00.000Z`);
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  throw new BadRequestError(`Invalid date format: ${String(v)}`);
};

const normalizeOriginalFilename = (name: string) => {
  try {
    return Buffer.from(name, "latin1").toString("utf8");
  } catch {
    return name;
  }
};

const sanitizeFilename = (name: string) =>
  name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-");

const buildValuationDocumentName = (valuationNo: string, fileName: string) => {
  const normalized = normalizeOriginalFilename(fileName);
  const safe = sanitizeFilename(normalized);
  return `${valuationNo}-${safe}`;
};


const createPropertyValuation = async (
  data: CreatePropertyValuationDTO,
  createdById: number,
  documentFile?: Express.Multer.File,
  userHierarchyLevel = 99
) => {
  const hasPropertyId = typeof data.propertyId === "number";
  const hasProperty = !!data.property;

  if (!hasPropertyId && !hasProperty) {
    throw new BadRequestError("Property ID or property data is required");
  }
  if (hasPropertyId && hasProperty) {
    throw new BadRequestError("Provide either propertyId or property data, not both");
  }

  const actorUserId = createdById;
  if (!actorUserId) {
    throw new BadRequestError("User authentication required to create valuation");
  }
  const isAdmin = userHierarchyLevel <= 2;
  if (!isAdmin) {
    if (data.status && data.status !== PropertyValuationStatus.ACTIVE) {
      throw new ForbiddenError("Only admins can set valuation status");
    }
    if (data.workflowStatus && data.workflowStatus !== WorkflowStatus.DRAFT) {
      throw new ForbiddenError("Only admins can set valuation workflow status");
    }
  }
  const { createdValuation } = await repository.transaction(async (tx) => {
    let propertyId = data.propertyId;
    let isOwner = true;
    let propertyStatusToSet: PropertyStatus = PropertyStatus.ACTIVE;
    let propertyWorkflowToSet: WorkflowStatus = WorkflowStatus.DRAFT;

    // 1) Create property (if needed)
    if (!propertyId && data.property) {
      const propertyData: CreateValuationPropertyInput = data.property;

      const propertyType = await repository.findPropertyType(
        { where: { propertyTypeId: propertyData.propertyTypeId } },
        tx
      );
      if (!propertyType) throw new BadRequestError("Property type not found");

      const propertyCode = await propertyCodeService.generateCode(propertyType.propertyName);
      const propertyName = propertyCodeService.buildName(
        propertyData.propertyName,
        propertyType.propertyName,
        propertyCode
      );

      const canSetPropertyState = isAdmin || isOwner;
      propertyStatusToSet =
        canSetPropertyState && propertyData.status
          ? propertyData.status
          : PropertyStatus.ACTIVE;
      propertyWorkflowToSet =
        canSetPropertyState && propertyData.workflowStatus
          ? propertyData.workflowStatus
          : WorkflowStatus.DRAFT;

      const createdProperty = await repository.createProperty(
        {
          data: {
            propertyTypeId: propertyData.propertyTypeId,
            propertySubtypeId: propertyData.propertySubtypeId ?? null,
            currentUseId: propertyData.currentUseId ?? null,
            propertyCode,
            propertyName,
            status: propertyStatusToSet,
            workflowStatus: propertyWorkflowToSet,
            description: propertyData.description ?? undefined,
            createdBy: actorUserId,
            updatedBy: actorUserId,
            ...(propertyData.propertyAddress
              ? { propertyAddress: { create: propertyData.propertyAddress as any } }
              : {}),
            ...(propertyData.propertyLocation
              ? { propertyLocation: { create: propertyData.propertyLocation as any } }
              : {}),
            ...(propertyData.dataSource
              ? {
                  dataSource: {
                    create: {
                      ...propertyData.dataSource,
                      createdBy: actorUserId,
                      updateBy: actorUserId,
                    },
                  },
                }
              : {}),
            ...(propertyData.titleDocument
              ? { titleDocument: { create: propertyData.titleDocument } }
              : {}),
          },
        },
        tx
      );

      // point geom
      if (
        propertyData.propertyLocation?.latitude != null &&
        propertyData.propertyLocation?.longitude != null
      ) {
        await tx.$executeRaw`
          UPDATE property_locations
          SET geom = ST_SetSRID(
            ST_MakePoint(${Number(propertyData.propertyLocation.longitude)}, ${Number(propertyData.propertyLocation.latitude)}),
            4326
          )
          WHERE property_id = ${createdProperty.propertyId}
        `;
      }

      // polygon geom
      if (propertyData.propertyLocation?.polygon) {
        const normalized =
          typeof propertyData.propertyLocation.polygon === "string"
            ? normalizePolygonData(propertyData.propertyLocation.polygon)
            : propertyData.propertyLocation.polygon;

        const wkt = convertGeoJsonToWKT(normalized);
        if (wkt) {
          await tx.$executeRaw`
            UPDATE property_locations
            SET geom_polygon = ST_GeomFromText(${wkt}, 4326)
            WHERE property_id = ${createdProperty.propertyId}
          `;
        }
      }

      propertyId = createdProperty.propertyId;
    }

    if (!propertyId) throw new BadRequestError("Property ID is required");

    if (data.propertyId) {
      if (!isAdmin) {
        const existingProperty = await repository.findProperty(
          {
            where: { propertyId },
            select: { createdBy: true },
          },
          tx
        );
        if (!existingProperty) throw new BadRequestError("Property not found");
        isOwner = existingProperty.createdBy === actorUserId;
      }

      const canSetPropertyState = isAdmin || isOwner;
      propertyStatusToSet =
        canSetPropertyState && data.property?.status
          ? data.property.status
          : PropertyStatus.ACTIVE;
      propertyWorkflowToSet =
        canSetPropertyState && data.property?.workflowStatus
          ? data.property.workflowStatus
          : WorkflowStatus.DRAFT;

      await repository.updateProperty(
        {
          where: { propertyId },
          data: {
            status: propertyStatusToSet,
            workflowStatus: propertyWorkflowToSet,
            updatedBy: actorUserId,
            updatedAt: new Date(),
          },
        },
        tx
      );
    }

    const canSetValuationState = isAdmin || isOwner;
    const valuationStatus: PropertyValuationStatus =
      canSetValuationState && data.status
        ? data.status
        : PropertyValuationStatus.ACTIVE;
    const valuationWorkflowStatus: WorkflowStatus =
      canSetValuationState && data.workflowStatus
        ? data.workflowStatus
        : WorkflowStatus.DRAFT;

    // 4) Generate valuationNo
    const valuationNo = data.valuationNo?.trim()
      ? data.valuationNo.trim()
      : `VAL-${propertyId}-${Date.now()}`;

    // 6) Create valuation
    let createdValuation = await repository.create(
      {
        data: {
          propertyId,
          valuationNo,
          landValue: data.landValue,
          buildingValue: data.buildingValue,
          marketValue: data.marketValue,
          forcedSaleValue: data.forcedSaleValue,
          pricePerSqm: data.pricePerSqm,

          dateOfInspection: toDateOrUndefined(data.dateOfInspection),
          valuationMethod: data.valuationMethod,
          currency: data.currency || "USD",
          valuationDate: toDateOrUndefined(data.valuationDate) || new Date(),
          dateOfReport: toDateOrUndefined(data.dateOfReport),

          valuerId: actorUserId,
          status: valuationStatus,
          workflowStatus: valuationWorkflowStatus,

          createdBy: actorUserId,
          updatedBy: actorUserId,

          preparedFor: data.preparedFor,
          inspectorName: data.inspectorName,
          purposeOfValuation: data.purposeOfValuation,
          note: data.note,
          internalNotes: data.internalNotes,
        },
        include: valuationInclude,
      },
      tx
    );

    // 7) Upload document (optional) + update latestVersion
    if (documentFile) {
      const upload = await FileUploadService.uploadPdf(
        documentFile,
        "valuations/documents"
      );

      const lastDoc = await repository.findLatestDocument(
        {
          where: { valuationId: createdValuation.valuationId },
          select: { version: true },
        },
        tx
      );

      const version = (lastDoc?.version ?? 0) + 1;

      await repository.createDocument(
        {
          data: {
            valuationId: createdValuation.valuationId,
            version,
            fileName: buildValuationDocumentName(valuationNo, documentFile.originalname),
            mimeType: documentFile.mimetype || "application/pdf",
            fileSize: documentFile.size,
            storageKey: upload.key,
            uploadedById: actorUserId,
          },
        },
        tx
      );

      createdValuation = await repository.update(
        {
          where: { valuationId: createdValuation.valuationId },
          data: { latestVersion: version },
          include: valuationInclude,
        },
        tx
      );
    }

    return { createdValuation };
  });

  // // ✅ Emit event OUTSIDE transaction (safe)
  // switch (requestedStatus) {
  //   case ValuationStatus.APPROVED:
  //     valuationEmitter.emit(ValuationEvents.APPROVED, {
  //       valuation: createdValuation,
  //       approvedBy: actorUserId,
  //     });
  //     break;
  //   case ValuationStatus.REJECTED:
  //     valuationEmitter.emit(ValuationEvents.REJECTED, {
  //       valuation: createdValuation,
  //       rejectedBy: actorUserId,
  //       rejectionReason: data.rejectionReason?.trim(),
  //     });
  //     break;
  //   case ValuationStatus.PENDING_REVIEW:
  //     valuationEmitter.emit(ValuationEvents.SUBMITTED, {
  //       valuation: createdValuation,
  //       submittedBy: actorUserId,
  //     });
  //     break;
  //   default:
  //     valuationEmitter.emit(ValuationEvents.CREATED, {
  //       valuation: createdValuation,
  //       createdBy: actorUserId,
  //     });
  //     break;
  // }
  return {
    success: true,
    message: "Property Valuation created successfully",
    data: createdValuation,
  };
};

const getAllPropertyValuation = async (
  filter: valuationFiltersDTO,
  paginationOptions: valuationPaginationOptionsDTO,
  currentUser: { id: number; roles: string[]; hierarchyLevel: number }
) => {
  const filterOptions = { ...filter };
  const {
    page = 1,
    limit = 10,
    sortBy = "valuationNo",
    sortOrder = "asc",
  } = paginationOptions;

  const isRestricted = currentUser.hierarchyLevel > 3;

  if (isRestricted) {
    filterOptions.valuerId = currentUser.id;
  }

  const skip = (page - 1) * limit;
  const dbSortBy = sortBy === "id" ? "valuationNo" : sortBy;

  const where = repository.buildValuationWhere(filterOptions);
  const total = await repository.count(where);

  const valuations = await repository.findMany({
    where,
    skip,
    take: limit,
    orderBy: {
      [dbSortBy]: sortOrder, 
    },
    include: {
      property: {
        include: {
          propertyType: true,
          propertyAddress: {
            include: {
              province: true,
              district: true,
              commune: true,
              village: true,
            },
          },
        },
      },
      valuer: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          profilePicture: true,
        },
      },
      approved: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          profilePicture: true,
        },
      },
      lastestDocument:true,
    },
  });

  return {
    success: true,
    message: "Property Valuations retrieved successfully",
    data: {
      valuations,
    },
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getPropertyValuationById = async (valuationId: number) => {
  const valuation = await repository.findUnique({
      where: { valuationId },
      include: {
        ValuationComparable: {
          include: {
            comparable: {
              include: {
                property: {
                  select: {
                    propertyId: true,
                    propertyName: true,
                    propertyCode: true,
                  },
                },
              },
            },
          },
        },

        property: {
          include: {
            propertyType: true,
            propertySubtype: true,
            propertyAddress: {
              include: {
                province: true,
                district: true,
                commune: true,
                village: true,
              },
            },
            propertyLocation: true,
            land: true,
            building: {
              include: {
                buildingSubtype: true,
              },
            },
            titleDocument: true,
            dataSource: true,
          },
        },
        valuer: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
        approved: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
        salesComparisonValuation: {
          include: {
            comparable: {
              include: {
                comparable: true,
                adjustments: true,
              },
            },
          },
        },
        incomeApproachValuation: true,
        costApproachValuation: true,
        transactions: true,
        documents: true,
        lastestDocument: true,
      },
    });
  if (!valuation) {
    throw new NotFoundError("Property Valuation not found");
  }
  return {
    success: true,
    message: "Property Valuation retrieved successfully",
    data: valuation,
  };
};

const updatePropertyValuation = async (
  valuationId: number,
  data: UpdatePropertyValuationDTO,
  userId: number,
  userHierarchyLevel: number
) => {
  // 1. Fetch current state
  const existingValuation = await repository.findUnique({
    where: { valuationId },
    select: { propertyId: true, valuerId: true, status: true, workflowStatus: true }
  });

  if (!existingValuation) {
    throw new NotFoundError("Property Valuation not found");
  }

  const isOwner = existingValuation.valuerId === userId;
  const isAdmin = userHierarchyLevel <= 2; 

  // 2. Check Permissions
  if (!isOwner && !isAdmin) {
    throw new ForbiddenError("You are not authorized to update this valuation.");
  }

  if (!isAdmin) {
    if (data.status && data.status !== existingValuation.status) {
      throw new ForbiddenError("Only admins can change valuation status");
    }
    if (
      data.workflowStatus &&
      data.workflowStatus !== existingValuation.workflowStatus
    ) {
      throw new ForbiddenError("Only admins can change valuation workflow status");
    }
  }


  // 3. Check Workflow Status
  if (!isAdmin && 
      existingValuation.workflowStatus !== WorkflowStatus.DRAFT && 
      existingValuation.workflowStatus !== WorkflowStatus.REJECTED
  ) {
    throw new BadRequestError(
      `Cannot update valuation in '${existingValuation.workflowStatus}' status. Withdraw the submission first.`
    );
  }

  // 4. Auto-Reset Logic
  let newWorkflowStatus: WorkflowStatus | undefined = undefined;
  if (existingValuation.workflowStatus === WorkflowStatus.REJECTED) {
    newWorkflowStatus = WorkflowStatus.DRAFT;
  }

  // 5. Destructure Data
  const { 
    property, 
    valuerId, 
    propertyId, 
    valuationMethod, 
    status,
    dateOfInspection,
    valuationDate,
    dateOfReport,
    ...restOfValuationData 
  } = data;

  // Resolve target property once: prefer request propertyId, fallback to valuation relation.
  const resolvedPropertyId = propertyId ?? existingValuation.propertyId;

  if (propertyId !== undefined && propertyId !== existingValuation.propertyId) {
    throw new BadRequestError("propertyId does not match this valuation");
  }

  // 6. Prepare Property Update
  let propertyUpdateInput = {};
  
  if (property) {
    const {
      propertyAddress,
      propertyLocation,
      titleDocument,
      dataSource,
      ...mainPropertyFields
    } = property;

    propertyUpdateInput = {
      // Scalar Fields
      ...(mainPropertyFields.propertyName !== undefined && { propertyName: mainPropertyFields.propertyName }),
      ...(mainPropertyFields.propertyTypeId !== undefined && { propertyTypeId: mainPropertyFields.propertyTypeId }),
      ...(mainPropertyFields.propertySubtypeId !== undefined && { propertySubtypeId: mainPropertyFields.propertySubtypeId }),
      ...(mainPropertyFields.currentUseId !== undefined && { currentUseId: mainPropertyFields.currentUseId }),
      ...(mainPropertyFields.status !== undefined && { status: mainPropertyFields.status }),
      ...(mainPropertyFields.description !== undefined && { description: mainPropertyFields.description }),
      
      // Update the main property's audit field
      updatedBy: userId, 

      // --- Relation 1: Address (FIX: No createdBy/updatedBy here) ---
      ...(propertyAddress && {
        propertyAddress: {
          upsert: {
            create: propertyAddress, 
            update: propertyAddress, 
          },
        },
      }),

      // --- Relation 2: Location (FIX: No createdBy/updatedBy here) ---
      ...(propertyLocation && {
        propertyLocation: {
          upsert: {
            create: propertyLocation,
            update: propertyLocation,
          },
        },
      }),

      // --- Relation 3: Title Document (FIX: No createdBy/updatedBy here) ---
      ...(titleDocument && {
        titleDocument: {
          upsert: {
            create: titleDocument,
            update: titleDocument,
          },
        },
      }),

      // --- Relation 4: Data Source (KEEP createdBy/updateBy here) ---
      // Your schema specifically requires this for DataSource
      ...(dataSource && {
        dataSource: {
          upsert: {
            create: { 
                ...dataSource, 
                createdBy: userId, 
                updateBy: userId 
            },
            update: { 
                ...dataSource, 
                updateBy: userId 
            },
          },
        },
      }),
    };
  }

  // 7. Execute Update
  const valuation = await repository.transaction(async (tx) => {
    // Update property if needed
    if (Object.keys(propertyUpdateInput).length > 0 && resolvedPropertyId) {
      await tx.property.update({
        where: { propertyId: resolvedPropertyId },
        data: propertyUpdateInput,
      });
    }

    // Update valuation
    return await tx.propertyValuation.update({
      where: { valuationId },
      data: {
        ...restOfValuationData,
        
        // Dates
        ...(dateOfInspection !== undefined && { dateOfInspection: toDateOrUndefined(dateOfInspection) }),
        ...(valuationDate !== undefined && { valuationDate: toDateOrUndefined(valuationDate) }),
        ...(dateOfReport !== undefined && { dateOfReport: toDateOrUndefined(dateOfReport) }),

        // Enums
        ...(valuationMethod !== undefined && { valuationMethod: valuationMethod as ValuationMethod }),
        ...(newWorkflowStatus !== undefined && { workflowStatus: newWorkflowStatus as WorkflowStatus }),
        ...(status !== undefined && { status: status as PropertyValuationStatus }),

        // Audit field
        updatedBy: userId,

        // Update valuerId if admin
        ...(valuerId !== undefined && isAdmin && { valuerId }),
      },
      include: {
        property: {
          include: {
            propertyAddress: true,
            propertyLocation: true,
            titleDocument: true,
            dataSource: true,
          },
        },
        valuer: true,
      },
    });
  });

  return {
    success: true,
    message: "Property Valuation updated successfully",
    data: valuation,
  };
};

const reassignValuation = async (
  valuationId: number,
  newValuerId: number,
  actorId: number 
) => {
  const valuation = await repository.findUnique({ where: { valuationId } });
  if (!valuation) throw new NotFoundError("Valuation not found");

  const targetValuer = await prisma.user.findUnique({
    where: { id: newValuerId },
    include: {
      roles: {
        include: { role: true },
      },
    },
  });

  if (!targetValuer) {
    throw new NotFoundError("Selected valuer not found");
  }

  const isValuer = targetValuer.roles.some(
    (userRole) => userRole.role?.roleCode?.toUpperCase() === "VALUER"
  );

  if (!isValuer) {
    throw new BadRequestError("Selected user must have the VALUER role");
  }

  const updatedValuation = await repository.update({
    where: { valuationId },
    data: {
      valuerId: newValuerId,
      internalNotes: valuation.internalNotes 
        ? `${valuation.internalNotes}\n[System]: Reassigned to User ${newValuerId} by User ${actorId}`
        : `[System]: Reassigned to User ${newValuerId} by User ${actorId}`,
    },
    include: { valuer: true }
  });

  return {
    success: true,
    message: "Valuation successfully reassigned",
    data: updatedValuation
  };
};

const submitForReview = async (
  valuationId: number, 
  userId: number,
  userHierarchyLevel: number
) => {
  // Get valuation
  const valuation = await repository.findUnique({ 
    where: { valuationId },
  });
  
  if (!valuation) {
    throw new NotFoundError("Property Valuation not found");
  }
  
  // Check status
  if (valuation.workflowStatus !== WorkflowStatus.DRAFT) {
    throw new BadRequestError(
      "Only valuations in DRAFT status can be submitted for review"
    );
  }

  // Check ownership (privileged users can submit any valuation)
  const isPrivileged = userHierarchyLevel <= 2;
  const isOwner = valuation.valuerId === userId;

  if (!isPrivileged && !isOwner) {
    throw new ForbiddenError(
      "Only the valuation creator or privileged users can submit for review"
    );
  }

  // Update valuation
  const result = await repository.transaction(async (tx) => {
    // Update property workflow status
    await tx.property.update({
      where: { propertyId: valuation.propertyId },
      data: { workflowStatus: WorkflowStatus.PENDING_REVIEW }
    });

    const updated = await tx.propertyValuation.update({
      where: { valuationId },
      data: {
        workflowStatus: WorkflowStatus.PENDING_REVIEW,
        updatedBy: userId,
      },
      include: valuationInclude,
    });

  await createAuditLog(tx, {
      userId,
      action: "SUBMIT_FOR_REVIEW",
      entityId: valuationId,
      details: { note: "Valuation moved to PENDING_REVIEW" }
    });

    return updated;
  });

  // Emit event for notification
  valuationEmitter.emit(ValuationEvents.SUBMITTED, { valuation: result, submittedBy: userId });

  return {
    success: true,
    message: "Property Valuation submitted for review successfully",
    data: result,
  };
};

const approveValuation = async (
  valuationId: number,
  approvalData: ApproveValuationDTO
) => {
  const valuation = await repository.findUnique({ where: { valuationId } });
  if (!valuation) {
    throw new NotFoundError("Property Valuation not found");
  }

  if (valuation.workflowStatus !== WorkflowStatus.PENDING_REVIEW ) {
    throw new BadRequestError(
      "Only valuations in PENDING_REVIEW status can be submitted for review"
    );
  }
  
  const result = await repository.transaction(async (tx) => {
    // 1. Mark previous valuations as SUPERSEDED (New Logic)
    await tx.propertyValuation.updateMany({
      where: { 
        propertyId: valuation.propertyId, 
        status: PropertyValuationStatus.ACTIVE,
        valuationId: { not: valuationId }
      },
      data: { status: PropertyValuationStatus.SUPERSEDED }
    });

    // 2. Approve current valuation
    const updated = await tx.propertyValuation.update({
      where: { valuationId },
      data: {
        status: PropertyValuationStatus.ACTIVE,
        workflowStatus: WorkflowStatus.APPROVED,
        approvedBy: approvalData.approvedById,
        // Set expiry date if not already set (e.g., +6 months)
        expiryDate: new Date(new Date().setMonth(new Date().getMonth() + 6)),
      },
      include: valuationInclude,
    });

    // 3. Update property status
    await tx.property.update({
      where: { propertyId: updated.propertyId },
      data: { 
        status: PropertyStatus.ACTIVE, 
        workflowStatus: WorkflowStatus.APPROVED 
      }
    });

    // 4. Log high-detail audit
    await createAuditLog(tx, {
      userId: approvalData.approvedById,
      action: "APPROVE_VALUATION",
      entityId: valuationId,
      details: { 
        marketValue: updated.marketValue, 
        notes: approvalData.notes 
      }
    });

    return updated;
  });

  valuationEmitter.emit(ValuationEvents.APPROVED, { valuation: result, approvedBy: approvalData.approvedById });
  return { success: true, message: "Property Valuation approved successfully", data: result };
};

const rejectValuation = async (
  valuationId: number,
  rejectionData: RejectValuationDTO
) => {
  const valuation = await repository.findUnique({ where: { valuationId } });
  if (!valuation) {
    throw new NotFoundError("Property Valuation not found");
  }
  if (
    valuation.workflowStatus !== WorkflowStatus.PENDING_REVIEW 
  ) {
    throw new BadRequestError(
      "Only valuations in PENDING_REVIEW  status can be rejected"
    );
  }

  const result = await repository.transaction(async (tx) => {
    const updated = await tx.propertyValuation.update({
      where: { valuationId },
      data: {
        workflowStatus: WorkflowStatus.REJECTED,
        rejectedBy: rejectionData.rejectedById,
        rejectionReason: rejectionData.rejectionReason,
      },
      include: valuationInclude,
    });

    // Update property status
    await tx.property.update({
      where: { propertyId: updated.propertyId },
      data: { workflowStatus: WorkflowStatus.REJECTED }
    });

    await createAuditLog(tx, {
      userId: rejectionData.rejectedById,
      action: "REJECT_VALUATION",
      entityId: valuationId,
      details: { reason: rejectionData.rejectionReason }
    });

    return updated;
  });

  valuationEmitter.emit(ValuationEvents.REJECTED, { 
    valuation: result, 
    rejectedBy: rejectionData.rejectedById,
    reason: rejectionData.rejectionReason 
  });
  
  return { success: true, message: "Property Valuation rejected successfully", data: result };
};

const deletePropertyValuation = async (valuationId: number) => {
  const valuation = await repository.findUnique({ where: { valuationId } });
  if (!valuation) {
    throw new NotFoundError("Property Valuation not found");
  }

  await repository.update({
    where: { valuationId },
    data: {
      workflowStatus: WorkflowStatus.ARCHIVED,
      status: PropertyValuationStatus.CANCELLED,
    },
  });

  return {
    success: true,
    message: "Property Valuation archived successfully",
  };
};

const getValuationStatistics = async (filters?: {
  propertyTypeId?: number;
  valuationMethod?: ValuationMethod;
  status?: PropertyValuationStatus;
  workflowStatus?: WorkflowStatus;
  yearFrom?: number;
  yearTo?: number;
  valuerId?: number;
  provinceId?: number;
}) => {
  const valuationDateFilter: Prisma.DateTimeFilter = {};
  if (filters?.yearFrom) {
    valuationDateFilter.gte = new Date(filters.yearFrom, 0, 1);
  }
  if (filters?.yearTo) {
    valuationDateFilter.lte = new Date(filters.yearTo, 11, 31);
  }

  const where: Prisma.PropertyValuationWhereInput = {
    ...(filters?.status && { status: filters.status }),
    ...(filters?.valuationMethod && {
      valuationMethod: filters.valuationMethod,
    }),
    ...(Object.keys(valuationDateFilter).length > 0 && {
      valuationDate: valuationDateFilter,
    }),
    ...(filters?.valuerId && { valuerId: filters.valuerId }),
    ...((filters?.propertyTypeId || filters?.provinceId) && {
      property: {
        is: {
          ...(filters?.propertyTypeId && { propertyTypeId: filters.propertyTypeId }),
          ...(filters?.provinceId && {
            propertyAddress: {
              is: {
                provinceId: String(filters.provinceId),
              },
            },
          }),
        },
      },
    }),
  };

  const toNumber = (value: Prisma.Decimal | number | null | undefined) =>
    value ? Number(value) : 0;

  const [
    total,
    valueStats,
    valueRange,
    statusCounts,
    byMethod,
    byPropertyType,
    byValuer,
    byProvince,
    workflowStats,
    monthlyTrend,
  ] = await Promise.all([
    // 1. Total count
    repository.count(where),

    // 2. Average market value
    repository.aggregate({
      where: { ...where, marketValue: { not: null } },
      _avg: { marketValue: true, landValue: true, buildingValue: true, forcedSaleValue: true },
      _sum: { marketValue: true, landValue: true, buildingValue: true },
    }),

    // 3. Value range
    repository.aggregate({
      where: { ...where, marketValue: { not: null } },
      _min: { marketValue: true },
      _max: { marketValue: true },
    }),

    // 4. By status
    repository.groupBy({
      by: ["status"],
      where,
      orderBy: { status: "asc" },
      _count: { _all: true },
    }),

    // 5. By valuation method
    repository.groupBy({
      by: ["valuationMethod"],
      where,
      _count: { _all: true },
      orderBy: { _count: { valuationMethod: "desc" } },
    }),

    // 6. By property type
    prisma.propertyValuation.groupBy({
      by: ["propertyId"],
      where,
      _count: { _all: true },
    }).then(async (results) => {
      const propertyIds = results.map((r) => r.propertyId);
      const properties = await prisma.property.findMany({
        where: { propertyId: { in: propertyIds } },
        select: { propertyId: true, propertyTypeId: true },
      });
      const typeCountMap: Record<number, number> = {};
      properties.forEach((prop) => {
        if (prop.propertyTypeId) {
          typeCountMap[prop.propertyTypeId] =
            (typeCountMap[prop.propertyTypeId] || 0) + 1;
        }
      });
      return Object.entries(typeCountMap).map(([typeId, count]) => ({
        propertyTypeId: Number(typeId),
        count,
      }));
    }),

    // 7. By valuer (top 10)
    repository.groupBy({
      by: ["valuerId"],
      where,
      _count: { _all: true },
      _avg: { marketValue: true },
      orderBy: { _count: { valuerId: "desc" } },
      take: 10,
    }),

    // 8. By province (top 10)
    prisma.$queryRaw<
      { provinceId: string; provinceName: string; count: number }[]
    >`
      SELECT
        pa.province_id as "provinceId",
        pr.province_name_en as "provinceName",
        COUNT(*)::int as count
      FROM property_valuations pv
      INNER JOIN properties p ON pv.property_id = p.property_id
      INNER JOIN property_address pa ON p.property_id = pa.property_id
      INNER JOIN provinces pr ON pa.province_id = pr.province_id
      WHERE 1=1
      ${filters?.status ? Prisma.sql`AND pv.status::text = ${filters.status}` : Prisma.empty}
      ${filters?.valuationMethod ? Prisma.sql`AND pv.valuation_method::text = ${filters.valuationMethod}` : Prisma.empty}
      ${filters?.valuerId ? Prisma.sql`AND pv.valuer_id = ${filters.valuerId}` : Prisma.empty}
      GROUP BY pa.province_id, pr.province_name_en
      ORDER BY count DESC
    `,

    // 9. Workflow statistics
    prisma.$transaction(async (tx) => {
      const draft = await repository.count({ ...where, workflowStatus: WorkflowStatus.DRAFT }, tx);
      const pending = await repository.count({ ...where, workflowStatus: WorkflowStatus.PENDING_REVIEW }, tx);
      const approved = await repository.count({ ...where, workflowStatus: WorkflowStatus.APPROVED }, tx);
      const rejected = await repository.count({ ...where, workflowStatus: WorkflowStatus.REJECTED }, tx);

      // Calculate average approval time (based on updated_at when status changes)
      const avgApprovalTime = await tx.$queryRaw<
        { avgDays: number | null }[]
      >`
        SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400) as "avgDays"
        FROM property_valuations
        WHERE "workflowStatus" = 'APPROVED'
        ${filters?.yearFrom ? Prisma.sql`AND valuation_date >= ${new Date(filters.yearFrom, 0, 1)}` : Prisma.empty}
        ${filters?.yearTo ? Prisma.sql`AND valuation_date <= ${new Date(filters.yearTo, 11, 31)}` : Prisma.empty}
      `;

      // Calculate approval rate
      const totalReviewed = approved + rejected;
      const approvalRate = totalReviewed > 0 ? (approved / totalReviewed) * 100 : 0;

      return {
        draft,
        pending,
        approved,
        rejected,
        avgApprovalDays: avgApprovalTime[0]?.avgDays
          ? Math.round(avgApprovalTime[0].avgDays * 10) / 10
          : null,
        approvalRate: Math.round(approvalRate * 10) / 10,
      };
    }),

    // 10. Monthly trend (last 12 months)
    prisma.$queryRaw<
      { month: string; count: number; avgValue: number }[]
    >`
      SELECT
        TO_CHAR(valuation_date, 'YYYY-MM') as month,
        COUNT(*)::int as count,
        COALESCE(AVG(market_value), 0)::numeric(15,2) as "avgValue"
      FROM property_valuations
      WHERE valuation_date >= NOW() - INTERVAL '12 months'
      ${filters?.status ? Prisma.sql`AND status::text = ${filters.status}` : Prisma.empty}
      ${filters?.valuationMethod ? Prisma.sql`AND valuation_method::text = ${filters.valuationMethod}` : Prisma.empty}
      ${filters?.propertyTypeId ? Prisma.sql`AND property_id IN (SELECT property_id FROM properties WHERE property_type_id = ${filters.propertyTypeId})` : Prisma.empty}
      GROUP BY TO_CHAR(valuation_date, 'YYYY-MM')
      ORDER BY month DESC
    `,
  ]);

  // Fetch property type names
  const propertyTypeIds = byPropertyType.map((pt) => pt.propertyTypeId);
  const propertyTypes = await prisma.propertyType.findMany({
    where: { propertyTypeId: { in: propertyTypeIds } },
    select: { propertyTypeId: true, propertyName: true },
  });
  const typeMap = Object.fromEntries(
    propertyTypes.map((pt) => [pt.propertyTypeId, pt.propertyName])
  );

  // Fetch valuer names
  const valuerIds = byValuer
  .map((v) => v.valuerId)
  .filter((id): id is number => id !== null);

// 2. Fetch valuer names (now valuerIds is number[])
const valuers = await prisma.user.findMany({
  where: { id: { in: valuerIds } },
  select: { id: true, username: true, firstName: true, lastName: true },
});

// 3. Create the map
const valuerMap = Object.fromEntries(
  valuers.map((v) => [
    v.id,
    `${v.firstName || ""} ${v.lastName || ""}`.trim() || v.username,
  ])
);

  return {
    success: true,
    message: "Valuation statistics retrieved successfully",
    data: {
      overview: {
        totalValuations: total,
        totalMarketValue: toNumber(valueStats._sum?.marketValue),
        totalLandValue: toNumber(valueStats._sum?.landValue),
        totalBuildingValue: toNumber(valueStats._sum?.buildingValue),
        averageMarketValue: toNumber(valueStats._avg?.marketValue),
        averageLandValue: toNumber(valueStats._avg?.landValue),
        averageBuildingValue: toNumber(valueStats._avg?.buildingValue),
        averageForcedSaleValue: toNumber(valueStats._avg?.forcedSaleValue),
        minValue: toNumber(valueRange._min?.marketValue),
        maxValue: toNumber(valueRange._max?.marketValue),
      },
      byStatus: statusCounts.reduce((acc, curr) => {
        const count =
          curr._count && typeof curr._count === "object"
            ? curr._count._all ?? 0
            : 0;
        acc[curr.status] = count;
        return acc;
      }, {} as Record<string, number>),
      byMethod: byMethod.map((item) => ({
        method: item.valuationMethod,
        count: typeof item._count === 'object' ? (item._count?._all ?? 0) : 0,
      })),
      byPropertyType: byPropertyType.map((item) => ({
        propertyTypeId: item.propertyTypeId,
        propertyTypeName: typeMap[item.propertyTypeId] || "Unknown",
        count: item.count,
      })),
      byValuer: byValuer.map((item) => ({
        valuerId: item.valuerId,
        valuerName: valuerMap[item.valuerId ?? 0] || "Unknown",
        count: typeof item._count === 'object' ? (item._count?._all ?? 0) : 0,
        avgMarketValue: toNumber(item._avg?.marketValue),
      })),
      byProvince,
      workflow: workflowStats,
      trends: {
        monthly: monthlyTrend.map((item) => ({
          month: item.month,
          count: item.count,
          avgValue: Number(item.avgValue),
        })),
      },
    },
  };
};

const getValuationDocumentForDownload = async (
  valuationId: number,
  opts: { version?: number } = {}
) => {
  const valuation = await repository.findValuationBasic(valuationId);
  if (!valuation) throw new NotFoundError("Property Valuation not found");

  const document = opts.version
    ? await repository.findDocumentById({ valuationId, version: opts.version })
    : await repository.findLatestValuationDocumentId(valuationId);

  if (!document) throw new NotFoundError("Valuation document not found");

  const safeName = normalizeOriginalFilename(document.fileName);

  // ✅ generate both links
  const [viewUrl, downloadUrl] = await Promise.all([
    FileUploadService.signedViewUrl(document.storageKey, 600, {
      filename: safeName,
      mimeType: document.mimeType || "application/pdf",
    }),
    FileUploadService.signedDownloadUrl(document.storageKey, 600, {
      filename: safeName,
    }),
  ]);

  return {
    success: true,
    message: "Valuation document links generated successfully",
    data: {
      valuationId,
      version: document.version,
      valuationNo: valuation.valuationNo,
      fileName: document.fileName,
      normalizedFileName: safeName,
      mimeType: document.mimeType,
      fileSize: document.fileSize,
      viewUrl,      // ✅ open in browser / iframe
      downloadUrl,  // ✅ force download
    },
  };
};


export const propertyValuationService = {
  createPropertyValuation,
  getAllPropertyValuation,
  getPropertyValuationById,
  updatePropertyValuation,
  reassignValuation, // New function exported
  submitForReview,
  approveValuation,
  rejectValuation,
  deletePropertyValuation,
  getValuationStatistics,
  getValuationDocumentForDownload,
};
