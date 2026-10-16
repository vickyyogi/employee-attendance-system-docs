import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/infrastructure/database/prisma';
import { generateAccessToken, hashPassword } from '../src/common/auth/token';
import { sanitizeAuditMetadata, REDACTED_AUDIT_KEYS } from '../src/infrastructure/audit/audit-service';
import {
  MembershipRole,
  MembershipStatus,
  UserStatus,
  CompanyStatus,
  EmploymentStatus,
  AttendanceStatus,
  LeaveUnit,
  LeaveRequestStatus,
  AttendanceCorrectionStatus,
} from '@prisma/client';

describe('Stage 12 — Hardening, Security, and Production Readiness', () => {
  let companyAId: string;
  let companyBId: string;

  let adminUserA: { id: string; email: string };
  let hrUserA: { id: string; email: string };
  let employeeUserA1: { id: string; email: string };
  let employeeUserB: { id: string; email: string };

  let tokenAdminA: string;
  let tokenHRA: string;
  let tokenEmployeeA1: string;
  let tokenEmployeeB: string;

  let employeeA1Id: string;
  let employeeB1Id: string;

  let workLocationAId: string;
  let workLocationBId: string;
  let shiftAId: string;
  let leaveTypeAId: string;
  let leaveRequestAId: string;
  let correctionRequestAId: string;
  let attendanceRecordAId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('Password123!');

    // 1. Setup Two Isolated Companies
    const compA = await prisma.company.create({
      data: {
        name: 'Hardening Comp A',
        slug: `hardening-a-${Date.now()}`,
        status: CompanyStatus.ACTIVE,
        timezone: 'Asia/Jakarta',
      },
    });
    companyAId = compA.id;

    const compB = await prisma.company.create({
      data: {
        name: 'Hardening Comp B',
        slug: `hardening-b-${Date.now()}`,
        status: CompanyStatus.ACTIVE,
        timezone: 'Asia/Jakarta',
      },
    });
    companyBId = compB.id;

    // 2. Setup Users
    adminUserA = await prisma.user.create({
      data: {
        email: `admin.hard.a.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Admin Hardening A',
        status: UserStatus.ACTIVE,
      },
    });

    hrUserA = await prisma.user.create({
      data: {
        email: `hr.hard.a.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'HR Hardening A',
        status: UserStatus.ACTIVE,
      },
    });

    employeeUserA1 = await prisma.user.create({
      data: {
        email: `emp.hard.a1.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Employee Hardening A1',
        status: UserStatus.ACTIVE,
      },
    });

    employeeUserB = await prisma.user.create({
      data: {
        email: `emp.hard.b.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Employee Hardening B',
        status: UserStatus.ACTIVE,
      },
    });

    // 3. Memberships
    await prisma.companyMembership.create({
      data: {
        companyId: companyAId,
        userId: adminUserA.id,
        role: MembershipRole.COMPANY_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });

    await prisma.companyMembership.create({
      data: {
        companyId: companyAId,
        userId: hrUserA.id,
        role: MembershipRole.HR_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });

    await prisma.companyMembership.create({
      data: {
        companyId: companyAId,
        userId: employeeUserA1.id,
        role: MembershipRole.EMPLOYEE,
        status: MembershipStatus.ACTIVE,
      },
    });

    await prisma.companyMembership.create({
      data: {
        companyId: companyBId,
        userId: employeeUserB.id,
        role: MembershipRole.EMPLOYEE,
        status: MembershipStatus.ACTIVE,
      },
    });

    // 4. Employees
    const empA1 = await prisma.employee.create({
      data: {
        companyId: companyAId,
        userId: employeeUserA1.id,
        employeeNumber: 'HRD-001',
        fullName: 'Employee Hardening A1',
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });
    employeeA1Id = empA1.id;

    const empB = await prisma.employee.create({
      data: {
        companyId: companyBId,
        userId: employeeUserB.id,
        employeeNumber: 'HRD-B01',
        fullName: 'Employee Hardening B',
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });
    employeeB1Id = empB.id;

    // 5. Work Locations & Shifts
    const locA = await prisma.workLocation.create({
      data: {
        companyId: companyAId,
        name: 'Office A',
        latitude: -6.2,
        longitude: 106.8,
        geofenceRadiusM: 100,
        maxGpsAccuracyM: 50,
      },
    });
    workLocationAId = locA.id;

    const locB = await prisma.workLocation.create({
      data: {
        companyId: companyBId,
        name: 'Office B',
        latitude: -7.2,
        longitude: 112.7,
        geofenceRadiusM: 100,
        maxGpsAccuracyM: 50,
      },
    });
    workLocationBId = locB.id;

    const shiftA = await prisma.shift.create({
      data: {
        companyId: companyAId,
        name: 'General Shift',
        startTimeLocal: '09:00',
        endTimeLocal: '18:00',
      },
    });
    shiftAId = shiftA.id;

    // 6. Leave Type & Requests
    const leaveTypeA = await prisma.leaveType.create({
      data: {
        companyId: companyAId,
        name: 'Annual Hardening Leave',
        unit: LeaveUnit.DAYS,
        requiresApproval: true,
      },
    });
    leaveTypeAId = leaveTypeA.id;

    const leaveReq = await prisma.leaveRequest.create({
      data: {
        companyId: companyAId,
        employeeId: employeeA1Id,
        leaveTypeId: leaveTypeAId,
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        endDate: new Date('2026-11-03T00:00:00.000Z'),
        reason: 'Rest and relaxation',
        status: LeaveRequestStatus.PENDING,
      },
    });
    leaveRequestAId = leaveReq.id;

    // 7. Attendance Record & Correction
    const attRecord = await prisma.attendanceRecord.create({
      data: {
        companyId: companyAId,
        employeeId: employeeA1Id,
        workDate: new Date('2026-10-10T00:00:00.000Z'),
        shiftId: shiftAId,
        workLocationId: workLocationAId,
        checkInAt: new Date('2026-10-10T09:15:00.000Z'),
        status: AttendanceStatus.LATE,
        idempotencyKey: `idem-hard-att-${Date.now()}`,
      },
    });
    attendanceRecordAId = attRecord.id;

    const corrReq = await prisma.attendanceCorrectionRequest.create({
      data: {
        companyId: companyAId,
        employeeId: employeeA1Id,
        attendanceRecordId: attendanceRecordAId,
        requestedCheckInAt: new Date('2026-10-10T08:55:00.000Z'),
        reason: 'Traffic jam cleared earlier, machine delay',
        status: AttendanceCorrectionStatus.PENDING,
      },
    });
    correctionRequestAId = corrReq.id;

    // 8. Tokens
    tokenAdminA = generateAccessToken({ userId: adminUserA.id, email: adminUserA.email });
    tokenHRA = generateAccessToken({ userId: hrUserA.id, email: hrUserA.email });
    tokenEmployeeA1 = generateAccessToken({ userId: employeeUserA1.id, email: employeeUserA1.email });
    tokenEmployeeB = generateAccessToken({ userId: employeeUserB.id, email: employeeUserB.email });
  });

  afterAll(async () => {
    await prisma.approvalAction.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.attendanceCorrectionRequest.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.leaveRequest.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.leaveType.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.attendanceEvent.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.attendanceRecord.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.shift.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.workLocation.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.employee.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.companyMembership.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    await prisma.user.deleteMany({
      where: { id: { in: [adminUserA.id, hrUserA.id, employeeUserA1.id, employeeUserB.id] } },
    });
  });

  describe('1. Security & Logging Redaction Review', () => {
    it('redacts all sensitive and secret keys in audit metadata', () => {
      const sensitiveMetadata = {
        employeeNumber: 'EMP-001',
        password: 'SuperSecretPassword!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        refreshToken: 'refresh-token-hash-12345',
        accessToken: 'access-token-hash-12345',
        authorization: 'Bearer secret_token',
        secret: 'vault_secret_key',
        cookie: 'session_id=abcdef',
        credential: 'db_password',
        jwt: 'jwt_payload',
        apiKey: 'api_key_secret',
        nested: {
          password: 'nested_password',
          safeField: 'harmless_value',
        },
        list: [{ token: 'list_token' }, { note: 'regular note' }],
      };

      const sanitized = sanitizeAuditMetadata(sensitiveMetadata)!;

      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.refreshToken).toBe('[REDACTED]');
      expect(sanitized.accessToken).toBe('[REDACTED]');
      expect(sanitized.authorization).toBe('[REDACTED]');
      expect(sanitized.secret).toBe('[REDACTED]');
      expect(sanitized.cookie).toBe('[REDACTED]');
      expect(sanitized.credential).toBe('[REDACTED]');
      expect(sanitized.jwt).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');

      // Nested object redaction
      const nested = sanitized.nested as Record<string, unknown>;
      expect(nested.password).toBe('[REDACTED]');
      expect(nested.safeField).toBe('harmless_value');

      // Array items redaction
      const list = sanitized.list as Array<Record<string, unknown>>;
      expect(list[0].token).toBe('[REDACTED]');
      expect(list[1].note).toBe('regular note');
    });

    it('contains all required sensitive keys in REDACTED_AUDIT_KEYS set', () => {
      expect(REDACTED_AUDIT_KEYS.has('password')).toBe(true);
      expect(REDACTED_AUDIT_KEYS.has('token')).toBe(true);
      expect(REDACTED_AUDIT_KEYS.has('refreshtoken')).toBe(true);
      expect(REDACTED_AUDIT_KEYS.has('accesstoken')).toBe(true);
      expect(REDACTED_AUDIT_KEYS.has('secret')).toBe(true);
      expect(REDACTED_AUDIT_KEYS.has('cookie')).toBe(true);
    });

    it('never exposes password hashes in employee endpoints', async () => {
      const res = await request(app)
        .get(`/api/v1/employees/${employeeA1Id}`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.password).toBeUndefined();
      expect(res.body.data.passwordHash).toBeUndefined();
    });
  });

  describe('2. Multi-Tenant Penetration & Isolation Checks', () => {
    it('returns 404 when querying employee belonging to a different tenant', async () => {
      // User B tries to view Company A's employee
      const res = await request(app)
        .get(`/api/v1/employees/${employeeA1Id}`)
        .set('Authorization', `Bearer ${tokenEmployeeB}`)
        .set('X-Company-Id', companyBId);

      expect(res.status).toBe(404);
    });

    it('returns 404 when looking up attendance record of another tenant', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/${attendanceRecordAId}`)
        .set('Authorization', `Bearer ${tokenEmployeeB}`)
        .set('X-Company-Id', companyBId);

      expect(res.status).toBe(404);
    });

    it('denies accessing selfie signed URL across tenants', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/${attendanceRecordAId}/selfie/check_in`)
        .set('Authorization', `Bearer ${tokenEmployeeB}`)
        .set('X-Company-Id', companyBId);

      expect(res.status).toBe(404);
    });

    it('denies approving leave request belonging to another company', async () => {
      const res = await request(app)
        .post(`/api/v1/leave-requests/${leaveRequestAId}/decision`)
        .set('Authorization', `Bearer ${tokenEmployeeB}`)
        .set('X-Company-Id', companyBId)
        .send({ decision: 'APPROVED' });

      // Employee B does not have leave.approve and belongs to company B
      expect([403, 404]).toContain(res.status);
    });

    it('denies approving attendance correction belonging to another company', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance-correction-requests/${correctionRequestAId}/decision`)
        .set('Authorization', `Bearer ${tokenEmployeeB}`)
        .set('X-Company-Id', companyBId)
        .send({ decision: 'APPROVED' });

      expect([403, 404]).toContain(res.status);
    });

    it('denies accessing work location belonging to another tenant', async () => {
      const res = await request(app)
        .get(`/api/v1/work-locations/${workLocationBId}`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(404);
    });

    it('denies admin A querying employee profile in company B', async () => {
      const res = await request(app)
        .get(`/api/v1/employees/${employeeB1Id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(404);
    });

    it('denies standard employee performing work location administrative updates', async () => {
      const res = await request(app)
        .patch(`/api/v1/work-locations/${workLocationAId}`)
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({ name: 'Tampered Location' });

      expect(res.status).toBe(403);
    });
  });

  describe('3. Concurrency & Idempotency Smoke Tests', () => {
    it('safely handles concurrent decision attempts on the same leave request', async () => {
      // Multiple concurrent approvals on the same pending leave request
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/v1/leave-requests/${leaveRequestAId}/decision`)
          .set('Authorization', `Bearer ${tokenHRA}`)
          .set('X-Company-Id', companyAId)
          .send({ decision: 'APPROVED', note: 'First win' }),
        request(app)
          .post(`/api/v1/leave-requests/${leaveRequestAId}/decision`)
          .set('Authorization', `Bearer ${tokenHRA}`)
          .set('X-Company-Id', companyAId)
          .send({ decision: 'REJECTED', note: 'Second attempt' }),
      ]);

      // Exactly one must succeed (200) and the other must be rejected as already decided (409 Conflict)
      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);
    });

    it('safely handles concurrent decision attempts on the same correction request', async () => {
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/v1/attendance-correction-requests/${correctionRequestAId}/decision`)
          .set('Authorization', `Bearer ${tokenHRA}`)
          .set('X-Company-Id', companyAId)
          .send({ decision: 'APPROVED', note: 'Approve concurrent' }),
        request(app)
          .post(`/api/v1/attendance-correction-requests/${correctionRequestAId}/decision`)
          .set('Authorization', `Bearer ${tokenHRA}`)
          .set('X-Company-Id', companyAId)
          .send({ decision: 'REJECTED', note: 'Reject concurrent' }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);
    });

    it('handles rapid sequential health and metric read requests under load', async () => {
      const promises = Array.from({ length: 15 }, () =>
        request(app).get('/api/v1/health')
      );

      const results = await Promise.all(promises);
      for (const res of results) {
        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('ok');
      }
    });
  });

  describe('4. Input Validation & Error Envelopes', () => {
    it('returns 400 with standard INVALID_JSON code on malformed JSON payload', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": invalid_json');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_JSON');
      expect(res.body.error.requestId).toBeDefined();
    });

    it('returns 404 with standard NOT_FOUND code on non-existent endpoints without leaking internal structure', async () => {
      const res = await request(app).get('/api/v1/non-existent-path-for-test');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.requestId).toBeDefined();
      expect(res.body.error.stack).toBeUndefined();
    });
  });
});
