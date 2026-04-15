import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildFlowMediaPath,
  buildMessageConfigForSave,
  normalizeMessageMediaConfig,
  uploadFlowNodeMedia,
  validateAttachmentCaption,
  validateFlowMediaFile,
} from '@/features/flow-media/uploadFlowNodeMedia'

const { uploadMock, getPublicUrlMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(() => Promise.resolve({ error: null })),
  getPublicUrlMock: vi.fn((path: string) => ({ data: { publicUrl: `https://storage.example/${path}` } })),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
        remove: vi.fn(() => Promise.resolve({ error: null })),
        list: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    },
  },
}))

function file(bytes: number[], name: string, type: string) {
  return new File([new Uint8Array(bytes)], name, { type })
}

describe('flow node media helper', () => {
  beforeEach(() => {
    uploadMock.mockClear()
    getPublicUrlMock.mockClear()
  })

  it('accepts valid image, video, and PDF files', async () => {
    await expect(validateFlowMediaFile(file([0xff, 0xd8, 0xff, 0x00], 'photo.jpg', 'image/jpeg'))).resolves.toMatchObject({ type: 'image' })
    await expect(validateFlowMediaFile(file([0x00, 0x00, 0x00], 'clip.mp4', 'video/mp4'))).resolves.toMatchObject({ type: 'video' })
    await expect(validateFlowMediaFile(file([0x25, 0x50, 0x44, 0x46], 'doc.pdf', 'application/pdf'))).resolves.toMatchObject({ type: 'document' })
  })

  it('rejects invalid MIME, extension mismatch, oversized files, and long captions', async () => {
    await expect(validateFlowMediaFile(file([1, 2, 3], 'bad.exe', 'application/x-msdownload'))).rejects.toThrow('Unsupported file type')
    await expect(validateFlowMediaFile(file([0xff, 0xd8, 0xff], 'photo.png', 'image/jpeg'))).rejects.toThrow('does not match')
    await expect(validateFlowMediaFile(new File([new Uint8Array(11 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' }))).rejects.toThrow('too large')
    expect(() => validateAttachmentCaption('x'.repeat(301))).toThrow('Caption')
  })

  it('builds owner/flow/node/random paths without original filenames', async () => {
    const path = buildFlowMediaPath({
      ownerId: 'owner-1',
      flowId: 'flow-1',
      nodeId: 'node-1',
      extension: 'jpg',
      randomId: 'random-id-123',
    })

    expect(path).toBe('owner-1/flows/flow-1/nodes/node-1/random-id-123.jpg')
    expect(path).not.toContain('photo')
  })

  it('uploads to chatbot-media and returns a normalized uploaded attachment', async () => {
    const attachment = await uploadFlowNodeMedia({
      ownerId: 'owner-1',
      flowId: 'flow-1',
      nodeId: 'node-1',
      file: file([0xff, 0xd8, 0xff, 0x00], 'photo.jpg', 'image/jpeg'),
    })

    expect(uploadMock).toHaveBeenCalledTimes(1)
    const [path] = uploadMock.mock.calls[0] as unknown as [string]
    expect(path).toMatch(/^owner-1\/flows\/flow-1\/nodes\/node-1\/.+\.jpg$/)
    expect(path).not.toContain('photo')
    expect(attachment).toMatchObject({
      type: 'image',
      source: 'upload',
      storage_path: path,
      url: `https://storage.example/${path}`,
    })
  })

  it('normalizes legacy media fields and writes only attachments/links', () => {
    const media = normalizeMessageMediaConfig({
      text: 'Hi',
      media_url: 'https://example.com/old.pdf',
      media_type: 'document',
      links: [{ url: 'https://youtube.com/watch?v=abc', label: 'Video' }],
    })

    expect(media.attachments[0]).toMatchObject({ type: 'document', url: 'https://example.com/old.pdf', source: 'url' })

    const saved = buildMessageConfigForSave({ text: 'Hi', media_url: 'old', media_type: 'image' }, media.attachments, media.links)
    expect(saved.media_url).toBeUndefined()
    expect(saved.media_type).toBeUndefined()
    expect(saved.attachments).toHaveLength(1)
    expect(saved.links).toHaveLength(1)
  })

  it('normalizes quick reply buttons when saving message config', () => {
    const saved = buildMessageConfigForSave({
      text: 'Pick one',
      buttons: [
        { id: 'b1', title: '  Pricing  ' },
        { id: 'b2', title: '' },
        { id: 'b3', title: 'Demo' },
        { id: 'b4', title: 'Support' },
        { id: 'b5', title: 'Overflow' },
      ],
    }, [], [])

    expect(saved.buttons).toEqual([
      { id: 'b1', title: 'Pricing' },
      { id: 'b3', title: 'Demo' },
      { id: 'b4', title: 'Support' },
    ])
  })
})
