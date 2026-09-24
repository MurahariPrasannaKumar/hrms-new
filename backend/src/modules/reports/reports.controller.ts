import type { Request, Response } from 'express';
import { toCsv } from '../../utils/csv';
import { ok } from '../../utils/http';
import { audit } from '../../utils/audit';
import { reportsService } from './reports.service';
import type { ReportQuery } from './reports.validation';

export const reportsController = {
  async run(req: Request, res: Response) {
    const q = req.query as unknown as ReportQuery;
    const type = req.params.type;
    const { rows, note } = await reportsService.run(req, type, q);
    if (q.format === 'csv') {
      await audit(req, { action: 'EXPORT', resource: 'REPORT', metadata: { type } });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
      return void res.send(toCsv(rows));
    }
    ok(res, { type, rows, ...(note ? { note } : {}) }, 'Success', 200, { total: rows.length });
  },
};
