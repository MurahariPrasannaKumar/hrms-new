import type { Request, Response } from 'express';
import { audit } from '../../utils/audit';
import { ok } from '../../utils/http';
import { learningService as s } from './learning.service';

const user = (req: Request) => req.user!;
const id = (req: Request) => req.params.id as string;

export const learningController = {
  async listCourses(req: Request, res: Response) {
    const { items, meta } = await s.listCourses(user(req), req.query as never);
    ok(res, items, 'Success', 200, meta);
  },
  async getCourse(req: Request, res: Response) {
    ok(res, await s.getCourse(user(req), id(req)));
  },
  async createCourse(req: Request, res: Response) {
    const course = await s.createCourse(user(req), req.body);
    await audit(req, { action: 'CREATE', resource: 'COURSE', resourceId: course.id, schoolId: course.schoolId });
    ok(res, course, 'Course created', 201);
  },
  async updateCourse(req: Request, res: Response) {
    const course = await s.updateCourse(user(req), id(req), req.body);
    await audit(req, { action: 'UPDATE', resource: 'COURSE', resourceId: course.id, schoolId: course.schoolId });
    ok(res, course, 'Course updated');
  },
  async deleteCourse(req: Request, res: Response) {
    const course = await s.deleteCourse(user(req), id(req));
    await audit(req, { action: 'DELETE', resource: 'COURSE', resourceId: course.id, schoolId: course.schoolId });
    ok(res, null, 'Course deleted');
  },
  async completeLesson(req: Request, res: Response) {
    ok(res, await s.completeLesson(user(req), id(req)), 'Lesson completed');
  },
  async progress(req: Request, res: Response) {
    ok(res, await s.progress(user(req)));
  },
  async certificates(req: Request, res: Response) {
    ok(res, await s.certificates(user(req)));
  },
  async listPaths(req: Request, res: Response) {
    ok(res, await s.listPaths(user(req)));
  },
  async createPath(req: Request, res: Response) {
    const path = await s.createPath(user(req), req.body);
    await audit(req, { action: 'CREATE', resource: 'LEARNING_PATH', resourceId: path.id, schoolId: path.schoolId });
    ok(res, path, 'Learning path created', 201);
  },
  async deletePath(req: Request, res: Response) {
    const path = await s.deletePath(user(req), id(req));
    await audit(req, { action: 'DELETE', resource: 'LEARNING_PATH', resourceId: path.id, schoolId: path.schoolId });
    ok(res, null, 'Learning path deleted');
  },
  async listResources(req: Request, res: Response) {
    const { items, meta } = await s.listResources(user(req), req.query as never);
    ok(res, items, 'Success', 200, meta);
  },
  async categories(req: Request, res: Response) {
    ok(res, await s.categories(user(req), req.query.area as string | undefined));
  },
  async getResource(req: Request, res: Response) {
    ok(res, await s.getResource(user(req), id(req)));
  },
  async createResource(req: Request, res: Response) {
    const r = await s.createResource(user(req), req.body);
    await audit(req, { action: 'CREATE', resource: 'LEARNING_RESOURCE', resourceId: r.id, schoolId: r.schoolId });
    ok(res, r, 'Resource created', 201);
  },
  async updateResource(req: Request, res: Response) {
    const r = await s.updateResource(user(req), id(req), req.body);
    await audit(req, { action: 'UPDATE', resource: 'LEARNING_RESOURCE', resourceId: r.id, schoolId: r.schoolId });
    ok(res, r, 'Resource updated');
  },
  async deleteResource(req: Request, res: Response) {
    const r = await s.deleteResource(user(req), id(req));
    await audit(req, { action: 'DELETE', resource: 'LEARNING_RESOURCE', resourceId: r.id, schoolId: r.schoolId });
    ok(res, null, 'Resource deleted');
  },
};
