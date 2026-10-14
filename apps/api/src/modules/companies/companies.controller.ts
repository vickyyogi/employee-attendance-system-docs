import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../common/errors/app-error';
import { MembershipStatus, CompanyStatus } from '@prisma/client';
import type { ApiResponse } from '@attendance/api-contracts';

export class CompaniesController {
  async listUserCompanies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';

      const memberships = await prisma.companyMembership.findMany({
        where: {
          userId: req.user!.id,
          status: MembershipStatus.ACTIVE,
          company: {
            status: CompanyStatus.ACTIVE,
          },
        },
        include: {
          company: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      const companies = memberships.map((m) => ({
        id: m.company.id,
        name: m.company.name,
        slug: m.company.slug,
        timezone: m.company.timezone,
        role: m.role,
        membershipId: m.id,
      }));

      const response: ApiResponse<typeof companies> = {
        data: companies,
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async getCompanyById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId } = req.params;
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';

      // Tenant isolation: caller's active tenant must match requested companyId
      if (req.tenantContext?.companyId !== companyId) {
        throw new NotFoundError('Company not found');
      }

      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          name: true,
          slug: true,
          timezone: true,
          status: true,
          createdAt: true,
        },
      });

      if (!company) {
        throw new NotFoundError('Company not found');
      }

      const response: ApiResponse<typeof company> = {
        data: company,
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}

export const companiesController = new CompaniesController();
