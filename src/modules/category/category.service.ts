import slugify from 'slugify';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../common/ApiError';
import { CreateCategoryInput, UpdateCategoryInput } from './category.schema';

async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name, { lower: true, strict: true });
  let slug = base;
  let counter = 1;

  while (
    await prisma.category.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) } })
  ) {
    slug = `${base}-${counter++}`;
  }
  return slug;
}

/** Walks up the ancestor chain from `parentId`; throws if it ever reaches `categoryId`. */
async function assertNoCycle(categoryId: string, parentId: string) {
  let currentId: string | null = parentId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === categoryId) {
      throw ApiError.badRequest('A category cannot become its own ancestor');
    }
    if (visited.has(currentId)) break; // safety net against pre-existing corrupt data
    visited.add(currentId);

    const parent: { parentId: string | null } | null = await prisma.category.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    currentId = parent?.parentId ?? null;
  }
}

export async function createCategory(input: CreateCategoryInput) {
  if (input.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: input.parentId } });
    if (!parent) throw ApiError.badRequest('parentId does not reference an existing category');
  }

  const slug = await uniqueSlug(input.name);

 return prisma.category.create({
    data: {
      name: input.name,
      slug,
      ...(input.description !== undefined && { description: input.description }),
      ...(input.imageId !== undefined && { imageId: input.imageId }),
      ...(input.parentId !== undefined && { parentId: input.parentId }),
      ...(input.active !== undefined && { active: input.active }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    },
  });
}

export async function getCategoryTree() {
  const all = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { image: true },
  });

  type Node = (typeof all)[number] & { children: Node[] };
  const byId = new Map<string, Node>(all.map((c) => [c.id, { ...c, children: [] }]));
  const roots: Node[] = [];

  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function getCategoryById(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { image: true, parent: true, children: true },
  });
  if (!category) throw ApiError.notFound('Category not found');
  return category;
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw ApiError.notFound('Category not found');

  if (input.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: input.parentId } });
    if (!parent) throw ApiError.badRequest('parentId does not reference an existing category');
    await assertNoCycle(id, input.parentId);
  }

  const slug = input.name ? await uniqueSlug(input.name, id) : undefined;

 return prisma.category.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(slug && { slug }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.imageId !== undefined && { imageId: input.imageId }),
      ...(input.parentId !== undefined && { parentId: input.parentId }),
      ...(input.active !== undefined && { active: input.active }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    },
  });
}

export async function deleteCategory(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { children: true } } },
  });
  if (!category) throw ApiError.notFound('Category not found');

  // Design decision: REFUSE deletion while children exist, matching the
  // "refuse, or reassign" choice made for Media above — consistent behaviour
  // across the catalog modules. (Product-reference check will be added in
  // task 20 once ProductCategory exists.)
  if (category._count.children > 0) {
    throw ApiError.conflict(`Cannot delete: category still has ${category._count.children} child(ren)`);
  }

  await prisma.category.delete({ where: { id } });
  return { deleted: true };
}