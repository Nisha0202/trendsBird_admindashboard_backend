import slugify from 'slugify';
import { Prisma, StockStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../common/ApiError';
import {
    CreateProductInput, UpdateProductInput, AddVariantInput, ListProductsQuery,
    AttachMediaInput, GenerateCombinationsInput,
} from './product.schema';

function toSlug(text: string): string {
    return slugify(text, { lower: true, strict: true });
}

async function uniqueProductSlug(name: string, excludeId?: string): Promise<string> {
    const base = toSlug(name);
    let slug = base;
    let counter = 1;
    while (await prisma.product.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) } })) {
        slug = `${base}-${counter++}`;
    }
    return slug;
}

function deriveSimpleStockStatus(
    stock: number,
    lowStockThreshold?: number | null
): StockStatus {

    if (stock <= 0) return 'OUT_OF_STOCK';

    if (
        lowStockThreshold != null &&
        stock <= lowStockThreshold
    )
        return 'LOW_STOCK';

    return 'IN_STOCK';
}

function deriveVariantStockStatus(stock: number, lowStockThreshold?: number | null): StockStatus {
    if (stock <= 0) return 'OUT_OF_STOCK';
    if (lowStockThreshold != null && stock <= lowStockThreshold) return 'LOW_STOCK';
    return 'IN_STOCK';
}

function combinationHashOf(attributeValueIds: string[]): string {
    return [...attributeValueIds].sort().join(':');
}

/** Cartesian product of attribute-value groups, e.g. [[R,B],[S,M]] -> [[R,S],[R,M],[B,S],[B,M]] */
function cartesianProduct(groups: string[][]): string[][] {
    return groups.reduce<string[][]>(
        (acc, group) => acc.flatMap((combo) => group.map((value) => [...combo, value])),
        [[]]
    );
}

export async function generateCombinations(input: GenerateCombinationsInput) {
    const combos = cartesianProduct(input.attributeValueGroups);
    const valueIds = [...new Set(combos.flat())];
    const values = await prisma.attributeValue.findMany({
        where: { id: { in: valueIds } },
        include: { attribute: true },
    });
    const byId = new Map(values.map((v) => [v.id, v]));

    return combos.map((combo) => ({
        attributeValueIds: combo,
        labels: combo.map((id) => {
            const v = byId.get(id);
            return v ? `${v.attribute.name}: ${v.value}` : id;
        }),
    }));
}

