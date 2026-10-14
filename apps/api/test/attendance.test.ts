import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs/promises';
import { app } from '../src/app';
import { prisma } from '../src/infrastructure/database/prisma';
import { generateAccessToken, hashPassword } from '../src/common/auth/token';
import { MembershipRole, MembershipStatus, UserStatus, CompanyStatus } from '@prisma/client';

describe('Stage 8 — Attendance Engine', () => {
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

  let employeeA1Id: string;
  let employeeA2Id: string;
  let _employeeBId: string;

  let workLocationAId: string;
  let workLocationBId: string;
  let standardShiftAId: string;
  let lateShiftAId: string;

  let selfieUploadA1Id: string;
  let selfieUploadA2Id: string;
  let selfieUploadLateId: string;

  let attendanceA1Id: string;

  // Realistic sample JPEG binary buffer
  const sampleJpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01,
    0x00, 0x60, 0x00, 0x60, 0x00, 0x00, 0xff, 0xd9,
  ]);

  // Helper to create and complete a selfie upload
  async function createCompletedSelfie(
    token: string,
    companyId: string
  ): Promise<string> {
    const intentRes = await request(app)
      .post('/api/v1/attendance/selfie-uploads')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Company-Id', companyId)
      .send({ mimeType: 'image/jpeg' });

    expect(intentRes.status).toBe(201);
    const uploadId = intentRes.body.data.uploadId;
    const parsedUrl = new URL(intentRes.body.data.uploadUrl);
    const tokenParam = parsedUrl.searchParams.get('token');

    const uploadRes = await request(app)
      .put(`/api/v1/storage/upload?token=${tokenParam}`)
      .set('Content-Type', 'image/jpeg')
      .send(sampleJpeg);
    expect(uploadRes.status).toBe(200);

    const completeRes = await request(app)
      .post(`/api/v1/attendance/selfie-uploads/${uploadId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Company-Id', companyId);
    expect(completeRes.status).toBe(200);

    return uploadId;
  }

  beforeAll(async () => {
    const passwordHash = await hashPassword('Password123!');

    // 1. Create Companies A & B
    const compA = await prisma.company.create({
      data: {
        name: 'Attendance Acme Corp',
        slug: `att-acme-${Date.now()}`,
        timezone: 'Asia/Jakarta',
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = compA.id;

    const compB = await prisma.company.create({
      data: {
        name: 'Attendance Globex Corp',
        slug: `att-globex-${Date.now()}`,
        timezone: 'Asia/Jakarta',
        status: CompanyStatus.ACTIVE,
      },
    });
    companyBId = compB.id;

    // 2. Create Users & Memberships
    // Admin A
    const uAdminA = await prisma.user.create({
      data: {
        email: `admin.s8.a.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Admin User S8 A',
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
        email: `hr.s8.a.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'HR User S8 A',
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

    // Employee A1
    const uEmpA1 = await prisma.user.create({
      data: {
        email: `emp.s8.a1.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Alice Employee S8 A1',
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

    // Employee A2 (for late shift test)
    const uEmpA2 = await prisma.user.create({
      data: {
        email: `emp.s8.a2.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Bob Employee S8 A2',
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

    // Employee B (Foreign tenant)
    const uEmpB = await prisma.user.create({
      data: {
        email: `emp.s8.b.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Charlie Employee S8 B',
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

    // 3. Create Employee Records
    const empA1 = await prisma.employee.create({
      data: {
        companyId: companyAId,
        userId: employeeA1User.id,
        employeeNumber: 'S8-EMP-001',
        fullName: 'Alice Employee S8 A1',
        email: employeeA1User.email,
      },
    });
    employeeA1Id = empA1.id;

    const empA2 = await prisma.employee.create({
      data: {
        companyId: companyAId,
        userId: employeeA2User.id,
        employeeNumber: 'S8-EMP-002',
        fullName: 'Bob Employee S8 A2',
        email: employeeA2User.email,
      },
    });
    employeeA2Id = empA2.id;

    const empB = await prisma.employee.create({
      data: {
        companyId: companyBId,
        userId: employeeBUser.id,
        employeeNumber: 'S8-EMP-B01',
        fullName: 'Charlie Employee S8 B',
        email: employeeBUser.email,
      },
    });
    _employeeBId = empB.id;

    // 4. Create Work Locations
    // Company A Work Location (HQ Jakarta: -6.2088, 106.8456)
    const locA = await prisma.workLocation.create({
      data: {
        companyId: companyAId,
        name: 'HQ Jakarta Monas',
        latitude: -6.2088,
        longitude: 106.8456,
        geofenceRadiusM: 100, // 100m radius
        maxGpsAccuracyM: 50,  // Max 50m allowable accuracy
        isActive: true,
      },
    });
    workLocationAId = locA.id;

    // Company B Work Location
    const locB = await prisma.workLocation.create({
      data: {
        companyId: companyBId,
        name: 'Globex Surabaya Hub',
        latitude: -7.2575,
        longitude: 112.7521,
        geofenceRadiusM: 120,
        maxGpsAccuracyM: 40,
        isActive: true,
      },
    });
    workLocationBId = locB.id;

    // 5. Create Shifts
    // Standard Day Shift (08:00 - 17:00, grace 15m)
    const shiftStd = await prisma.shift.create({
      data: {
        companyId: companyAId,
        name: 'Standard Morning Shift',
        startTimeLocal: '00:00',
        endTimeLocal: '23:59',
        gracePeriodMinutes: 1440, // 24-hour grace window so on-time anytime today
        isActive: true,
      },
    });
    standardShiftAId = shiftStd.id;

    // Shift guaranteed to produce late check-in (Start: 01:00, grace 0m)
    const shiftLate = await prisma.shift.create({
      data: {
        companyId: companyAId,
        name: 'Early Bird Shift (Late Trigger)',
        startTimeLocal: '01:00',
        endTimeLocal: '09:00',
        gracePeriodMinutes: 0,
        isActive: true,
      },
    });
    lateShiftAId = shiftLate.id;

    // Assign standard shift to Employee A1
    await prisma.employeeShift.create({
      data: {
        companyId: companyAId,
        employeeId: employeeA1Id,
        shiftId: standardShiftAId,
        effectiveFrom: new Date('2024-01-01'),
      },
    });

    // Assign late shift to Employee A2
    await prisma.employeeShift.create({
      data: {
        companyId: companyAId,
        employeeId: employeeA2Id,
        shiftId: lateShiftAId,
        effectiveFrom: new Date('2024-01-01'),
      },
    });

    // 6. Pre-generate completed selfies
    selfieUploadA1Id = await createCompletedSelfie(tokenEmployeeA1, companyAId);
    selfieUploadA2Id = await createCompletedSelfie(tokenEmployeeA1, companyAId); // for checkout
    selfieUploadLateId = await createCompletedSelfie(tokenEmployeeA2, companyAId);
  });

  afterAll(async () => {
    // Delete database records
    await prisma.auditLog.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.attendanceEvent.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.attendanceRecord.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.selfieUpload.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.employeeShift.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.shift.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.workLocation.deleteMany({
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

    // Clean up local storage
    try {
      const storageDir = path.resolve(process.cwd(), 'storage');
      await fs.rm(storageDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }

    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. Check-In Validations & Security Rules
  // =========================================================================
  describe('Check-In Validation & Constraints', () => {
    it('Rejects check-in when GPS accuracy exceeds maximum allowable threshold (422)', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          workLocationId: workLocationAId,
          latitude: -6.20885, // Inside geofence
          longitude: 106.84565,
          accuracyM: 85, // 85m exceeds maxGpsAccuracyM of 50m!
          selfieUploadId: selfieUploadA1Id,
          idempotencyKey: `idemp-bad-gps-${Date.now()}`,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      expect(res.body.error.message).toContain('GPS accuracy (85m) exceeds allowable threshold');
    });

    it('Rejects check-in when coordinates are outside the geofence radius (422)', async () => {
      // Coordinates ~600m away from -6.2088, 106.8456
      const res = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          workLocationId: workLocationAId,
          latitude: -6.2140, // Outside 100m radius
          longitude: 106.8456,
          accuracyM: 10,
          selfieUploadId: selfieUploadA1Id,
          idempotencyKey: `idemp-out-geofence-${Date.now()}`,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
      expect(res.body.error.message).toContain('Outside geofence radius');
    });

    it('Rejects check-in with invalid or uncompleted selfie upload (404/400)', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          workLocationId: workLocationAId,
          latitude: -6.20885,
          longitude: 106.84565,
          accuracyM: 15,
          selfieUploadId: '00000000-0000-0000-0000-000000000000', // Non-existent
          idempotencyKey: `idemp-fake-selfie-${Date.now()}`,
        });

      expect(res.status).toBe(404);
    });

    it('Rejects check-in using selfie owned by another employee (404 Not Found)', async () => {
      // Employee A1 attempts to use Employee A2's selfie
      const res = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          workLocationId: workLocationAId,
          latitude: -6.20885,
          longitude: 106.84565,
          accuracyM: 15,
          selfieUploadId: selfieUploadLateId, // Owned by Employee A2
          idempotencyKey: `idemp-foreign-selfie-${Date.now()}`,
        });

      expect(res.status).toBe(404);
    });

    it('Rejects check-in from foreign tenant work location (Cross-Tenant) (404 Not Found)', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          workLocationId: workLocationBId, // Company B location!
          latitude: -7.2575,
          longitude: 112.7521,
          accuracyM: 10,
          selfieUploadId: selfieUploadA1Id,
          idempotencyKey: `idemp-cross-loc-${Date.now()}`,
        });

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // 2. Successful Check-In & Idempotency
  // =========================================================================
  describe('Successful Check-In Workflow & Idempotency', () => {
    const keyA1 = `idemp-success-a1-${Date.now()}`;

    it('Employee A1 checks in successfully within geofence and valid GPS (201)', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          workLocationId: workLocationAId,
          latitude: -6.20885, // ~10m from -6.2088, 106.8456
          longitude: 106.84565,
          accuracyM: 15,
          selfieUploadId: selfieUploadA1Id,
          idempotencyKey: keyA1,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.employeeId).toBe(employeeA1Id);
      expect(res.body.data.status).toBe('IN_PROGRESS'); // On-time check-in
      expect(res.body.data.checkInAt).toBeDefined();
      expect(res.body.data.checkOutAt).toBeNull();
      expect(res.body.data.checkInGeofenceValid).toBe(true);
      expect(res.body.data.checkInDistanceM).toBeLessThanOrEqual(50);
      expect(res.body.data.checkInSelfieObjectKey).toBeDefined();
      expect(res.body.data.shift?.id).toBe(standardShiftAId);
      expect(res.body.data.workLocation?.id).toBe(workLocationAId);

      attendanceA1Id = res.body.data.id;

      // Verify SelfieUpload status transitioned to ATTACHED
      const uploadDb = await prisma.selfieUpload.findUnique({ where: { id: selfieUploadA1Id } });
      expect(uploadDb?.status).toBe('ATTACHED');
    });

    it('Re-sending check-in with the SAME idempotency key safely returns existing record (Idempotency Replay) (201)', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          workLocationId: workLocationAId,
          latitude: -6.20885,
          longitude: 106.84565,
          accuracyM: 15,
          selfieUploadId: selfieUploadA1Id,
          idempotencyKey: keyA1, // Same key!
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(attendanceA1Id);
    });

    it('Rejects duplicate check-in for the same date with DIFFERENT idempotency key (409 Conflict)', async () => {
      const anotherSelfie = await createCompletedSelfie(tokenEmployeeA1, companyAId);
      const res = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          workLocationId: workLocationAId,
          latitude: -6.20885,
          longitude: 106.84565,
          accuracyM: 15,
          selfieUploadId: anotherSelfie,
          idempotencyKey: `idemp-diff-key-${Date.now()}`,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('Attendance already checked in for this date');
    });

    it('Employee A2 checks in and triggers LATE status based on shift policy (201)', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${tokenEmployeeA2}`)
        .set('X-Company-Id', companyAId)
        .send({
          workLocationId: workLocationAId,
          latitude: -6.20882,
          longitude: 106.84562,
          accuracyM: 10,
          selfieUploadId: selfieUploadLateId,
          idempotencyKey: `idemp-late-a2-${Date.now()}`,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.employeeId).toBe(employeeA2Id);
      expect(res.body.data.status).toBe('LATE'); // Late shift started at 01:00 with 0m grace
      expect(res.body.data.shift?.id).toBe(lateShiftAId);
    });
  });

  // =========================================================================
  // 3. Check-Out Workflow & State Transitions
  // =========================================================================
  describe('Check-Out Workflow & State Transitions', () => {
    const keyOutA1 = `idemp-checkout-a1-${Date.now()}`;

    it('Rejects check-out when user has no active check-in session (409 Conflict)', async () => {
      // Employee B hasn't checked in yet
      const res = await request(app)
        .post('/api/v1/attendance/check-out')
        .set('Authorization', `Bearer ${tokenEmployeeB}`)
        .set('X-Company-Id', companyBId)
        .send({
          latitude: -7.2575,
          longitude: 112.7521,
          accuracyM: 10,
          idempotencyKey: `idemp-no-session-${Date.now()}`,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('No open attendance session found to check out');
    });

    it('Employee A1 checks out successfully, transitioning status to PRESENT (200)', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/check-out')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          latitude: -6.20884,
          longitude: 106.84564,
          accuracyM: 12,
          selfieUploadId: selfieUploadA2Id,
          workLocationId: workLocationAId,
          idempotencyKey: keyOutA1,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(attendanceA1Id);
      expect(res.body.data.status).toBe('PRESENT'); // IN_PROGRESS -> PRESENT
      expect(res.body.data.checkOutAt).toBeDefined();
      expect(res.body.data.checkOutLatitude).toBeCloseTo(-6.20884);
      expect(res.body.data.checkOutSelfieObjectKey).toBeDefined();

      // Verify events recorded
      const events = await prisma.attendanceEvent.findMany({
        where: { attendanceRecordId: attendanceA1Id },
      });
      const eventTypes = events.map((e) => e.eventType);
      expect(eventTypes).toContain('CHECK_IN');
      expect(eventTypes).toContain('CHECK_OUT');
    });

    it('Re-sending check-out with the SAME idempotency key returns existing record safely (200)', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/check-out')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          latitude: -6.20884,
          longitude: 106.84564,
          accuracyM: 12,
          selfieUploadId: selfieUploadA2Id,
          workLocationId: workLocationAId,
          idempotencyKey: keyOutA1, // Same key!
        });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(attendanceA1Id);
      expect(res.body.data.status).toBe('PRESENT');
    });

    it('Rejects second check-out with a NEW idempotency key after session is closed (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/check-out')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          latitude: -6.20884,
          longitude: 106.84564,
          accuracyM: 12,
          idempotencyKey: `idemp-diff-checkout-${Date.now()}`,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('No open attendance session found to check out');
    });

    it('Employee A2 checks out and status remains LATE (200)', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/check-out')
        .set('Authorization', `Bearer ${tokenEmployeeA2}`)
        .set('X-Company-Id', companyAId)
        .send({
          latitude: -6.20882,
          longitude: 106.84562,
          accuracyM: 10,
          idempotencyKey: `idemp-checkout-a2-${Date.now()}`,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('LATE'); // Remains LATE
      expect(res.body.data.checkOutAt).toBeDefined();
    });
  });

  // =========================================================================
  // 4. Query, Flagging, and Selfie URL Operations
  // =========================================================================
  describe('Attendance Queries, Flagging & Selfie URL', () => {
    it('Employee A1 fetches their current attendance for today (200)', async () => {
      const res = await request(app)
        .get('/api/v1/attendance/today')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(attendanceA1Id);
      expect(res.body.data.status).toBe('PRESENT');
    });

    it('Employee A1 fetches their own attendance history (200)', async () => {
      const res = await request(app)
        .get('/api/v1/attendance/mine')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].id).toBe(attendanceA1Id);
    });

    it('Company Admin searches tenant attendance records with pagination (200)', async () => {
      const res = await request(app)
        .get('/api/v1/attendance?page=1&pageSize=10')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2); // Alice & Bob
      expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
    });

    it('HR Admin retrieves attendance record detail with event trail (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/${attendanceA1Id}`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(attendanceA1Id);
      expect(res.body.data.employee.fullName).toBe('Alice Employee S8 A1');
    });

    it('HR Admin flags an attendance record for review (200)', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance/${attendanceA1Id}/flag`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          reason: 'Irregular check-in location discrepancy suspected',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('FLAGGED');
      expect(res.body.data.flagReason).toBe('Irregular check-in location discrepancy suspected');

      // Verify flag event recorded
      const flagEvent = await prisma.attendanceEvent.findFirst({
        where: {
          attendanceRecordId: attendanceA1Id,
          eventType: 'FLAG',
        },
      });
      expect(flagEvent).toBeDefined();
    });

    it('Upload owner can obtain signed URL for their attendance check-in selfie (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/${attendanceA1Id}/selfie/check_in`)
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.readUrl).toContain('/api/v1/storage/read?token=');
      expect(res.body.data.expiresInSeconds).toBe(300);
    });

    it('HR Admin can obtain signed URL for employee check-in selfie with audit trail (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/${attendanceA1Id}/selfie/check_in`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.readUrl).toBeDefined();
    });

    it('Denies selfie read to peer regular employee (404 Not Found)', async () => {
      // Employee A2 attempts to view Employee A1's attendance selfie
      const res = await request(app)
        .get(`/api/v1/attendance/${attendanceA1Id}/selfie/check_in`)
        .set('Authorization', `Bearer ${tokenEmployeeA2}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(404);
    });

    it('Denies attendance detail lookup to foreign tenant user (Cross-Tenant Isolation) (404 Not Found)', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/${attendanceA1Id}`)
        .set('Authorization', `Bearer ${tokenEmployeeB}`)
        .set('X-Company-Id', companyBId);

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // 5. Audit Trail Verification
  // =========================================================================
  describe('Audit Trail Verification', () => {
    it('Records immutable audit log entries for check-in, check-out, flagging, and selfie access', async () => {
      const logs = await prisma.auditLog.findMany({
        where: { companyId: companyAId },
      });

      const actions = logs.map((l) => l.action);
      expect(actions).toContain('ATTENDANCE_CHECKED_IN');
      expect(actions).toContain('ATTENDANCE_CHECKED_OUT');
      expect(actions).toContain('ATTENDANCE_FLAGGED');
      expect(actions).toContain('SELFIE_READ_ACCESSED');
    });
  });
});
