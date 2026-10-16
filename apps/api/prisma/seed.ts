import 'dotenv/config';
import { PrismaClient, MembershipRole, UserStatus, CompanyStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.info('Starting safe development seed...');

  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  // 1. Clean existing data (dev only)
  await prisma.refreshToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.employeeShift.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.workLocation.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.companyMembership.deleteMany();
  await prisma.platformAdmin.deleteMany();
  await prisma.department.deleteMany();
  await prisma.position.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create Platform Admin User
  const platformAdminUser = await prisma.user.create({
    data: {
      email: 'platform.admin@example.com',
      passwordHash: defaultPasswordHash,
      fullName: 'System Platform Admin',
      status: UserStatus.ACTIVE,
      platformAdmin: {
        create: {
          status: 'ACTIVE',
        },
      },
    },
  });

  // 3. Create Companies (Tenants)
  const companyA = await prisma.company.create({
    data: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      timezone: 'Asia/Jakarta',
      status: CompanyStatus.ACTIVE,
      departments: {
        create: [
          { name: 'Engineering', code: 'ENG' },
          { name: 'Human Resources', code: 'HR' },
        ],
      },
      positions: {
        create: [
          { name: 'Senior Software Engineer' },
          { name: 'HR Generalist' },
        ],
      },
    },
  });

  const companyB = await prisma.company.create({
    data: {
      name: 'Globex Industries',
      slug: 'globex-corp',
      timezone: 'Asia/Jakarta',
      status: CompanyStatus.ACTIVE,
      departments: {
        create: [
          { name: 'Operations', code: 'OPS' },
          { name: 'Finance', code: 'FIN' },
        ],
      },
      positions: {
        create: [
          { name: 'Operations Coordinator' },
          { name: 'Financial Analyst' },
        ],
      },
    },
  });

  // 4. Create Company Users & Memberships
  // Company A Admin
  const userAdminA = await prisma.user.create({
    data: {
      email: 'admin.acme@example.com',
      passwordHash: defaultPasswordHash,
      fullName: 'Acme Admin',
      status: UserStatus.ACTIVE,
      memberships: {
        create: {
          companyId: companyA.id,
          role: MembershipRole.COMPANY_ADMIN,
        },
      },
    },
  });

  // Company A HR Admin
  const userHRA = await prisma.user.create({
    data: {
      email: 'hr.acme@example.com',
      passwordHash: defaultPasswordHash,
      fullName: 'Acme HR Manager',
      status: UserStatus.ACTIVE,
      memberships: {
        create: {
          companyId: companyA.id,
          role: MembershipRole.HR_ADMIN,
        },
      },
    },
  });

  // Company A Employee
  const userEmployeeA = await prisma.user.create({
    data: {
      email: 'employee.acme@example.com',
      passwordHash: defaultPasswordHash,
      fullName: 'Acme Employee',
      status: UserStatus.ACTIVE,
      memberships: {
        create: {
          companyId: companyA.id,
          role: MembershipRole.EMPLOYEE,
        },
      },
    },
  });

  // Company B Admin
  const userAdminB = await prisma.user.create({
    data: {
      email: 'admin.globex@example.com',
      passwordHash: defaultPasswordHash,
      fullName: 'Globex Admin',
      status: UserStatus.ACTIVE,
      memberships: {
        create: {
          companyId: companyB.id,
          role: MembershipRole.COMPANY_ADMIN,
        },
      },
    },
  });

  // Multi-Company User (Employee in Acme, HR in Globex)
  const userMulti = await prisma.user.create({
    data: {
      email: 'multi.tenant@example.com',
      passwordHash: defaultPasswordHash,
      fullName: 'Multi Tenant User',
      status: UserStatus.ACTIVE,
      memberships: {
        create: [
          {
            companyId: companyA.id,
            role: MembershipRole.EMPLOYEE,
          },
          {
            companyId: companyB.id,
            role: MembershipRole.HR_ADMIN,
          },
        ],
      },
    },
  });

  // 5. Create Employees
  const engDept = await prisma.department.findFirst({
    where: { companyId: companyA.id, code: 'ENG' },
  });
  const devPos = await prisma.position.findFirst({
    where: { companyId: companyA.id, name: 'Senior Software Engineer' },
  });

  const emp1 = await prisma.employee.create({
    data: {
      companyId: companyA.id,
      userId: userAdminA.id,
      employeeNumber: 'ACM-001',
      fullName: 'Acme Admin',
      email: userAdminA.email,
      departmentId: engDept?.id,
      positionId: devPos?.id,
      hireDate: new Date('2024-01-15'),
    },
  });

  await prisma.employee.create({
    data: {
      companyId: companyA.id,
      userId: userEmployeeA.id,
      employeeNumber: 'ACM-002',
      fullName: 'Acme Employee',
      email: userEmployeeA.email,
      departmentId: engDept?.id,
      positionId: devPos?.id,
      managerEmployeeId: emp1.id,
      hireDate: new Date('2024-03-01'),
    },
  });

  const opsDeptB = await prisma.department.findFirst({
    where: { companyId: companyB.id, code: 'OPS' },
  });
  const opsPosB = await prisma.position.findFirst({
    where: { companyId: companyB.id, name: 'Operations Coordinator' },
  });

  await prisma.employee.create({
    data: {
      companyId: companyB.id,
      userId: userAdminB.id,
      employeeNumber: 'GLX-001',
      fullName: 'Globex Admin',
      email: userAdminB.email,
      departmentId: opsDeptB?.id,
      positionId: opsPosB?.id,
      hireDate: new Date('2024-02-01'),
    },
  });

  // 6. Create Work Locations
  await prisma.workLocation.create({
    data: {
      companyId: companyA.id,
      name: 'BPR Adiartha Reksacitra',
      address: 'Jl. Raya Mondoroko No.114 Pagentan - Singosari, Malang, Jawa Timur',
      latitude: -7.902444234001053,
      longitude:  112.66144098107387,
      geofenceRadiusM: 100,
      maxGpsAccuracyM: 50,
      isActive: true,
    },
  });

  await prisma.workLocation.create({
    data: {
      companyId: companyB.id,
      name: 'Globex Surabaya Hub',
      address: 'Jl. Pemuda No. 10, Surabaya',
      latitude: -7.2575000,
      longitude: 112.7521000,
      geofenceRadiusM: 150,
      maxGpsAccuracyM: 50,
      isActive: true,
    },
  });

  // 7. Create Shifts (including standard and overnight)
  const dayShiftA = await prisma.shift.create({
    data: {
      companyId: companyA.id,
      name: 'Regular Day Shift',
      startTimeLocal: '08:00',
      endTimeLocal: '17:00',
      crossesMidnight: false,
      gracePeriodMinutes: 15,
      isActive: true,
    },
  });

  await prisma.shift.create({
    data: {
      companyId: companyA.id,
      name: 'Overnight Shift',
      startTimeLocal: '22:00',
      endTimeLocal: '06:00',
      crossesMidnight: true,
      gracePeriodMinutes: 15,
      isActive: true,
    },
  });

  // 8. Assign Shift to Employee
  await prisma.employeeShift.create({
    data: {
      companyId: companyA.id,
      employeeId: emp1.id,
      shiftId: dayShiftA.id,
      effectiveFrom: new Date('2024-01-01'),
    },
  });

  // 9. Create Holidays
  await prisma.holiday.create({
    data: {
      companyId: companyA.id,
      date: new Date('2024-01-01'),
      name: 'Tahun Baru Masehi',
    },
  });

  console.info('Development seed completed successfully:', {
    platformAdmin: platformAdminUser.email,
    companies: [companyA.slug, companyB.slug],
    usersCreated: [
      userAdminA.email,
      userHRA.email,
      userEmployeeA.email,
      userAdminB.email,
      userMulti.email,
    ],
    employeesCreated: ['ACM-001', 'ACM-002', 'GLX-001'],
    locationsCreated: ['BPR Adiartha Reksacitra', 'Globex Surabaya Hub'],
    shiftsCreated: ['Regular Day Shift', 'Overnight Shift'],
    holidaysCreated: ['Tahun Baru Masehi'],
  });
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
