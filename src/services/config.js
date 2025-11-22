import prisma from './prismaClient.js';

export async function getGlobalRadiusKm(defaultValue = 5) {
    const config = await prisma.appConfig.findUnique({
        where: { key: 'search_radius_km' },
        select: { value: true },
    });

    if (!config || !config.value) return defaultValue;

    const parsed = parseFloat(config.value);
    return Number.isNaN(parsed) ? defaultValue : parsed;
}