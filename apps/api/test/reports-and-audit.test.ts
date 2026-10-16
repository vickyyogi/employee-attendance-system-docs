import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/infrastructure/database/prisma';
import { generateAccessToken, hashPassword } from '../src/common/auth/token';
import {
  MembershipRole,
  MembershipStatus,
  UserStatus,
  CompanyStatus,
  EmploymentStatus,
  AttendanceStatus,
} from '@prisma/client';

describe('Stage 11 — Reports and Audit Logs Endpoints', () => {
  let companyAId: string;
  let companyBId: string;

  let hrUserA: { id: string; email: string };
  let employeeUserA: { id: string; email: string };
  let employeeUserB: { id: string; email: string };

  let tokenHRA: string;
  let tokenEmployeeA: string;
  let tokenEmployeeB: string;

  let deptA1Id: string;
  let employeeA1Id: string;
  let employeeA2Id: string;
  let employeeB1Id: string;

  let shiftAId: string;
  let workLocationAId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('Password123!');

    // 1. Create Companies
    const compA = await prisma.company.create({
      data: {
        name: 'Reports Comp A',
        slug: `reports-comp-a-${Date.now()}`,
        status: CompanyStatus.ACTIVE,
        timezone: 'Asia/Jakarta',
      },
    });
    companyAId = compA.id;

    const compB = await prisma.company.create({
      data: {
        name: 'Reports Comp B',
        slug: `reports-comp-b-${Date.now()}`,
        status: CompanyStatus.ACTIVE,
        timezone: 'Asia/Jakarta',
      },
    });
    companyBId = compB.id;

    // 2. Work Location & Shift
    const loc = await prisma.workLocation.create({
      data: {
        companyId: companyAId,
        name: 'Headquarters',
        latitude: -6.2,
        longitude: 106.8,
        geofenceRadiusM: 100,
        maxGpsAccuracyM: 50,
      },
    });
    workLocationAId = loc.id;

    const shift = await prisma.shift.create({
      data: {
        companyId: companyAId,
        name: 'Morning Shift',
        startTimeLocal: '09:00',
        endTimeLocal: '18:00',
      },
    });
    shiftAId = shift.id;

    // 3. Department
    const dept = await prisma.department.create({
      data: {
        companyId: companyAId,
        name: 'Engineering',
        code: 'ENG',
      },
    });
    deptA1Id = dept.id;

    // 4. Users
    hrUserA = await prisma.user.create({
      data: {
        email: `hr-rep-${Date.now()}@test.com`,
        passwordHash,
        fullName: 'HR Officer',
        status: UserStatus.ACTIVE,
      },
    });

    employeeUserA = await prisma.user.create({
      data: {
        email: `emp-rep-a-${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Dev Employee A',
        status: UserStatus.ACTIVE,
      },
    });

    employeeUserB = await prisma.user.create({
      data: {
        email: `emp-rep-b-${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Dev Employee B',
        status: UserStatus.ACTIVE,
      },
    });

    // 5. Memberships
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
        userId: employeeUserA.id,
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

    // 6. Employees
    const emp1 = await prisma.employee.create({
      data: {
        companyId: companyAId,
        userId: employeeUserA.id,
        employeeNumber: 'EMP-001',
        fullName: 'Dev Employee A',
        employmentStatus: EmploymentStatus.ACTIVE,
        departmentId: deptA1Id,
      },
    });
    employeeA1Id = emp1.id;

    const emp2 = await prisma.employee.create({
      data: {
        companyId: companyAId,
        employeeNumber: 'EMP-002',
        fullName: 'Second Employee A',
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });
    employeeA2Id = emp2.id;

    const empB = await prisma.employee.create({
      data: {
        companyId: companyBId,
        userId: employeeUserB.id,
        employeeNumber: 'EMP-B01',
        fullName: 'Dev Employee B',
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });
    employeeB1Id = empB.id;

    // 7. Seed Attendance Records for Reports Testing
    // Comp A - Record 1: Present on 2026-10-01
    await prisma.attendanceRecord.create({
      data: {
        companyId: companyAId,
        employeeId: employeeA1Id,
        workDate: new Date('2026-10-01T00:00:00.000Z'),
        shiftId: shiftAId,
        workLocationId: workLocationAId,
        checkInAt: new Date('2026-10-01T08:55:00.000Z'),
        checkOutAt: new Date('2026-10-01T18:00:00.000Z'),
        status: AttendanceStatus.PRESENT,
        idempotencyKey: `idem-rep-1-${Date.now()}`,
      },
    });

    // Comp A - Record 2: Late on 2026-10-01
    await prisma.attendanceRecord.create({
      data: {
        companyId: companyAId,
        employeeId: employeeA2Id,
        workDate: new Date('2026-10-01T00:00:00.000Z'),
        shiftId: shiftAId,
        workLocationId: workLocationAId,
        checkInAt: new Date('2026-10-01T09:30:00.000Z'),
        status: AttendanceStatus.LATE,
        idempotencyKey: `idem-rep-2-${Date.now()}`,
      },
    });

    // Comp A - Record 3: Corrected on 2026-10-02
    await prisma.attendanceRecord.create({
      data: {
        companyId: companyAId,
        employeeId: employeeA1Id,
        workDate: new Date('2026-10-02T00:00:00.000Z'),
        shiftId: shiftAId,
        workLocationId: workLocationAId,
        checkInAt: new Date('2026-10-02T09:00:00.000Z'),
        checkOutAt: new Date('2026-10-02T18:00:00.000Z'),
        status: AttendanceStatus.CORRECTED,
        idempotencyKey: `idem-rep-3-${Date.now()}`,
      },
    });

    // Comp B - Record: should never be included in Comp A reports
    await prisma.attendanceRecord.create({
      data: {
        companyId: companyBId,
        employeeId: employeeB1Id,
        workDate: new Date('2026-10-01T00:00:00.000Z'),
        checkInAt: new Date('2026-10-01T09:00:00.000Z'),
        status: AttendanceStatus.PRESENT,
        idempotencyKey: `idem-rep-b-${Date.now()}`,
      },
    });

    // 8. Generate JWT tokens
    tokenHRA = generateAccessToken({ userId: hrUserA.id, email: hrUserA.email });
    tokenEmployeeA = generateAccessToken({ userId: employeeUserA.id, email: employeeUserA.email });
    tokenEmployeeB = generateAccessToken({ userId: employeeUserB.id, email: employeeUserB.email });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.auditLog.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.attendanceRecord.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.employee.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.companyMembership.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.workLocation.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.shift.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.department.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.company.deleteMany({
      where: { id: { in: [companyAId, companyBId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [hrUserA.id, employeeUserA.id, employeeUserB.id] } },
    });
  });

  describe('GET /reports/attendance-summary', () => {
    it('returns attendance summary and daily breakdown within date range', async () => {
      const res = await request(app)
        .get('/api/v1/reports/attendance-summary?startDate=2026-10-01&endDate=2026-10-05')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.totalRecords).toBe(3);
      expect(res.body.data.presentCount).toBe(1);
      expect(res.body.data.lateCount).toBe(1);
      expect(res.body.data.correctedCount).toBe(1);
      expect(res.body.data.dailyBreakdown.length).toBe(2);
    });

    it('validates date range ordering (startDate <= endDate)', async () => {
      const res = await request(app)
        .get('/api/v1/reports/attendance-summary?startDate=2026-10-10&endDate=2026-10-01')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(422);
    });

    it('enforces tenant isolation: company B records are excluded', async () => {
      const res = await request(app)
        .get('/api/v1/reports/attendance-summary?startDate=2026-10-01&endDate=2026-10-05')
        .set('Authorization', `Bearer ${tokenEmployeeB}`)
        .set('X-Company-Id', companyBId);

      expect(res.status).toBe(200);
      expect(res.body.data.totalRecords).toBe(1);
    });
  });

  describe('GET /reports/late-arrivals', () => {
    it('returns late arrival items with employee and late calculation details', async () => {
      const res = await request(app)
        .get('/api/v1/reports/late-arrivals?startDate=2026-10-01&endDate=2026-10-05')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.totalLate).toBe(1);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].employeeNumber).toBe('EMP-002');
      expect(res.body.data.items[0].lateMinutes).toBeGreaterThan(0);
    });
  });

  describe('POST /reports/attendance-export', () => {
    it('exports CSV formatted report and records audit log', async () => {
      const res = await request(app)
        .post('/api/v1/reports/attendance-export')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          startDate: '2026-10-01',
          endDate: '2026-10-05',
          format: 'csv',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.format).toBe('csv');
      expect(res.body.data.recordCount).toBe(3);
      expect(res.body.data.filename).toContain('.csv');
      expect(res.body.data.data).toContain('Employee Number,Employee Name');
      expect(res.body.data.data).toContain('EMP-001');

      // Verify audit log was recorded
      const audit = await prisma.auditLog.findFirst({
        where: {
          companyId: companyAId,
          action: 'REPORT_EXPORTED',
        },
      });
      expect(audit).not.toBeNull();
      expect(audit?.actorUserId).toBe(hrUserA.id);
    });

    it('exports JSON formatted report and supports department filter', async () => {
      const res = await request(app)
        .post('/api/v1/reports/attendance-export')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          startDate: '2026-10-01',
          endDate: '2026-10-05',
          format: 'json',
          departmentId: deptA1Id,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.format).toBe('json');
      expect(res.body.data.recordCount).toBe(2); // Only employee 1 in ENG
      const parsed = JSON.parse(res.body.data.data);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
    });

    it('denies export to users without report.attendance.export permission', async () => {
      const res = await request(app)
        .post('/api/v1/reports/attendance-export')
        .set('Authorization', `Bearer ${tokenEmployeeA}`)
        .set('X-Company-Id', companyAId)
        .send({
          startDate: '2026-10-01',
          endDate: '2026-10-05',
          format: 'csv',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /audit-logs', () => {
    it('returns paginated audit logs for the tenant', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs?action=REPORT_EXPORTED')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].action).toBe('REPORT_EXPORTED');
      expect(res.body.data[0].actorUser.fullName).toBe('HR Officer');
    });

    it('denies access to non-auditor/non-admin roles', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${tokenEmployeeA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(403);
    });
  });
});
