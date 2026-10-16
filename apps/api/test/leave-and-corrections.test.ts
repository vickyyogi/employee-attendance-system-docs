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

describe('Stage 10 — Leave and Attendance Correction Workflows', () => {
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
  let _employeeA2Id: string;
  let _employeeHrAId: string;

  let leaveTypeAnnualId: string;
  let leaveTypeSickId: string;
  let leaveTypeCompanyBId: string;

  let attendanceRecordA1Id: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('Password123!');

    // 1. Create Companies A & B
    const compA = await prisma.company.create({
      data: {
        name: 'Stage 10 Company A',
        slug: `stage10-comp-a-${Date.now()}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = compA.id;

    const compB = await prisma.company.create({
      data: {
        name: 'Stage 10 Company B',
        slug: `stage10-comp-b-${Date.now()}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyBId = compB.id;

    // 2. Create Users
    // Company Admin A
    const uAdminA = await prisma.user.create({
      data: {
        email: `admin.s10.a.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Admin User S10 A',
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

    // HR Admin A (also has employee profile for self-approval testing)
    const uHRA = await prisma.user.create({
      data: {
        email: `hr.s10.a.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'HR User S10 A',
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

    const empHrA = await prisma.employee.create({
      data: {
        companyId: companyAId,
        userId: uHRA.id,
        employeeNumber: `EMP-HR-${Date.now()}`,
        fullName: 'HR User S10 A (Employee)',
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });
    _employeeHrAId = empHrA.id;

    // Regular Employee A1
    const uEmpA1 = await prisma.user.create({
      data: {
        email: `emp.a1.s10.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Employee A1 S10',
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

    const empA1 = await prisma.employee.create({
      data: {
        companyId: companyAId,
        userId: uEmpA1.id,
        employeeNumber: `EMP-A1-${Date.now()}`,
        fullName: 'Employee A1 S10',
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });
    employeeA1Id = empA1.id;

    // Regular Employee A2
    const uEmpA2 = await prisma.user.create({
      data: {
        email: `emp.a2.s10.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Employee A2 S10',
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

    const empA2 = await prisma.employee.create({
      data: {
        companyId: companyAId,
        userId: uEmpA2.id,
        employeeNumber: `EMP-A2-${Date.now()}`,
        fullName: 'Employee A2 S10',
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });
    _employeeA2Id = empA2.id;

    // Employee B (Company B)
    const uEmpB = await prisma.user.create({
      data: {
        email: `emp.b.s10.${Date.now()}@test.com`,
        passwordHash,
        fullName: 'Employee B S10',
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

    await prisma.employee.create({
      data: {
        companyId: companyBId,
        userId: uEmpB.id,
        employeeNumber: `EMP-B-${Date.now()}`,
        fullName: 'Employee B S10',
        employmentStatus: EmploymentStatus.ACTIVE,
      },
    });

    // 3. Create sample attendance record for Employee A1 to test attendance corrections
    const attRecord = await prisma.attendanceRecord.create({
      data: {
        companyId: companyAId,
        employeeId: employeeA1Id,
        workDate: new Date('2026-10-10T00:00:00Z'),
        checkInAt: new Date('2026-10-10T08:45:00Z'),
        checkOutAt: new Date('2026-10-10T17:00:00Z'),
        status: AttendanceStatus.LATE,
      },
    });
    attendanceRecordA1Id = attRecord.id;
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    await prisma.approvalAction.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.attendanceCorrectionRequest.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.leaveRequest.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.leaveType.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.attendanceEvent.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.attendanceRecord.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.employee.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.companyMembership.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.user.deleteMany({
      where: {
        id: { in: [adminAUser.id, hrAUser.id, employeeA1User.id, employeeA2User.id, employeeBUser.id] },
      },
    });
    await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
  });

  describe('Leave Types Management', () => {
    it('Admin can create leave types in company', async () => {
      const resAnnual = await request(app)
        .post('/api/v1/leave-types')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'Annual Paid Leave',
          unit: 'DAYS',
          requiresApproval: true,
        });

      expect(resAnnual.status).toBe(201);
      expect(resAnnual.body.data.name).toBe('Annual Paid Leave');
      expect(resAnnual.body.data.unit).toBe('DAYS');
      expect(resAnnual.body.data.requiresApproval).toBe(true);
      leaveTypeAnnualId = resAnnual.body.data.id;

      const resSick = await request(app)
        .post('/api/v1/leave-types')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'Medical Sick Leave',
          unit: 'DAYS',
        });

      expect(resSick.status).toBe(201);
      leaveTypeSickId = resSick.body.data.id;
    });

    it('Duplicate leave type name in the same company returns 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/v1/leave-types')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'Annual Paid Leave',
          unit: 'DAYS',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('Regular employee cannot create leave types (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/leave-types')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          name: 'Unauthorized Type',
        });

      expect(res.status).toBe(403);
    });

    it('Leave types are strictly scoped by tenant', async () => {
      // Create leave type in Company B
      const resCompB = await prisma.leaveType.create({
        data: {
          companyId: companyBId,
          name: 'Company B Leave',
        },
      });
      leaveTypeCompanyBId = resCompB.id;

      const listA = await request(app)
        .get('/api/v1/leave-types')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId);

      expect(listA.status).toBe(200);
      const names = listA.body.data.map((t: { name: string }) => t.name);
      expect(names).toContain('Annual Paid Leave');
      expect(names).toContain('Medical Sick Leave');
      expect(names).not.toContain('Company B Leave');
    });
  });

  describe('Leave Request Submission & Lifecycle', () => {
    let leaveRequestA1Id: string;

    it('Employee can submit a leave request with valid dates and reason', async () => {
      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          leaveTypeId: leaveTypeAnnualId,
          startDate: '2026-11-01',
          endDate: '2026-11-03',
          reason: 'Family vacation and personal matters',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.startDate).toBe('2026-11-01');
      expect(res.body.data.endDate).toBe('2026-11-03');
      expect(res.body.data.employeeId).toBe(employeeA1Id);
      leaveRequestA1Id = res.body.data.id;
    });

    it('Submitting leave request with startDate > endDate returns 422 Unprocessable Entity', async () => {
      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          leaveTypeId: leaveTypeAnnualId,
          startDate: '2026-11-05',
          endDate: '2026-11-01', // End before start
          reason: 'Invalid date range request',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toContain('Start date must be before or equal to end date');
    });

    it('Submitting request with cross-tenant leaveTypeId returns 404 Not Found', async () => {
      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          leaveTypeId: leaveTypeCompanyBId, // From Company B!
          startDate: '2026-11-01',
          endDate: '2026-11-02',
          reason: 'Attempting cross-tenant leave type',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('Leave type not found');
    });

    it('Employee can list their own leave requests', async () => {
      const res = await request(app)
        .get('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].id).toBe(leaveRequestA1Id);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('Employee can view details of their own leave request', async () => {
      const res = await request(app)
        .get(`/api/v1/leave-requests/${leaveRequestA1Id}`)
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(leaveRequestA1Id);
      expect(res.body.data.status).toBe('PENDING');
    });

    it('Other non-HR employee cannot view another employee leave request (404 Not Found)', async () => {
      const res = await request(app)
        .get(`/api/v1/leave-requests/${leaveRequestA1Id}`)
        .set('Authorization', `Bearer ${tokenEmployeeA2}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(404);
    });

    it('Employee can cancel their own PENDING leave request', async () => {
      // Create request to be cancelled
      const createRes = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${tokenEmployeeA2}`)
        .set('X-Company-Id', companyAId)
        .send({
          leaveTypeId: leaveTypeSickId,
          startDate: '2026-12-01',
          endDate: '2026-12-02',
          reason: 'Doctor appointment to be cancelled',
        });

      expect(createRes.status).toBe(201);
      const reqId = createRes.body.data.id;

      // Cancel it
      const cancelRes = await request(app)
        .post(`/api/v1/leave-requests/${reqId}/cancel`)
        .set('Authorization', `Bearer ${tokenEmployeeA2}`)
        .set('X-Company-Id', companyAId);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');

      // Attempting to cancel again returns 409 Conflict
      const secondCancel = await request(app)
        .post(`/api/v1/leave-requests/${reqId}/cancel`)
        .set('Authorization', `Bearer ${tokenEmployeeA2}`)
        .set('X-Company-Id', companyAId);

      expect(secondCancel.status).toBe(409);
    });
  });

  describe('Leave Approvals & Mandatory Self-Approval Prevention', () => {
    let pendingLeaveReqId: string;
    let hrOwnLeaveReqId: string;

    beforeAll(async () => {
      // 1. Employee A1 submits leave request
      const res = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          leaveTypeId: leaveTypeAnnualId,
          startDate: '2026-11-10',
          endDate: '2026-11-12',
          reason: 'Annual trip',
        });
      pendingLeaveReqId = res.body.data.id;

      // 2. HR Admin submits their own leave request (as an employee)
      const resHr = await request(app)
        .post('/api/v1/leave-requests')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          leaveTypeId: leaveTypeSickId,
          startDate: '2026-11-20',
          endDate: '2026-11-21',
          reason: 'Personal medical leave for HR user',
        });
      hrOwnLeaveReqId = resHr.body.data.id;
    });

    it('HR Admin can view pending requests queue via /api/v1/approvals/pending', async () => {
      const res = await request(app)
        .get('/api/v1/approvals/pending')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.leaveRequests.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.total).toBeGreaterThanOrEqual(2);
    });

    it('Regular employee cannot view pending approvals queue (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/approvals/pending')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(403);
    });

    it('MANDATORY: Self-approval prevention prevents HR Admin from approving their own request (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/leave-requests/${hrOwnLeaveReqId}/decision`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          decision: 'APPROVED',
          note: 'Trying to approve my own leave request',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Self-approval is strictly prohibited');
    });

    it('HR Admin can approve an employee leave request transactionally', async () => {
      const res = await request(app)
        .post(`/api/v1/leave-requests/${pendingLeaveReqId}/decision`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          decision: 'APPROVED',
          note: 'Approved. Enjoy your time off!',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');
      expect(res.body.data.decidedByUserId).toBe(hrAUser.id);
      expect(res.body.data.decisionNote).toBe('Approved. Enjoy your time off!');

      // Verify approval_action record created
      const action = await prisma.approvalAction.findFirst({
        where: {
          requestId: pendingLeaveReqId,
          requestType: 'LEAVE',
        },
      });
      expect(action).not.toBeNull();
      expect(action?.action).toBe('APPROVED');
      expect(action?.actorUserId).toBe(hrAUser.id);
    });

    it('Cannot decide an already decided leave request (409 Conflict)', async () => {
      const res = await request(app)
        .post(`/api/v1/leave-requests/${pendingLeaveReqId}/decision`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          decision: 'REJECTED',
          note: 'Attempting to change decision',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('Cross-tenant leave request decision attempt returns 404 Not Found', async () => {
      // Company B tries to decide Company A request
      const res = await request(app)
        .post(`/api/v1/leave-requests/${pendingLeaveReqId}/decision`)
        .set('Authorization', `Bearer ${tokenEmployeeB}`)
        .set('X-Company-Id', companyBId)
        .send({
          decision: 'APPROVED',
        });

      expect(res.status).toBe(403); // Or 404 depending on auth/tenant
    });
  });

  describe('Attendance Correction Requests & Side-Effects', () => {
    let correctionReqId: string;
    let hrOwnCorrectionReqId: string;

    it('Employee can submit an attendance correction request linked to an attendance record', async () => {
      const res = await request(app)
        .post('/api/v1/attendance-correction-requests')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          attendanceRecordId: attendanceRecordA1Id,
          requestedCheckInAt: '2026-10-10T08:00:00Z', // Original was 08:45
          requestedCheckOutAt: '2026-10-10T17:00:00Z',
          reason: 'Biometric device scanner lagged, actually arrived at 08:00',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.employeeId).toBe(employeeA1Id);
      expect(res.body.data.attendanceRecordId).toBe(attendanceRecordA1Id);
      correctionReqId = res.body.data.id;
    });

    it('Submitting correction with requestedCheckInAt > requestedCheckOutAt returns 422 Unprocessable Entity', async () => {
      const res = await request(app)
        .post('/api/v1/attendance-correction-requests')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId)
        .send({
          attendanceRecordId: attendanceRecordA1Id,
          requestedCheckInAt: '2026-10-10T18:00:00Z',
          requestedCheckOutAt: '2026-10-10T08:00:00Z', // Out before in
          reason: 'Invalid timestamp inversion',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toContain('Requested check-in time must be before requested check-out time');
    });

    it('Employee can list their own correction requests', async () => {
      const res = await request(app)
        .get('/api/v1/attendance-correction-requests')
        .set('Authorization', `Bearer ${tokenEmployeeA1}`)
        .set('X-Company-Id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].id).toBe(correctionReqId);
    });

    it('MANDATORY: Self-approval prevention prevents HR Admin from approving own correction request (403 Forbidden)', async () => {
      // HR Admin creates correction request for themselves
      const createRes = await request(app)
        .post('/api/v1/attendance-correction-requests')
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          requestedCheckInAt: '2026-10-11T08:00:00Z',
          reason: 'Forgot to clock in',
        });

      expect(createRes.status).toBe(201);
      hrOwnCorrectionReqId = createRes.body.data.id;

      // HR Admin tries to approve their own request
      const approveRes = await request(app)
        .post(`/api/v1/attendance-correction-requests/${hrOwnCorrectionReqId}/decision`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          decision: 'APPROVED',
          note: 'Self-approval attempt',
        });

      expect(approveRes.status).toBe(403);
      expect(approveRes.body.error.message).toContain('Self-approval is strictly prohibited');
    });

    it('Approving attendance correction updates record to CORRECTED and writes AttendanceEvent and ApprovalAction', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance-correction-requests/${correctionReqId}/decision`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          decision: 'APPROVED',
          note: 'Verified with security desk logbook',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('APPROVED');

      // 1. Verify underlying AttendanceRecord was updated
      const updatedRecord = await prisma.attendanceRecord.findUnique({
        where: { id: attendanceRecordA1Id },
      });
      expect(updatedRecord).not.toBeNull();
      expect(updatedRecord?.status).toBe(AttendanceStatus.CORRECTED);
      expect(updatedRecord?.checkInAt?.toISOString()).toBe('2026-10-10T08:00:00.000Z');

      // 2. Verify immutable AttendanceEvent of type CORRECTION created
      const event = await prisma.attendanceEvent.findFirst({
        where: {
          attendanceRecordId: attendanceRecordA1Id,
          eventType: 'CORRECTION',
        },
      });
      expect(event).not.toBeNull();
      expect(event?.actorUserId).toBe(hrAUser.id);
      expect(
        (event?.metadata as Record<string, unknown>)?.correctionRequestId
      ).toBe(correctionReqId);
      expect((event?.metadata as Record<string, unknown>)?.previousStatus).toBe(
        'LATE'
      );

      // 3. Verify ApprovalAction record created
      const approval = await prisma.approvalAction.findFirst({
        where: {
          requestId: correctionReqId,
          requestType: 'ATTENDANCE_CORRECTION',
        },
      });
      expect(approval).not.toBeNull();
      expect(approval?.action).toBe('APPROVED');
      expect(approval?.actorUserId).toBe(hrAUser.id);
    });

    it('Cannot decide an already decided correction request (409 Conflict)', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance-correction-requests/${correctionReqId}/decision`)
        .set('Authorization', `Bearer ${tokenHRA}`)
        .set('X-Company-Id', companyAId)
        .send({
          decision: 'REJECTED',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });
});
