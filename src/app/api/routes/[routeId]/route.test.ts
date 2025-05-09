import { test, expect, describe, vi, beforeEach } from 'jest';
import { GET, DELETE, PATCH } from './route';
import { NextRequest, NextResponse } from 'next/server';
import { NextApiRequest, NextApiResponse } from 'next';
import { Route } from '@/lib/models/Route';
import { getRouteById, deleteRoute, updateRoute } from '@/lib/mongodb';

vi.mock('@/lib/mongodb', () => ({
  getRouteById: vi.fn(),
  deleteRoute: vi.fn(),
  updateRoute: vi.fn(),
}));

describe('API Routes - /api/routes/[routeId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    test('should return 200 with route data when route exists', async () => {
      const mockRoute: Route  = {
        _id: '1',
        userId: 'user1',
        name: 'Test Route',
        waypoints: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      
        const mockRouteResult: Route = {
        _id: '1',
        userId: 'user1',
        name: 'Test Route',
        waypoints: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (getRouteById as vi.Mock).mockResolvedValue(mockRouteResult);

      const req = {
        nextUrl: {
          pathname: '/api/routes/1',
        },
      } as unknown as NextRequest;

      const res = await GET(req, { params: { routeId: '1' } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual(mockRouteResult);
      expect(getRouteById).toHaveBeenCalledWith('1');
    });

    test('should return 404 when route does not exist', async () => {
      (getRouteById as vi.Mock).mockResolvedValue(null);

      const req = {
        nextUrl: {
          pathname: '/api/routes/1',
        },
      } as unknown as NextRequest;

      const res = await GET(req, { params: { routeId: '1' } });

      expect(res.status).toBe(404);
      expect(getRouteById).toHaveBeenCalledWith('1');
    });

    test('should return 500 on error', async () => {
      (getRouteById as vi.Mock).mockRejectedValue(new Error('Database error'));

      const req = {
        nextUrl: {
          pathname: '/api/routes/1',
        },
      } as unknown as NextRequest;

      const res = await GET(req, { params: { routeId: '1' } });

      expect(res.status).toBe(500);
      expect(getRouteById).toHaveBeenCalledWith('1');
    });
  });

  describe('DELETE', () => {
    test('should return 200 when route is successfully deleted', async () => {
      (deleteRoute as vi.Mock).mockResolvedValue(true);

      const req = {
        nextUrl: {
          pathname: '/api/routes/1',
        },
      } as unknown as NextRequest;

      const res = await DELETE(req, { params: { routeId: '1' } });

      expect(res.status).toBe(200);
      expect(deleteRoute).toHaveBeenCalledWith('1');
    });

    test('should return 404 if routeId is not found', async () => {
        (deleteRoute as vi.Mock).mockResolvedValue(false);

        const req = {
            nextUrl: {
              pathname: '/api/routes/1',
            },
          } as unknown as NextRequest;
    
          const res = await DELETE(req, { params: { routeId: '1' } });
    
          expect(res.status).toBe(404);
          expect(deleteRoute).toHaveBeenCalledWith('1');
      });

    test('should return 500 on error', async () => {
      (deleteRoute as vi.Mock).mockRejectedValue(new Error('Database error'));
    
      const req = {
        nextUrl: {
          pathname: '/api/routes/1',
        },
      } as unknown as NextRequest;

      const res = await DELETE(req, { params: { routeId: '1' } });

      expect(res.status).toBe(500);
      expect(deleteRoute).toHaveBeenCalledWith('1');
    });
  });

  describe('PATCH', () => {
    test('should return 200 with updated route data on successful update', async () => {
      const updatedRouteData = { name: 'Updated Test Route', };
      const mockRoute: Route  = {
            _id: '1',
            userId: 'user1',
            name: 'Updated Test Route',
            waypoints: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          
      };
      (updateRoute as vi.Mock).mockResolvedValue(mockRoute);
      const mockJson = vi.fn().mockResolvedValue(updatedRouteData);

      const req = {
        json: mockJson,
        nextUrl: {
          pathname: '/api/routes/1',
        },
      } as unknown as NextRequest;

      const res = await PATCH(req, { params: { routeId: '1' } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual(mockRoute);
      expect(updateRoute).toHaveBeenCalledWith('1', updatedRouteData);
    });

    test('should return 400 if no request body is provided', async () => {
        const mockJson = vi.fn().mockRejectedValue(new Error('No request body provided'));
        const req = {
          json: mockJson,
            nextUrl: {
              pathname: '/api/routes/1',
            },
          } as unknown as NextRequest;
    
          const res = await PATCH(req, { params: { routeId: '1' } });
    
          expect(res.status).toBe(400);
    });

    test('should return 404 if no route is updated', async () => {
        const mockJson = vi.fn().mockResolvedValue({name: 'Updated Test Route',});

        (updateRoute as vi.Mock).mockResolvedValue(null);

        const req = {
           json: mockJson,
          nextUrl: {
              pathname: '/api/routes/1',
            },
          } as unknown as NextRequest;
    
          const res = await PATCH(req, { params: { routeId: '1' } });
    
          expect(res.status).toBe(404);
    });

    test('should return 500 on error', async () => {
        const mockJson = vi.fn().mockResolvedValue({name: 'Updated Test Route',});
      (updateRoute as vi.Mock).mockRejectedValue(new Error('Database error'));

      const req = {
        json: mockJson,
        nextUrl: {
          pathname: '/api/routes/1',
        },
      } as unknown as NextRequest;

      const res = await PATCH(req, { params: { routeId: '1' } });

      expect(res.status).toBe(500);
      expect(updateRoute).toHaveBeenCalled();
    });
  });
});
