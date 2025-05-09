import { afterEach, beforeEach, describe, expect, jest, test, vi } from 'jest';

import { GET, POST } from './route';
import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { headers } from 'next/headers';

vi.mock('mongodb');
vi.mock('next/headers');
vi.mock('next/server');
describe('API Route - /api/routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET', () => {
    test('should return all routes on success', async () => {
      const mockFind = vi.fn().mockResolvedValue([{ _id: '1', name: 'Route 1' }, { _id: '2', name: 'Route 2' }]);
      const mockCollection = vi.fn().mockReturnValue({ find: mockFind });
      const mockDb = vi.fn().mockReturnValue({ collection: mockCollection } as any);
      const mockClient = { db: mockDb } as any;
      vi.spyOn(MongoClient, 'connect').mockResolvedValue(mockClient);
      vi.spyOn(NextResponse, "json").mockResolvedValue({message: "Database error"} as any);
      
      const response = await GET(new NextRequest(new URL('/api/routes', 'http://localhost')));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([{ _id: '1', name: 'Route 1' }, { _id: '2', name: 'Route 2' }]);
      expect(mockFind).toHaveBeenCalled();
      expect(mockCollection).toHaveBeenCalledWith('routes');
    });

    test('should return 500 on database error', async () => {
      vi.spyOn(MongoClient, 'connect').mockRejectedValue(new Error('Database error') as any);

      const response = await GET(new NextRequest(new URL('/api/routes', 'http://localhost')));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ message: 'Database error' });
    });

    test('should handle empty routes array', async () => {
        const mockFind = vi.fn().mockResolvedValue([]);
        const mockCollection = vi.fn().mockReturnValue({ find: mockFind });
        const mockDb = vi.fn().mockReturnValue({ collection: mockCollection } as any);
        const mockClient = { db: mockDb } as any;
        vi.spyOn(MongoClient, 'connect').mockResolvedValue(mockClient);
        vi.spyOn(NextResponse, "json").mockResolvedValue({message: "Database error"} as any);

        const response = await GET(new NextRequest(new URL('/api/routes', 'http://localhost')));
        const data = await response.json();
  
        expect(response.status).toBe(200);
        expect(data).toEqual([]);
        expect(mockFind).toHaveBeenCalled();
        expect(mockCollection).toHaveBeenCalledWith('routes');
    });
  });

  describe('POST', () => {
    test('should create a new route on success', async () => {
      const mockInsertOne = vi.fn().mockResolvedValue({ insertedId: 'newRouteId' });
      const mockCollection = vi.fn().mockReturnValue({ insertOne: mockInsertOne });
      const mockDb = vi.fn().mockReturnValue({ collection: mockCollection } as any);
      const mockClient = { db: mockDb } as any;
      vi.spyOn(MongoClient, 'connect').mockResolvedValue(mockClient);
      vi.spyOn(NextResponse, "json").mockResolvedValue({message: "Database error"} as any);

      const mockHeaders = { get: vi.fn() }
      vi.spyOn(headers, 'default').mockReturnValue(mockHeaders as any);
      const request = new NextRequest(new URL('/api/routes', 'http://localhost'), {
        method: 'POST',
        body: JSON.stringify({ name: 'New Route', start: {lat: 1, lng: 2}, end: {lat: 3, lng: 4}, stops: [] }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual({ _id: 'newRouteId' });
      expect(mockInsertOne).toHaveBeenCalledWith({ name: 'New Route', start: {lat: 1, lng: 2}, end: {lat: 3, lng: 4}, stops: [] });
      expect(mockCollection).toHaveBeenCalledWith('routes');
    });

    test('should return 400 if request body is invalid', async () => {
      const request = new NextRequest(new URL('/api/routes', 'http://localhost'), {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ message: 'Invalid request body' });
    });

    test('should return 500 on database error', async () => {
      vi.spyOn(MongoClient, 'connect').mockRejectedValue(new Error('Database error') as any);
      vi.spyOn(NextResponse, "json").mockResolvedValue({message: "Database error"} as any);
      const mockHeaders = { get: vi.fn() }
      vi.spyOn(headers, 'default').mockReturnValue(mockHeaders as any);
      const request = new NextRequest(new URL('/api/routes', 'http://localhost'), {
        method: 'POST',
        body: JSON.stringify({ name: 'New Route', start: {lat: 1, lng: 2}, end: {lat: 3, lng: 4}, stops: [] }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ message: 'Database error' });
    });

    test('should return 400 if name is missing', async () => {
      const mockHeaders = { get: vi.fn() }
      vi.spyOn(headers, 'default').mockReturnValue(mockHeaders as any);
      const request = new NextRequest(new URL('/api/routes', 'http://localhost'), {
        method: 'POST',
        body: JSON.stringify({ start: {lat: 1, lng: 2}, end: {lat: 3, lng: 4}, stops: [] }),
      });
      const response = await POST(request);
      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data).toEqual({ message: 'Invalid request body' });
    });
  });
});