export async function createProduct(input: CreateProductInput) {
    if (input.brandId) {
        const brand = await prisma.brand.findUnique({ where: { id: input.brandId } });
        if (!brand) throw ApiError.badRequest('brandId does not reference an existing brand');
    }

    if (input.categoryIds?.length) {
        const found = await prisma.category.findMany({ where: { id: { in: input.categoryIds } } });
        if (found.length !== input.categoryIds.length) throw ApiError.badRequest('One or more categoryIds do not exist');
    }

    const slug = await uniqueProductSlug(input.name);

    // Everything below runs in ONE transaction: if variant validation fails
    // partway through, no half-built product survives (Section 5.9 requirement).
    return prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
            data: {
                name: input.name,
                slug,
                sku: input.hasVariants ? null : (input.sku ?? null),
                shortDescription: input.shortDescription ?? null,
                longDescription: input.longDescription ?? null,
                hasVariants: input.hasVariants,
                price: input.hasVariants ? null : (input.price ?? null),
                salePrice: input.hasVariants ? null : (input.salePrice ?? null),
                stock: input.hasVariants ? null : (input.stock ?? null),

                lowStockThreshold: input.hasVariants
                    ? null
                    : (input.lowStockThreshold ?? null),

                stockStatus: input.hasVariants
                    ? null
                    : deriveSimpleStockStatus(
                        input.stock ?? 0,
                        input.lowStockThreshold
                    ),



                weight: input.weight ?? null,
                active: input.active,
                featured: input.featured,
                sortOrder: input.sortOrder,
                brandId: input.brandId ?? null,
            },
        });

        if (input.categoryIds?.length) {
            await tx.productCategory.createMany({
                data: input.categoryIds.map((categoryId) => ({ productId: product.id, categoryId })),
            });
        }

        // Map "targetRef" (variant SKU used in THIS payload) -> real variant id,
        // filled in as variants are created below, so media can reference a
        // variant that doesn't have a DB id yet at payload-construction time.
        const variantIdBySku = new Map<string, string>();

        if (input.hasVariants && input.variants?.length) {
            const seenHashes = new Set<string>();

            for (const v of input.variants) {
                const foundValues = await tx.attributeValue.findMany({ where: { id: { in: v.attributeValueIds } } });
                if (foundValues.length !== v.attributeValueIds.length) {
                    throw ApiError.badRequest(`Variant "${v.sku}" references an attribute value that does not exist`);
                }

                const hash = combinationHashOf(v.attributeValueIds);
                if (seenHashes.has(hash)) {
                    throw ApiError.conflict(`Duplicate variant combination for SKU "${v.sku}" within this product`);
                }
                seenHashes.add(hash);

                const variant = await tx.productVariant.create({
                    data: {
                        productId: product.id,
                        sku: v.sku,
                        price: v.price,
                        salePrice: v.salePrice ?? null, // <-- Changed from v.salePrice
                        stock: v.stock,
                        stockStatus: deriveVariantStockStatus(v.stock, v.lowStockThreshold),
                        lowStockThreshold: v.lowStockThreshold ?? null, // <-- Changed from v.lowStockThreshold
                        weight: v.weight ?? null, // <-- Changed from v.weight
                        active: v.active,
                        combinationHash: hash,
                        attributeValues: {
                            create: v.attributeValueIds.map((attributeValueId) => ({ attributeValueId }))
                        },
                    },
                });
                variantIdBySku.set(v.sku, variant.id);
            }
        }

        if (input.media?.length) {
            let thumbnailAlreadySetForProduct = false;
            const thumbnailSetForVariant = new Set<string>();

            for (const m of input.media) {
                const media = await tx.media.findUnique({ where: { id: m.mediaId } });
                if (!media) throw ApiError.badRequest(`mediaId ${m.mediaId} does not exist`);

                let productId: string | null = null;
                let variantId: string | null = null;
                let attributeValueId: string | null = null;

                if (m.attachTo === 'product') {
                    productId = product.id;
                } else if (m.attachTo === 'variant') {
                    const vId = m.targetRef ? variantIdBySku.get(m.targetRef) : undefined;
                    if (!vId) throw ApiError.badRequest(`media targetRef "${m.targetRef}" does not match any variant SKU in this payload`);
                    variantId = vId;
                } else {
                    if (!m.targetRef) throw ApiError.badRequest('media attachTo=attributeValue requires targetRef (the attributeValueId)');
                    attributeValueId = m.targetRef;
                }

                let isThumbnail = m.isThumbnail;
                if (isThumbnail) {
                    // Never two thumbnails at once: demote the previous one (documented choice).
                    if (productId && thumbnailAlreadySetForProduct) isThumbnail = false;
                    if (variantId && thumbnailSetForVariant.has(variantId)) isThumbnail = false;
                    if (isThumbnail && productId) thumbnailAlreadySetForProduct = true;
                    if (isThumbnail && variantId) thumbnailSetForVariant.add(variantId);
                }

                await tx.productMedia.create({
                    data: {
                        mediaId: m.mediaId,
                        productId,
                        variantId,
                        attributeValueId,
                        isThumbnail,
                        isGallery: m.isGallery,
                        sortOrder: m.sortOrder,
                    },
                });
            }
        }

        return tx.product.findUnique({
            where: { id: product.id },
            include: fullProductInclude,
        });
    });
}

const fullProductInclude = {
    brand: true,
    categories: { include: { category: true } },
    media: { include: { media: true }, orderBy: { sortOrder: 'asc' as const } },
    variants: {
        include: {
            attributeValues: { include: { attributeValue: { include: { attribute: true } } } },
            media: { include: { media: true } },
        },
    },
};

