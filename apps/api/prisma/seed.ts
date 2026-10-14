import { PrismaClient, MembershipRole, UserStatus, CompanyStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.info('Starting safe development seed...');

  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  // 1. Clean existing data (dev only)
  await prisma.refreshToken.deleteMany();
  await prisma.auditLog.deleteMany();
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
