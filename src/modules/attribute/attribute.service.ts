import slugify from 'slugify';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../common/ApiError';
import {
    CreateAttributeInput, UpdateAttributeInput, CreateValueInput, UpdateValueInput,
} from './attribute.schema';

function toSlug(text: string): string {
    return slugify(text, { lower: true, strict: true });
}

export async function createAttribute(input: CreateAttributeInput) {
    const existing = await prisma.attribute.findUnique({ where: { name: input.name } });
    if (existing) throw ApiError.conflict(`Attribute "${input.name}" already exists`);

    const slug = toSlug(input.name);

    return prisma.$transaction(async (tx) => {
        const attribute = await tx.attribute.create({ data: { name: input.name, slug, type: input.type } });

        if (input.values?.length) {
            for (const v of input.values) {
                const valueSlug = toSlug(v.value);
                const dup = await tx.attributeValue.findFirst({
                    where: { attributeId: attribute.id, OR: [{ value: v.value }, { slug: valueSlug }] },
                });
                if (dup) throw ApiError.conflict(`Value "${v.value}" already exists under this attribute`);

                await tx.attributeValue.create({
                    data: {
                        attributeId: attribute.id,
                        value: v.value,
                        slug: valueSlug,
                        ...(v.referenceValue ? { referenceValue: v.referenceValue } : {}),
                        ...(v.referenceMediaId ? { referenceMediaId: v.referenceMediaId } : {}),
                    },
                });
            }
        }

        return tx.attribute.findUnique({ where: { id: attribute.id }, include: { values: true } });
    });
}

export async function listAttributes() {
    return prisma.attribute.findMany({ include: { values: true }, orderBy: { name: 'asc' } });
}

export async function getAttributeById(id: string) {
    const attribute = await prisma.attribute.findUnique({ where: { id }, include: { values: true } });
    if (!attribute) throw ApiError.notFound('Attribute not found');
    return attribute;
}

export async function updateAttribute(id: string, input: UpdateAttributeInput) {
    const attribute = await prisma.attribute.findUnique({ where: { id } });
    if (!attribute) throw ApiError.notFound('Attribute not found');

    if (input.name && input.name !== attribute.name) {
        const conflict = await prisma.attribute.findUnique({ where: { name: input.name } });
        if (conflict) throw ApiError.conflict(`Attribute "${input.name}" already exists`);
    }

    return prisma.attribute.update({
        where: { id },
        data: {
            ...(input.name ? { name: input.name, slug: toSlug(input.name) } : {}),
            ...(input.type ? { type: input.type } : {}),
        },
        include: { values: true },
    });
}

export async function deleteAttribute(id: string) {
    const attribute = await prisma.attribute.findUnique({ where: { id }, include: { values: true } });
    if (!attribute) throw ApiError.notFound('Attribute not found');

    // Placeholder until task 20: real check is "no variant references any of
    // this attribute's values" via VariantAttributeValue. Wired in task 20.
    const usedByVariant = false;
    if (usedByVariant) {
        throw ApiError.conflict('Cannot delete: attribute is used by one or more product variants');
    }

    await prisma.attribute.delete({ where: { id } }); // cascades its values
    return { deleted: true };
}

export async function addValue(attributeId: string, input: CreateValueInput) {
    const attribute = await prisma.attribute.findUnique({ where: { id: attributeId } });
    if (!attribute) throw ApiError.notFound('Attribute not found');

    const valueSlug = toSlug(input.value);
    const dup = await prisma.attributeValue.findFirst({
        where: { attributeId, OR: [{ value: input.value }, { slug: valueSlug }] },
    });
    if (dup) throw ApiError.conflict(`Value "${input.value}" already exists under this attribute`);

    return prisma.attributeValue.create({
        data: {
            attributeId,
            value: input.value,
            slug: valueSlug,
            ...(input.referenceValue ? { referenceValue: input.referenceValue } : {}),
            ...(input.referenceMediaId ? { referenceMediaId: input.referenceMediaId } : {}),
        },
    });
}

export async function updateValue(attributeId: string, valueId: string, input: UpdateValueInput) {
    const value = await prisma.attributeValue.findFirst({ where: { id: valueId, attributeId } });
    if (!value) throw ApiError.notFound('Attribute value not found');

    if (input.value && input.value !== value.value) {
        const dup = await prisma.attributeValue.findFirst({
            where: { attributeId, id: { not: valueId }, OR: [{ value: input.value }, { slug: toSlug(input.value) }] },
        });
        if (dup) throw ApiError.conflict(`Value "${input.value}" already exists under this attribute`);
    }

    return prisma.attributeValue.update({
        where: { id: valueId },
        data: {
            ...(input.value ? { value: input.value, slug: toSlug(input.value) } : {}),
            ...(input.referenceValue !== undefined ? { referenceValue: input.referenceValue } : {}),
            ...(input.referenceMediaId !== undefined ? { referenceMediaId: input.referenceMediaId } : {}),
        },
    });
}

export async function deleteValue(attributeId: string, valueId: string) {
    const value = await prisma.attributeValue.findFirst({ where: { id: valueId, attributeId } });
    if (!value) throw ApiError.notFound('Attribute value not found');

    // Placeholder until task 20: check VariantAttributeValue usage.
    const usedByVariant = false;
    if (usedByVariant) {
        throw ApiError.conflict('Cannot delete: value is used by one or more product variants');
    }

    await prisma.attributeValue.delete({ where: { id: valueId } });
    return { deleted: true };
}