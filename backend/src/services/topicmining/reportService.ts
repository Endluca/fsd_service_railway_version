import { randomUUID } from 'crypto';
import prisma from '../../config/prisma';
import type {
  ReportEntity,
  ReportListItem,
  ReportPayload,
  SampleSelectionResult,
} from '../../types/topicmining/report';

export class ReportService {
  async createReport(payload: ReportPayload): Promise<ReportEntity> {
    const id = randomUUID();
    const samples: SampleSelectionResult = payload.selectedSamples || {
      parentSamples: {},
      childSamples: {},
    };

    const generatedAt = payload.generatedAt
      ? new Date(payload.generatedAt)
      : new Date();

    const report = await prisma.report.create({
      data: {
        id,
        title: payload.title,
        summary: payload.summary,
        statisticsJson: payload.statistics as any,
        samplesJson: samples as any,
        metadataJson: payload.metadata as any,
        generatedAt,
      },
    });

    return {
      id: report.id,
      title: report.title,
      summary: report.summary || undefined,
      statistics: report.statisticsJson as any,
      samples: report.samplesJson as any,
      metadata: (report.metadataJson as any) || undefined,
      generatedAt: report.generatedAt.toISOString(),
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    };
  }

  async listReports(): Promise<ReportListItem[]> {
    const reports = await prisma.report.findMany({
      select: {
        id: true,
        title: true,
        summary: true,
        generatedAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return reports.map((report) => ({
      id: report.id,
      title: report.title,
      summary: report.summary || undefined,
      generatedAt: report.generatedAt.toISOString(),
      createdAt: report.createdAt.toISOString(),
    }));
  }

  async getReportById(id: string): Promise<ReportEntity | null> {
    const report = await prisma.report.findUnique({
      where: { id },
    });

    if (!report) {
      return null;
    }

    return {
      id: report.id,
      title: report.title,
      summary: report.summary || undefined,
      statistics: report.statisticsJson as any,
      samples: report.samplesJson as any,
      metadata: (report.metadataJson as any) || undefined,
      generatedAt: report.generatedAt.toISOString(),
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    };
  }

  async deleteReport(id: string): Promise<boolean> {
    try {
      await prisma.report.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default new ReportService();
