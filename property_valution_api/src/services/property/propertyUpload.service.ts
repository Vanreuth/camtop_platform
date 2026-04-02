import { BadRequestError } from "../../common/errors/badRequest.error";
import type { FileField } from "../../modules/property/property.dto";

type PhotoUrls = {
  frontSide?: string | null;
  inside?: string | null;
  leftSide?: string | null;
  rightSide?: string | null;
  opposite?: string | null;
  gallery?: string[];
  coverPhotoUrl?: string | null;
  backSidePhotoUrl?: string | null;
  buildingImage?: string | null;
};

type ExistingPropertyUploads = {
  propertyPhotos?: {
    frontSide?: string | null;
    inside?: string | null;
    leftSide?: string | null;
    rightSide?: string | null;
    opposite?: string | null;
    gallery?: string[] | null;
  } | null;
  titleDocument?: {
    coverPhotoUrl?: string | null;
    backSidePhotoUrl?: string | null;
  } | null;
  building?: Array<{ buildingImage?: string | null }> | null;
};

export const createPropertyUploadService = (FileUploadService: any) => {
  const uploadPhotos = async (files?: FileField): Promise<PhotoUrls> => {
    const photoUrls: PhotoUrls = {};
    const tasks: Promise<void>[] = [];

    if (!files) return photoUrls;

    const uploadOne = (file: Express.Multer.File, folder: string, key: Exclude<keyof PhotoUrls, 'gallery'>) => {
      tasks.push(
        FileUploadService.uploadFile(file, folder).then((url: string) => {
          (photoUrls[key] as string | null | undefined) = url;
        })
      );
    };

    if (files.frontSide?.[0]) uploadOne(files.frontSide[0], "properties/photos", "frontSide");
    if (files.inside?.[0]) uploadOne(files.inside[0], "properties/photos", "inside");
    if (files.leftSide?.[0]) uploadOne(files.leftSide[0], "properties/photos", "leftSide");
    if (files.rightSide?.[0]) uploadOne(files.rightSide[0], "properties/photos", "rightSide");
    if (files.opposite?.[0]) uploadOne(files.opposite[0], "properties/photos", "opposite");

    if (files.gallery && files.gallery.length > 0) {
      tasks.push(
        FileUploadService.uploadMultipleFiles(files.gallery, "properties/gallery").then((urls: string[]) => {
          photoUrls.gallery = urls;
        })
      );
    }

    if (files.coverPhoto?.[0]) uploadOne(files.coverPhoto[0], "properties/documents", "coverPhotoUrl");
    if (files.backSidePhoto?.[0]) uploadOne(files.backSidePhoto[0], "properties/documents", "backSidePhotoUrl");

    try {
      await Promise.all(tasks);
      return photoUrls;
    } catch (err: any) {
      throw new BadRequestError(`Failed to upload files: ${err?.message ?? "Unknown error"}`);
    }
  };

  const uploadBuildingImages = async (
    files: FileField | undefined,
    buildingCount: number
  ): Promise<Record<number, string>> => {
    if (!files || buildingCount <= 0) return {};

    try {
      return await FileUploadService.uploadBuildingImages(files, buildingCount);
    } catch {
      return {}; // do not fail the whole createProperty
    }
  };

  const updatePhotos = async ({
    files,
    existingProperty,
    deletedImages,
  }: {
    files?: FileField;
    existingProperty: ExistingPropertyUploads;
    deletedImages?: string[];
  }): Promise<PhotoUrls> => {
    const photoUrls: PhotoUrls = {};
    const tasks: Promise<void>[] = [];
    const photoUrlsByKey = photoUrls as Record<string, any>;

    const {
    frontSide = [],
    inside = [],
    leftSide = [],
    rightSide = [],
    opposite = [],
    gallery = [],
    coverPhoto = [],
    backSidePhoto = [],
    buildingImage = [],
  } = files ?? {};

    if (files) {
      if (frontSide[0]) {
    tasks.push((async () => {
      await FileUploadService.deleteOldImage(existingProperty.propertyPhotos?.frontSide);
      photoUrls.frontSide = await FileUploadService.uploadFile(frontSide[0], "properties/photos");
    })());
  }

      if (inside[0]) {
        tasks.push(
          (async () => {
            await FileUploadService.deleteOldImage(existingProperty.propertyPhotos?.inside);
            photoUrls.inside = await FileUploadService.uploadFile(
              inside[0],
              "properties/photos"
            );
          })()
        );
      }

      if (leftSide[0]) {
        tasks.push(
          (async () => {
            await FileUploadService.deleteOldImage(existingProperty.propertyPhotos?.leftSide);
            photoUrls.leftSide = await FileUploadService.uploadFile(
              leftSide[0],
              "properties/photos"
            );
          })()
        );
      }

      if (rightSide[0]) {
        tasks.push(
          (async () => {
            await FileUploadService.deleteOldImage(existingProperty.propertyPhotos?.rightSide);
            photoUrls.rightSide = await FileUploadService.uploadFile(
              rightSide[0],
              "properties/photos"
            );
          })()
        );
      }

      if (opposite[0]) {
        tasks.push(
          (async () => {
            await FileUploadService.deleteOldImage(existingProperty.propertyPhotos?.opposite);
            photoUrls.opposite = await FileUploadService.uploadFile(
              opposite[0],
              "properties/photos"
            );
          })()
        );
      }

      if (gallery.length > 0) {
        tasks.push(
          (async () => {
            if (existingProperty.propertyPhotos?.gallery) {
              await FileUploadService.deleteOldImages(
                existingProperty.propertyPhotos.gallery as string[]
              );
            }
            photoUrls.gallery = await FileUploadService.uploadMultipleFiles(
              gallery,
              "properties/gallery"
            );
          })()
        );
      }

      if (coverPhoto[0]) {
        tasks.push(
          (async () => {
            await FileUploadService.deleteOldImage(existingProperty.titleDocument?.coverPhotoUrl);
            photoUrls.coverPhotoUrl = await FileUploadService.uploadFile(
              coverPhoto[0],
              "properties/documents"
            );
          })()
        );
      }

      if (backSidePhoto[0]) {
        tasks.push(
          (async () => {
            await FileUploadService.deleteOldImage(existingProperty.titleDocument?.backSidePhotoUrl);
            photoUrls.backSidePhotoUrl = await FileUploadService.uploadFile(
              backSidePhoto[0],
              "properties/documents"
            );
          })()
        );
      }

      if (buildingImage[0]) {
        tasks.push(
          (async () => {
            if (existingProperty.building && existingProperty.building.length > 0) {
              for (const building of existingProperty.building) {
                await FileUploadService.deleteOldImage(building.buildingImage);
              }
            }
            photoUrls.buildingImage = await FileUploadService.uploadFile(
              buildingImage[0],
              "properties/buildings"
            );
          })()
        );
      }
    }

    if (deletedImages && deletedImages.length > 0) {
      const propertyPhotoFields = ["frontSide", "inside", "leftSide", "rightSide", "opposite"];

      for (const field of deletedImages) {
        if (photoUrlsByKey[field] !== undefined) continue;

        if (propertyPhotoFields.includes(field)) {
          const oldUrl = existingProperty.propertyPhotos?.[
            field as keyof NonNullable<ExistingPropertyUploads["propertyPhotos"]>
          ];

          if (oldUrl && typeof oldUrl === "string") {
            tasks.push(FileUploadService.deleteOldImage(oldUrl));
          }

          photoUrlsByKey[field] = null;
        }

        if (field === "coverPhotoUrl") {
          const oldUrl = existingProperty.titleDocument?.coverPhotoUrl;
          if (oldUrl) tasks.push(FileUploadService.deleteOldImage(oldUrl));
          photoUrls.coverPhotoUrl = null;
        }

        if (field === "backSidePhotoUrl") {
          const oldUrl = existingProperty.titleDocument?.backSidePhotoUrl;
          if (oldUrl) tasks.push(FileUploadService.deleteOldImage(oldUrl));
          photoUrls.backSidePhotoUrl = null;
        }
      }
    }

    await Promise.all(tasks);
    return photoUrls;
  };

  return { uploadPhotos, uploadBuildingImages, updatePhotos };
};
