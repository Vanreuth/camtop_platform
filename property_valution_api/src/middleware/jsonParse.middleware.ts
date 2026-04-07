import { Request, Response, NextFunction } from "express";

const parseJsonFields = (req: Request, res: Response, next: NextFunction) => {
  // Fields that should remain as strings even if they look like numbers
  const stringOnlyFields = [
    'propertyName',
    'propertyCode',
    'indicationNo',
    'valuationNo',
    'instructedBy',
    'preparedFor',
    'valuerLicense',
    'currency',
    'inspectorName',
    'intendedUse',
    'purposeOfValuation',
    'contactTel',
    'villageName',
    'street',
    'houseNo',
    'titleAddress',
    'accessRoads',
    'neighborLocation',
    'titleDeedNo',
    'issuedYear',
    'parcelNo',
    'contactName',
    'phoneNumber',
    'unitNo',
    'buildingName',
    'description',
    'note',
    'internalNotes',
    'notes',
    'buildingImage',
    'coverPhotoUrl',
    'backSidePhotoUrl',
    'frontSide',
    'inside',
    'leftSide',
    'rightSide',
    'opposite',
    'geolocationLink',
    'formattedAddress',
    'placeId',
    'polygon',
  ];

  for (const key in req.body) {
    const rawValue = req.body[key];

    if (typeof rawValue !== "string") continue;

    const value = rawValue.trim();

    try {
      // Parse if looks like JSON (objects or arrays)
      if (
        (value.startsWith("{") && value.endsWith("}")) ||
        (value.startsWith("[") && value.endsWith("]"))
      ) {
        req.body[key] = JSON.parse(value);
        continue;
      }

      if (value === "null") {
        req.body[key] = null;
        continue;
      }

      // Convert numeric strings ONLY for fields that are NOT in stringOnlyFields
      if (!stringOnlyFields.includes(key) && !isNaN(Number(value)) && value !== "") {
        req.body[key] = Number(value);
        continue;
      }

      // Convert booleans
      if (value === "true" || value === "false") {
        req.body[key] = value === "true";
        continue;
      }
    } catch (err) {
      console.warn(`Failed to parse ${key}:`, err);
    }
  }

  next();
};

export default parseJsonFields;
