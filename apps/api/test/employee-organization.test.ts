import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/infrastructure/database/prisma';
import { generateAccessToken, hashPassword } from '../src/common/auth/token';
import { MembershipRole, MembershipStatus, UserStatus, CompanyStatus } from '@prisma/client';

describe('Stage 5 — Employee and Organization Management', () => {
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

  let deptAId: string;
  let deptBId: string;
  let posAId: string;
  let posBId: string;
  let managerEmpId: string;
  let staffEmpId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('Password123!');

    // 1. Create 2 test companies
    const compA = await prisma.company.create({
      data: {
        name: 'Stage 5 Company A',
        slug: `stage5-comp-a-${Date.now()}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = compA.id;

    const compB = await prisma.company.create({
      data: {
        name: 'Stage 5 Company B',
        slug: `stage5-comp-b-${Date.now()}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyBId = compB.id;

    // 2. Create users
    const uAdminA = await prisma.user.create({
      data: {
        email: `admin.s5.a.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Admin User S5 A',
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
        email: `hr.s5.a.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'HR User S5 A',
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
        email: `emp.s5.a.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Emp User S5 A',
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
        email: `admin.s5.b.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Admin User S5 B',
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
  });

  afterAll(async () => {
    // Cleanup
    await prisma.auditLog.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.employee.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.companyMembership.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.department.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await prisma.position.deleteMany({
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
  // 1. Department Management & Scoping
  // =========================================================================
  describe('Department Management', () => {
    it('HR Admin creates a department successfully (201)', async () => {
      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'Engineering',
          code: 'ENG',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Engineering');
      expect(res.body.data.code).toBe('ENG');
      expect(res.body.data.companyId).toBe(companyAId);
      deptAId = res.body.data.id;
    });

    it('Rejects duplicate department name within the same company (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'Engineering',
          code: 'ENG2',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('Allows same department name in a different tenant (Company B) (201)', async () => {
      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .set('X-Company-Id', companyBId)
        .send({
          name: 'Engineering',
          code: 'ENG-B',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.companyId).toBe(companyBId);
      deptBId = res.body.data.id;
    });

    it('HR Admin lists only Company A departments', async () => {
      const res = await request(app)
        .get('/api/v1/departments')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(deptAId);
    });

    it('Rejects cross-tenant department detail lookup (404 Not Found)', async () => {
      const res = await request(app)
        .get(`/api/v1/departments/${deptAId}`)
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .set('X-Company-Id', companyBId);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('Updates department name, code, and status (200)', async () => {
      const res = await request(app)
        .patch(`/api/v1/departments/${deptAId}`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'Software Engineering',
          code: 'SWE',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Software Engineering');
      expect(res.body.data.code).toBe('SWE');
    });

    it('Denies department creation to Employee role (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${tokenEmployeeA}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'Marketing',
        });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 2. Position Management & Scoping
  // =========================================================================
  describe('Position Management', () => {
    it('HR Admin creates a position successfully (201)', async () => {
      const res = await request(app)
        .post('/api/v1/positions')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'Software Architect',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Software Architect');
      expect(res.body.data.companyId).toBe(companyAId);
      posAId = res.body.data.id;
    });

    it('Rejects duplicate position name within the same company (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/positions')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'Software Architect',
        });

      expect(res.status).toBe(409);
    });

    it('Allows same position in a different tenant (201)', async () => {
      const res = await request(app)
        .post('/api/v1/positions')
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .set('X-Company-Id', companyBId)
        .send({
          name: 'Software Architect',
        });

      expect(res.status).toBe(201);
      posBId = res.body.data.id;
    });

    it('Rejects cross-tenant position detail lookup (404 Not Found)', async () => {
      const res = await request(app)
        .get(`/api/v1/positions/${posAId}`)
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .set('X-Company-Id', companyBId);

      expect(res.status).toBe(404);
    });

    it('Updates position successfully (200)', async () => {
      const res = await request(app)
        .patch(`/api/v1/positions/${posAId}`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'Principal Software Architect',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Principal Software Architect');
    });
  });

  // =========================================================================
  // 3. Employee Creation & Cross-Tenant Reference Validation
  // =========================================================================
  describe('Employee Creation & Invariant Validation', () => {
    it('HR Admin creates a manager employee linked to Admin A user (201)', async () => {
      const res = await request(app)
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          employeeNumber: 'EMP-001',
          fullName: 'Alice Manager',
          email: 'alice@comp-a.com',
          phone: '+628123456789',
          departmentId: deptAId,
          positionId: posAId,
          userId: adminAUser.id,
          hireDate: '2023-01-10',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.employeeNumber).toBe('EMP-001');
      expect(res.body.data.fullName).toBe('Alice Manager');
      expect(res.body.data.department?.name).toBe('Software Engineering');
      expect(res.body.data.position?.name).toBe('Principal Software Architect');
      expect(res.body.data.employmentStatus).toBe('ACTIVE');
      managerEmpId = res.body.data.id;
    });

    it('HR Admin creates a second employee reporting to the manager (201)', async () => {
      const res = await request(app)
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          employeeNumber: 'EMP-002',
          fullName: 'Bob Developer',
          email: 'bob@comp-a.com',
          departmentId: deptAId,
          positionId: posAId,
          managerEmployeeId: managerEmpId,
          userId: employeeAUser.id,
          hireDate: '2023-05-15',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.employeeNumber).toBe('EMP-002');
      expect(res.body.data.manager?.fullName).toBe('Alice Manager');
      staffEmpId = res.body.data.id;
    });

    it('Rejects duplicate employeeNumber within Company A (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          employeeNumber: 'EMP-001',
          fullName: 'Charlie Clone',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('Allows same employeeNumber in different tenant (Company B) (201)', async () => {
      const res = await request(app)
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .set('X-Company-Id', companyBId)
        .send({
          employeeNumber: 'EMP-001',
          fullName: 'David Globex',
          departmentId: deptBId,
          positionId: posBId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.companyId).toBe(companyBId);
      expect(res.body.data.employeeNumber).toBe('EMP-001');
    });

    it('Rejects employee creation when department belongs to another company (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          employeeNumber: 'EMP-ERR-1',
          fullName: 'Error Department',
          departmentId: deptBId, // Company B department
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Department does not belong to this company');
    });

    it('Rejects employee creation when position belongs to another company (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          employeeNumber: 'EMP-ERR-2',
          fullName: 'Error Position',
          positionId: posBId, // Company B position
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Position does not belong to this company');
    });

    it('Rejects linking a user with no membership in the active company (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          employeeNumber: 'EMP-ERR-3',
          fullName: 'Error User',
          userId: adminBUser.id, // User from Company B only
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('active membership');
    });

    it('Rejects linking a user already linked to an employee in this company (409 Conflict)', async () => {
      const res = await request(app)
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          employeeNumber: 'EMP-ERR-4',
          fullName: 'Duplicate User Link',
          userId: employeeAUser.id, // already linked to EMP-002
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('already linked');
    });
  });

  // =========================================================================
  // 4. Employee Listing, Filtering, and Tenant Isolation
  // =========================================================================
  describe('Employee Listing and Filtering', () => {
    it('HR Admin lists employees with pagination metadata (200)', async () => {
      const res = await request(app)
        .get('/api/v1/employees?page=1&pageSize=10')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.pageSize).toBe(10);
    });

    it('Filters employees by search keyword', async () => {
      const res = await request(app)
        .get('/api/v1/employees?search=Bob')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].employeeNumber).toBe('EMP-002');
    });

    it('Filters employees by status', async () => {
      const res = await request(app)
        .get('/api/v1/employees?status=ACTIVE')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it('Ensures Company B cannot see Company A employees (tenant isolation)', async () => {
      const res = await request(app)
        .get('/api/v1/employees')
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .set('X-Company-Id', companyBId);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].companyId).toBe(companyBId);
      expect(res.body.data[0].fullName).toBe('David Globex');
    });
  });

  // =========================================================================
  // 5. Authorization: Detail, Update, and Status Management
  // =========================================================================
  describe('Employee Authorization and Operations', () => {
    it('Regular employee can view their own profile (200)', async () => {
      // Employee A is linked to staffEmpId
      const res = await request(app)
        .get(`/api/v1/employees/${staffEmpId}`)
        .set('Authorization', `Bearer ${tokenEmployeeA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(staffEmpId);
      expect(res.body.data.fullName).toBe('Bob Developer');
    });

    it("Regular employee CANNOT view another employee's profile without employee.read (403)", async () => {
      const res = await request(app)
        .get(`/api/v1/employees/${managerEmpId}`)
        .set('Authorization', `Bearer ${tokenEmployeeA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Rejects cross-tenant employee lookup even with admin token (404 Not Found)', async () => {
      const res = await request(app)
        .get(`/api/v1/employees/${managerEmpId}`)
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .set('X-Company-Id', companyBId);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('Rejects setting an employee as their own manager (400 Bad Request)', async () => {
      const res = await request(app)
        .patch(`/api/v1/employees/${managerEmpId}`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          managerEmployeeId: managerEmpId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('cannot be their own manager');
    });

    it('HR Admin updates employee profile details (200)', async () => {
      const res = await request(app)
        .patch(`/api/v1/employees/${staffEmpId}`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          fullName: 'Robert Developer',
          phone: '+628999888777',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.fullName).toBe('Robert Developer');
      expect(res.body.data.phone).toBe('+628999888777');
    });

    it('HR Admin cannot change employee status without employee.manage_status (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/employees/${staffEmpId}/status`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          status: 'INACTIVE',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('employee.manage_status');
    });

    it('Company Admin with employee.manage_status can change employee status (200)', async () => {
      const res = await request(app)
        .patch(`/api/v1/employees/${staffEmpId}/status`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .set('X-Company-Id', companyAId)
        .send({
          status: 'TERMINATED',
          terminationDate: '2024-10-14',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.employmentStatus).toBe('TERMINATED');
      expect(res.body.data.terminationDate).toBe('2024-10-14');
    });

    it('Audit log records actions for employee status change and profile updates', async () => {
      const logs = await prisma.auditLog.findMany({
        where: {
          companyId: companyAId,
          entityType: 'Employee',
        },
      });

      expect(logs.length).toBeGreaterThanOrEqual(3);
      const actions = logs.map((l) => l.action);
      expect(actions).toContain('EMPLOYEE_CREATED');
      expect(actions).toContain('EMPLOYEE_UPDATED');
      expect(actions).toContain('EMPLOYEE_STATUS_CHANGED');
    });
  });
});
