import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/infrastructure/database/prisma';
import { generateAccessToken, hashPassword } from '../src/common/auth/token';
import { MembershipRole, MembershipStatus, UserStatus, CompanyStatus } from '@prisma/client';

describe('Stage 6 — Work Locations, Shifts, Assignments, and Holidays', () => {
  let companyAId: string;
  let companyBId: string;

  let adminAUser: { id: string; email: string };
  let hrAUser: { id: string; email: string };
  let employeeAUser: { id: string; email: string };
  let adminBUser: { id: string; email: string };

  let tokenAdminA: string;
  let tokenHRA: string;
  let tokenEmployeeA: string;
  let tokenAdminB: string;

  let employeeAId: string;
  let employeeBId: string;

  let locationAId: string;
  let locationBId: string;
  let dayShiftAId: string;
  let nightShiftAId: string;
  let shiftBId: string;
  let assignmentAId: string;
  let holidayAId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('Password123!');

    // 1. Create Companies
    const compA = await prisma.company.create({
      data: {
        name: 'Stage 6 Acme Corp',
        slug: `stage6-acme-${Date.now()}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = compA.id;

    const compB = await prisma.company.create({
      data: {
        name: 'Stage 6 Globex Corp',
        slug: `stage6-globex-${Date.now()}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyBId = compB.id;

    // 2. Create Users
    const uAdminA = await prisma.user.create({
      data: {
        email: `admin.s6.a.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Admin User S6 A',
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

    const uHRA = await prisma.user.create({
      data: {
        email: `hr.s6.a.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'HR User S6 A',
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

    const uEmpA = await prisma.user.create({
      data: {
        email: `emp.s6.a.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Emp User S6 A',
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
    employeeAUser = { id: uEmpA.id, email: uEmpA.email };
    tokenEmployeeA = generateAccessToken({ userId: uEmpA.id, email: uEmpA.email });

    const uAdminB = await prisma.user.create({
      data: {
        email: `admin.s6.b.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Admin User S6 B',
        status: UserStatus.ACTIVE,
        memberships: {
          create: {
            companyId: companyBId,
            role: MembershipRole.COMPANY_ADMIN,
            status: MembershipStatus.ACTIVE,
          },
        },
      },
    });
    adminBUser = { id: uAdminB.id, email: uAdminB.email };
    tokenAdminB = generateAccessToken({ userId: uAdminB.id, email: uAdminB.email });

    // 3. Create Employees in Company A and Company B
    const empA = await prisma.employee.create({
      data: {
        companyId: companyAId,
        userId: employeeAUser.id,
        employeeNumber: 'S6-EMP-001',
        fullName: 'Alice Staff',
        email: employeeAUser.email,
      },
    });
    employeeAId = empA.id;

    const empB = await prisma.employee.create({
      data: {
        companyId: companyBId,
        userId: adminBUser.id,
        employeeNumber: 'S6-EMP-002',
        fullName: 'Bob Staff B',
        email: adminBUser.email,
      },
    });
    employeeBId = empB.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.holiday.deleteMany({
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
        id: { in: [adminAUser.id, hrAUser.id, employeeAUser.id, adminBUser.id] },
      },
    });
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. Work Locations & Geofence
  // =========================================================================
  describe('Work Locations & Geofence', () => {
    it('HR Admin creates a work location with geofence parameters (201)', async () => {
      const res = await request(app)
        .post('/api/v1/work-locations')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'Main Office Jakarta',
          address: 'Jl. Sudirman No. 10',
          latitude: -6.2088,
          longitude: 106.8456,
          geofenceRadiusM: 120,
          maxGpsAccuracyM: 40,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Main Office Jakarta');
      expect(res.body.data.geofenceRadiusM).toBe(120);
      expect(res.body.data.maxGpsAccuracyM).toBe(40);
      expect(res.body.data.isActive).toBe(true);
      locationAId = res.body.data.id;
    });

    it('Rejects invalid latitude/longitude out of range (422)', async () => {
      const res = await request(app)
        .post('/api/v1/work-locations')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'Invalid Coordinates',
          latitude: 95.0, // Invalid > 90
          longitude: 106.8456,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('Rejects non-positive geofence radius (422)', async () => {
      const res = await request(app)
        .post('/api/v1/work-locations')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'Zero Radius',
          latitude: -6.2088,
          longitude: 106.8456,
          geofenceRadiusM: 0,
        });

      expect(res.status).toBe(422);
    });

    it('Allows creating work location in Company B (201)', async () => {
      const res = await request(app)
        .post('/api/v1/work-locations')
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .set('X-Company-Id', companyBId)
        .send({
          name: 'Branch Surabaya',
          latitude: -7.2575,
          longitude: 112.7521,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.companyId).toBe(companyBId);
      locationBId = res.body.data.id;
    });

    it('Admin B retrieves their own company work location detail (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/work-locations/${locationBId}`)
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .set('X-Company-Id', companyBId);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(locationBId);
      expect(res.body.data.name).toBe('Branch Surabaya');
    });

    it('Lists only Company A work locations for HR Admin (200)', async () => {
      const res = await request(app)
        .get('/api/v1/work-locations')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(locationAId);
    });

    it('Rejects cross-tenant work location lookup (404 Not Found)', async () => {
      const res = await request(app)
        .get(`/api/v1/work-locations/${locationAId}`)
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .set('X-Company-Id', companyBId);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('Updates work location geofence radius (200)', async () => {
      const res = await request(app)
        .patch(`/api/v1/work-locations/${locationAId}`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          geofenceRadiusM: 150,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.geofenceRadiusM).toBe(150);
    });

    it('Denies work location creation to regular employee (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/work-locations')
        .set('Authorization', `Bearer ${tokenEmployeeA}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'Home Office',
          latitude: -6.2,
          longitude: 106.8,
        });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 2. Shifts & Overnight Definition
  // =========================================================================
  describe('Shift Management & Policy', () => {
    it('HR Admin creates a regular day shift (201)', async () => {
      const res = await request(app)
        .post('/api/v1/shifts')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'Standard Morning Shift',
          startTimeLocal: '08:00',
          endTimeLocal: '17:00',
          gracePeriodMinutes: 15,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Standard Morning Shift');
      expect(res.body.data.startTimeLocal).toBe('08:00');
      expect(res.body.data.endTimeLocal).toBe('17:00');
      expect(res.body.data.crossesMidnight).toBe(false);
      expect(res.body.data.gracePeriodMinutes).toBe(15);
      dayShiftAId = res.body.data.id;
    });

    it('Creates an overnight shift crossing midnight (201)', async () => {
      const res = await request(app)
        .post('/api/v1/shifts')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'Night Watch Shift',
          startTimeLocal: '22:00',
          endTimeLocal: '06:00',
          gracePeriodMinutes: 10,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Night Watch Shift');
      expect(res.body.data.crossesMidnight).toBe(true); // auto-detected when endTime < startTime
      nightShiftAId = res.body.data.id;
    });

    it('HR Admin retrieves overnight shift details verifying crossesMidnight (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/shifts/${nightShiftAId}`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(nightShiftAId);
      expect(res.body.data.crossesMidnight).toBe(true);
      expect(res.body.data.startTimeLocal).toBe('22:00');
      expect(res.body.data.endTimeLocal).toBe('06:00');
    });

    it('Rejects duplicate shift name within Company A (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/shifts')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'Standard Morning Shift',
          startTimeLocal: '09:00',
          endTimeLocal: '18:00',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('Allows same shift name in a different tenant (Company B) (201)', async () => {
      const res = await request(app)
        .post('/api/v1/shifts')
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .set('X-Company-Id', companyBId)
        .send({
          name: 'Standard Morning Shift',
          startTimeLocal: '08:30',
          endTimeLocal: '17:30',
        });

      expect(res.status).toBe(201);
      shiftBId = res.body.data.id;
    });

    it('Rejects invalid time format (422)', async () => {
      const res = await request(app)
        .post('/api/v1/shifts')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'Bad Time Shift',
          startTimeLocal: '8:00 AM', // Not 24-hr HH:mm
          endTimeLocal: '17:00',
        });

      expect(res.status).toBe(422);
    });

    it('Rejects cross-tenant shift lookup (404 Not Found)', async () => {
      const res = await request(app)
        .get(`/api/v1/shifts/${dayShiftAId}`)
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .set('X-Company-Id', companyBId);

      expect(res.status).toBe(404);
    });

    it('Updates shift details (200)', async () => {
      const res = await request(app)
        .patch(`/api/v1/shifts/${dayShiftAId}`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          gracePeriodMinutes: 20,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.gracePeriodMinutes).toBe(20);
    });
  });

  // =========================================================================
  // 3. Employee Shift Assignments
  // =========================================================================
  describe('Employee Shift Assignments', () => {
    it('HR Admin assigns a shift to an employee (201)', async () => {
      const res = await request(app)
        .post('/api/v1/employee-shifts')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          employeeId: employeeAId,
          shiftId: dayShiftAId,
          effectiveFrom: '2024-01-01',
          effectiveTo: '2024-12-31',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.employeeId).toBe(employeeAId);
      expect(res.body.data.shiftId).toBe(dayShiftAId);
      expect(res.body.data.effectiveFrom).toBe('2024-01-01');
      expect(res.body.data.effectiveTo).toBe('2024-12-31');
      expect(res.body.data.employee?.fullName).toBe('Alice Staff');
      expect(res.body.data.shift?.name).toBe('Standard Morning Shift');
      assignmentAId = res.body.data.id;
    });

    it('Rejects shift assignment when shift belongs to another company (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/employee-shifts')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          employeeId: employeeAId,
          shiftId: shiftBId, // Company B shift
          effectiveFrom: '2024-01-01',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Shift does not belong to this company');
    });

    it('Rejects shift assignment when employee belongs to another company (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/employee-shifts')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          employeeId: employeeBId, // Company B employee
          shiftId: dayShiftAId,
          effectiveFrom: '2024-01-01',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Employee does not belong to this company');
    });

    it('Rejects effectiveTo earlier than effectiveFrom (422)', async () => {
      const res = await request(app)
        .post('/api/v1/employee-shifts')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          employeeId: employeeAId,
          shiftId: dayShiftAId,
          effectiveFrom: '2024-06-01',
          effectiveTo: '2024-05-01', // Earlier than effectiveFrom!
        });

      expect(res.status).toBe(422);
      expect(res.body.error.details[0].message).toContain('effectiveTo cannot be earlier than effectiveFrom');
    });

    it('Queries active assignments for a specific effective date (200)', async () => {
      const res = await request(app)
        .get('/api/v1/employee-shifts?effectiveDate=2024-06-15')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(assignmentAId);
    });

    it('Rejects cross-tenant shift assignment detail lookup (404 Not Found)', async () => {
      const res = await request(app)
        .get(`/api/v1/employee-shifts/${assignmentAId}`)
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .set('X-Company-Id', companyBId);

      expect(res.status).toBe(404);
    });

    it('Company Admin A can list all employee shift assignments (200)', async () => {
      const res = await request(app)
        .get('/api/v1/employee-shifts')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('Deletes employee shift assignment (200)', async () => {
      const res = await request(app)
        .delete(`/api/v1/employee-shifts/${assignmentAId}`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });
  });

  // =========================================================================
  // 4. Holidays Calendar
  // =========================================================================
  describe('Holidays Calendar', () => {
    it('HR Admin creates a holiday in Company A (201)', async () => {
      const res = await request(app)
        .post('/api/v1/holidays')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          date: '2024-08-17',
          name: 'Hari Kemerdekaan RI',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Hari Kemerdekaan RI');
      expect(res.body.data.date).toBe('2024-08-17');
      holidayAId = res.body.data.id;
    });

    it('Rejects duplicate holiday on the same date in Company A (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/holidays')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          date: '2024-08-17',
          name: 'HUT RI Ke-79',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('Allows same holiday date in Company B (201)', async () => {
      const res = await request(app)
        .post('/api/v1/holidays')
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .set('X-Company-Id', companyBId)
        .send({
          date: '2024-08-17',
          name: 'Hari Kemerdekaan RI Globex',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.companyId).toBe(companyBId);
    });

    it('Lists holidays for a specific year (200)', async () => {
      const res = await request(app)
        .get('/api/v1/holidays?year=2024')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Hari Kemerdekaan RI');
    });

    it('Rejects cross-tenant holiday lookup (404 Not Found)', async () => {
      const res = await request(app)
        .get(`/api/v1/holidays/${holidayAId}`)
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .set('X-Company-Id', companyBId);

      expect(res.status).toBe(404);
    });

    it('Updates holiday name (200)', async () => {
      const res = await request(app)
        .patch(`/api/v1/holidays/${holidayAId}`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'HUT Kemerdekaan RI ke-79',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('HUT Kemerdekaan RI ke-79');
    });

    it('Deletes holiday (200)', async () => {
      const res = await request(app)
        .delete(`/api/v1/holidays/${holidayAId}`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });
  });

  // =========================================================================
  // 5. Audit Log Verification
  // =========================================================================
  describe('Audit Trail for Stage 6', () => {
    it('Records audit logs for work location, shift, assignment, and holiday mutations', async () => {
      const logs = await prisma.auditLog.findMany({
        where: {
          companyId: companyAId,
        },
      });

      const actions = logs.map((l) => l.action);
      expect(actions).toContain('WORK_LOCATION_CREATED');
      expect(actions).toContain('WORK_LOCATION_UPDATED');
      expect(actions).toContain('SHIFT_CREATED');
      expect(actions).toContain('SHIFT_UPDATED');
      expect(actions).toContain('EMPLOYEE_SHIFT_ASSIGNED');
      expect(actions).toContain('EMPLOYEE_SHIFT_REMOVED');
      expect(actions).toContain('HOLIDAY_CREATED');
      expect(actions).toContain('HOLIDAY_UPDATED');
      expect(actions).toContain('HOLIDAY_DELETED');
    });
  });
});
