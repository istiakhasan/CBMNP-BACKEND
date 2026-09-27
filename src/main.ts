import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ZodFilter } from './middleware/ZodFilter';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express'; //
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = new DocumentBuilder()
    .setTitle('CBMNP Backend API')
    .setDescription(
      'Complete source-derived API reference for the CBMNP ERP backend. The standard application route is /api/v1/{endpoint}. See docs/BACKEND_API.md for authentication, tenancy, request examples, uploads, and legacy-route exceptions.',
    )
    .setVersion('1.0')
    .addServer('/api', 'Current server, application prefix')
    // AuthGuard verifies the raw JWT supplied in the Authorization header; it
    // does not strip a "Bearer " prefix. Model it as an API key so Swagger's
    // Authorize action sends the value exactly as the backend expects.
    .addApiKey(
      { type: 'apiKey', name: 'Authorization', in: 'header' },
      'raw-jwt',
    )
    .addApiKey(
      { type: 'apiKey', name: 'x-organization-id', in: 'header' },
      'x-organization-id',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);

  // Most legacy controllers predate @ApiTags. Keep the UI useful without
  // changing their runtime routes: derive a stable module group from each path.
  const moduleTags: Record<string, string> = {
    accounting: 'Accounting',
    'activity-logs': 'Activity Logs',
    auth: 'Authentication',
    category: 'Product Catalogue',
    customers: 'Customers',
    dashboard: 'Dashboard',
    'delivery-partner': 'Delivery Partners',
    districts: 'Locations',
    divisions: 'Locations',
    'finance': 'Finance',
    garments: 'Garments',
    governance: 'Governance',
    'hr-payroll': 'HR & Payroll',
    inventory: 'Inventory',
    'inventory-operations': 'Inventory Operations',
    'logistics-operations': 'Logistics Operations',
    notifications: 'Notifications',
    orders: 'Orders',
    organization: 'Organizations',
    permission: 'Access Control',
    procurements: 'Procurement',
    products: 'Product Catalogue',
    'purchase-returns': 'Purchase Returns',
    requisition: 'Requisitions',
    'sales-operations': 'Sales Operations',
    'sfa-dms': 'SFA / DMS',
    status: 'Order Status',
    supplier: 'Suppliers',
    thana: 'Locations',
    transaction: 'Inventory Transactions',
    user: 'Users',
    userpermission: 'Access Control',
    warehouse: 'Warehouses',
    webhook: 'External Webhooks',
    chat: 'Chat',
  };
  for (const [path, pathItem] of Object.entries(document.paths)) {
    const parts = path.split('/').filter(Boolean);
    const moduleName = parts[0] === 'v1' || parts[0] === 'v2' ? parts[1] : parts[0];
    const tag = moduleTags[moduleName] || 'Other';
    for (const [httpMethod, operation] of Object.entries(pathItem as Record<string, any>)) {
      if (operation && typeof operation === 'object' && (!operation.tags || operation.tags.includes('default'))) {
        operation.tags = [tag];
      }

      // Legacy controllers frequently use `@Body() data: any`. Nest discovers
      // the route but cannot infer a Swagger schema from `any`, so Swagger UI
      // otherwise omits its request-body textarea. Keep those write operations
      // executable while their DTOs are progressively documented.
      if (['post', 'put', 'patch'].includes(httpMethod) && !operation.requestBody) {
        operation.requestBody = {
          required: false,
          description: 'Editable JSON payload. Use the operation-specific example when present; legacy endpoints accept fields defined by their controller/service.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
                example: {
                  name: 'Example name',
                  code: 'EXAMPLE-001',
                  status: 'active',
                },
              },
            },
          },
        };
      }
    }
  }
  SwaggerModule.setup('api-docs', app, document);
  app.use(
    express.json({
      // Biometric devices can send a backlog after an outage. Keep this bounded
      // while allowing a legitimate roster/attendance sync to reach the API.
      limit: process.env.REQUEST_BODY_LIMIT || '10mb',
      verify: (req: any, res, buf) => {
        req.rawBody = buf.toString();
      },
    }),
  );
  app.enableCors({
    origin: [
      'https://cbmnp-frontend-nu.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://31.97.60.104:3000',
      'http://193.203.160.33:3002',
      'https://erp.tabaya.com',
      'http://192.168.30.43:3000',
    ],
    methods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization  ',
      'Authentication',
      'Access-Control-Allow-Credentials',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Methods',
      'Access-Control-Allow-Origin',
      'User-Agent',
      'Referer',
      'Accept-Encoding',
      'Accept-Language',
      'Access-Control-Request-Headers',
      'Cache-Control',
      'Pragma',
      'x-organization-id',
    ],
  });

  app.useGlobalFilters(new ZodFilter());
  app.useGlobalPipes(new ValidationPipe());
  app.setGlobalPrefix('api');

  const PORT = Number(process.env.PORT) || 8080;
  await app.listen(PORT, '0.0.0.0');

  console.log(`🚀 Server is running at http://localhost:${PORT}`);
}

bootstrap();
