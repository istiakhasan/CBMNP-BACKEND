import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { PermissionService } from '../../modules/v1/permission/permission.service';

async function runSeed() {
  console.log('====================================================');
  console.log('🌱 Starting CBMNP ERP Permission Seeder...');
  console.log('====================================================');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const permissionService = app.get(PermissionService);
    const result = await permissionService.seedData();

    console.log('\n📊 Seeding Summary:');
    console.log(`- Predefined Target Permissions: ${result.totalPredefined}`);
    console.log(`- Already Present in DB:         ${result.alreadyExisting}`);
    console.log(`- Newly Inserted:                ${result.inserted}`);
    if (result.inserted > 0 && result.insertedLabels) {
      console.log(`- Newly Added Labels:            ${result.insertedLabels.join(', ')}`);
    }
    console.log(`- Status:                        ${result.message}`);
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Failed to run permission seed:', err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

runSeed().then(() => {
  console.log('✨ Seed process completed.');
  process.exit(0);
});
