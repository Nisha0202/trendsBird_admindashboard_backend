import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { prisma } from '../../config/prisma';
import { supabaseAdmin } from '../../config/supabase';
import { env } from '../../config/env';
import { ApiError } from '../../common/ApiError';
import { ListMediaQuery, UpdateMediaInput } from './media.schema';
import { Prisma } from '@prisma/client';
const THUMBNAIL_WIDTH = 300;

async function uploadBuffer(path: string, buffer: Buffer, contentType: string): Promise<string> {
  const { error } = await supabaseAdmin.storage
    .from(env.supabase.mediaBucket)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) throw ApiError.internal(`Storage upload failed: ${error.message}`);

  const { data } = supabaseAdmin.storage.from(env.supabase.mediaBucket).getPublicUrl(path);
  return data.publicUrl;
}

async function deleteFromStorage(paths: string[]) {
  await supabaseAdmin.storage.from(env.supabase.mediaBucket).remove(paths);
}

export async function uploadSingleFile(file: Express.Multer.File, uploadedById: string) {
  const isImage = file.mimetype.startsWith('image/');
  const id = randomUUID();
  const ext = file.originalname.split('.').pop() ?? 'bin';
  const originalPath = `originals/${id}.${ext}`;

  let width: number | undefined;
  let height: number | undefined;
  let thumbnailUrl: string | undefined;

  if (isImage) {
    // Re-verify actual file content, not just the client-declared mimetype:
    // sharp throws if the buffer isn't a real, parseable image.
    let metadata;
    try {
      metadata = await sharp(file.buffer).metadata();
    } catch {
      throw ApiError.unprocessable('File content does not match a valid image');
    }
    width = metadata.width;
    height = metadata.height;

    const thumbnailBuffer = await sharp(file.buffer)
      .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
      .toBuffer();
    const thumbPath = `thumbnails/${id}.${ext}`;
    thumbnailUrl = await uploadBuffer(thumbPath, thumbnailBuffer, file.mimetype);
  }

  const publicUrl = await uploadBuffer(originalPath, file.buffer, file.mimetype);

 return prisma.media.create({
  data: {
    fileName: file.originalname,
    storedPath: originalPath,
    publicUrl,
    mimeType: file.mimetype,
    type: isImage ? 'IMAGE' : 'VIDEO',
    size: file.size,
    width: width ?? null,
    height: height ?? null,
    thumbnailUrl: thumbnailUrl ?? null,
    uploadedById,
  },
});
}

export async function uploadFiles(files: Express.Multer.File[], uploadedById: string) {
  // Sequential, not Promise.all: keeps Supabase Storage calls from all
  // hitting rate limits at once on a bulk upload.
  const results = [];
  for (const file of files) {
    results.push(await uploadSingleFile(file, uploadedById));
  }
  return results;
}

export async function listMedia(query: ListMediaQuery) {
  // Coerce page and limit safely to numbers with fallback defaults
  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Number(query.limit) : 20;
  const search = query.search;
  const type = query.type;

  const where = {
    ...(type ? { type } : {}),
    ...(search
      ? {
          OR: [
            { fileName: { contains: search, mode: 'insensitive' as const } },
            { title: { contains: search, mode: 'insensitive' as const } },
            { altText: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [media, total] = await prisma.$transaction([
    prisma.media.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.media.count({ where }),
  ]);

  return { media, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function updateMedia(id: string, input: UpdateMediaInput) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) throw ApiError.notFound('Media not found');

  // Strip `undefined` properties or convert explicit nullables:
  const data: Prisma.MediaUpdateInput = {};
  
  if (input.title !== undefined) data.title = input.title;
  if (input.altText !== undefined) data.altText = input.altText;

  return prisma.media.update({ where: { id }, data });
}

export async function deleteMedia(id: string) {
  const media = await prisma.media.findUnique({
    where: { id },
    include: { _count: { select: { categories: true } } },
  });
  if (!media) throw ApiError.notFound('Media not found');

  // Design decision: REFUSE deletion while referenced anywhere, rather than
  // silently detaching — this guarantees no product/category is ever left
  // pointing at a missing file. Extend this check as Brand/Attribute/Product
  // start attaching media in later tasks.
  if (media._count.categories > 0) {
    throw ApiError.conflict(`Cannot delete: still attached to ${media._count.categories} categor(y/ies)`);
  }

  const pathsToRemove = [media.storedPath];
  if (media.thumbnailUrl) {
    const thumbPath = media.storedPath.replace('originals/', 'thumbnails/');
    pathsToRemove.push(thumbPath);
  }

  await deleteFromStorage(pathsToRemove);
  await prisma.media.delete({ where: { id } });

  return { deleted: true };
}