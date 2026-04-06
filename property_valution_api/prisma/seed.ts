import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/common/utils/hash";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const DEFAULT_SEED_PASSWORD = "12345678";
const seedPassword = (process.env.SEED_USER_PASSWORD ?? DEFAULT_SEED_PASSWORD).trim();
const seedPasswordLabel =
  seedPassword === DEFAULT_SEED_PASSWORD ? `'${DEFAULT_SEED_PASSWORD}'` : "SEED_USER_PASSWORD env var";

if (seedPassword.length < 6) {
  throw new Error("SEED_USER_PASSWORD must be at least 6 characters.");
}

// Helper to read CSV files
async function readCSV(fileName: string): Promise<any[]> {
  const csvPath = path.join(__dirname, "data", fileName);
  const fileContent = fs.readFileSync(csvPath, "utf-8");
  const lines = fileContent.split("\n").filter((line) => line.trim());
  const headers = lines[0].split(",").map(h => h.trim());

  const results: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const obj: any = {};
    headers.forEach((header, index) => {
      // Remove quotes if present and trim
      let val = values[index]?.trim() || "";
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      obj[header] = val;
    });
    results.push(obj);
  }
  return results;
}

async function main() {
  console.log("🌱 Starting database seeding...");

  // Clear all data in correct order
  console.log("🧹 Cleaning existing data...");
  await prisma.propertyValuation.deleteMany({});
  await prisma.propertyPhoto.deleteMany({});
  await prisma.dataSource.deleteMany({});
  await prisma.titleDocument.deleteMany({});
  await prisma.propertyLocation.deleteMany({});
  await prisma.propertyAddress.deleteMany({});
  await prisma.buildingUnit.deleteMany({});
  await prisma.building.deleteMany({});
  await prisma.agricultureLand.deleteMany({});
  await prisma.land.deleteMany({});
  await prisma.property.deleteMany({});
  await prisma.propertyTypeCurrentUse.deleteMany({});
  await prisma.currentUse.deleteMany({});
  await prisma.buildingSubtype.deleteMany({});
  await prisma.propertySubtype.deleteMany({});
  await prisma.propertyType.deleteMany({});
  await prisma.recordType.deleteMany({});
  await prisma.village.deleteMany({});
  await prisma.commune.deleteMany({});
  await prisma.district.deleteMany({});
  await prisma.province.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.userPreference.deleteMany({});
  await prisma.rolePermission.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.permission.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.user.deleteMany({});
  console.log("✅ Existing data cleaned!");

  // ============================================
  // 1. SEED PROVINCES (WITH GIS MAPS)
  // ============================================
  console.log("📍 Seeding Provinces...");
  
  // A. Load Data
  const provinceData = await readCSV("CambodiaProvinceList2025.csv");
  
  // B. Load GeoJSON for Boundaries
  let geoJsonMap = new Map<string, string>();
  try {
    const geoJsonPath = path.join(__dirname, "data", "CambodiaProvinceBoundaries.geojson");
    if (fs.existsSync(geoJsonPath)) {
      const rawGeo = fs.readFileSync(geoJsonPath, "utf-8");
      const geoData = JSON.parse(rawGeo);
      
      console.log(`   Found GeoJSON with ${geoData.features.length} features.`);
      
      // Map "KH01" -> GeoJSON String
      geoData.features.forEach((f: any) => {
  const rawCode = f.properties?.ADM1_PCODE; // e.g., "KH01"
  if (rawCode) {
    const cleanCode = rawCode.replace("KH", ""); // "01"
    let geometry = f.geometry;
    // If geometry is Polygon, wrap as MultiPolygon
    if (geometry.type === "Polygon") {
      geometry = {
        type: "MultiPolygon",
        coordinates: [geometry.coordinates],
      };
    }
    geoJsonMap.set(cleanCode, JSON.stringify(geometry));
  }
});
    } else {
      console.warn("⚠️  CambodiaProvinceBoundaries.geojson not found. Skipping GIS data.");
    }
  } catch (err) {
    console.error("❌ Error loading GeoJSON:", err);
  }

  // C. Insert Data
  for (const row of provinceData) {
    const pCode = row.province_code;

    // 1. Create/Update Basic Info
    await prisma.province.upsert({
      where: { code: pCode },
      update: {
        nameKh: row.province_kh,
        nameEn: row.province_en,
      },
      create: {
        code: pCode,
        nameKh: row.province_kh,
        nameEn: row.province_en,
      },
    });

    // 2. Update Geometry (if available)
    const geomJson = geoJsonMap.get(pCode);
    if (geomJson) {
      // We use executeRaw because Prisma doesn't support PostGIS writes natively yet.
      // Table name must match @map("provinces") in schema
      await prisma.$executeRaw`
        UPDATE "provinces"
        SET "geom" = ST_SetSRID(ST_GeomFromGeoJSON(${geomJson}::json), 4326)
        WHERE "province_id" = ${pCode};
      `;
    }
  }
  console.log(`✅ Seeded ${provinceData.length} provinces.`);


  // ============================================
  // 2. SEED DISTRICTS (WITH GIS)
  // ============================================
  console.log("📍 Seeding Districts...");
  const districtData = await readCSV("CambodiaDistrictList2025.csv");
  
  // Step A: Bulk Insert Data (Fast)
  await prisma.district.createMany({
    data: districtData.map(row => ({
      code: row.district_code,
      nameKh: row.district_kh,
      nameEn: row.district_en,
      provinceId: row.province_code,
    })),
    skipDuplicates: true,
  });

  // Step B: Update Geometry from GeoJSON
 const distGeoPath = path.join(__dirname, "data", "CambodiaDistrictBoundaries.geojson");
if (fs.existsSync(distGeoPath)) {
  const geoData = JSON.parse(fs.readFileSync(distGeoPath, "utf-8"));
  
  for (const f of geoData.features) {
    const rawCode = f.properties?.ADM2_PCODE; // "KH0101"
    if (rawCode) {
      const cleanCode = rawCode.replace("KH", ""); // "0101"
      const geomJson = JSON.stringify(f.geometry);
      
      // ST_Multi converts simple Polygons to MultiPolygons automatically
      await prisma.$executeRaw`
        UPDATE "districts"
        SET "geom" = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${geomJson}::json), 4326))
        WHERE "district_id" = ${cleanCode};
      `;
    }
  }
}
  console.log(`✅ District Process Complete.`);


  // ============================================
  // 3. SEED COMMUNES (WITH GIS)
  // ============================================
  console.log("📍 Seeding Communes...");
  const communeData = await readCSV("CambodiaCommuneList2025.csv");
  
  // Step A: Bulk Insert Data (Chunked)
  const chunkSize = 1000;
  for (let i = 0; i < communeData.length; i += chunkSize) {
    const chunk = communeData.slice(i, i + chunkSize);
    await prisma.commune.createMany({
      data: chunk.map(row => ({
        code: row.commune_code,
        nameKh: row.commune_kh,
        nameEn: row.commune_en,
        districtId: row.district_code,
      })),
      skipDuplicates: true,
    });
  }

  // 2. Update Commune GIS
const comGeoPath = path.join(__dirname, "data", "CambodiaCommuneBoundaries.geojson");
if (fs.existsSync(comGeoPath)) {
  const geoData = JSON.parse(fs.readFileSync(comGeoPath, "utf-8"));
  
  for (const f of geoData.features) {
    const rawCode = f.properties?.ADM3_PCODE; 
    if (rawCode) {
      const cleanCode = rawCode.replace("KH", ""); 
      const geomJson = JSON.stringify(f.geometry);
      
      await prisma.$executeRaw`
        UPDATE "communes"
        SET "geom" = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${geomJson}::json), 4326))
        WHERE "commune_id" = ${cleanCode};
      `;
    }
  }
}
  console.log(`✅ Commune Process Complete.`);
  // ============================================
  // 4. SEED VILLAGES
  // ============================================
  console.log("🏘️ Seeding Villages...");
  const villageData = await readCSV("CambodiaVillagesList2025.csv");
  
  for (let i = 0; i < villageData.length; i += chunkSize) {
    const chunk = villageData.slice(i, i + chunkSize);
    await prisma.village.createMany({
      data: chunk.map(row => ({
        code: row.village_code,
        nameKh: row.village_kh,
        nameEn: row.village_en,
        communeId: row.commune_code,
      })),
      skipDuplicates: true,
    });
  }
  console.log(`✅ Seeded ${villageData.length} villages.`);

  console.log("🏁 Seeding Completed Successfully!");
  const hashedPassword = await hashPassword(seedPassword);
  const seedUsers = [
    {
      username: "admin",
      email: "admin@gmail.com",
      firstName: "System",
      lastName: "Administrator",
      phone: "+855-88-123-456",
    },
    {
      username: "vanreuth",
      email: "vanreuth@gmail.com",
      firstName: "Heng",
      lastName: "Vanreuth",
      phone: "+855-12-987-654",
    },
    {
      username: "testuser",
      email: "testuser@gmail.com",
      firstName: "Test",
      lastName: "User",
      phone: "+855-17-456-789",
    },
    {
      username: "Bill",
      email: "bill@gmail.com",
      firstName: "Bill",
      lastName: "Gates",
      phone: "+855-15-555-111",
    },
    {
      username: "ElonMusk",
      email: "elon.musk@gmail.com",
      firstName: "Elon",
      lastName: "Musk",
      phone: "+855-16-222-333",
    },
  ] as const;

  // Users
  console.log("👤 Seeding users...");
  const users = await Promise.all(
    seedUsers.map((u) =>
      prisma.user.create({
        data: {
          username: u.username,
          email: u.email,
          password: hashedPassword,
          firstName: u.firstName,
          lastName: u.lastName,
          phone: u.phone,
          status: "ACTIVE",
        },
      })
    )
  ); // Roles

  // Roles
  console.log("🔐 Seeding roles...");
  const roles = await Promise.all([
    prisma.role.create({
      data: {
        roleName: "Super Administrator",
        roleCode: "SUPER_ADMIN",
        description: "Full system access and control",
        hierarchyLevel: 1,
      },
    }),
    prisma.role.create({
      data: {
        roleName: "Property Manager",
        roleCode: "PROP_MGR",
        description: "Can manage properties and related data",
        hierarchyLevel: 2,
      },
    }),
    prisma.role.create({
      data: {
        roleName:"Valuer",
        roleCode: "VALUER",
        description: "Can perform property valuations",
        hierarchyLevel: 3,
      },
    }),
    prisma.role.create({
      data: {
        // roles[2]
        roleName: "Data Entry",
        roleCode: "DATA_ENTRY",
        description: "Can create and update property information",
        hierarchyLevel: 4,
      },
    }),
    prisma.role.create({
      data: {
        // roles[3]
        roleName: "Viewer",
        roleCode: "VIEWER",
        description: "Read-only access to property data",
        hierarchyLevel: 5,
      },
    }),
    prisma.role.create({
      data: {
        roleName: "User",
        roleCode: "USER",
        description: "Public user",
        hierarchyLevel: 6,
      },
    }),
  ]);

  // Permissions
  console.log("🔑 Seeding permissions...");
  const permissions = await Promise.all([
    // User permissions
    prisma.permission.create({
      data: {
        permissionName: "Manage Users",
        permissionCode: "user:manage",
        resource: "user",
        action: "MANAGE",
        description: "Full control over user accounts",
      },
    }),
    prisma.permission.create({
      data: {
        permissionName: "Create Users",
        permissionCode: "user:create",
        resource: "user",
        action: "CREATE",
        description: "Create new users",
      },
    }),
    prisma.permission.create({
      data: {
        permissionName: "Read Users",
        permissionCode: "user:read",
        resource: "user",
        action: "READ",
        description: "View user information",
      },
    }),
    prisma.permission.create({
      data: {
        permissionName: "Update Users",
        permissionCode: "user:update",
        resource: "user",
        action: "UPDATE",
        description: "Modify user information",
      },
    }),
    prisma.permission.create({
      data: {
        permissionName: "Delete Users",
        permissionCode: "user:delete",
        resource: "user",
        action: "DELETE",
        description: "Remove users from system",
      },
    }), // Role permissions
    prisma.permission.create({
      data: {
        permissionName: "Manage Roles",
        permissionCode: "role:manage",
        resource: "role",
        action: "MANAGE",
        description: "Full control over roles",
      },
    }),
    prisma.permission.create({
      data: {
        permissionName: "Create Roles",
        permissionCode: "role:create",
        resource: "role",
        action: "CREATE",
        description: "Create new roles",
      },
    }),
    prisma.permission.create({
      data: {
        permissionName: "Read Roles",
        permissionCode: "role:read",
        resource: "role",
        action: "READ",
        description: "View role information",
      },
    }), // Permission permissions
    prisma.permission.create({
      data: {
        permissionName: "Manage Permissions",
        permissionCode: "permission:manage",
        resource: "permission",
        action: "MANAGE",
        description: "Full control over permissions",
      },
    }),
    prisma.permission.create({
      data: {
        permissionName: "Read Permissions",
        permissionCode: "permission:read",
        resource: "permission",
        action: "READ",
        description: "View permission information",
      },
    }),
    prisma.permission.create({
      data: {
        permissionName: "Assign Permissions to Roles",
        permissionCode: "permission:assign",
        resource: "permission",
        action: "CREATE",
        description: "Assign permissions to roles",
      },
    }), // Audit Log permissions
    prisma.permission.create({
      data: {
        permissionName: "View Audit Logs",
        permissionCode: "audit:read",
        resource: "audit",
        action: "READ",
        description: "View system audit logs",
      },
    }),
    prisma.permission.create({
      data: {
        permissionName: "Manage Audit Logs",
        permissionCode: "audit:manage",
        resource: "audit",
        action: "MANAGE",
        description: "Full control over audit logs",
      },
    }),
    // Property permissions
    prisma.permission.create({
      data: {
        permissionName: "Manage Properties",
        permissionCode: "property:manage",
        resource: "property",
        action: "MANAGE",
        description: "Full control over properties",
      },
    }),
    prisma.permission.create({
      data: {
        permissionName: "Create Properties",
        permissionCode: "property:create",
        resource: "property",
        action: "CREATE",
        description: "Create new properties",
      },
    }),
    prisma.permission.create({
      data: {
        permissionName: "Read Properties",
        permissionCode: "property:read",
        resource: "property",
        action: "READ",
        description: "View property information",
      },
    }),
    prisma.permission.create({
      data: {
        permissionName: "Update Properties",
        permissionCode: "property:update",
        resource: "property",
        action: "UPDATE",
        description: "Modify property information",
      },
    }),
    prisma.permission.create({
      data: {
        permissionName: "Delete Properties",
        permissionCode: "property:delete",
        resource: "property",
        action: "DELETE",
        description: "Remove property information",
      },
    }),
    prisma.permission.create({
      data: {
        permissionName: "Create Comparable",
        permissionCode: "comparable:create",
        resource: "comparable",
        action: "CREATE",
        description: "Create new comparable entries",
      },
    }),
    prisma.permission.create({
      data: {
        permissionName: "Read Comparable",
        permissionCode: "comparable:read",
        resource: "comparable",
        action: "READ",
        description: "Read comparable entries",
      },
    }),
    prisma.permission.create({
      data: {
        permissionName: "Manage Comparable",
        permissionCode: "comparable:manage",
        resource: "comparable",
        action: "MANAGE",
        description: "Full control over comparable entries",
      },
    }),
  ]);

  // User Roles
  console.log("👥 Seeding user roles...");
  await Promise.all([
    prisma.userRole.create({
      data: {
        userId: users[0].id,
        roleId: roles[0].id,
        assignedBy: users[0].id,
      },
    }),
    prisma.userRole.create({
      data: {
        userId: users[1].id,
        roleId: roles[1].id,
        assignedBy: users[0].id,
      },
    }),
    prisma.userRole.create({
      data: {
        userId: users[2].id,
        roleId: roles[2].id,
        assignedBy: users[0].id,
      },
    }),
    prisma.userRole.create({
      data: {
        userId: users[3].id,
        roleId: roles[3].id,
        assignedBy: users[0].id,
      },
    }),
    prisma.userRole.create({
      data: {
        userId: users[4].id,
        roleId: roles[1].id,
        assignedBy: users[0].id,
      },
    }), // Manager
    prisma.userRole.create({
      data: {
        userId: users[4].id,
        roleId: roles[2].id,
        assignedBy: users[0].id,
      },
    }), // Data E
  ]);

  // Role Permissions
  console.log("🔗 Seeding role permissions...");
  for (const permission of permissions) {
    await prisma.rolePermission.create({
      data: {
        roleId: roles[0].id,
        permissionId: permission.id,
        assignedBy: users[0].id,
      },
    });
  }

  // Property Manager gets all property permissions
  const propertyPermissions = permissions.filter(
    (p) => p.resource === "property"
  );
  for (const permission of propertyPermissions) {
    await prisma.rolePermission.create({
      data: {
        roleId: roles[1].id,
        permissionId: permission.id,
        assignedBy: users[0].id,
      },
    });
  } // Data Entry gets CREATE, UPDATE, READ for properties
  const dataEntryPermissions = permissions.filter(
    (p) =>
      p.resource === "property" &&
      ["CREATE", "UPDATE", "READ"].includes(p.action)
  );
  for (const permission of dataEntryPermissions) {
    await prisma.rolePermission.create({
      data: {
        roleId: roles[2].id,
        permissionId: permission.id,
        assignedBy: users[0].id,
      },
    });
  } // Viewer gets all READ permissions
  const readPermissions = permissions.filter((p) => p.action === "READ");
  for (const permission of readPermissions) {
    await prisma.rolePermission.create({
      data: {
        roleId: roles[3].id,
        permissionId: permission.id,
        assignedBy: users[0].id,
      },
    });
  }
  // User Preferences
  console.log("⚙️ Seeding user preferences...");
  await Promise.all([
    prisma.userPreference.create({
      data: {
        userId: users[0].id,
        theme: "dark",
        language: "en",
        timezone: "Asia/Phnom_Penh",
      },
    }),
    prisma.userPreference.create({
      data: {
        userId: users[1].id,
        theme: "light",
        language: "km",
        timezone: "Asia/Phnom_Penh",
      },
    }),
  ]); // Geographic data

  // Geographic data
  console.log("🌍 Seeding geographic data...");

  // Property classification
  console.log("🏢 Seeding property classification...");
  const recordTypes = await Promise.all([
    prisma.recordType.create({ data: { recordTypeId: 1, recordName: "Land" } }),
    prisma.recordType.create({
      data: { recordTypeId: 2, recordName: "Building" },
    }),
    prisma.recordType.create({
      data: { recordTypeId: 3, recordName: "LandAndBuilding" },
    }),
  ]);

  const propertyTypes = await Promise.all([
    prisma.propertyType.create({
      data: {
        propertyTypeId: 1,
        propertyName: "Vacant Land",
        recordTypeId: recordTypes[0].recordTypeId,
      },
    }), // 0
    prisma.propertyType.create({
      data: {
        propertyTypeId: 2,
        propertyName: "Agricultural Land",
        recordTypeId: recordTypes[0].recordTypeId,
      },
    }), // 1
    prisma.propertyType.create({
      data: {
        propertyTypeId: 3,
        propertyName: "Residential Building",
        recordTypeId: recordTypes[1].recordTypeId,
      },
    }), // 2
    prisma.propertyType.create({
      data: {
        propertyTypeId: 4,
        propertyName: "Commercial Building",
        recordTypeId: recordTypes[1].recordTypeId,
      },
    }), // 3
    prisma.propertyType.create({
      data: {
        propertyTypeId: 5,
        propertyName: "Agricultural Property",
        recordTypeId: recordTypes[2].recordTypeId,
      },
    }), // 4
    prisma.propertyType.create({
      data: {
        propertyTypeId: 6,
        propertyName: "Residential Property",
        recordTypeId: recordTypes[2].recordTypeId,
      },
    }), // 5
    prisma.propertyType.create({
      data: {
        propertyTypeId: 7,
        propertyName: "Commercial Property",
        recordTypeId: recordTypes[2].recordTypeId,
      },
    }), // 6
    prisma.propertyType.create({
      data: {
        propertyTypeId: 8,
        propertyName: "Industrial Property",
        recordTypeId: recordTypes[2].recordTypeId,
      },
    }), // 7
    prisma.propertyType.create({
      data: {
        propertyTypeId: 9,
        propertyName: "Specialized Property",
        recordTypeId: recordTypes[2].recordTypeId,
      },
    }), // 8
  ]);

  const propertyTypeIds = {
    vacantLand: propertyTypes[0].propertyTypeId,
    agriculturalLand: propertyTypes[1].propertyTypeId,
    residentialBuilding: propertyTypes[2].propertyTypeId,
    commercialBuilding: propertyTypes[3].propertyTypeId,
    agriculturalProperty: propertyTypes[4].propertyTypeId,
    residentialProperty: propertyTypes[5].propertyTypeId,
    commercialProperty: propertyTypes[6].propertyTypeId,
    industrialProperty: propertyTypes[7].propertyTypeId,
    specializedProperty: propertyTypes[8].propertyTypeId,
  } as const;

  const propertySubtypes = await Promise.all([
    // Vacant Land subtypes (propertyTypes[0])
    prisma.propertySubtype.create({
      // [0]
      data: {
        propertySubtypeId: 1,
        subtypeName: "Improvement Land",
        propertyTypeId: propertyTypeIds.vacantLand,
      },
    }),
    prisma.propertySubtype.create({
      // [1]
      data: {
        propertySubtypeId: 2,
        subtypeName: "Unimprovement Land",
        propertyTypeId: propertyTypeIds.vacantLand,
      },
    }),
    prisma.propertySubtype.create({
      // [2] - Other for Vacant Land
      data: {
        propertySubtypeId: 3,
        subtypeName: "Other Land",
        propertyTypeId: propertyTypeIds.vacantLand,
      },
    }),

    // Agricultural Land subtypes (propertyTypes[1])
    prisma.propertySubtype.create({
      // [3]
      data: {
        propertySubtypeId: 4,
        subtypeName: "Mango Orchard",
        propertyTypeId: propertyTypeIds.agriculturalLand,
      },
    }),
    prisma.propertySubtype.create({
      // [4]
      data: {
        propertySubtypeId: 5,
        subtypeName: "Orange Orchard",
        propertyTypeId: propertyTypeIds.agriculturalLand,
      },
    }),
    prisma.propertySubtype.create({
      // [5]
      data: {
        propertySubtypeId: 6,
        subtypeName: "Coconut Orchard",
        propertyTypeId: propertyTypeIds.agriculturalLand,
      },
    }),
    prisma.propertySubtype.create({
      // [6]
      data: {
        propertySubtypeId: 7,
        subtypeName: "Cashew Orchard",
        propertyTypeId: propertyTypeIds.agriculturalLand,
      },
    }),
    prisma.propertySubtype.create({
      // [7]
      data: {
        propertySubtypeId: 8,
        subtypeName: "Durian Orchard",
        propertyTypeId: propertyTypeIds.agriculturalLand,
      },
    }),
    prisma.propertySubtype.create({
      // [8]
      data: {
        propertySubtypeId: 9,
        subtypeName: "Longan Orchard",
        propertyTypeId: propertyTypeIds.agriculturalLand,
      },
    }),
    prisma.propertySubtype.create({
      // [9]
      data: {
        propertySubtypeId: 10,
        subtypeName: "Banana Orchard",
        propertyTypeId: propertyTypeIds.agriculturalLand,
      },
    }),
    prisma.propertySubtype.create({
      // [10]
      data: {
        propertySubtypeId: 11,
        subtypeName: "Coconut Orchard",
        propertyTypeId: propertyTypeIds.agriculturalLand,
      },
    }),
    prisma.propertySubtype.create({
      // [12]
      data: {
        propertySubtypeId: 13,
        subtypeName: "Rubber Plantation",
        propertyTypeId: propertyTypeIds.agriculturalLand,
      },
    }),
    prisma.propertySubtype.create({
      // [13]
      data: {
        propertySubtypeId: 14,
        subtypeName: "Rice Farm",
        propertyTypeId: propertyTypeIds.agriculturalLand,
      },
    }),
    prisma.propertySubtype.create({
      // [14]
      data: {
        propertySubtypeId: 15,
        subtypeName: "Vegetable Farm",
        propertyTypeId: propertyTypeIds.agriculturalLand,
      },
    }),
    prisma.propertySubtype.create({
      // [15]
      data: {
        propertySubtypeId: 16,
        subtypeName: "Livestock Farm",
        propertyTypeId: propertyTypeIds.agriculturalLand,
      },
    }),
    prisma.propertySubtype.create({
      // [16]
      data: {
        propertySubtypeId: 17,
        subtypeName: "Fishery Farm",
        propertyTypeId: propertyTypeIds.agriculturalLand,
      },
    }),
    prisma.propertySubtype.create({
      // [17]
      data: {
        propertySubtypeId: 18,
        subtypeName: "Timber Land",
        propertyTypeId: propertyTypeIds.agriculturalLand,
      },
    }),
    prisma.propertySubtype.create({
      // [18]
      data: {
        propertySubtypeId: 19,
        subtypeName: "Improvement Land",
        propertyTypeId: propertyTypeIds.agriculturalLand,
      },
    }),
    prisma.propertySubtype.create({
      // [19]
      data: {
        propertySubtypeId: 20,
        subtypeName: "Unimprovement Land",
        propertyTypeId: propertyTypeIds.agriculturalLand,
      },
    }),
    prisma.propertySubtype.create({
      // [20] - Other for Agricultural Land
      data: {
        propertySubtypeId: 21,
        subtypeName: "Other",
        propertyTypeId: propertyTypeIds.agriculturalLand,
      },
    }),

    // Residential Building subtypes (propertyTypes[2])
    prisma.propertySubtype.create({
      // [21]
      data: {
        propertySubtypeId: 22,
        subtypeName: "Condominium",
        propertyTypeId: propertyTypeIds.residentialBuilding,
      },
    }),
    prisma.propertySubtype.create({
      // [22]
      data: {
        propertySubtypeId: 23,
        subtypeName: "Apartment",
        propertyTypeId: propertyTypeIds.residentialBuilding,
      },
    }),
    prisma.propertySubtype.create({
      // [23]
      data: {
        propertySubtypeId: 24,
        subtypeName: "Co-Ownership",
        propertyTypeId: propertyTypeIds.residentialBuilding,
      },
    }),
    prisma.propertySubtype.create({
      // [24]
      data: {
        propertySubtypeId: 25,
        subtypeName: "Studio Unit",
        propertyTypeId: propertyTypeIds.residentialBuilding,
      },
    }),
    prisma.propertySubtype.create({
      // [25]
      data: {
        propertySubtypeId: 26,
        subtypeName: "Penthouse",
        propertyTypeId: propertyTypeIds.residentialBuilding,
      },
    }),
    prisma.propertySubtype.create({
      // [26]
      data: {
        propertySubtypeId: 27,
        subtypeName: "Apartment",
        propertyTypeId: propertyTypeIds.residentialBuilding,
      },
    }),
    prisma.propertySubtype.create({
      // [27]
      data: {
        propertySubtypeId: 28,
        subtypeName: "Wooden House",
        propertyTypeId: propertyTypeIds.residentialBuilding,
      },
    }),
    prisma.propertySubtype.create({
      // [28] - Other for Residential Building
      data: {
        propertySubtypeId: 29,
        subtypeName: "Other",
        propertyTypeId: propertyTypeIds.residentialBuilding,
      },
    }),

    // Commercial Building subtypes (propertyTypes[3])
    prisma.propertySubtype.create({
      // [29]
      data: {
        propertySubtypeId: 30,
        subtypeName: "Office Building",
        propertyTypeId: propertyTypeIds.commercialBuilding,
      },
    }),
    prisma.propertySubtype.create({
      // [30]
      data: {
        propertySubtypeId: 31,
        subtypeName: "Retail Space",
        propertyTypeId: propertyTypeIds.commercialBuilding,
      },
    }),
    prisma.propertySubtype.create({
      // [31]
      data: {
        propertySubtypeId: 32,
        subtypeName: "Hotel",
        propertyTypeId: propertyTypeIds.commercialBuilding,
      },
    }),
    prisma.propertySubtype.create({
      // [32]
      data: {
        propertySubtypeId: 33,
        subtypeName: "Shopping Mall",
        propertyTypeId: propertyTypeIds.commercialBuilding,
      },
    }),
    prisma.propertySubtype.create({
      // [33]
      data: {
        propertySubtypeId: 34,
        subtypeName: "Showroom",
        propertyTypeId: propertyTypeIds.commercialBuilding,
      },
    }),
    prisma.propertySubtype.create({
      // [34]
      data: {
        propertySubtypeId: 35,
        subtypeName: "Medical Center",
        propertyTypeId: propertyTypeIds.commercialBuilding,
      },
    }),
    prisma.propertySubtype.create({
      // [35] - Other for Commercial Building
      data: {
        propertySubtypeId: 36,
        subtypeName: "Other",
        propertyTypeId: propertyTypeIds.commercialBuilding,
      },
    }),

    // Agricultural Property subtypes (propertyTypes[4])
    prisma.propertySubtype.create({
      // [36]
      data: {
        propertySubtypeId: 37,
        subtypeName: "Rubber Plantation",
        propertyTypeId: propertyTypeIds.agriculturalProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [37]
      data: {
        propertySubtypeId: 38,
        subtypeName: "Durian Plantation",
        propertyTypeId: propertyTypeIds.agriculturalProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [38]
      data: {
        propertySubtypeId: 39,
        subtypeName: "Mango Plantation",
        propertyTypeId: propertyTypeIds.agriculturalProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [39]
      data: {
        propertySubtypeId: 40,
        subtypeName: "Orange Plantation",
        propertyTypeId: propertyTypeIds.agriculturalProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [40]
      data: {
        propertySubtypeId: 41,
        subtypeName: "Pepper Plantation",
        propertyTypeId: propertyTypeIds.agriculturalProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [41]
      data: {
        propertySubtypeId: 42,
        subtypeName: "Cashew Plantation",
        propertyTypeId: propertyTypeIds.agriculturalProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [42]
      data: {
        propertySubtypeId: 43,
        subtypeName: "Coconut Plantation",
        propertyTypeId: propertyTypeIds.agriculturalProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [43]
      data: {
        propertySubtypeId: 44,
        subtypeName: "Longan Plantation",
        propertyTypeId: propertyTypeIds.agriculturalProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [44]
      data: {
        propertySubtypeId: 45,
        subtypeName: "Rice Paddy with House",
        propertyTypeId: propertyTypeIds.agriculturalProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [45]
      data: {
        propertySubtypeId: 46,
        subtypeName: "Farm with Facilities",
        propertyTypeId: propertyTypeIds.agriculturalProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [46] - Other already exists for Agricultural Property
      data: {
        propertySubtypeId: 47,
        subtypeName: "Other",
        propertyTypeId: propertyTypeIds.agriculturalProperty,
      },
    }),

    // Residential Property subtypes (propertyTypes[5])
    prisma.propertySubtype.create({
      // [47]
      data: {
        propertySubtypeId: 48,
        subtypeName: "Villa",
        propertyTypeId: propertyTypeIds.residentialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [48]
      data: {
        propertySubtypeId: 49,
        subtypeName: "Dwelling House",
        propertyTypeId: propertyTypeIds.residentialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [49]
      data: {
        propertySubtypeId: 50,
        subtypeName: "Linked House",
        propertyTypeId: propertyTypeIds.residentialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [50]
      data: {
        propertySubtypeId: 51,
        subtypeName: "Twin Villa",
        propertyTypeId: propertyTypeIds.residentialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [51]
      data: {
        propertySubtypeId: 52,
        subtypeName: "Flat House",
        propertyTypeId: propertyTypeIds.residentialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [52]
      data: {
        propertySubtypeId: 53,
        subtypeName: "Townhouse",
        propertyTypeId: propertyTypeIds.residentialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [53]
      data: {
        propertySubtypeId: 54,
        subtypeName: "Bungalow",
        propertyTypeId: propertyTypeIds.residentialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [54]
      data: {
        propertySubtypeId: 55,
        subtypeName: "Duplex",
        propertyTypeId: propertyTypeIds.residentialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [55] - Other for Residential Property
      data: {
        propertySubtypeId: 56,
        subtypeName: "Other",
        propertyTypeId: propertyTypeIds.residentialProperty,
      },
    }),

    // Commercial Property subtypes (propertyTypes[6])
    prisma.propertySubtype.create({
      // [56]
      data: {
        propertySubtypeId: 57,
        subtypeName: "Entertainment Center",
        propertyTypeId: propertyTypeIds.commercialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [57]
      data: {
        propertySubtypeId: 58,
        subtypeName: "Mixed Use",
        propertyTypeId: propertyTypeIds.commercialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [58]
      data: {
        propertySubtypeId: 59,
        subtypeName: "Hotel",
        propertyTypeId: propertyTypeIds.commercialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [59]
      data: {
        propertySubtypeId: 60,
        subtypeName: "Resort",
        propertyTypeId: propertyTypeIds.commercialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [60]
      data: {
        propertySubtypeId: 61,
        subtypeName: "Restaurant",
        propertyTypeId: propertyTypeIds.commercialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [61]
      data: {
        propertySubtypeId: 62,
        subtypeName: "Shop House",
        propertyTypeId: propertyTypeIds.commercialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [62]
      data: {
        propertySubtypeId: 63,
        subtypeName: "Shopping Center",
        propertyTypeId: propertyTypeIds.commercialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [63]
      data: {
        propertySubtypeId: 64,
        subtypeName: "Office Building",
        propertyTypeId: propertyTypeIds.commercialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [64]
      data: {
        propertySubtypeId: 65,
        subtypeName: "Gas Station",
        propertyTypeId: propertyTypeIds.commercialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [65]
      data: {
        propertySubtypeId: 66,
        subtypeName: "Convenience Store",
        propertyTypeId: propertyTypeIds.commercialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [66]
      data: {
        propertySubtypeId: 67,
        subtypeName: "Car Showroom",
        propertyTypeId: propertyTypeIds.commercialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [67]
      data: {
        propertySubtypeId: 68,
        subtypeName: "Event Hall",
        propertyTypeId: propertyTypeIds.commercialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [68] - Other for Commercial Property
      data: {
        propertySubtypeId: 69,
        subtypeName: "Other",
        propertyTypeId: propertyTypeIds.commercialProperty,
      },
    }),

    // Industrial Property subtypes (propertyTypes[7])
    prisma.propertySubtype.create({
      // [69]
      data: {
        propertySubtypeId: 70,
        subtypeName: "Warehouse",
        propertyTypeId: propertyTypeIds.industrialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [70]
      data: {
        propertySubtypeId: 71,
        subtypeName: "Factory",
        propertyTypeId: propertyTypeIds.industrialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [71]
      data: {
        propertySubtypeId: 72,
        subtypeName: "Power Station",
        propertyTypeId: propertyTypeIds.industrialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [72]
      data: {
        propertySubtypeId: 73,
        subtypeName: "Manufacturing Plant",
        propertyTypeId: propertyTypeIds.industrialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [73]
      data: {
        propertySubtypeId: 74,
        subtypeName: "Cold Storage",
        propertyTypeId: propertyTypeIds.industrialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [74]
      data: {
        propertySubtypeId: 75,
        subtypeName: "Logistics Center",
        propertyTypeId: propertyTypeIds.industrialProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [75] - Other for Industrial Property
      data: {
        propertySubtypeId: 76,
        subtypeName: "Other",
        propertyTypeId: propertyTypeIds.industrialProperty,
      },
    }),

    // Specialized Property subtypes (propertyTypes[8])
    prisma.propertySubtype.create({
      // [76]
      data: {
        propertySubtypeId: 77,
        subtypeName: "Government Institution",
        propertyTypeId: propertyTypeIds.specializedProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [77]
      data: {
        propertySubtypeId: 78,
        subtypeName: "Hospital",
        propertyTypeId: propertyTypeIds.specializedProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [78]
      data: {
        propertySubtypeId: 79,
        subtypeName: "School",
        propertyTypeId: propertyTypeIds.specializedProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [79]
      data: {
        propertySubtypeId: 80,
        subtypeName: "University",
        propertyTypeId: propertyTypeIds.specializedProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [80]
      data: {
        propertySubtypeId: 81,
        subtypeName: "Sports Complex",
        propertyTypeId: propertyTypeIds.specializedProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [81]
      data: {
        propertySubtypeId: 82,
        subtypeName: "Religious Building",
        propertyTypeId: propertyTypeIds.specializedProperty,
      },
    }),
    prisma.propertySubtype.create({
      // [82] - Other for Specialized Property
      data: {
        propertySubtypeId: 83,
        subtypeName: "Other",
        propertyTypeId: propertyTypeIds.specializedProperty,
      },
    }),
  ]);

  // Building Subtypes
  console.log("🧱 Seeding building subtypes...");
  const buildingSubtypes = await Promise.all([
    // Residential Building Subtypes
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 1,
        propertyTypeId: propertyTypeIds.residentialBuilding, // Residential Building
        subtypeName: "Villa",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 2,
        propertyTypeId: propertyTypeIds.residentialBuilding, // Residential Building
        subtypeName: "Condominium Unit",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 3,
        propertyTypeId: propertyTypeIds.residentialBuilding, // Residential Building
        subtypeName: "Apartment Unit",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 4,
        propertyTypeId: propertyTypeIds.residentialBuilding, // Residential Building
        subtypeName: "Single-Family House",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 5,
        propertyTypeId: propertyTypeIds.residentialBuilding, // Residential Building
        subtypeName: "Duplex",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 6,
        propertyTypeId: propertyTypeIds.residentialBuilding, // Residential Building
        subtypeName: "Townhouse",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 7,
        propertyTypeId: propertyTypeIds.residentialBuilding, // Residential Building
        subtypeName: "Other",
      },
    }),
    // Commercial Building Subtypes
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 8,
        propertyTypeId: propertyTypeIds.commercialBuilding, // Commercial Building
        subtypeName: "Office Building",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 9,
        propertyTypeId: propertyTypeIds.commercialBuilding, // Commercial Property
        subtypeName: "Industrial Building",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 10,
        propertyTypeId: propertyTypeIds.commercialBuilding, // Commercial Property
        subtypeName: "Entertainment Building",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 11,
        propertyTypeId: propertyTypeIds.commercialBuilding, // Commercial Property
        subtypeName: "Retail Building",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 12,
        propertyTypeId: propertyTypeIds.commercialBuilding, // Commercial Property
        subtypeName: "Mixed-Use Building",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 13,
        propertyTypeId: propertyTypeIds.commercialBuilding, // Commercial Property
        subtypeName: "Other",
      },
    }),
    // Agricultural Property Subtypes
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 14,
        propertyTypeId: propertyTypeIds.agriculturalProperty, // Agricultural Property
        subtypeName: "Farmhouse",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 15,
        propertyTypeId: propertyTypeIds.agriculturalProperty, // Agricultural Property
        subtypeName: "Greenhouse",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 16,
        propertyTypeId: propertyTypeIds.agriculturalProperty, // Agricultural Property
        subtypeName: "Barn",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 17,
        propertyTypeId: propertyTypeIds.agriculturalProperty, // Agricultural Property
        subtypeName: "Storage Shed",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 18,
        propertyTypeId: propertyTypeIds.agriculturalProperty, // Agricultural Property
        subtypeName: "Other",
      },
    }),
    // Residentail Property Subtypes
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 19,
        propertyTypeId: propertyTypeIds.residentialProperty, // Residential Property
        subtypeName: "Dwelling House",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 20,
        propertyTypeId: propertyTypeIds.residentialProperty, // Residential Property
        subtypeName: "Linked House",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 21,
        propertyTypeId: propertyTypeIds.residentialProperty, // Residential Property
        subtypeName: "Twin Villa",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 22,
        propertyTypeId: propertyTypeIds.residentialProperty, // Residential Property
        subtypeName: "Flat House",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 23,
        propertyTypeId: propertyTypeIds.residentialProperty, // Residential Property
        subtypeName: "Bungalow",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 24,
        propertyTypeId: propertyTypeIds.residentialProperty, // Residential Property
        subtypeName: "Duplex",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 25,
        propertyTypeId: propertyTypeIds.residentialProperty, // Residential Property
        subtypeName: "Other",
      },
    }),
    // Commercial Property Subtypes
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 26,
        propertyTypeId: propertyTypeIds.commercialProperty, // Commercial Property
        subtypeName: "Office Building",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 27,
        propertyTypeId: propertyTypeIds.commercialProperty, // Commercial Property
        subtypeName: "Retail Space",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 28,
        propertyTypeId: propertyTypeIds.commercialProperty, // Commercial Property
        subtypeName: "Industrial Building",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 29,
        propertyTypeId: propertyTypeIds.commercialProperty, // Commercial Property
        subtypeName: "MultiFamily Building",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 30,
        propertyTypeId: propertyTypeIds.commercialProperty, // Commercial Property
        subtypeName: "Mixed-Use Building",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 31,
        propertyTypeId: propertyTypeIds.commercialProperty, // Commercial Property
        subtypeName: "Hospitality Building",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 32,
        propertyTypeId: propertyTypeIds.commercialProperty, // Commercial Property
        subtypeName: "Other",
      },
    }),

    // Industrial Property Subtypes
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 33,
        propertyTypeId: propertyTypeIds.industrialProperty, // Industrial Property
        subtypeName: "Factory",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 34,
        propertyTypeId: propertyTypeIds.industrialProperty, // Industrial Property
        subtypeName: "Power Station",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 35,
        propertyTypeId: propertyTypeIds.industrialProperty, // Industrial Property
        subtypeName: "Warehouse",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 36,
        propertyTypeId: propertyTypeIds.industrialProperty, // Industrial Property
        subtypeName: "Manufacturing Plant",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 37,
        propertyTypeId: propertyTypeIds.industrialProperty, // Industrial Property
        subtypeName: "Cold Storage Facility",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 38,
        propertyTypeId: propertyTypeIds.industrialProperty, // Industrial Property
        subtypeName: "Distribution Center",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 39,
        propertyTypeId: propertyTypeIds.industrialProperty, // Industrial Property
        subtypeName: "Other",
      },
    }),
    // Specialized Property Subtypes
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 40,
        propertyTypeId: propertyTypeIds.specializedProperty, // Specialized Property
        subtypeName: "Hospital",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 41,
        propertyTypeId: propertyTypeIds.specializedProperty, // Specialized Property
        subtypeName: "School",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 42,
        propertyTypeId: propertyTypeIds.specializedProperty, // Specialized Property
        subtypeName: "University",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 43,
        propertyTypeId: propertyTypeIds.specializedProperty, // Specialized Property
        subtypeName: "Government Building",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 44,
        propertyTypeId: propertyTypeIds.specializedProperty, // Specialized Property
        subtypeName: "Religious Building",
      },
    }),
    prisma.buildingSubtype.create({
      data: {
        buildingSubtypeId: 45,
        propertyTypeId: propertyTypeIds.specializedProperty, // Specialized Property
        subtypeName: "Other",
      },
    }),
  ]);

  // Current Uses
  console.log("🎯 Seeding current uses...");
  const currentUses = await Promise.all([
    // Residential Uses (1-5)
    prisma.currentUse.create({
      data: { useId: 1, useName: "Single Family Residential" },
    }),
    prisma.currentUse.create({
      data: { useId: 2, useName: "Multi-Family Residential" },
    }),
    prisma.currentUse.create({
      data: { useId: 3, useName: "Condominium" },
    }),
    prisma.currentUse.create({
      data: { useId: 4, useName: "Apartment Building" },
    }),
    prisma.currentUse.create({
      data: { useId: 5, useName: "Serviced Apartment" },
    }),

    // Commercial Uses (6-10)
    prisma.currentUse.create({
      data: { useId: 6, useName: "Office Building" },
    }),
    prisma.currentUse.create({
      data: { useId: 7, useName: "Retail Store" },
    }),
    prisma.currentUse.create({
      data: { useId: 8, useName: "Shopping Mall" },
    }),
    prisma.currentUse.create({
      data: { useId: 9, useName: "Shop House" },
    }),
    prisma.currentUse.create({
      data: { useId: 10, useName: "Showroom" },
    }),

    // Hospitality Uses (11-14)
    prisma.currentUse.create({
      data: { useId: 11, useName: "Hotel/Hospitality" },
    }),
    prisma.currentUse.create({
      data: { useId: 12, useName: "Resort" },
    }),
    prisma.currentUse.create({
      data: { useId: 13, useName: "Guest House" },
    }),
    prisma.currentUse.create({
      data: { useId: 14, useName: "Restaurant/Cafe" },
    }),

    // Industrial Uses (15-18)
    prisma.currentUse.create({
      data: { useId: 15, useName: "Industrial Warehouse" },
    }),
    prisma.currentUse.create({
      data: { useId: 16, useName: "Factory" },
    }),
    prisma.currentUse.create({
      data: { useId: 17, useName: "Manufacturing" },
    }),
    prisma.currentUse.create({
      data: { useId: 18, useName: "Logistics/Distribution" },
    }),

    // Agricultural Uses (19-22)
    prisma.currentUse.create({
      data: { useId: 19, useName: "Agricultural Land" },
    }),
    prisma.currentUse.create({
      data: { useId: 20, useName: "Farm" },
    }),
    prisma.currentUse.create({
      data: { useId: 21, useName: "Plantation" },
    }),
    prisma.currentUse.create({
      data: { useId: 22, useName: "Orchard" },
    }),

    // Land Uses (23-24)
    prisma.currentUse.create({
      data: { useId: 23, useName: "Vacant Land" },
    }),
    prisma.currentUse.create({
      data: { useId: 24, useName: "Development Land" },
    }),

    // Mixed/Special Uses (25-33)
    prisma.currentUse.create({
      data: { useId: 25, useName: "Mixed Use Development" },
    }),
    prisma.currentUse.create({
      data: { useId: 26, useName: "Entertainment/Recreation" },
    }),
    prisma.currentUse.create({
      data: { useId: 27, useName: "Medical/Healthcare" },
    }),
    prisma.currentUse.create({
      data: { useId: 28, useName: "Educational" },
    }),
    prisma.currentUse.create({
      data: { useId: 29, useName: "Religious" },
    }),
    prisma.currentUse.create({
      data: { useId: 30, useName: "Government/Institutional" },
    }),
    prisma.currentUse.create({
      data: { useId: 31, useName: "Sports Facility" },
    }),
    prisma.currentUse.create({
      data: { useId: 32, useName: "Parking Facility" },
    }),
    prisma.currentUse.create({
      data: { useId: 33, useName: "Service Station" },
    }),
    prisma.currentUse.create({
      data: { useId: 34, useName: "Other" },
    }),
  ]);

  // Link PropertyTypes with CurrentUses
  console.log("🔗 Linking property types with current uses...");
  await prisma.propertyTypeCurrentUse.createMany({
    data: [
      // Vacant Land (propertyTypes[0])
      { propertyTypeId: propertyTypeIds.vacantLand, useId: 23 }, // Vacant Land
      { propertyTypeId: propertyTypeIds.vacantLand, useId: 24 }, // Development Land
      { propertyTypeId: propertyTypeIds.vacantLand, useId: 34 }, // Other

      // Agricultural Land (propertyTypes[1])
      { propertyTypeId: propertyTypeIds.agriculturalLand, useId: 19 }, // Agricultural Land
      { propertyTypeId: propertyTypeIds.agriculturalLand, useId: 20 }, // Farm
      { propertyTypeId: propertyTypeIds.agriculturalLand, useId: 21 }, // Plantation
      { propertyTypeId: propertyTypeIds.agriculturalLand, useId: 22 }, // Orchard
      { propertyTypeId: propertyTypeIds.agriculturalLand, useId: 34 }, // Other

      // Residential Building (propertyTypes[2])
      { propertyTypeId: propertyTypeIds.residentialBuilding, useId: 3 }, // Condominium
      { propertyTypeId: propertyTypeIds.residentialBuilding, useId: 4 }, // Apartment Building
      { propertyTypeId: propertyTypeIds.residentialBuilding, useId: 5 }, // Serviced Apartment
      { propertyTypeId: propertyTypeIds.residentialBuilding, useId: 34 }, // Other

      // Commercial Building (propertyTypes[3])
      { propertyTypeId: propertyTypeIds.commercialBuilding, useId: 6 }, // Office Building
      { propertyTypeId: propertyTypeIds.commercialBuilding, useId: 7 }, // Retail Store
      { propertyTypeId: propertyTypeIds.commercialBuilding, useId: 8 }, // Shopping Mall
      { propertyTypeId: propertyTypeIds.commercialBuilding, useId: 9 }, // Shop House
      { propertyTypeId: propertyTypeIds.commercialBuilding, useId: 10 }, // Showroom
      { propertyTypeId: propertyTypeIds.commercialBuilding, useId: 11 }, // Hotel/Hospitality
      { propertyTypeId: propertyTypeIds.commercialBuilding, useId: 27 }, // Medical/Healthcare
      { propertyTypeId: propertyTypeIds.commercialBuilding, useId: 34 }, // Other

      // Agricultural Property (propertyTypes[4])
      { propertyTypeId: propertyTypeIds.agriculturalProperty, useId: 19 }, // Agricultural Land
      { propertyTypeId: propertyTypeIds.agriculturalProperty, useId: 20 }, // Farm
      { propertyTypeId: propertyTypeIds.agriculturalProperty, useId: 21 }, // Plantation
      { propertyTypeId: propertyTypeIds.agriculturalProperty, useId: 22 }, // Orchard
      { propertyTypeId: propertyTypeIds.agriculturalProperty, useId: 34 }, // Other

      // Residential Property (propertyTypes[5])
      { propertyTypeId: propertyTypeIds.residentialProperty, useId: 1 }, // Single Family Residential
      { propertyTypeId: propertyTypeIds.residentialProperty, useId: 2 }, // Multi-Family Residential
      { propertyTypeId: propertyTypeIds.residentialProperty, useId: 3 }, // Condominium
      { propertyTypeId: propertyTypeIds.residentialProperty, useId: 25 }, // Mixed Use Development
      { propertyTypeId: propertyTypeIds.residentialProperty, useId: 34 }, // Other

      // Commercial Property (propertyTypes[6])
      { propertyTypeId: propertyTypeIds.commercialProperty, useId: 11 }, // Hotel/Hospitality
      { propertyTypeId: propertyTypeIds.commercialProperty, useId: 12 }, // Resort
      { propertyTypeId: propertyTypeIds.commercialProperty, useId: 13 }, // Guest House
      { propertyTypeId: propertyTypeIds.commercialProperty, useId: 14 }, // Restaurant/Cafe
      { propertyTypeId: propertyTypeIds.commercialProperty, useId: 7 }, // Retail Store
      { propertyTypeId: propertyTypeIds.commercialProperty, useId: 8 }, // Shopping Mall
      { propertyTypeId: propertyTypeIds.commercialProperty, useId: 9 }, // Shop House
      { propertyTypeId: propertyTypeIds.commercialProperty, useId: 6 }, // Office Building
      { propertyTypeId: propertyTypeIds.commercialProperty, useId: 25 }, // Mixed Use Development
      { propertyTypeId: propertyTypeIds.commercialProperty, useId: 26 }, // Entertainment/Recreation
      { propertyTypeId: propertyTypeIds.commercialProperty, useId: 33 }, // Service Station
      { propertyTypeId: propertyTypeIds.commercialProperty, useId: 34 }, // Other

      // Industrial Property (propertyTypes[7])
      { propertyTypeId: propertyTypeIds.industrialProperty, useId: 15 }, // Industrial Warehouse
      { propertyTypeId: propertyTypeIds.industrialProperty, useId: 16 }, // Factory
      { propertyTypeId: propertyTypeIds.industrialProperty, useId: 17 }, // Manufacturing
      { propertyTypeId: propertyTypeIds.industrialProperty, useId: 18 }, // Logistics/Distribution
      { propertyTypeId: propertyTypeIds.industrialProperty, useId: 34 }, // Other

      // Specialized Property (propertyTypes[8])
      { propertyTypeId: propertyTypeIds.specializedProperty, useId: 27 }, // Medical/Healthcare
      { propertyTypeId: propertyTypeIds.specializedProperty, useId: 28 }, // Educational
      { propertyTypeId: propertyTypeIds.specializedProperty, useId: 29 }, // Religious
      { propertyTypeId: propertyTypeIds.specializedProperty, useId: 30 }, // Government/Institutional
      { propertyTypeId: propertyTypeIds.specializedProperty, useId: 31 }, // Sports Facility
      { propertyTypeId: propertyTypeIds.specializedProperty, useId: 11 }, // Hotel/Hospitality
      { propertyTypeId: propertyTypeIds.specializedProperty, useId: 26 }, // Entertainment/Recreation
      { propertyTypeId: propertyTypeIds.specializedProperty, useId: 34 }, // Other
    ],
  });


  console.log("\n✅ Database seeding completed successfully!");
  console.log("=".repeat(50));
  console.log("📊 Summary:");
  console.log(`   Users: ${users.length}`);
  console.log(`   Roles: ${roles.length}`);
  console.log(`   Permissions: ${permissions.length}`);
  console.log(`   Property Types: ${propertyTypes.length}`);
  console.log(`   Building Subtypes: ${buildingSubtypes.length}`);
  console.log("=".repeat(50));
  console.log("\n🏠 Properties Created:");
  console.log("   1. Villa (1 building, 0 units)");
  console.log("   2. Condo Tower (1 building, 10 units)");
  console.log("   3. Residential Complex (3 buildings, 15 units total)");
  console.log("   4. Shopping Mall (1 building, 20 retail units)");
  console.log("   5. Hotel (1 building, 21 room units)");
  console.log("   6. Vacant Land (0 buildings, 0 units)");
  console.log("=".repeat(50));
  console.log(`\n🔑 Test Credentials (password: ${seedPasswordLabel}):`);
  console.log(`   Super Admin:      ${seedUsers[0].email} (@${seedUsers[0].username})`);
  console.log(`   Property Manager: ${seedUsers[1].email} (@${seedUsers[1].username})`);
  console.log(`   Data Entry:       ${seedUsers[2].email} (@${seedUsers[2].username})`);
  console.log("=".repeat(50));
}
main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("👋 Disconnected from database. Exiting.");
  });
