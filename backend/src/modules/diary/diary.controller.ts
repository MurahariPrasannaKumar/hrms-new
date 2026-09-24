import type { Request, Response } from 'express';
import { ok } from '../../utils/http';
import { assignmentsService as a, diaryService as d } from './diary.service';

export const diaryController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await d.list(req, req.query as never);
    ok(res, items, 'Success', 200, meta);
  },
  async get(req: Request, res: Response) {
    ok(res, await d.get(req, req.params.id));
  },
  async complete(req: Request, res: Response) {
    ok(res, await d.setCompleted(req, req.params.id, true), 'Marked as done');
  },
  async uncomplete(req: Request, res: Response) {
    ok(res, await d.setCompleted(req, req.params.id, false), 'Marked as not done');
  },
  async create(req: Request, res: Response) {
    ok(res, await d.create(req, req.body), 'Diary entry created', 201);
  },
  async update(req: Request, res: Response) {
    ok(res, await d.update(req, req.params.id, req.body), 'Diary entry updated');
  },
  async remove(req: Request, res: Response) {
    await d.remove(req, req.params.id);
    ok(res, null, 'Diary entry deleted');
  },
};

export const assignmentsController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await a.list(req, req.query as never);
    ok(res, items, 'Success', 200, meta);
  },
  async get(req: Request, res: Response) {
    ok(res, await a.get(req, req.params.id));
  },
  async create(req: Request, res: Response) {
    ok(res, await a.create(req, req.body), 'Assignment created', 201);
  },
  async update(req: Request, res: Response) {
    ok(res, await a.update(req, req.params.id, req.body), 'Assignment updated');
  },
  async remove(req: Request, res: Response) {
    await a.remove(req, req.params.id);
    ok(res, null, 'Assignment deleted');
  },
  async submit(req: Request, res: Response) {
    ok(res, await a.submit(req, req.params.id, req.body), 'Submission saved', 201);
  },
  async submissions(req: Request, res: Response) {
    ok(res, await a.listSubmissions(req, req.params.id));
  },
  async grade(req: Request, res: Response) {
    ok(res, await a.grade(req, req.params.id, req.params.submissionId, req.body.marks), 'Submission graded');
  },
};
