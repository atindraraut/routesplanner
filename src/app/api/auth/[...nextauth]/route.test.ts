import { NextApiRequest, NextApiResponse } from 'next';
import { jest } from '@jest/globals'; // Correctly import NextApiRequest and NextApiResponse
import { getServerSession } from 'next-auth'; // Correctly import getServerSession
import { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth';
import { handler } from './route'; // Correctly import handler
import { GET } from './route';
jest.mock('next-auth'); // Correct jest.mock call

describe('Auth API Route', () => {
  let mockRequest: Partial<NextApiRequest>; // Correct type annotation
  let mockResponse: Partial<NextApiResponse>; // Correct type annotation
  let nextRequest:NextRequest;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      redirect: jest.fn(), //Added missing comma
    };
    (getServerSession as jest.Mock).mockReset();
  });

  it('should handle successful authentication', async () => {
    (getServerSession as jest.Mock).mockResolvedValueOnce({ user: { name: 'Test User' } }); // Correct mock implementation

    await handler(mockRequest as NextApiRequest, mockResponse as NextApiResponse); // Correct call to handler

    expect(getServerSession).toHaveBeenCalledWith(mockRequest, mockResponse, authOptions); // Correct call to expect
  });

  it('should handle unauthenticated user', async () => {
    (getServerSession as jest.Mock).mockResolvedValueOnce(null); // Correct mock implementation

    await handler(mockRequest as NextApiRequest, mockResponse as NextApiResponse); // Correct call to handler

    expect(getServerSession).toHaveBeenCalledWith(mockRequest, mockResponse, authOptions); // Correct call to expect
  });

  it('should handle unexpected error during authentication', async () => {
    const mockError = new Error('Test Error');
    (getServerSession as jest.Mock).mockRejectedValueOnce(mockError); // Correct mock implementation

    await handler(mockRequest as NextApiRequest, mockResponse as NextApiResponse); // Correct call to handler

    expect(getServerSession).toHaveBeenCalledWith(mockRequest, mockResponse, authOptions); // Correct call to expect
  });

  test('should return 500 on internal server error', async () => {
    // Mock getServerSession to throw an error
    (getServerSession as jest.Mock).mockRejectedValue(new Error('Mock server error'));

    const req = {
      nextUrl: {
        pathname: '/api/auth/session', // Simulate a session check request
      },
    } as unknown as NextRequest;

    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});