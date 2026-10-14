import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs/promises';
import { app } from '../src/app';
import { prisma } from '../src/infrastructure/database/prisma';
import { generateAccessToken, hashPassword } from '../src/common/auth/token';
import { MembershipRole, MembershipStatus, UserStatus, CompanyStatus } from '@prisma/client';
import { getStorageService } from '../src/infrastructure/storage/storage.factory';
import { LocalStorageService } from '../src/infrastructure/storage/local-storage.service';

describe('Stage 7 — Private Selfie Storage Foundation', () => {
  let companyAId: string;
  let companyBId: string;

  let adminAUser: { id: string; email: string };
  let hrAUser: { id: string; email: string };
  let employeeA1User: { id: string; email: string };
  let employeeA2User: { id: string; email: string };
  let employeeBUser: { id: string; email: string };

  let tokenAdminA: string;
  let tokenHRA: string;
  let tokenEmployeeA1: string;
  let tokenEmployeeA2: string;
  let tokenEmployeeB: string;

  let uploadA1Id: string;
  let uploadUrlA1: string;
  let objectKeyA1: string;

  // Realistic sample binary buffers
  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01,
    0x00, 0x60, 0x00, 0x60, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06,
    0xff, 0xd9,
  ]);

  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
    0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
    0x00, 0x1f, 0x15, 0xc4, 0x89,
  ]);

  const fakeScriptBuffer = Buffer.from(
    '<?php echo "malicious executable script masquerading as image"; ?>'
  );

  beforeAll(async () => {
    const passwordHash = await hashPassword('Password123!');

    // 1. Create Companies A and B
    const compA = await prisma.company.create({
      data: {
        name: 'Storage Acme Tenant A',
        slug: `storage-acme-${Date.now()}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = compA.id;

    const compB = await prisma.company.create({
      data: {
        name: 'Storage Globex Tenant B',
        slug: `storage-globex-${Date.now()}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyBId = compB.id;

    // 2. Create Users & Memberships
    // Admin A
    const uAdminA = await prisma.user.create({
      data: {
        email: `admin.s7.a.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Admin User S7 A',
        status: UserStatus.ACTIVE,
        memberships: {
          create: {
            companyId: companyAId,
            role: MembershipRole.COMPANY_ADMIN,
            status: MembershipStatus.ACTIVE,
          },
        },
      },
    });
    adminAUser = { id: uAdminA.id, email: uAdminA.email };
    tokenAdminA = generateAccessToken({ userId: uAdminA.id, email: uAdminA.email });

    // HR A
    const uHRA = await prisma.user.create({
      data: {
        email: `hr.s7.a.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'HR User S7 A',
        status: UserStatus.ACTIVE,
        memberships: {
          create: {
            companyId: companyAId,
            role: MembershipRole.HR_ADMIN,
            status: MembershipStatus.ACTIVE,
          },
        },
      },
    });
    hrAUser = { id: uHRA.id, email: uHRA.email };
    tokenHRA = generateAccessToken({ userId: uHRA.id, email: uHRA.email });

    // Employee A1 (Upload owner)
    const uEmpA1 = await prisma.user.create({
      data: {
        email: `emp.s7.a1.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Alice Staff S7 A1',
        status: UserStatus.ACTIVE,
        memberships: {
          create: {
            companyId: companyAId,
            role: MembershipRole.EMPLOYEE,
            status: MembershipStatus.ACTIVE,
          },
        },
      },
    });
    employeeA1User = { id: uEmpA1.id, email: uEmpA1.email };
    tokenEmployeeA1 = generateAccessToken({ userId: uEmpA1.id, email: uEmpA1.email });

    // Employee A2 (Peer in same company)
    const uEmpA2 = await prisma.user.create({
      data: {
        email: `emp.s7.a2.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Bob Staff S7 A2',
        status: UserStatus.ACTIVE,
        memberships: {
          create: {
            companyId: companyAId,
            role: MembershipRole.EMPLOYEE,
            status: MembershipStatus.ACTIVE,
          },
        },
      },
    });
    employeeA2User = { id: uEmpA2.id, email: uEmpA2.email };
    tokenEmployeeA2 = generateAccessToken({ userId: uEmpA2.id, email: uEmpA2.email });

    // Employee B (Foreign tenant employee)
    const uEmpB = await prisma.user.create({
      data: {
        email: `emp.s7.b.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Charlie Staff S7 B',
        status: UserStatus.ACTIVE,
        memberships: {
          create: {
            companyId: companyBId,
            role: MembershipRole.EMPLOYEE,
            status: MembershipStatus.ACTIVE,
          },
        },
      },
    });
    employeeBUser = { id: uEmpB.id, email: uEmpB.email };
    tokenEmployeeB = generateAccessToken({ userId: uEmpB.id, email: uEmpB.email });

    // 3. Create Employee records
    await prisma.employee.create({
      data: {
        companyId: companyAId,
        userId: employeeA1User.id,
        employeeNumber: 'S7-EMP-001',
        fullName: 'Alice Staff S7 A1',
        email: employeeA1User.email,
      },
    });

    await prisma.employee.create({
      data: {
        companyId: companyAId,
        userId: employeeA2User.id,
        employeeNumber: 'S7-EMP-002',
        fullName: 'Bob Staff S7 A2',
        email: employeeA2User.email,
      },
    });

    await prisma.employee.create({
      data: {
        companyId: companyBId,
        userId: employeeBUser.id,
        employeeNumber: 'S7-EMP-B01',
        fullName: 'Charlie Staff S7 B',
        email: employeeBUser.email,
      },
    });
  });

  afterAll(async () => {
    // Clean up DB
    await prisma.auditLog.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.selfieUpload.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.employee.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.companyMembership.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.company.deleteMany({
      where: { id: { in: [companyAId, companyBId] } },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [
            adminAUser.id,
            hrAUser.id,
            employeeA1User.id,
            employeeA2User.id,
            employeeBUser.id,
          ],
        },
      },
    });

    // Clean up local storage test directory
    try {
      const storageDir = path.resolve(process.cwd(), 'storage');
      await fs.rm(storageDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }

    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. Upload Intent Creation
  // =========================================================================
  describe('Upload Intent Creation', () => {
    it('Employee creates short-lived selfie upload intent with allowed MIME type (201)', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/selfie-uploads')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          mimeType: 'image/jpeg',
          originalName: 'selfie_morning.jpg',
          fileSizeBytes: validJpegBuffer.length,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.uploadId).toBeDefined();
      expect(res.body.data.uploadUrl).toContain('/api/v1/storage/upload?token=');
      expect(res.body.data.objectKey).toContain(`tenants/${companyAId}/selfies/`);
      expect(res.body.data.expiresInSeconds).toBe(900);
      expect(res.body.data.maxFileSizeBytes).toBe(5 * 1024 * 1024);
      expect(res.body.data.requiredHeaders['Content-Type']).toBe('image/jpeg');

      uploadA1Id = res.body.data.uploadId;
      uploadUrlA1 = res.body.data.uploadUrl;
      objectKeyA1 = res.body.data.objectKey;
    });

    it('Rejects disallowed MIME types (e.g. application/pdf, text/html) (422)', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/selfie-uploads')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          mimeType: 'application/pdf',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('Rejects fileSizeBytes exceeding 5MB limit (422)', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/selfie-uploads')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          mimeType: 'image/jpeg',
          fileSizeBytes: 6 * 1024 * 1024, // 6MB > 5MB limit
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('Rejects unauthenticated intent creation (401)', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/selfie-uploads')
        .set('X-Company-Id', companyAId)
        .send({ mimeType: 'image/jpeg' });

      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // 2. Physical Storage & Signed Upload / Read Security
  // =========================================================================
  describe('Private Storage & Cryptographic Verification', () => {
    it('Rejects direct storage upload without token (403 Forbidden)', async () => {
      const res = await request(app)
        .put('/api/v1/storage/upload')
        .set('Content-Type', 'image/jpeg')
        .send(validJpegBuffer);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Rejects direct storage upload with forged / tampered token (403 Forbidden)', async () => {
      const parsedUrl = new URL(uploadUrlA1);
      const validToken = parsedUrl.searchParams.get('token')!;
      const tamperedToken = validToken.substring(0, validToken.length - 4) + 'abcd';

      const res = await request(app)
        .put(`/api/v1/storage/upload?token=${tamperedToken}`)
        .set('Content-Type', 'image/jpeg')
        .send(validJpegBuffer);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Rejects direct storage read without token (403 Forbidden)', async () => {
      const res = await request(app).get('/api/v1/storage/read');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Rejects storage operation with expired token (403 Forbidden)', async () => {
      const storage = getStorageService() as LocalStorageService;
      // Generate token expired 10 seconds ago
      const expiredToken = storage.signPayload({
        key: objectKeyA1,
        operation: 'upload',
        contentType: 'image/jpeg',
        expiresAt: Date.now() - 10000,
      });

      const res = await request(app)
        .put(`/api/v1/storage/upload?token=${expiredToken}`)
        .set('Content-Type', 'image/jpeg')
        .send(validJpegBuffer);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('expired');
    });

    it('Uploads valid JPEG payload via valid pre-signed URL (200)', async () => {
      const parsedUrl = new URL(uploadUrlA1);
      const token = parsedUrl.searchParams.get('token');

      const res = await request(app)
        .put(`/api/v1/storage/upload?token=${token}`)
        .set('Content-Type', 'image/jpeg')
        .send(validJpegBuffer);

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
      expect(res.body.data.sizeBytes).toBe(validJpegBuffer.length);
    });

    it('Uploads and verifies valid PNG payload via pre-signed URL (200)', async () => {
      const intentRes = await request(app)
        .post('/api/v1/attendance/selfie-uploads')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({ mimeType: 'image/png' });

      expect(intentRes.status).toBe(201);
      const pngUploadId = intentRes.body.data.uploadId;
      const parsedUrl = new URL(intentRes.body.data.uploadUrl);
      const token = parsedUrl.searchParams.get('token');

      const uploadRes = await request(app)
        .put(`/api/v1/storage/upload?token=${token}`)
        .set('Content-Type', 'image/png')
        .send(validPngBuffer);
      expect(uploadRes.status).toBe(200);

      const completeRes = await request(app)
        .post(`/api/v1/attendance/selfie-uploads/${pngUploadId}/complete`)
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId);
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.upload.status).toBe('COMPLETED');
      expect(completeRes.body.data.upload.mimeType).toBe('image/png');
    });

    it('Blocks path traversal attempt in storage key (Path Traversal Security)', async () => {
      const storage = getStorageService() as LocalStorageService;
      expect(() => {
        storage.resolveSafePath('../../../etc/passwd');
      }).toThrow(/Path traversal detected/);
    });
  });

  // =========================================================================
  // 3. Upload Completion & Binary Magic Bytes Verification
  // =========================================================================
  describe('Upload Completion & Magic Bytes Validation', () => {
    it('Employee completes their valid selfie upload (200)', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance/selfie-uploads/${uploadA1Id}/complete`)
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.verified).toBe(true);
      expect(res.body.data.upload.status).toBe('COMPLETED');
      expect(res.body.data.upload.fileSizeBytes).toBe(validJpegBuffer.length);
      expect(res.body.data.upload.fileHashSha256).toBeDefined();
      expect(res.body.data.upload.completedAt).toBeDefined();
    });

    it('Rejects completion if file is not uploaded yet (400 Bad Request)', async () => {
      // 1. Create a new intent
      const intentRes = await request(app)
        .post('/api/v1/attendance/selfie-uploads')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({ mimeType: 'image/png' });

      const newUploadId = intentRes.body.data.uploadId;

      // 2. Complete without uploading
      const res = await request(app)
        .post(`/api/v1/attendance/selfie-uploads/${newUploadId}/complete`)
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('not been uploaded to storage yet');
    });

    it('Fails completion if uploaded payload has fake / disguised binary (Magic Bytes check) (422)', async () => {
      // 1. Create intent
      const intentRes = await request(app)
        .post('/api/v1/attendance/selfie-uploads')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({ mimeType: 'image/jpeg' });

      const fakeUploadId = intentRes.body.data.uploadId;
      const parsedUrl = new URL(intentRes.body.data.uploadUrl);
      const token = parsedUrl.searchParams.get('token');

      // 2. Upload fake script binary
      await request(app)
        .put(`/api/v1/storage/upload?token=${token}`)
        .set('Content-Type', 'image/jpeg')
        .send(fakeScriptBuffer);

      // 3. Attempt completion
      const res = await request(app)
        .post(`/api/v1/attendance/selfie-uploads/${fakeUploadId}/complete`)
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      expect(res.body.error.message).toContain('Image verification failed');

      // Check upload status in database transitioned to FAILED
      const dbRecord = await prisma.selfieUpload.findUnique({ where: { id: fakeUploadId } });
      expect(dbRecord?.status).toBe('FAILED');
    });

    it('Rejects completion attempt by non-owner user (403 Forbidden)', async () => {
      // Employee A2 attempts to complete Employee A1's upload
      const res = await request(app)
        .post(`/api/v1/attendance/selfie-uploads/${uploadA1Id}/complete`)
        .set('Authorization', `Bearer ${tokenEmployeeA2}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Rejects completion attempt from foreign tenant (Cross-Tenant Isolation) (404 Not Found)', async () => {
      // Employee B attempts to complete Company A's upload
      const res = await request(app)
        .post(`/api/v1/attendance/selfie-uploads/${uploadA1Id}/complete`)
        .set('Authorization', `Bearer ${tokenEmployeeB}`)
        .set('X-Company-Id', companyBId);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // =========================================================================
  // 4. Pre-Signed Read Access & Security Rules
  // =========================================================================
  describe('Pre-Signed Read Access & Access Control', () => {
    it('Upload owner can obtain signed read URL for their selfie (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/selfie-uploads/${uploadA1Id}/signed-url`)
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.readUrl).toContain('/api/v1/storage/read?token=');
      expect(res.body.data.expiresInSeconds).toBe(300);

      // Verify reading the file via this signed read URL returns binary JPEG with security headers
      const parsed = new URL(res.body.data.readUrl);
      const readToken = parsed.searchParams.get('token');

      const streamRes = await request(app).get(`/api/v1/storage/read?token=${readToken}`);
      expect(streamRes.status).toBe(200);
      expect(streamRes.headers['content-type']).toContain('image/jpeg');
      expect(streamRes.headers['cache-control']).toContain('private, no-cache, no-store');
      expect(streamRes.headers['x-content-type-options']).toBe('nosniff');
      expect(streamRes.body).toBeInstanceOf(Buffer);
      expect(streamRes.body.length).toBe(validJpegBuffer.length);
    });

    it('HR Admin can obtain signed read URL for tenant employee selfie (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/selfie-uploads/${uploadA1Id}/signed-url`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.readUrl).toBeDefined();
    });

    it('Company Admin can obtain signed read URL for tenant employee selfie (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/selfie-uploads/${uploadA1Id}/signed-url`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.readUrl).toBeDefined();
    });

    it('Denies read signed URL to peer regular employee (404 Not Found)', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/selfie-uploads/${uploadA1Id}/signed-url`)
        .set('Authorization', `Bearer ${tokenEmployeeA2}`)
        .set('X-Company-Id', companyAId);

      // Non-privileged user trying to read peer's selfie returns 404
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('Denies read signed URL to foreign tenant user (Cross-Tenant Isolation) (404 Not Found)', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/selfie-uploads/${uploadA1Id}/signed-url`)
        .set('Authorization', `Bearer ${tokenEmployeeB}`)
        .set('X-Company-Id', companyBId);

      expect(res.status).toBe(404);
    });

    it('Detail lookup returns upload metadata for owner (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/selfie-uploads/${uploadA1Id}`)
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(uploadA1Id);
      expect(res.body.data.status).toBe('COMPLETED');
    });

    it('Denies detail lookup to peer regular employee (404 Not Found)', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/selfie-uploads/${uploadA1Id}`)
        .set('Authorization', `Bearer ${tokenEmployeeA2}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // 5. Cleanup Policy & Audit Logging
  // =========================================================================
  describe('Cleanup Policy & Audit Trail', () => {
    it('HR Admin triggers cleanup routine (200)', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/selfie-uploads/cleanup')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.cleanedCount).toBeGreaterThanOrEqual(0);
    });

    it('Regular employee is forbidden from triggering cleanup routine (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/selfie-uploads/cleanup')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(403);
    });

    it('Records immutable audit log entries for intent creation, completion, privileged read, and cleanup', async () => {
      const logs = await prisma.auditLog.findMany({
        where: { companyId: companyAId },
      });

      const actions = logs.map((l) => l.action);
      expect(actions).toContain('SELFIE_INTENT_CREATED');
      expect(actions).toContain('SELFIE_UPLOAD_COMPLETED');
      expect(actions).toContain('SELFIE_READ_ACCESSED');
      expect(actions).toContain('SELFIE_CLEANUP_EXECUTED');
    });
  });
});