export async function listProducts(query: ListProductsQuery) {

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const { search, categoryId, brandId, active, sortBy = 'createdAt', sortDir = 'desc' } = query;

    const where: Prisma.ProductWhereInput = {
        ...(brandId ? { brandId } : {}),
        ...(active !== undefined ? { active } : {}),
        ...(categoryId ? { categories: { some: { categoryId } } } : {}),
        ...(search
            ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }] }
            : {}),
    };

    const [products, total] = await prisma.$transaction([
        prisma.product.findMany({
            where,
            include: {
                brand: true,
                categories: { include: { category: true } },
                media: { where: { isThumbnail: true }, include: { media: true }, take: 1 },
                variants: { select: { price: true, salePrice: true } },
            },
            orderBy: { [sortBy]: sortDir },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.product.count({ where }),
    ]);

    const rows = products.map((p) => {
        let priceDisplay: string;
        if (p.hasVariants && p.variants.length) {
            const prices = p.variants.map((v) => Number(v.salePrice ?? v.price));
            priceDisplay = prices.length > 1 && Math.min(...prices) !== Math.max(...prices)
                ? `${Math.min(...prices)} – ${Math.max(...prices)}`
                : String(prices[0]);
        } else {
            priceDisplay = String(Number(p.salePrice ?? p.price ?? 0));
        }
        return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            sku: p.sku,
            thumbnail: p.media[0]?.media.thumbnailUrl ?? p.media[0]?.media.publicUrl ?? null,
            brand: p.brand ? { id: p.brand.id, name: p.brand.name } : null,
            categories: p.categories.map((c) => ({ id: c.category.id, name: c.category.name })),
            priceDisplay,
            active: p.active,
            hasVariants: p.hasVariants,
        };
    });

    return { products: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getProductById(id: string) {
    const product = await prisma.product.findUnique({ where: { id }, include: fullProductInclude });
    if (!product) throw ApiError.notFound('Product not found');
    return product;
}

export async function updateProduct(id: string, input: UpdateProductInput) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw ApiError.notFound('Product not found');

    if (!product.hasVariants) {
        const nextPrice = input.price ?? Number(product.price);
        const nextSale = input.salePrice ?? (product.salePrice ? Number(product.salePrice) : undefined);
        if (nextSale !== undefined && nextSale > nextPrice) {
            throw ApiError.badRequest('salePrice must not exceed price');
        }
    } else if (input.price !== undefined || input.salePrice !== undefined || input.stock !== undefined) {
        throw ApiError.badRequest('Cannot set price/salePrice/stock directly on a variable product — edit its variants instead');
    }

    if (input.brandId) {
        const brand = await prisma.brand.findUnique({ where: { id: input.brandId } });
        if (!brand) throw ApiError.badRequest('brandId does not reference an existing brand');
    }

    const slug = input.name ? await uniqueProductSlug(input.name, id) : undefined;


    return prisma.$transaction(async (tx) => {
    // 1. Update the product itself
    await tx.product.update({
        where: { id },
        data: {
            ...(
                !product.hasVariants &&
                input.lowStockThreshold !== undefined
                    ? {
                        lowStockThreshold: input.lowStockThreshold ?? null,
                    }
                    : {}
            ),

            ...(input.name && slug ? { name: input.name, slug } : {}),
            ...(input.shortDescription !== undefined
                ? { shortDescription: input.shortDescription ?? null }
                : {}),
            ...(input.longDescription !== undefined
                ? { longDescription: input.longDescription ?? null }
                : {}),
            ...(input.sku !== undefined ? { sku: input.sku ?? null } : {}),

            ...(!product.hasVariants && input.price !== undefined
                ? { price: input.price ?? null }
                : {}),

            ...(!product.hasVariants && input.salePrice !== undefined
                ? { salePrice: input.salePrice ?? null }
                : {}),

            ...(!product.hasVariants && input.stock !== undefined
                ? {
                      stock: input.stock ?? null,
                      stockStatus: deriveSimpleStockStatus(
                          input.stock,
                          input.lowStockThreshold ?? product.lowStockThreshold
                      ),
                  }
                : {}),

            ...(input.weight !== undefined ? { weight: input.weight ?? null } : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
            ...(input.featured !== undefined ? { featured: input.featured } : {}),
            ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
            ...(input.brandId !== undefined ? { brandId: input.brandId ?? null } : {}),
        },
    });

    // 2. Update categories
    if (input.categoryIds !== undefined) {
        await tx.productCategory.deleteMany({
            where: {
                productId: id,
            },
        });

        if (input.categoryIds.length > 0) {
            await tx.productCategory.createMany({
                data: input.categoryIds.map((categoryId) => ({
                    productId: id,
                    categoryId,
                })),
            });
        }
    }

     // 3. Update media
    if (input.media !== undefined) {

    await tx.productMedia.deleteMany({
        where: {
            productId: id,
        },
    });

    await tx.productMedia.createMany({
        data: input.media.map((m, index) => ({
            mediaId: m.mediaId,
            productId: id,
            isThumbnail: m.isThumbnail,
            isGallery: m.isGallery,
            sortOrder: index,
        })),
    });

}

    // 3. Return the updated product with categories
    return await tx.product.findUnique({
        where: { id },
        include: fullProductInclude,
    });
});
}

export async function deleteProduct(id: string) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw ApiError.notFound('Product not found');

    // Variants and ProductMedia rows cascade via the schema's onDelete:Cascade.
    // The underlying Media assets themselves are NOT deleted — other products
    // may still reference them (Section 5.9 requirement).
    await prisma.product.delete({ where: { id } });
    return { deleted: true };
}

export async function addVariant(productId: string, input: AddVariantInput) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw ApiError.notFound('Product not found');
    if (!product.hasVariants) throw ApiError.badRequest('Cannot add a variant to a simple product');

    const foundValues = await prisma.attributeValue.findMany({
        where: { id: { in: input.attributeValueIds } }
    });
    if (foundValues.length !== input.attributeValueIds.length) {
        throw ApiError.badRequest('One or more attributeValueIds do not exist');
    }

    const hash = combinationHashOf(input.attributeValueIds);

    return prisma.productVariant.create({
        data: {
            productId,
            sku: input.sku,
            price: input.price,
            salePrice: input.salePrice ?? null,
            stock: input.stock,
            stockStatus: deriveVariantStockStatus(input.stock, input.lowStockThreshold),
            lowStockThreshold: input.lowStockThreshold ?? null,
            weight: input.weight ?? null,
            active: input.active,
            combinationHash: hash,
            attributeValues: {
                create: input.attributeValueIds.map((attributeValueId) => ({ attributeValueId }))
            },
        },
        include: { attributeValues: { include: { attributeValue: true } } },
    });
}

