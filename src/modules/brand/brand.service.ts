import slugify from 'slugify';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../common/ApiError';
import { CreateBrandInput, UpdateBrandInput, ListBrandsQuery } from './brand.schema';

async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name, { lower: true, strict: true });
  let slug = base;
  let counter = 1;
  while (await prisma.brand.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) } })) {
    slug = `${base}-${counter++}`;
  }
  return slug;
}

export async function createBrand(input: CreateBrandInput) {
  const existing = await prisma.brand.findUnique({ where: { name: input.name } });
  if (existing) throw ApiError.conflict(`Brand "${input.name}" already exists`);

  const slug = await uniqueSlug(input.name);

 return prisma.brand.create({
    data: {
      name: input.name,
      slug,
      status: input.status,
      ...(input.logoId ? { logoId: input.logoId } : {}),
      ...(input.description ? { description: input.description } : {}),
    },
  });
}

// export async function listBrands(query: ListBrandsQuery) {
//   const { search, status, page, limit } = query;

//   const where = {
//     ...(status !== undefined ? { status } : {}),
//     ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
//   };

//   const [brands, total] = await prisma.$transaction([
//     prisma.brand.findMany({
//       where,
//       include: { logo: true, _count: { select: { products: true } } },
//       orderBy: { name: 'asc' },
//       skip: (page - 1) * limit,
//       take: limit,
//     }),
//     prisma.brand.count({ where }),
//   ]);

//   return { brands, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
// }


export async function getBrandById(id: string) {
  const brand = await prisma.brand.findUnique({ where: { id }, include: { logo: true } });
  if (!brand) throw ApiError.notFound('Brand not found');
  return brand;
}

export async function updateBrand(id: string, input: UpdateBrandInput) {
  const brand = await prisma.brand.findUnique({ where: { id } });
  if (!brand) throw ApiError.notFound('Brand not found');

  if (input.name && input.name !== brand.name) {
    const conflict = await prisma.brand.findUnique({ where: { name: input.name } });
    if (conflict) throw ApiError.conflict(`Brand "${input.name}" already exists`);
  }

  const slug = input.name ? await uniqueSlug(input.name, id) : undefined;

  return prisma.brand.update({
    where: { id },
    data: {
      ...(input.name && slug ? { name: input.name, slug } : {}),
      ...(input.logoId !== undefined ? { logoId: input.logoId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
  });
}

// export async function deleteBrand(id: string) {
//   const brand = await prisma.brand.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
//   if (!brand) throw ApiError.notFound('Brand not found');

//   if (brand._count.products > 0) {
//     throw ApiError.conflict(`Cannot delete: ${brand._count.products} product(s) still reference this brand`);
//   }

//   await prisma.brand.delete({ where: { id } });
//   return { deleted: true };
// }

// TEMPORARY until task 20 adds Product.brandId:
export async function deleteBrand(id: string) {
  const brand = await prisma.brand.findUnique({ where: { id } });
  if (!brand) throw ApiError.notFound('Brand not found');
  await prisma.brand.delete({ where: { id } });
  return { deleted: true };
}





export async function listBrands(query: ListBrandsQuery) {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;

  // Ensure status is explicitly converted to boolean if it arrives as string
  const status =
    typeof query.status === 'string'
      ? query.status === 'true'
      : query.status;

  const where = {
    ...(status !== undefined ? { status } : {}),
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
  };

  const [brands, total] = await prisma.$transaction([
    prisma.brand.findMany({
      where,
      include: { logo: true },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.brand.count({ where }),
  ]);

  return { brands, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

