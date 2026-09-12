import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedProcedure, router } from './trpc.js';

function normalizeSteps(steps: unknown) {
  if (!Array.isArray(steps)) {
    return [] as string[];
  }

  return steps.filter((step): step is string => typeof step === 'string');
}

export const recipesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const recipes = await ctx.prisma.recipe.findMany({
      orderBy: { title: 'asc' },
    });

    return recipes.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      description: recipe.description,
      image: recipe.image,
    }));
  }),
  getById: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const recipe = await ctx.prisma.recipe.findUnique({
        where: { id: input.id },
      });

      if (!recipe) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Recipe not found.' });
      }

      return {
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        image: recipe.image,
        steps: normalizeSteps(recipe.steps),
      };
    }),
});
