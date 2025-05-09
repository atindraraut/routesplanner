import { NextRequest, NextResponse } from 'next/server';
import { POST } from './route';
import { File } from 'buffer';
import { jest } from '@jest/globals';

jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(),
  },
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mocked-uuid'),
}));

describe('POST /api/photos/upload', () => {
  const mockWriteFile = require('fs').promises.writeFile as jest.Mock<any, any>;
  const mockUuid = require('uuid').v4 as jest.Mock<any, any>;
  
  beforeEach(() => {
    mockWriteFile.mockClear();
    mockUuid.mockClear();
  });

  it('should successfully upload a photo', async () => {
    const mockFormData = new FormData();
    const mockFile = new File(['dummy data'], 'test.jpg', { type: 'image/jpeg' });
    mockFormData.append('file', mockFile);

    const mockRequest = {
      formData: jest.fn().mockResolvedValue(mockFormData),
    } as unknown as NextRequest;

    mockWriteFile.mockResolvedValue(undefined);
    const response = await POST(mockRequest);
    
    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody.path).toBe('/uploads/mocked-uuid.jpg');
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('/uploads/mocked-uuid.jpg'),
      expect.any(Buffer)
    );
  });

  it('should return 400 if no file is provided', async () => {
    const mockFormData = new FormData();
    const mockRequest = {
      formData: jest.fn().mockResolvedValue(mockFormData),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody.error).toBe('No file provided');
  });
  
  it('should return 500 if writeFile fails', async () => {
    const mockFormData = new FormData();
    const mockFile = new File(['dummy data'], 'test.jpg', { type: 'image/jpeg' });
    mockFormData.append('file', mockFile);

    const mockRequest = {
      formData: jest.fn().mockResolvedValue(mockFormData),
    } as unknown as NextRequest;
    mockWriteFile.mockRejectedValue(new Error('Mocked writeFile error'));

    const response = await POST(mockRequest);
    expect(response.status).toBe(500);
    const responseBody = await response.json();
    expect(responseBody.error).toBe('Failed to save photo: Error: Mocked writeFile error');
  });

  it('should return 400 if the file is not an image', async () => {
    const mockFormData = new FormData();
    const mockFile = new File(['dummy data'], 'test.txt', { type: 'text/plain' });
    mockFormData.append('file', mockFile);

    const mockRequest = {
      formData: jest.fn().mockResolvedValue(mockFormData),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);
    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody.error).toBe('Invalid file type. Only images are allowed.');
  });

  it('should handle errors during formData parsing', async () => {
      const mockRequest = {
        formData: jest.fn().mockRejectedValue(new Error('FormData parsing error')),
      } as unknown as NextRequest;
  
      const response = await POST(mockRequest);
      expect(response.status).toBe(500);
      const responseBody = await response.json();
      expect(responseBody.error).toBe('Error parsing form data: Error: FormData parsing error');
    });
});