export async function deleteVariant(productId: string, variantId: string) {
    const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId } });
    if (!variant) throw ApiError.notFound('Variant not found');
    await prisma.productVariant.delete({ where: { id: variantId } }); // cascades its ProductMedia rows
    return { deleted: true };
}

export async function attachMediaToProduct(productId: string, input: AttachMediaInput) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw ApiError.notFound('Product not found');

    const media = await prisma.media.findUnique({ where: { id: input.mediaId } });
    if (!media) throw ApiError.badRequest('mediaId does not reference existing media');

    return prisma.$transaction(async (tx) => {
        if (input.isThumbnail) {
            // Demote any existing product-level thumbnail — never two at once.
            await tx.productMedia.updateMany({ where: { productId, isThumbnail: true }, data: { isThumbnail: false } });
        }
        return tx.productMedia.create({
            data: {
                mediaId: input.mediaId,
                productId,
                isThumbnail: input.isThumbnail,
                isGallery: input.isGallery,
                sortOrder: input.sortOrder,
            },
            include: { media: true },
        });
    });
}

export async function detachMedia(productMediaId: string) {
    const pm = await prisma.productMedia.findUnique({ where: { id: productMediaId } });
    if (!pm) throw ApiError.notFound('Media attachment not found');
    await prisma.productMedia.delete({ where: { id: productMediaId } }); // only detaches; Media asset survives
    return { deleted: true };
}

export async function reorderGallery(productId: string, orderedProductMediaIds: string[]) {
    await prisma.$transaction(
        orderedProductMediaIds.map((pmId, index) =>
            prisma.productMedia.update({ where: { id: pmId }, data: { sortOrder: index } })
        )
    );
    return { reordered: true };
}