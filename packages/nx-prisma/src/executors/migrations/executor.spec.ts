import executor from './executor';
import { PrismaMigrateSchema } from './schema';

const options: PrismaMigrateSchema = {
  schema: 'packages/nx-prisma/tests/schema.prisma',
};

export const migrationsSuite = () =>
  describe('Migrations Executor', () => {
    it('can run', async () => {
      const output = await executor(options);
      expect(output.success).toBe(true);
    });
  });
